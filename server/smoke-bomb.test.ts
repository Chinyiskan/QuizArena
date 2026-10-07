// Papa caliente contra el servidor vivo: bombas secretas, explosiones, observadores y fin de partida. Uso: pnpm test:live
import assert from 'node:assert/strict'
import { io } from 'socket.io-client'
import { BASE, H, bare, hostSocket } from './test-auth.ts'

const post = (p: string, b: unknown) => fetch(BASE + p, { method: 'POST', headers: H, body: JSON.stringify(b) }).then((r) => r.json())
const ack = (s: ReturnType<typeof io>, ...a: unknown[]) => new Promise<any>((res) => s.emit(...([a[0], ...a.slice(1), res] as [string, ...unknown[]])))
const questions = Array.from({ length: 12 }, (_, i) => ({ id: `q${i}`, type: 'mcq', prompt: `P${i}`, time: 20, points: 1000, data: { options: ['a', 'b', 'c', 'd'], correct: 1 } }))
const lesson = await post('/api/lessons', { title: 'Bombas', emoji: 'flask', questions })
const { pin } = await post('/api/rooms', { lessonId: lesson.id })

const host = hostSocket()
let s: any
host.on('state', (x) => (s = x))
const until = async (f: () => boolean) => { for (let i = 0; i < 150 && !f(); i++) await new Promise((r) => setTimeout(r, 30)); assert.ok(f(), 'timeout') }
assert.ok(await ack(host, 'host:open', pin))
const names = ['Ana', 'Beto', 'Caro', 'Dani']
const socks = names.map(() => io(BASE))
const ids: string[] = []
for (const [i, so] of socks.entries()) ids.push((await ack(so, 'player:join', pin, names[i], 'pix:fox', undefined)).id)
const [A, B] = ids // Ana y Beto aciertan siempre; Caro y Dani fallan siempre
host.emit('host:style', pin, 'bomb')
await until(() => s.style === 'bomb')

let booms = 0
for (let i = 0; i < 12; i++) {
  host.emit('host:next', pin)
  await until(() => s.phase === 'podium' || (s.phase === 'question' && s.index === i))
  if (s.phase === 'podium') break
  if (i === 0) {
    host.emit('host:style', pin, 'classic') // ya empezó: no se puede cambiar
    await new Promise((r) => setTimeout(r, 100))
    assert.equal(s.style, 'bomb', 'el modo no cambia a mitad de partida')
  }
  assert.ok(s.bombs >= 1, 'hay bombas en juego')
  assert.deepEqual([s.booms, s.defused], [[], []], 'mientras se responde no se sabe nada')
  assert.ok(!JSON.stringify(s).includes('holder'), 'el estado no lleva quién tiene bomba')
  const out = (id: string) => s.players.find((p: any) => p.id === id).out !== undefined
  socks.forEach((so, j) => so.emit('player:answer', j < 2 ? 1 : 0)) // los eliminados también "responden": se ignora
  await until(() => s.phase === 'reveal')
  for (const id of s.booms) assert.ok(id !== A && id !== B, 'solo explota quien falló')
  for (const id of s.defused) assert.ok(id === A || id === B, 'desactiva quien acertó')
  for (const id of s.booms) assert.equal(s.players.find((p: any) => p.id === id).out, i, 'queda fuera desde esta pregunta')
  booms += s.booms.length
  for (const id of ids) if (out(id) && !s.booms.includes(id)) assert.equal(s.credit[id], undefined, 'un observador no recibe calificación')
}
assert.ok(booms > 0, 'en 12 rondas alguien explotó')

// tarde: con la papa caliente empezada se entra a observar
const late = io(BASE)
const jl = await ack(late, 'player:join', pin, 'Tarde', 'pix:fox', undefined)
if (s.phase !== 'podium') {
  await until(() => s.players.some((p: any) => p.id === jl.id))
  assert.notEqual(s.players.find((p: any) => p.id === jl.id).out, undefined, 'quien llega tarde observa')
}

// al final: vivos primero, luego quien explotó más tarde
while (s.phase !== 'podium') { host.emit('host:next', pin); await new Promise((r) => setTimeout(r, 60)); if (s.phase === 'question') socks.forEach((so) => so.emit('player:answer', 1)) }
const order = s.players.map((p: any) => p.out ?? Infinity)
assert.deepEqual(order, [...order].sort((a: number, b: number) => b - a), 'podio: vivos primero, luego por ronda de eliminación')
assert.ok(s.players[0].out === undefined, 'gana alguien en pie')

;[host, late, ...socks].forEach((x) => x.disconnect())
await fetch(BASE + `/api/rooms/${pin}`, { method: 'DELETE', headers: bare })
const reps = await fetch(BASE + '/api/reports', { headers: bare }).then((r) => r.json())
for (const r of reps.filter((r: any) => r.title === 'Bombas')) await fetch(BASE + `/api/reports/${r.id}`, { method: 'DELETE', headers: bare })
await fetch(BASE + `/api/lessons/${lesson.id}`, { method: 'DELETE', headers: bare })
console.log('ok')
process.exit(0)
