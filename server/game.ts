import { randomInt, randomUUID } from 'node:crypto'
import type { Server } from 'socket.io'
import { answerLabel, grade, hideAnswer, score, type Lesson, type Question } from '../shared/questions.ts'
import { STEAL_MIN_LEFT, STYLES, bombOver, hideWrong, pickBombs, rollDrop, stealAmount, type Power, type Style } from '../shared/powers.ts'
import { hwRooms, reports } from './db.ts'

export type Phase = 'lobby' | 'question' | 'reveal' | 'podium'
export type Mode = 'live' | 'homework'
type Result = { credit: number; gained: number; pick?: string } // pick: texto de lo que respondió (solo si falló; para el panel del profe)
type Player = {
  id: string; name: string; avatar: string; score: number; streak: number; online: boolean
  key?: string // secreta: solo la conoce el celular del jugador; el id es público (va en el ranking) y no basta para reconectarse
  // solo modo tarea: avance propio de cada estudiante
  pos: number // pregunta actual
  awaiting: boolean // ya respondió la actual y ve la retroalimentación
  results: Result[] // results[i] = resultado de la pregunta i (se llena en orden)
  // solo modo en vivo: poder guardado (máx. 1) y poder activado para la pregunta en curso
  power?: Power
  armed?: Power
  out?: number // papa caliente: pregunta en la que explotó (desde ahí, solo observa)
  lastAt?: number // tarea: última actividad (para ver quién lleva rato quieto)
}
type Answer = { value: unknown; at: number; credit: number } // credit: se califica al llegar, así el profe ve bien/mal EN VIVO

type Room = {
  pin: string
  lesson: Lesson
  mode: Mode
  closed: boolean // tarea cerrada por el profe: ya no se aceptan respuestas
  startedAt: number
  reportId?: string // id estable del reporte de esta sala (se actualiza en vez de duplicarse)
  touched: number
  phase: Phase
  index: number
  endsAt: number
  qStart: number // cuándo empezó la pregunta actual (endsAt cambia si el profe da más tiempo)
  players: Map<string, Player>
  answers: Map<string, Answer> // playerId -> respuesta de la pregunta actual
  gained: Map<string, number> // puntos ganados en la pregunta actual (para el reveal)
  credit: Map<string, number> // fracción 0..1 acertada (1 = perfecta, entre 0 y 1 = parcial)
  dist?: number[] // cuántos eligieron cada opción (solo tipos de opciones)
  timer?: NodeJS.Timeout
  // modo automático (en vivo): tras cada reveal avanza solo después de `pauseMs`
  style: Style // clásico, con poderes o papa caliente; se elige en el lobby
  bombs: Set<string> // papa caliente: quién tiene bomba en la pregunta actual. SECRETO: nunca viaja mientras se responde
  booms: string[] // explotaron en este reveal
  defused: string[] // tenían bomba y acertaron
  steals: Map<string, { from: string; amount: number; blocked?: boolean }> // robos de este reveal (ladrón -> víctima)
  hides: Map<string, number[]> // 50/50: opciones ocultas por jugador en la pregunta actual (viajan solo por su canal personal)
  drops: Map<string, Power> // poderes que cayeron en este reveal
  auto: boolean
  pauseMs: number
  autoAt: number
  autoTimer?: NodeJS.Timeout // también la cuenta de la tabla de posiciones
  boardUntil: number // fin de la tabla de posiciones (0 = no se está mostrando); sigue siendo phase 'reveal'
}

const BOARD_MS = 5000

const rooms = new Map<string, Room>()
let io: Server
// Sal secreta del barajado: con la semilla pública (id de la pregunta) se podía deshacer el barajado y deducir la respuesta.
const SALT = randomUUID()

