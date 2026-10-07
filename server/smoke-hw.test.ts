// Prueba de humo del modo tarea. Requiere el servidor en :3000 (pnpm start). Se ejecuta con pnpm test:live
import assert from 'node:assert/strict'
import { io } from 'socket.io-client'

import { BASE, H, bare, hostSocket } from './test-auth.ts'
const call = (p: string, method = 'GET', b?: unknown, headers: Record<string, string> = H) =>
  fetch(BASE + p, { method, headers: b ? headers : Object.fromEntries(Object.entries(headers).filter(([k]) => k !== 'content-type')), body: b ? JSON.stringify(b) : undefined }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))

const { body: lesson } = await call('/api/lessons', 'POST', {
  title: 'Tarea smoke', emoji: 'book',
  questions: [
    { id: 'a', type: 'mcq', prompt: '2+2?', time: 10, points: 1000, data: { options: ['3', '4'], correct: 1 } },
    { id: 'b', type: 'tf', prompt: 'El cielo es verde', time: 10, points: 1000, data: { correct: false } },
    { id: 'c', type: 'fill', prompt: 'Completa', time: 10, points: 1000, data: { text: 'La capital de [Francia] es [París]' } },
  ],
})
const { body: room } = await call('/api/rooms', 'POST', { lessonId: lesson.id, mode: 'homework' })
const pin = room.pin
assert.ok(pin)

// auth: sin token no se lista, no se borra; el PIN sí se puede consultar (lo hace el estudiante)
assert.equal((await call('/api/rooms', 'GET', undefined, {})).status, 401)
assert.equal((await call(`/api/rooms/${pin}`, 'DELETE', undefined, {})).status, 401)
const info = await call(`/api/rooms/${pin}`, 'GET', undefined, {})
assert.equal(info.body.mode, 'homework')

const host = hostSocket(), s1 = io(BASE), s2 = io(BASE)
let hs: any, v1: any, v2: any
host.on('state', (s) => (hs = s))
s1.on('hw', (v) => (v1 = v))
s2.on('hw', (v) => (v2 = v))
const until = async (f: () => boolean, msg = 'timeout') => { for (let i = 0; i < 100 && !f(); i++) await new Promise((r) => setTimeout(r, 30)); assert.ok(f(), msg) }
const ack = (s: typeof s1, ...a: unknown[]) => new Promise<any>((res) => s.emit(...([a[0], ...a.slice(1), res] as [string, ...unknown[]])))

assert.ok(await ack(host, 'host:open', pin))
const j1 = await ack(s1, 'player:join', pin, 'Ana', 'pix:fox', undefined)
const j2 = await ack(s2, 'player:join', pin, 'Beto', 'pix:fox', undefined)
assert.ok(j1.id && j2.id)
await until(() => v1 && v2 && hs?.players.length === 2)

// la solución no viaja mientras se responde
assert.equal(v1.stage, 'answer')
assert.equal(v1.question.data.correct, -1)
assert.equal(v1.pos, 0)
assert.equal(hs.mode, 'homework')

// cada quien a su ritmo: Ana acierta y avanza, Beto sigue en la 1
s1.emit('hw:answer', 1)
await until(() => v1.stage === 'feedback')
assert.equal(v1.result.credit, 1)
assert.equal(v1.question.data.correct, 1, 'tras responder, ve la solución')
s1.emit('hw:answer', 0) // doble envío ignorado
s1.emit('hw:next')
await until(() => v1.stage === 'answer' && v1.pos === 1)
assert.equal(v2.pos, 0, 'Beto no avanza por Ana')

s2.emit('hw:answer', 0) // Beto falla
await until(() => v2.stage === 'feedback' && v2.result.credit === 0)
await until(() => hs.qstats[0].answered === 2)
assert.equal(hs.qstats[0].accuracy, 0.5)

// Ana termina: tf perfecto, fill parcial
s1.emit('hw:answer', false); await until(() => v1.stage === 'feedback'); s1.emit('hw:next')
await until(() => v1.pos === 2 && v1.stage === 'answer')
s1.emit('hw:answer', ['francia', 'x']); await until(() => v1.stage === 'feedback' && v1.result.credit === 0.5)
s1.emit('hw:next')
await until(() => v1.stage === 'done')
assert.equal(v1.review.length, 3)
assert.equal(v1.review[2].credit, 0.5)
await until(() => hs.players.find((p: any) => p.id === j1.id)?.finished)

// el profe cierra la tarea: Beto (a medias) ve sus resultados y ya no puede responder
s2.emit('hw:next')
await until(() => v2.pos === 1 && v2.stage === 'answer')
host.emit('host:lock', pin)
await until(() => v2.stage === 'done' && v2.closed)
assert.equal(v2.review[1].credit, null, 'preguntas sin responder quedan en null')
s2.emit('hw:answer', false)
await new Promise((r) => setTimeout(r, 150))
assert.equal(v2.review[1].credit, null, 'cerrada: no acepta respuestas')
const late = await ack(io(BASE), 'player:join', pin, 'Tarde', 'pix:fox', undefined)
assert.ok(late.error, 'tarea cerrada: no entra nadie nuevo')

// reporte de la tarea: se guarda desde la primera respuesta, queda cerrado al cerrar y sobrevive a eliminar la sala
const reps = (await call('/api/reports')).body
const meta = reps.find((r: any) => r.title === 'Tarea smoke')
assert.ok(meta?.closed, 'reporte de tarea cerrado')
const rep = (await call(`/api/reports/${meta.id}`)).body
assert.deepEqual(rep.players.find((p: any) => p.name === 'Ana').results, [1, 1, 0.5])
assert.deepEqual(rep.players.find((p: any) => p.name === 'Beto').results, [0, null, null])

assert.equal((await call(`/api/rooms/${pin}`, 'DELETE')).status, 200)
assert.ok((await call(`/api/reports/${meta.id}`)).body.title, 'el reporte sobrevive a eliminar la sala')
assert.equal((await call(`/api/reports/${meta.id}`, 'DELETE')).status, 200)
assert.equal((await call('/api/reports', 'GET', undefined, {})).status, 401, 'reportes exigen token')
await call(`/api/lessons/${lesson.id}`, 'DELETE')
console.log('ok')
process.exit(0)
