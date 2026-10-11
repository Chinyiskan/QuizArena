// Prueba de humo de punta a punta. Requiere el servidor en :3000 (npm start). Uso: npm run test:live
import assert from 'node:assert/strict'
import { io } from 'socket.io-client'

import { BASE, H, bare, hostSocket } from './test-auth.ts'
const post = (p: string, b: unknown, method = 'POST') => fetch(BASE + p, { method, headers: H, body: JSON.stringify(b) }).then((r) => r.json())

const lesson = await post('/api/lessons', {
  title: 'Smoke', emoji: 'flask',
  questions: [
    { id: 'a', type: 'mcq', prompt: '2+2?', time: 10, points: 1000, data: { options: ['3', '4'], correct: 1 } },
    { id: 'b', type: 'tf', prompt: 'El cielo es verde', time: 10, points: 1000, data: { correct: false } },
    { id: 'c', type: 'fill', prompt: 'Completa', time: 10, points: 1000, data: { text: 'La capital de [Francia] es [París]' } },
    { id: 'd', type: 'dropdown', prompt: 'Elige', time: 10, points: 1000, data: { text: 'She [has|have|is] been' } },
    { id: 'e', type: 'open', prompt: 'País de Bogotá', time: 10, points: 1000, data: { answers: ['Colombia'] } },
    { id: 'f', type: 'order', prompt: 'Ordena', time: 10, points: 1000, data: { items: ['uno', 'dos', 'tres'] } },
    { id: 'g', type: 'match', prompt: 'Relaciona', time: 10, points: 1000, data: { pairs: [{ left: 'a', right: '1' }, { left: 'b', right: '2' }] } },
    { id: 'h', type: 'sort', prompt: 'Clasifica', time: 10, points: 1000, data: { cats: [{ name: 'Frutas', items: ['Manzana', 'Pera'] }, { name: 'Verduras', items: ['Zanahoria'] }] } },
    { id: 'j', type: 'table', prompt: 'Tabla', time: 10, points: 1000, passage: 'Texto de apoyo', data: { header: true, rows: [['K', 'V'], ['a', '[b]']] } },
    { id: 'k', type: 'grid', prompt: 'Cuadrícula', time: 10, points: 1000, data: { cols: ['A', 'B'], rows: [{ text: 'r1', correct: 0 }, { text: 'r2', correct: 1 }] } },
    { id: 'l', type: 'tap', prompt: 'Toca', time: 10, points: 1000, data: { text: 'x [y] z' } },
    { id: 'm', type: 'blocks', prompt: 'Ordena el código', time: 10, points: 1000, data: { lang: 'py', indent: true, extra: ['while True:'], lines: [{ t: 'for i in x:', i: 0 }, { t: 'print(i)', i: 1 }] } },
    { id: 'i', type: 'drag', prompt: 'Arrastra', time: 10, points: 1000, data: { text: 'El [sol] brilla', extra: ['luna'] } },
  ],
})
assert.ok(lesson.id, 'lección creada')
const { pin } = await post('/api/rooms', { lessonId: lesson.id })

// un cliente que no manda callback no debe tumbar el servidor
const rude = io(BASE)
rude.emit('host:open', pin, 'x')
rude.emit('player:join', '000000', 'Grosero', 'pix:fox', undefined)
await new Promise((r) => setTimeout(r, 300))
assert.equal((await fetch(BASE + `/api/rooms/${pin}`)).status, 200, 'el servidor sigue vivo')
rude.disconnect()

const host = hostSocket(), p1 = io(BASE), p2 = io(BASE)
let state: any
host.on('state', (s) => (state = s))
const until = async (f: () => boolean) => { for (let i = 0; i < 100 && !f(); i++) await new Promise((r) => setTimeout(r, 30)); assert.ok(f(), 'timeout') }
const ack = (s: typeof p1, ...a: unknown[]) => new Promise<any>((res) => s.emit(...([a[0], ...a.slice(1), res] as [string, ...unknown[]])))

assert.ok(await ack(host, 'host:open', pin))
const j1 = await ack(p1, 'player:join', pin, 'Ana', 'pix:fox', undefined)
const j2 = await ack(p2, 'player:join', pin, 'Beto', 'pix:fox', undefined)
assert.ok(j1.id && j2.id)
await until(() => state?.players.length === 2)

host.emit('host:next', pin)
await until(() => state.phase === 'question')
assert.equal(state.question.data.correct, -1, 'no se filtra la respuesta')
p1.emit('player:answer', 1) // correcta
p2.emit('player:answer', 0) // incorrecta -> todos respondieron -> reveal automático
await until(() => state.phase === 'reveal')
assert.equal(state.question.data.correct, 1)
assert.ok(state.gained[j1.id] > 0 && state.gained[j2.id] === 0)
assert.equal(state.players[0].name, 'Ana')
assert.deepEqual(state.dist, [1, 1], 'distribución por opción')
assert.equal(state.credit[j1.id], 1)
assert.equal(state.credit[j2.id], 0)

// entrada tardía: con la partida en curso se puede entrar (se desconecta para no frenar las rondas)
const p3 = io(BASE)
const j3 = await ack(p3, 'player:join', pin, 'Cami', 'pix:fox', undefined)
assert.ok(j3.id, 'entrada tardía permitida')
await until(() => state.players.length === 3)
p3.disconnect()