const newRoom = (pin: string, lesson: Lesson, mode: Mode): Room => ({
  pin, lesson, mode, closed: false, startedAt: Date.now(), touched: Date.now(), phase: 'lobby', index: -1, endsAt: 0, qStart: 0,
  players: new Map(), answers: new Map(), gained: new Map(), credit: new Map(),
  style: 'powers', bombs: new Set(), booms: [], defused: [], steals: new Map(), hides: new Map(), drops: new Map(),
  auto: false, pauseMs: 8000, autoAt: 0, boardUntil: 0,
})

export function initGame(server: Server) {
  io = server
  // las tareas sobreviven a un reinicio del servidor (pueden durar horas o días)
  for (const [pin, body] of hwRooms.all()) {
    try {
      const b = JSON.parse(body)
      const r = newRoom(pin, b.lesson, 'homework')
      r.closed = b.closed
      r.startedAt = b.startedAt ?? r.startedAt
      r.reportId = b.reportId
      for (const p of b.players) r.players.set(p.id, { ...p, online: false })
      rooms.set(pin, r)
    } catch (e) {
      console.error(`[tarea ${pin}] no se pudo cargar, se omite`, e) // una fila dañada no debe impedir que arranque el servidor
    }
  }
}
export const getRoom = (pin: string) => rooms.get(pin)

/** Foto de resultados: una fila por estudiante, una columna por pregunta (null = no participó). */
export function reportOf(r: Room) {
  r.reportId ??= `${r.startedAt.toString(36)}-${r.pin}`
  const qs = r.lesson.questions
  return {
    id: r.reportId,
    at: r.startedAt,
    title: r.lesson.title,
    mode: r.mode,
    closed: r.mode === 'homework' ? r.closed : r.phase === 'podium',
    questions: qs.map((x) => ({ prompt: x.prompt, type: x.type })),
    players: [...r.players.values()]
      .sort((a, b) => b.score - a.score)
      .map((p) => ({ name: p.name, avatar: p.avatar, score: p.score, results: qs.map((_, i) => p.results[i]?.credit ?? null) })),
  }
}
function saveReport(r: Room) {
  const rep = reportOf(r)
  if (rep.players.some((p) => p.results.some((c) => c !== null))) reports.save(rep) // sin respuestas no hay nada que reportar
}

const persist = (r: Room) => {
  if (r.mode !== 'homework') return
  hwRooms.save(r.pin, JSON.stringify({ lesson: r.lesson, closed: r.closed, startedAt: r.startedAt, reportId: r.reportId, players: [...r.players.values()].map(({ online, ...p }) => p) }))
  saveReport(r) // la tarea queda en Reportes desde la primera respuesta y se va actualizando
}

export function createRoom(lesson: Lesson, mode: Mode = 'live'): string {
  // limpieza: partidas en vivo abandonadas hace más de 12 h
  for (const [k, v] of rooms) if (v.mode === 'live' && Date.now() - v.touched > 12 * 3600e3) closeRoom(k)
  let pin: string
  do pin = String(randomInt(100000, 1000000))
  while (rooms.has(pin))
  const r = newRoom(pin, lesson, mode)
  rooms.set(pin, r)
  persist(r)
  return pin
}

export const listRooms = () =>
  [...rooms.values()].map((r) => ({ pin: r.pin, title: r.lesson.title, mode: r.mode, players: r.players.size, closed: r.closed || r.phase === 'podium' }))

/** ¿Es una reconexión legítima? Hace falta el id Y la clave secreta (las tareas guardadas antes de existir la clave solo traen id). */
export function isReturning(r: Room, id: unknown, key: unknown) {
  const p = typeof id === 'string' ? r.players.get(id) : undefined
  return !!p && (p.key === undefined || p.key === key)
}

/** `id` solo si ya se comprobó con `isReturning`. */
export function addPlayer(room: Room, name: string, avatar: string, id?: string): Player | 'locked' {
  const back = id !== undefined && room.players.get(id)
  if (back) return ((back.key ??= randomUUID()), back) // reconexión
  if (room.mode === 'homework' ? room.closed : room.phase === 'podium') return 'locked' // en vivo: entrada tardía hasta el podio
  const p: Player = { id: randomUUID(), key: randomUUID(), name: name.slice(0, 20), avatar, score: 0, streak: 0, online: true, pos: 0, awaiting: false, results: [], lastAt: Date.now() }
  if (room.mode === 'live' && room.style === 'bomb' && room.index >= 0) p.out = room.index // papa caliente ya empezada: entra a observar
  room.players.set(p.id, p)
  persist(room)
  return p
}

