// Prueba de humo del modo automático. Requiere el servidor en :3000 (pnpm start). Se ejecuta con pnpm test:live
import assert from 'node:assert/strict'
import { io } from 'socket.io-client'

import { BASE, H as json, bare, hostSocket } from './test-auth.ts'

const lesson = await fetch(BASE + '/api/lessons', {
  method: 'POST', headers: json,
  body: JSON.stringify({
    title: 'Auto smoke', emoji: 'bolt',
    questions: [
      { id: 'a', type: 'mcq', prompt: 'Uno', time: 10, points: 1000, explanation: 'Porque sí', data: { options: ['x', 'y'], correct: 0 } },
      { id: 'b', type: 'mcq', prompt: 'Dos', time: 10, points: 1000, data: { options: ['x', 'y'], correct: 1 } },
    ],
  }),
}).then((r) => r.json())
const { pin } = await fetch(BASE + '/api/rooms', { method: 'POST', headers: json, body: JSON.stringify({ lessonId: lesson.id }) }).then((r) => r.json())

const host = hostSocket(), p1 = io(BASE)
let st: any
host.on('state', (s) => (st = s))
const until = async (f: () => boolean, msg: string, tries = 150) => { for (let i = 0; i < tries && !f(); i++) await new Promise((r) => setTimeout(r, 30)); assert.ok(f(), msg) }
const ack = (s: typeof p1, ...a: unknown[]) => new Promise<any>((res) => s.emit(...([a[0], ...a.slice(1), res] as [string, ...unknown[]])))

assert.ok(await ack(host, 'host:open', pin))
const j = await ack(p1, 'player:join', pin, 'Ana', 'pix:fox', undefined)
assert.ok(j.id)
await until(() => st?.players.length === 1, 'jugador dentro')
assert.equal(st.auto, false, 'por defecto es manual')

// solo el profe puede cambiar el modo
p1.emit('host:auto', pin, true, 1)
await new Promise((r) => setTimeout(r, 150))
assert.equal(st.auto, false, 'un estudiante no puede activar el automático')

host.emit('host:auto', pin, true, 1)
await until(() => st.auto === true && st.pauseMs === 1000, 'automático activado, pausa de 1 s')

host.emit('host:next', pin)
await until(() => st.phase === 'question', 'empezó')
assert.equal(st.question.explanation, undefined, 'la explicación no viaja mientras se responde')
p1.emit('player:answer', 0)
await until(() => st.phase === 'reveal', 'reveal')
assert.equal(st.question.explanation, 'Porque sí', 'la explicación llega en el reveal')
assert.ok(st.autoLeftMs > 0 && st.autoLeftMs <= 1000 + 8000, 'cuenta regresiva expuesta')

// sin tocar nada, pasa solo a la siguiente
await until(() => st.phase === 'question' && st.index === 1, 'avanza solo a la pregunta 2', 200)
p1.emit('player:answer', 0) // incorrecta
await until(() => st.phase === 'reveal', 'reveal 2')

// pausar el automático: se queda en el reveal
host.emit('host:auto', pin, false)
await until(() => st.auto === false, 'automático apagado')
await new Promise((r) => setTimeout(r, 1500))
assert.equal(st.phase, 'reveal', 'en manual no avanza solo')

// reactivarlo en pleno reveal: el reloj arranca y llega al podio solo
host.emit('host:auto', pin, true, 1)
await until(() => st.phase === 'podium', 'tras la última pregunta pasa solo al podio', 200)

host.emit('host:close', pin)
await fetch(BASE + `/api/lessons/${lesson.id}`, { method: 'DELETE', headers: bare })
const reps = await fetch(BASE + '/api/reports', { headers: bare }).then((r) => r.json())
for (const r of reps.filter((x: any) => x.title === 'Auto smoke')) await fetch(BASE + `/api/reports/${r.id}`, { method: 'DELETE', headers: bare })
console.log('ok')
process.exit(0)
