import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { Server } from 'socket.io'
import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { TOTP_SECRET, checkConfig, clientIp, cookieHeader, isAdmin, login, logout, tooMany } from './auth.ts'
import { lessonInputSchema, lessonProblems } from '../shared/questions.ts'
import { lessons, reports } from './db.ts'
import { addPlayer, answer, broadcast, closeRoom, createRoom, emitHw, getRoom, hostNext, hwAnswer, hwLock, hidesOf, hwNext, initGame, isReturning, kick, listRooms, setAuto, setOnline, setStyle, usePower } from './game.ts'

const PORT = Number(process.env.PORT ?? 3000)
const PUBLIC_URL = process.env.PUBLIC_URL ?? ''
checkConfig() // sin ADMIN_PASSWORD no arranca: se acabó el token por defecto
const MAX_PLAYERS = 150
// PIN fallidos por IP cada 10 min. Todo un colegio puede salir por la misma IP: alto para no frenar a un salón,
// y aun así adivinar uno de 900 000 PIN tomaría días.
const PIN_TRIES = 300

// Red de seguridad: un error inesperado se registra pero NO tumba la clase (con `pnpm clase` caerse = perder el túnel y el link).
process.on('uncaughtException', (e) => console.error('[error sin capturar]', e))
process.on('unhandledRejection', (e) => console.error('[promesa rechazada]', e))

/** Nombre visible: sin caracteres de control ni de dirección de texto (‮ invierte el texto en el proyector), máx. 20. */
const clean = (s: string) => s.replace(/[\p{Cc}‎‏‪-‮⁦-⁩]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20)

const app = Fastify({ bodyLimit: 1 << 20 })
// sin `cors`: el socket solo acepta la misma página (Vite hace de proxy en dev)
const io = new Server(app.server, {
  maxHttpBufferSize: 1e5,
  // los WebSocket no respetan CORS: se rechaza cualquier página de otro sitio (sin Origin = script/prueba local)
  allowRequest: (req, cb) => cb(null, !req.headers.origin || URL.parse(req.headers.origin)?.host === req.headers.host),
})
initGame(io)