const q = (r: Room): Question | undefined => r.lesson.questions[r.index]

/** Estado público (en vivo): nunca incluye la respuesta correcta mientras se responde. */
export function view(r: Room) {
  const cur = q(r)
  // papa caliente: primero los vivos, luego quien explotó más tarde; el puntaje desempata
  const alive = (p: Player) => (r.style === 'bomb' ? (p.out ?? Infinity) : 0)
  // solo lo público de cada jugador: nada de clave, poderes guardados/activados ni resultados (eso va por el canal personal, `me`)
  const leaderboard = [...r.players.values()]
    .sort((a, b) => alive(b) - alive(a) || b.score - a.score)
    .map(({ id, name, avatar, score, streak, online, out }) => ({ id, name, avatar, score, streak, online, out }))
  return {
    mode: 'live' as const,
    pin: r.pin,
    title: r.lesson.title,
    phase: r.phase,
    index: r.index,
    total: r.lesson.questions.length,
    // ms restantes (no un timestamp): el reloj del celular del estudiante no coincide con el del servidor
    leftMs: r.phase === 'question' ? Math.max(0, r.endsAt - Date.now()) : 0,
    question: cur && (r.phase === 'question' ? hideAnswer(cur, SALT) : cur),
    answered: r.answers.size,
    players: leaderboard,
    // en reveal/podio cada jugador ve cuánto ganó y si acertó
    gained: r.phase === 'reveal' ? Object.fromEntries(r.gained) : {},
    credit: r.phase === 'reveal' ? Object.fromEntries(r.credit) : {},
    dist: r.phase === 'reveal' ? r.dist : undefined,
    style: r.style,
    powers: r.style === 'powers',
    bombs: r.style === 'bomb' && r.phase === 'question' ? r.bombs.size : 0, // solo cuántas, nunca quién
    alive: [...r.players.values()].filter((p) => p.out === undefined).length,
    booms: r.phase === 'reveal' ? r.booms : [],
    defused: r.phase === 'reveal' ? r.defused : [],
    steals: r.phase === 'reveal' ? Object.fromEntries(r.steals) : {},
    drops: r.phase === 'reveal' ? Object.fromEntries(r.drops) : {},
    auto: r.auto,
    pauseMs: r.pauseMs,
    // ms restantes para pasar solos a la siguiente (como leftMs: relativo, no un timestamp)
    autoLeftMs: r.phase === 'reveal' && r.auto ? Math.max(0, r.autoAt - Date.now()) : 0,
    // ms restantes de la tabla de posiciones entre el reveal y la siguiente pregunta (0 = no se muestra)
    boardMs: r.phase === 'reveal' ? Math.max(0, r.boardUntil - Date.now()) : 0,
  }
}

// ---------- Modo tarea: cada estudiante avanza a su ritmo ----------

/** Vista personal: la solución solo aparece DESPUÉS de que el estudiante respondió esa pregunta. */
export function hwPlayerView(r: Room, p: Player) {
  const total = r.lesson.questions.length
  const stage = p.pos >= total || (r.closed && !p.awaiting) ? ('done' as const) : p.awaiting ? ('feedback' as const) : ('answer' as const)
  const cur = r.lesson.questions[p.pos]
  const answered = p.results.length
  return {
    mode: 'homework' as const,
    title: r.lesson.title,
    total, pos: p.pos, stage, closed: r.closed, score: p.score, streak: p.streak,
    question: stage === 'answer' ? hideAnswer(cur, SALT) : stage === 'feedback' ? cur : undefined,
    result: stage === 'feedback' ? p.results[p.pos] : undefined,
    review: stage === 'done' ? r.lesson.questions.map((x, i) => ({ prompt: x.prompt, credit: p.results[i]?.credit ?? null })) : undefined,
    accuracy: answered ? p.results.reduce((a, x) => a + x.credit, 0) / answered : 0,
  }
}

