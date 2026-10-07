// Carga: N jugadores falsos en vivo y en tarea. Requiere la API en :3000. Uso: pnpm tsx server/load.test.ts [N]
import assert from 'node:assert/strict'
import { io } from 'socket.io-client'
import { BASE, H, bare, hostSocket } from './test-auth.ts'

const N = +(process.argv[2] ?? 40)
const post = (p: string, b: unknown) => fetch(BASE + p, { method: 'POST', headers: H, body: JSON.stringify(b) }).then((r) => r.json())
const del = (p: string) => fetch(BASE + p, { method: 'DELETE', headers: bare })
const ack = (s: ReturnType<typeof io>, ...a: unknown[]) => new Promise<any>((res) => s.emit(...([a[0], ...a.slice(1), res] as [string, ...unknown[]])))
const until = async (f: () => boolean, ms = 15000) => { const t = Date.now(); while (!f() && Date.now() - t < ms) await new Promise((r) => setTimeout(r, 20)); assert.ok(f(), 'timeout') }

const q = (id: string, correct: number) => ({ id, type: 'mcq', prompt: id, time: 20, points: 1000, data: { options: ['a', 'b', 'c', 'd'], correct } })
const lesson = await post('/api/lessons', { title: 'Carga', emoji: 'flask', questions: [q('1', 0), q('2', 1), q('3', 2)] })
const { pin } = await post('/api/rooms', { lessonId: lesson.id })

const host = hostSocket()
let state: any, bytes = 0, emits = 0, maxBytes = 0
host.on('state', (s) => { state = s; const b = JSON.stringify(s).length; bytes += b; emits++; maxBytes = Math.max(maxBytes, b) })
assert.ok(await ack(host, 'host:open', pin))

const bots = Array.from({ length: N }, () => io(BASE))
const ids: string[] = []
for (const [i, b] of bots.entries()) ids.push((await ack(b, 'player:join', pin, `Bot${i}`, 'pix:fox', undefined)).id)
await until(() => state?.players.length === N)

const lat: number[] = []
for (let r = 0; r < 3; r++) {
  host.emit('host:next', pin)
  await until(() => state.phase === 'question' && state.index === r)
  assert.equal(state.question.data.correct, -1, 'no se filtra la respuesta')
  const t0 = Date.now()
  bots.forEach((b, i) => setTimeout(() => b.emit('player:answer', i % 4), Math.random() * 300))
  await until(() => state.phase === 'reveal')
  lat.push(Date.now() - t0)
  const sc = state.players.map((p: any) => p.score)
  assert.deepEqual(sc, [...sc].sort((a, b) => b - a), 'ranking ordenado')
}
host.emit('host:next', pin)
await until(() => state.phase === 'podium')
assert.equal(state.players.length, N)

await del(`/api/rooms/${pin}`)
const reps = await fetch(BASE + '/api/reports', { headers: H }).then((r) => r.json())
for (const r of reps.filter((r: any) => r.title === 'Carga')) await del(`/api/reports/${r.id}`)

// tarea: cada bot a su ritmo, en paralelo
const hw = await post('/api/rooms', { lessonId: lesson.id, mode: 'homework' })
const hostHw = hostSocket(); await ack(hostHw, 'host:open', hw.pin)
let done = 0
const hwBots = Array.from({ length: N }, (_, i) => {
  const s = io(BASE)
  s.on('hw', (v) => {
    if (v.stage === 'answer') setTimeout(() => s.emit('hw:answer', i % 4), 50 + Math.random() * 200)
    if (v.stage === 'feedback') setTimeout(() => s.emit('hw:next'), 50 + Math.random() * 100)
    if (v.stage === 'done') done++
  })
  s.on('connect', () => s.emit('player:join', hw.pin, `Hw${i}`, 'pix:fox', undefined, () => s.emit('hw:sync')))
  return s
})
await until(() => done === N, 30000)
await del(`/api/rooms/${hw.pin}`)
for (const r of (await fetch(BASE + '/api/reports', { headers: H }).then((r) => r.json())).filter((r: any) => r.title === 'Carga')) await del(`/api/reports/${r.id}`)
await fetch(BASE + `/api/lessons/${lesson.id}`, { method: 'DELETE', headers: bare })

console.log(`ok N=${N} | state avg ${Math.round(bytes / emits)} B, max ${maxBytes} B, ${emits} emisiones | respuestas→reveal ${lat.join('/')} ms`)
process.exit(0)