// Cabeceras de seguridad. La CSP solo aplica al build (en dev Vite inyecta scripts propios).
app.addHook('onSend', async (_req, reply) => {
  reply.header('x-content-type-options', 'nosniff')
  reply.header('x-frame-options', 'DENY')
  reply.header('referrer-policy', 'same-origin')
  reply.header('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
})

// --- Login del profe: contraseña (+ TOTP) -> cookie HttpOnly. Todo /api exige sesión salvo lo público. ---
const PUBLIC = new Set(['GET /api/config', 'GET /api/avatars', 'GET /api/auth', 'GET /api/rooms/:pin', 'POST /api/login', 'POST /api/logout'])
app.addHook('onRequest', async (req, reply) => {
  // Se decide con la RUTA que eligió el router, no con el texto de la URL: el router decodifica (/%61pi/lessons = /api/lessons)
  // y comparar el texto crudo dejaba pasar sin sesión. Sin ruta (404) no hay nada que proteger.
  const route = req.routeOptions.url
  if (!route?.startsWith('/api/') || PUBLIC.has(`${req.method} ${route}`)) return
  if (!isAdmin(req.headers.cookie)) return reply.code(401).send({ error: 'sesión' })
})
const https = (h: Record<string, unknown>) => h['x-forwarded-proto'] === 'https' || h['cf-visitor']?.toString().includes('https') === true
app.post<{ Body: { password?: string; code?: string } }>('/api/login', async (req, reply) => {
  const r = login(clientIp(req.ip, req.headers), req.body?.password, req.body?.code)
  if (!r.cookie) return reply.code(r.error?.startsWith('Demasiados') ? 429 : 401).send({ error: r.error })
  reply.header('set-cookie', cookieHeader(r.cookie, https(req.headers)))
  return { ok: true }
})
app.post('/api/logout', async (req, reply) => {
  logout(req.headers.cookie)
  reply.header('set-cookie', cookieHeader('', https(req.headers)))
  return { ok: true }
})
app.get('/api/auth', async (req) => ({ admin: isAdmin(req.headers.cookie), totp: !!TOTP_SECRET }))

app.get('/api/config', async () => ({ publicUrl: PUBLIC_URL }))

app.get('/api/avatars', async () => {
  const dir = resolve('public/avatars')
  return existsSync(dir) ? readdirSync(dir).filter((f) => /\.(png|jpe?g|webp|gif|svg)$/i.test(f)) : []
})

app.get('/api/lessons', async () => lessons.list())
app.get<{ Params: { id: string } }>('/api/lessons/:id', async (req, reply) => lessons.get(req.params.id) ?? reply.code(404).send({ error: 'no existe' }))

function parseLesson(body: unknown) {
  const r = lessonInputSchema.safeParse(body)
  if (!r.success) return { error: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }
  const problems = lessonProblems(r.data)
  return problems.length ? { error: problems.join('; ') } : { data: r.data }
}

app.post('/api/lessons', async (req, reply) => {
  const p = parseLesson(req.body)
  return p.data ? lessons.save(p.data) : reply.code(400).send(p)
})
app.put<{ Params: { id: string } }>('/api/lessons/:id', async (req, reply) => {
  const p = parseLesson(req.body)
  return p.data ? lessons.save(p.data, req.params.id) : reply.code(400).send(p)
})
app.delete<{ Params: { id: string } }>('/api/lessons/:id', async (req) => (lessons.remove(req.params.id), { ok: true }))

app.get('/api/reports', async () => reports.list())
app.get<{ Params: { id: string } }>('/api/reports/:id', async (req, reply) => reports.get(req.params.id) ?? reply.code(404).send({ error: 'no existe' }))
app.delete<{ Params: { id: string } }>('/api/reports/:id', async (req) => (reports.remove(req.params.id), { ok: true }))
app.get('/api/rooms', async () => listRooms())
app.delete<{ Params: { pin: string } }>('/api/rooms/:pin', async (req) => {
  io.to(req.params.pin).emit('closed')
  closeRoom(req.params.pin)
  return { ok: true }
})
app.post<{ Body: { lessonId: string; mode?: string } }>('/api/rooms', async (req, reply) => {
  const lesson = lessons.get(req.body?.lessonId)
  if (!lesson) return reply.code(404).send({ error: 'no existe' })
  if (!lesson.questions.length) return reply.code(400).send({ error: 'La lección no tiene preguntas' })
  return { pin: createRoom(lesson, req.body.mode === 'homework' ? 'homework' : 'live') }
})
// público: el estudiante comprueba que el PIN existe antes de pedirle el nombre
app.get<{ Params: { pin: string } }>('/api/rooms/:pin', async (req, reply) => {
  const ip = clientIp(req.ip, req.headers)
  if (tooMany(`pin:${ip}`, PIN_TRIES, 10 * 60e3, false)) return reply.code(429).send({ error: 'Demasiados intentos, espera unos minutos' })
  const r = getRoom(req.params.pin)
  if (!r) tooMany(`pin:${ip}`, PIN_TRIES, 10 * 60e3) // solo los PIN fallidos cuentan: no frena a un salón entero tras la misma IP
  return r ? { title: r.lesson.title, mode: r.mode, taken: [...r.players.values()].map((p) => p.avatar), open: r.mode === 'homework' ? !r.closed : r.phase !== 'podium' } : reply.code(404).send({ error: 'PIN no válido' })
})

// --- Tiempo real ---
const fn = (f: unknown) => (typeof f === 'function' ? f : () => {}) as (x: any) => void // un cliente sin callback no debe tumbar el servidor
io.on('connection', (s) => {
  const ip = clientIp(s.handshake.address, s.handshake.headers)
  // máx. 30 eventos por segundo por conexión; más que eso es un script
  let n = 0, t = Date.now()
  s.use((_ev, next) => {
    if (Date.now() - t > 1000) (t = Date.now()), (n = 0)
    if (++n > 30) return s.disconnect(true)
    next()
  })
  s.on('host:open', (pin: string, cb: unknown) => {
    const ack = fn(cb)
    const r = getRoom(pin)
    if (!r || !isAdmin(s.handshake.headers.cookie)) return ack(false)
    s.join(pin)
    s.join(`${pin}:host`) // el panel de tareas se emite solo aquí: los estudiantes no ven datos de los demás
    s.data = { host: pin }
    ack(true)
    broadcast(r)
  })
  const host = (pin: unknown) => (s.data.host !== undefined && s.data.host === pin ? getRoom(pin as string) : undefined)
  s.on('host:next', (pin: string) => { const r = host(pin); if (r) hostNext(r) })
  s.on('host:auto', (pin: string, auto: boolean, secs?: number) => { const r = host(pin); if (r) setAuto(r, !!auto, typeof secs === 'number' ? secs : undefined) })
  s.on('host:style', (pin: string, style: unknown) => { const r = host(pin); if (r && typeof style === 'string') setStyle(r, style) })
  s.on('host:lock', (pin: string) => { const r = host(pin); if (r) hwLock(r) })
  s.on('host:close', (pin: string) => { if (host(pin)) { io.to(pin).emit('closed'); closeRoom(pin) } })
  s.on('host:kick', (pin: string, id: unknown) => {
    const r = host(pin)
    if (!r || typeof id !== 'string' || !kick(r, id)) return
    io.to(`${pin}:p:${id}`).emit('kicked')
    io.in(`${pin}:p:${id}`).socketsLeave([pin, `${pin}:p:${id}`])
  })

  // `key` es secreta (solo la conoce ese celular): sin ella, el id de otro (que sí es público) no sirve para suplantarlo
  s.on('player:join', (pin: unknown, name: unknown, avatar: unknown, id: unknown, key: unknown, cb: unknown) => {
    if (typeof key === 'function') (cb = key), (key = undefined) // clientes viejos (bots, pruebas): sin clave, el callback llega en su lugar
    const ack = fn(cb)
    // todo llega de un cliente sin control: cualquier tipo raro se trata como vacío (String() de un objeto puede lanzar)
    const r = typeof pin === 'string' ? getRoom(pin) : undefined
    const back = !!r && isReturning(r, id, key) // reconexión legítima: no cuenta para el límite ni la bloquea un bromista
    if (!back && tooMany(`pin:${ip}`, PIN_TRIES, 10 * 60e3, false)) return ack({ error: 'Demasiados intentos, espera unos minutos' })
    if (!r) return (tooMany(`pin:${ip}`, PIN_TRIES, 10 * 60e3), ack({ error: 'PIN no válido' }))
    if (r.players.size >= MAX_PLAYERS && !back) return ack({ error: 'La sala está llena' })
    const nick = typeof name === 'string' ? clean(name) : ''
    if (!nick && !back) return ack({ error: 'Escribe tu nombre' })
    const p = addPlayer(r, nick, typeof avatar === 'string' ? avatar.slice(0, 60) : '', back ? (id as string) : undefined)
    if (p === 'locked') return ack({ error: 'La partida ya terminó' })
    for (const room of s.rooms) if (room !== s.id) s.leave(room) // un socket = una sala
    p.online = true
    s.join(pin as string)
    s.join(`${pin}:p:${p.id}`) // canal personal (tarea, 50/50, poderes)
    s.data = { pin, id: p.id }
    ack({ id: p.id, key: p.key })
    broadcast(r)
    const hide = hidesOf(r, p.id) // reconexión a media pregunta: recupera su 50/50
    if (hide) s.emit('hide', { index: r.index, hide })
    if (r.mode === 'homework') emitHw(r, p)
  })
  // modo tarea: respuesta, siguiente y re-sincronizar mi vista (al montar la pantalla o reconectar)
  const me = () => {
    const { pin, id } = s.data ?? {}
    const r = pin && getRoom(pin)
    const p = r && r.players.get(id)
    return r && p ? ([r, p] as const) : undefined
  }
  s.on('hw:answer', (value: unknown) => { const m = me(); if (m) hwAnswer(m[0], m[1], value) })
  s.on('hw:next', () => { const m = me(); if (m) hwNext(m[0], m[1]) })
  s.on('hw:sync', () => { const m = me(); if (m) emitHw(m[0], m[1]) })
  s.on('player:power', () => { const { pin, id } = s.data ?? {}; const r = pin && getRoom(pin); if (r) usePower(r, id) })
  s.on('player:answer', (value: unknown) => {
    const { pin, id } = s.data ?? {}
    const r = pin && getRoom(pin)
    if (r) answer(r, id, value)
  })
  s.on('disconnect', () => {
    const { pin, id } = s.data ?? {}
    const r = pin && getRoom(pin)
    // el celular pudo volver con otro socket antes de que este se diera por caído: entonces sigue en línea
    if (!r || io.sockets.adapter.rooms.get(`${pin}:p:${id}`)?.size) return
    setOnline(r, id, false)
    broadcast(r)
  })
})

// Avatares del profe: se sirven directo de public/avatars, así los que agregues aparecen sin volver a compilar.
if (existsSync('public/avatars')) await app.register(fastifyStatic, { root: resolve('public/avatars'), prefix: '/avatars/', decorateReply: false, maxAge: '1h' })

// --- Cliente compilado (producción / túnel) ---
if (existsSync('client-dist')) {
  await app.register(fastifyStatic, { root: resolve('client-dist') })
  app.setNotFoundHandler((req, reply) => (req.url.startsWith('/api/') ? reply.code(404).send({ error: 'no existe' }) : reply.sendFile('index.html')))
}

await app.listen({ port: PORT, host: '0.0.0.0' })
console.log(`QuizArena API en :${PORT}`)