/** Panel del profe: progreso de cada estudiante y qué preguntas costaron más. */
export function hwHostView(r: Room) {
  const total = r.lesson.questions.length
  const ps = [...r.players.values()]
  const players = ps
    .map((p) => ({
      id: p.id, name: p.name, avatar: p.avatar, score: p.score, online: p.online,
      pos: p.pos, idleMs: p.lastAt ? Date.now() - p.lastAt : null, // relativo, como leftMs: los relojes no coinciden
      answered: p.results.length, finished: p.results.length >= total,
      accuracy: p.results.length ? p.results.reduce((a, x) => a + x.credit, 0) / p.results.length : 0,
    }))
    .sort((a, b) => b.score - a.score)
  const qstats = r.lesson.questions.map((x, i) => {
    const rs = ps.flatMap((p) => (p.results[i] ? [p.results[i].credit] : []))
    // las equivocaciones más repetidas ("flexbox" mal escrito 5 veces, la opción B 7 veces…)
    const wrong = new Map<string, number>()
    for (const p of ps) { const k = p.results[i]?.pick; if (k) wrong.set(k, (wrong.get(k) ?? 0) + 1) }
    return { prompt: x.prompt, answered: rs.length, accuracy: rs.length ? rs.reduce((a, c) => a + c, 0) / rs.length : null, wrong: topWrong(wrong) }
  })
  return { mode: 'homework' as const, pin: r.pin, title: r.lesson.title, total, closed: r.closed, players, qstats, reportId: r.reportId }
}

export function emitHw(r: Room, p?: Player) {
  io.to(`${r.pin}:host`).emit('state', hwHostView(r))
  if (p) io.to(`${r.pin}:p:${p.id}`).emit('hw', hwPlayerView(r, p))
}

export function hwAnswer(r: Room, p: Player, value: unknown) {
  const cur = r.lesson.questions[p.pos]
  if (r.mode !== 'homework' || r.closed || p.awaiting || !cur) return
  const ok = grade(cur, value)
  p.streak = ok === 1 ? p.streak + 1 : 0
  const gained = ok > 0 ? Math.round(score(cur.points, 1, Math.max(0, p.streak - 1)) * ok) : 0 // sin reloj: velocidad máxima
  p.score += gained
  p.results[p.pos] = { credit: ok, gained, pick: ok < 1 ? answerLabel(cur, value) : undefined }
  p.awaiting = true
  p.lastAt = Date.now()
  persist(r)
  emitHw(r, p)
}

export function hwNext(r: Room, p: Player) {
  if (r.mode !== 'homework' || !p.awaiting) return
  p.awaiting = false
  p.pos++
  p.lastAt = Date.now()
  persist(r)
  emitHw(r, p)
}

export function hwLock(r: Room) {
  if (r.mode !== 'homework') return
  r.closed = true
  persist(r)
  for (const p of r.players.values()) emitHw(r, p)
  emitHw(r)
}

/** Lo privado de cada jugador en vivo: su poder, el que activó y si ya respondió esta pregunta (índice, o -1). */
export const meOf = (r: Room, p: Player) => ({ power: p.power, armed: p.armed, answered: r.answers.has(p.id) ? r.index : -1 })

const topWrong = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([label, n]) => ({ label, n }))

/**
 * Lo que SOLO ve el profe en vivo (canal `pin:host`): quién respondió, cómo le va a cada uno mientras la pregunta sigue abierta
 * y la pregunta CON su solución (a los estudiantes `state` se la oculta). Los estudiantes nunca reciben esto.
 */