// resto de rondas: [respuesta de Ana, respuesta de Beto]
const rounds: [unknown, unknown][] = [
  [false, true], // tf
  [['francia', 'paris'], ['francia', 'roma']], // fill: Ana 100%, Beto 50% (parcial)
  [['has'], ['is']], // dropdown
  [' COLOMBIA ', 'peru'], // open
  [['uno', 'dos', 'tres'], ['tres', 'dos', 'uno']], // order: Beto solo acierta el del medio
  [['1', '2'], ['2', '1']], // match
  [{ Manzana: 0, Pera: 0, Zanahoria: 1 }, { Manzana: 1, Pera: 0, Zanahoria: 1 }], // sort: Beto 2/3
  [['b'], ['x']], // table
  [[0, 1], [1, 0]], // grid
  [[1], [0, 2]], // tap: Beto acierta 0 y falla 2
  [[{ t: 'for i in x:', i: 0 }, { t: 'print(i)', i: 1 }], [{ t: 'print(i)', i: 1 }, { t: 'for i in x:', i: 0 }]], // blocks: Beto 0/2
  [['sol'], ['luna']], // drag
]
for (const [i, [a1, a2]] of rounds.entries()) {
  host.emit('host:next', pin)
  await until(() => state.phase === 'question' && state.index === i + 1)
  if (i === 0) { // más tiempo: la cuenta sube ~10 s
    host.emit('host:time', pin, 10)
    await until(() => state.leftMs > 12000)
  }
  const hidden = JSON.stringify(state.question.data)
  if (state.question.type === 'fill') assert.ok(!/Francia|París/.test(hidden), 'fill no filtra la solución')
  if (state.question.type === 'open') assert.deepEqual(state.question.data.answers, [])
  const d = state.question.data
  if (state.question.type === 'order') assert.notDeepEqual(d.items, ['uno', 'dos', 'tres'], 'order llega barajado')
  if (state.question.type === 'match') assert.ok(d.pairs.every((p: any) => p.right === '') && d.pool.length === 2, 'match no filtra parejas')
  if (state.question.type === 'sort') assert.ok(d.cats.every((c: any) => !c.items.length) && d.pool.length === 3, 'sort no filtra categorías')
  if (state.question.type === 'table') assert.ok(d.rows[1][1] === '[]' && state.question.passage === 'Texto de apoyo', 'table no filtra y conserva la lectura')
  if (state.question.type === 'grid') assert.ok(d.rows.every((r: any) => r.correct === -1), 'grid no filtra')
  if (state.question.type === 'tap') assert.equal(d.text, 'x y z', 'tap llega sin marcas')
  if (state.question.type === 'blocks') assert.ok(d.lines.length === 0 && d.bank.length === 3 && !JSON.stringify(d).includes('"i":1'), 'blocks solo expone el banco')
  if (state.question.type === 'drag') assert.ok(d.text === 'El [] brilla' && d.bank.length === 2, 'drag solo expone el banco')
  p1.emit('player:answer', a1)
  p2.emit('player:answer', a2)
  await until(() => state.phase === 'reveal')
  const t = state.question.type
  if (['order', 'match', 'sort', 'drag', 'table', 'grid', 'tap', 'blocks'].includes(t)) {
    assert.equal(state.credit[j1.id], 1, `${t}: Ana perfecta`)
    const want = { order: 1 / 3, match: 0, sort: 2 / 3, drag: 0, table: 0, grid: 0, tap: 0, blocks: 0 }[t as 'order']
    assert.ok(Math.abs(state.credit[j2.id] - want) < 1e-9, `${t}: Beto ${state.credit[j2.id]} vs ${want}`)
  }
  if (state.question.type === 'tf') assert.deepEqual(state.dist, [1, 1], 'tf: [verdadero, falso]')
  if (state.question.type === 'fill') {
    assert.equal(state.dist, undefined)
    const [g1, g2] = [state.gained[j1.id], state.gained[j2.id]]
    assert.ok(g1 > 0 && g2 > 0 && g2 < g1, `parcial proporcional (${g1} vs ${g2})`)
  }
}
host.emit('host:next', pin)
await until(() => state.phase === 'podium')
assert.equal(state.players[0].name, 'Ana')

const late = await ack(io(BASE), 'player:join', pin, 'Tarde', 'pix:fox', undefined)
assert.ok(late.error, 'sin entrada tras el podio')

// borrar la sala (guarda el reporte final) ANTES de comprobarlo: closeRoom vuelve a guardar el de las partidas en vivo
await post(`/api/rooms/${pin}`, {}, 'DELETE')
// reporte: la partida quedó guardada con una fila por jugador y una columna por pregunta
const list = await fetch(BASE + '/api/reports', { headers: bare }).then((r) => r.json())
const meta = list.find((r: any) => r.title === 'Smoke')
assert.ok(meta?.closed, 'reporte de la partida en vivo guardado y cerrado')
const rep = await fetch(BASE + `/api/reports/${meta.id}`, { headers: bare }).then((r) => r.json())
assert.equal(rep.questions.length, 13)
assert.equal(rep.players[0].name, 'Ana')
assert.equal(rep.players.length, 3, 'incluye al que entró tarde')
assert.equal(rep.players.find((p: any) => p.name === 'Cami').results[0], null, 'quien entró tarde no participó en la 1')
assert.equal(rep.players[0].results[0], 1)
const del = await fetch(BASE + `/api/reports/${meta.id}`, { method: 'DELETE', headers: bare }) // sin content-type: Fastify rechaza DELETE con JSON y sin cuerpo
assert.equal(del.status, 200, 'reporte de prueba borrado')

await post(`/api/lessons/${lesson.id}`, {}, 'DELETE')
console.log('ok')
process.exit(0)
