// Blindaje contra estudiantes malintencionados o torpes (cada caso fue un bug real). Uso: pnpm test:live
import assert from 'node:assert/strict'
import { io } from 'socket.io-client'
import { BASE, H, bare, hostSocket } from './test-auth.ts'

const post = (p: string, b: unknown) => fetch(BASE + p, { method: 'POST', headers: H, body: JSON.stringify(b) }).then((r) => r.json())
const ack = (s: ReturnType<typeof io>, ...a: unknown[]) => new Promise<any>((res) => s.emit(...([a[0], ...a.slice(1), res] as [string, ...unknown[]])))
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const alive = () => fetch(BASE + '/api/config').then((r) => r.ok, () => false)
const until = async (f: () => boolean, msg: string) => { for (let i = 0; i < 100 && !f(); i++) await wait(30); assert.ok(f(), msg) }

const mcq = (id: string) => ({ id, type: 'mcq', prompt: id, time: 30, points: 1000, data: { options: ['a', 'b'], correct: 1 } })
const lesson = await post('/api/lessons', { title: 'Blindaje', emoji: 'flask', questions: [mcq('q1'), mcq('q2'), mcq('q3')] })
const { pin } = await post('/api/rooms', { lessonId: lesson.id })
const host = hostSocket()
let st: any
host.on('state', (s) => (st = s))
assert.ok(await ack(host, 'host:open', pin))

// 1. un objeto con toString inválido hacía lanzar String() y tumbaba el proceso entero
const rude = io(BASE)
await ack(rude, 'player:join', pin, { toString: 1 }, { toString: 1 }, { toString: 1 }, { toString: 1 })
await ack(rude, 'player:join', { toString: 1 }, 'x', 'y', undefined, undefined)
rude.emit('host:style', pin, { toString: 1 })
await wait(200)
assert.ok(await alive(), 'el servidor sobrevive a tipos raros en player:join')
rude.disconnect()

// 2. la URL codificada (/%61pi = /api) se saltaba el login
for (const p of ['/%61pi/lessons', '/a%70i/reports', '/%61pi/rooms', `/%61pi/lessons/${lesson.id}`]) {
  const r = await fetch(BASE + p)
  assert.ok(r.status === 401 || !(await r.text()).includes('Blindaje'), `${p} no filtra datos sin sesión (status ${r.status})`)
}
assert.equal((await fetch(BASE + '/%61pi/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 401, 'POST codificado exige sesión')

// 3. el id es público (ranking), pero sin la clave secreta no sirve para suplantar
const vic = io(BASE), bad = io(BASE)
const v = await ack(vic, 'player:join', pin, 'Victima', 'pix:fox', undefined, undefined)
assert.ok(v.id && v.key, 'al entrar se recibe id y clave')
await until(() => st?.players.length === 1, 'víctima en la sala')
assert.ok(st.players.every((p: any) => !('key' in p) && !('power' in p) && !('armed' in p) && !('results' in p)), 'el ranking público no lleva clave, poderes ni resultados')
const imp = await ack(bad, 'player:join', pin, 'Malo', 'pix:cat', v.id, undefined)
assert.notEqual(imp.id, v.id, 'con el id ajeno y sin clave entra como otro jugador')
const again = io(BASE)
assert.equal((await ack(again, 'player:join', pin, 'Victima', 'pix:fox', v.id, v.key)).id, v.id, 'con id + clave se reconecta como sí mismo')
again.disconnect()
await wait(150)

// 4. el socket viejo que se cae tarde (celular que volvió con otro socket) dejaba al jugador "offline" y cerraba la pregunta
const ghost = io(BASE)
await ack(ghost, 'player:join', pin, 'Victima', 'pix:fox', v.id, v.key) // 2 sockets para la víctima
ghost.disconnect()
await wait(300)
assert.equal(st.players.find((p: any) => p.id === v.id).online, true, 'sigue en línea por el otro socket')

// 5. doble clic en "Empezar" saltaba directo al reveal
host.emit('host:next', pin)
await wait(120)
host.emit('host:next', pin)
await wait(300)
assert.equal(st.phase, 'question', 'el doble clic no cierra la pregunta recién abierta')

// con la víctima en línea sin responder, la respuesta de otro no cierra la pregunta
let meBad: any
bad.on('me', (m) => (meBad = m))
bad.emit('player:answer', 0)
await until(() => meBad?.answered === 0, 'el servidor confirma por el canal personal que la respuesta llegó')
assert.equal(st.phase, 'question', 'no se revela mientras alguien en línea no ha respondido')

// 6. expulsar: solo el profe; el expulsado se entera y ya no cuenta
const kicked = new Promise((r) => bad.once('kicked', r))
vic.emit('host:kick', pin, imp.id) // un estudiante no puede
await wait(200)
assert.ok(st.players.some((p: any) => p.id === imp.id), 'un estudiante no puede expulsar')
host.emit('host:kick', pin, imp.id)
await kicked
await until(() => !st.players.some((p: any) => p.id === imp.id), 'expulsado del ranking')
bad.emit('player:answer', 1) // ya no puede responder
vic.emit('player:answer', 1)
await until(() => st.phase === 'reveal', 'al responder el último que queda, se revela')
assert.equal(st.credit[v.id], 1)
assert.equal(st.credit[imp.id], undefined, 'el expulsado no se califica')

assert.ok(await alive(), 'servidor vivo al final')
;[vic, bad, host].forEach((s) => s.disconnect())
await fetch(BASE + `/api/rooms/${pin}`, { method: 'DELETE', headers: bare })
const reps = await fetch(BASE + '/api/reports', { headers: bare }).then((r) => r.json())
for (const r of reps.filter((x: any) => x.title === 'Blindaje')) await fetch(BASE + `/api/reports/${r.id}`, { method: 'DELETE', headers: bare })
await fetch(BASE + `/api/lessons/${lesson.id}`, { method: 'DELETE', headers: bare })
console.log('ok')
process.exit(0)