export function dashOf(r: Room) {
  const cur = q(r)
  const wrong = new Map<string, number>()
  const credit: Record<string, number> = {}
  const picks: Record<string, string> = {} // qué respondió cada uno (texto, solo donde se lee como frase)
  const secs: Record<string, number> = {} // en cuántos segundos respondió
  for (const [id, a] of r.answers) {
    credit[id] = a.credit
    secs[id] = Math.max(0, Math.round((a.at - r.qStart) / 100) / 10)
    const label = cur ? answerLabel(cur, a.value) : undefined
    if (label) picks[id] = label
    if (label && a.credit < 1) wrong.set(label, (wrong.get(label) ?? 0) + 1)
  }
  return {
    answered: [...r.answers.keys()],
    credit,
    picks,
    secs,
    key: r.phase === 'question' || r.phase === 'reveal' ? cur : undefined,
    dist: cur ? distOf(cur, r.answers) : undefined, // cuántos eligieron cada opción, EN VIVO (a los estudiantes solo les llega al revelar)
    wrong: topWrong(wrong),
    reportId: r.reportId,
  }
}

export function broadcast(r: Room) {
  r.touched = Date.now()
  if (r.mode === 'homework') return void io.to(`${r.pin}:host`).emit('state', hwHostView(r))
  io.to(r.pin).emit('state', view(r))
  if (io.sockets.adapter.rooms.get(`${r.pin}:host`)?.size) io.to(`${r.pin}:host`).emit('dash', dashOf(r))
  for (const p of r.players.values()) io.to(`${r.pin}:p:${p.id}`).emit('me', meOf(r, p)) // 'me' llega después de 'state' (mismo socket, en orden)
}

/** El profe saca a un jugador (nombre ofensivo, bromista). Puede volver a entrar, pero con otro nombre y desde 0. */
export function kick(r: Room, id: string) {
  if (!r.players.delete(id)) return false
  r.answers.delete(id)
  r.bombs.delete(id)
  r.hides.delete(id)
  persist(r)
  if (r.mode === 'homework') emitHw(r)
  else if (r.phase === 'question' && allIn(r)) reveal(r)
  else broadcast(r)
  return true
}

// ---------- Modo en vivo ----------

/** Cuántos eligieron cada opción: mcq/multi por índice; tf como [verdadero, falso]. */
function distOf(q: Question, answers: Map<string, Answer>): number[] | undefined {
  if (q.type !== 'mcq' && q.type !== 'multi' && q.type !== 'tf') return
  const d = q.type === 'tf' ? [0, 0] : q.data.options.map(() => 0)
  for (const { value } of answers.values()) {
    const picks = q.type === 'tf' ? [value === true ? 0 : value === false ? 1 : -1] : [value].flat()
    for (const i of new Set(picks)) if (Number.isInteger(i) && d[i as number] !== undefined) d[i as number]++
  }
  return d
}

function reveal(r: Room) {
  if (r.phase !== 'question') return
  clearTimeout(r.timer)
  const cur = q(r)!
  r.gained.clear()
  r.credit.clear()
  r.drops.clear()
  r.steals.clear()
  r.booms = []
  r.defused = []
  r.dist = distOf(cur, r.answers)
  const leader = [...r.players.values()].sort((a, b) => b.score - a.score)[0] // el 1.º ANTES de esta pregunta (objetivo del robo)
  const leaderScore = leader?.score ?? 0
  const fast = new Set<string>() // acertaron perfecto con tiempo de sobra (condición del robo)
  for (const p of r.players.values()) {
    if (p.out !== undefined) continue // eliminado en papa caliente: solo observa (en el reporte queda "no participó")
    const a = r.answers.get(p.id)
    const ok = a ? a.credit : 0 // ya calificada al llegar
    r.credit.set(p.id, ok)
    p.streak = ok === 1 ? p.streak + 1 : p.armed === 'shield' ? p.streak : 0 // la racha solo sube con respuestas perfectas; el escudo la protege
    const left = a ? (r.endsAt - a.at) / (cur.time * 1000) : 0
    if (ok === 1 && left >= STEAL_MIN_LEFT) fast.add(p.id)
    let pts = ok > 0 ? Math.round(score(cur.points, left, Math.max(0, p.streak - 1)) * ok) : 0 // parcial: proporcional
    if (p.armed === 'x2') pts *= 2
    if (p.armed === 'bet') pts = ok === 1 ? pts * 3 : -Math.min(p.score, cur.points) // apuesta: x3 o pierdes lo que valía (sin bajar de 0)
    p.score += pts
    r.gained.set(p.id, pts)
    p.results[r.index] = { credit: ok, gained: pts }
  }
  // robos: después de sumar, contra el 1.º de antes de la pregunta; el escudo activo del 1.º los bloquea
  for (const p of r.players.values()) {
    if (p.armed !== 'steal' || !leader || p.id === leader.id || !fast.has(p.id)) continue
    if (leader.armed === 'shield') { r.steals.set(p.id, { from: leader.id, amount: 0, blocked: true }); continue }
    const amount = Math.min(stealAmount(leaderScore), leader.score)
    leader.score -= amount
    p.score += amount
    r.gained.set(p.id, (r.gained.get(p.id) ?? 0) + amount)
    r.gained.set(leader.id, (r.gained.get(leader.id) ?? 0) - amount)
    r.steals.set(p.id, { from: leader.id, amount })
  }
  // papa caliente: quien tenía bomba y no acertó perfecto, explota
  for (const id of r.bombs) {
    const p = r.players.get(id)
    if (!p || p.out !== undefined) continue
    if (r.credit.get(id) === 1) r.defused.push(id)
    else (p.out = r.index, r.booms.push(id))
  }
  if (r.style === 'powers' && r.index < r.lesson.questions.length - 1) {
    // reparto de poderes: se rankea con los puntos ya sumados; quien ya guarda uno no recibe otro
    const ranked = [...r.players.values()].sort((a, b) => b.score - a.score)
    ranked.forEach((p, rank) => {
      const drop = !p.power && rollDrop(rank, ranked.length, r.credit.get(p.id) === 1)
      if (drop) (p.power = drop, r.drops.set(p.id, drop))
    })
  }
  r.phase = 'reveal'
  scheduleAuto(r)
  broadcast(r)
}

/** Modo automático: tras el reveal espera exactamente `pauseMs` y avanza solo (luego vienen los 5 s de la tabla de posiciones). */
function scheduleAuto(r: Room) {
  clearTimeout(r.autoTimer)
  if (!r.auto || r.phase !== 'reveal') return
  const ms = r.pauseMs
  r.autoAt = Date.now() + ms
  r.autoTimer = setTimeout(() => next(r), ms)
}

export function setAuto(r: Room, auto: boolean, secs?: number) {
  if (r.mode !== 'live') return
  r.auto = auto
  if (secs !== undefined && Number.isFinite(secs)) r.pauseMs = Math.max(1, Math.min(60, Math.round(secs))) * 1000
  if (r.phase === 'reveal' && !r.boardUntil) auto ? scheduleAuto(r) : clearTimeout(r.autoTimer)
  broadcast(r)
}

export function setStyle(r: Room, style: string) {
  if (r.mode !== 'live' || r.phase !== 'lobby' || !Object.hasOwn(STYLES, style)) return // solo antes de empezar: cambiar las reglas a mitad sería injusto
  r.style = style as Style
  if (r.style !== 'powers') for (const p of r.players.values()) p.power = undefined
  broadcast(r)
}

/** Usa el poder guardado en la pregunta en curso (antes de responder). */
export function usePower(r: Room, playerId: string) {
  const p = r.players.get(playerId), cur = q(r)
  if (r.mode !== 'live' || r.style !== 'powers' || r.phase !== 'question' || !p?.power || !cur || r.answers.has(playerId) || p.armed) return
  if (p.power === 'fifty') {
    const hide = cur.type === 'mcq' ? hideWrong(cur.data.options.length, cur.data.correct) : []
    if (!hide.length) return // no aplica a esta pregunta: no se gasta
    r.hides.set(playerId, hide)
    io.to(`${r.pin}:p:${playerId}`).emit('hide', { index: r.index, hide })
  } else p.armed = p.power
  p.power = undefined
  broadcast(r)
}

export const hidesOf = (r: Room, playerId: string) => (r.phase === 'question' ? r.hides.get(playerId) : undefined)

/** "Siguiente" del profe. Un doble clic (o un clic justo cuando avanza el automático) cerraba la pregunta recién abierta. */
export function hostNext(r: Room) {
  const cur = q(r)
  if (r.phase === 'question' && cur && Date.now() - r.qStart < 1500) return
  next(r)
}

/** El profe da más tiempo a la pregunta en curso (máx. 5 min en total desde ahora). */
export function addTime(r: Room, secs: number) {
  if (r.mode !== 'live' || r.phase !== 'question' || !(secs > 0)) return
  r.endsAt = Math.min(r.endsAt + Math.min(secs, 60) * 1000, Date.now() + 300_000)
  clearTimeout(r.timer)
  r.timer = setTimeout(() => reveal(r), r.endsAt - Date.now() + 300)
  broadcast(r)
}

export function next(r: Room) {
  if (r.mode !== 'live') return
  clearTimeout(r.autoTimer)
  if (r.phase === 'question') return reveal(r) // "siguiente" durante la pregunta = cerrar y mostrar
  if (r.phase === 'podium') return
  // entre el reveal y la siguiente pregunta: 5 s de tabla de posiciones (un segundo "siguiente" del profe la salta)
  if (r.phase === 'reveal' && !r.boardUntil && r.players.size >= 2 && r.index < r.lesson.questions.length - 1) {
    r.boardUntil = Date.now() + BOARD_MS
    r.autoTimer = setTimeout(() => next(r), BOARD_MS)
    return broadcast(r)
  }
  r.boardUntil = 0
  r.index++
  r.answers.clear()
  r.hides.clear()
  r.bombs.clear()
  for (const p of r.players.values()) p.armed = undefined
  const alive = [...r.players.values()].filter((p) => p.out === undefined)
  if (r.index >= r.lesson.questions.length || (r.style === 'bomb' && bombOver(alive.length, r.players.size))) {
    r.phase = 'podium'
    saveReport(r)
  } else {
    r.phase = 'question'
    if (r.style === 'bomb') r.bombs = new Set(pickBombs(alive.map((p) => p.id)))
    const cur = q(r)!
    r.qStart = Date.now()
    r.endsAt = r.qStart + cur.time * 1000
    r.timer = setTimeout(() => reveal(r), cur.time * 1000 + 300) // 300ms de gracia por latencia
  }
  broadcast(r)
}

export function answer(r: Room, playerId: string, value: unknown) {
  if (r.mode !== 'live' || r.phase !== 'question' || !r.players.has(playerId) || r.answers.has(playerId) || r.players.get(playerId)!.out !== undefined) return
  r.answers.set(playerId, { value, at: Math.min(Date.now(), r.endsAt), credit: grade(q(r)!, value) })
  if (allIn(r)) return reveal(r)
  broadcast(r)
}

/** ¿Ya respondieron todos los que pueden responder (en línea y sin explotar)? */
const allIn = (r: Room) => [...r.players.values()].every((p) => !p.online || p.out !== undefined || r.answers.has(p.id))

export function setOnline(r: Room, playerId: string, online: boolean) {
  const p = r.players.get(playerId)
  if (!p) return
  p.online = online
  // si el único que faltaba se fue, no hay que esperar al reloj
  if (!online && r.mode === 'live' && r.phase === 'question' && r.answers.size && allIn(r)) reveal(r)
}

export function closeRoom(pin: string) {
  const r = rooms.get(pin)
  if (r) {
    clearTimeout(r.timer)
    clearTimeout(r.autoTimer)
    if (r.mode === 'live') saveReport(r) // si el profe termina antes del podio, igual se guarda lo jugado
  }
  rooms.delete(pin)
  hwRooms.remove(pin)
}
