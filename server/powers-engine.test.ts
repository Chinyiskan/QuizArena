// Motor de poderes sin azar: se asigna el poder a mano y se comprueba el puntaje de Robo, Apuesta, Doble y Escudo. pnpm test
// (usa salas en memoria con un Socket.IO falso; no llega al podio, así que no escribe reportes)
import assert from 'node:assert/strict'
import { addPlayer, answer, createRoom, getRoom, initGame, next, usePower } from './game.ts'

const hostRoom = new Set(['host-socket']) // un profe "conectado": así también se arma el panel (dashOf) en cada broadcast
initGame({ to: () => ({ emit() {} }), sockets: { adapter: { rooms: new Map([['*:host', hostRoom]]) } } } as any)
const mcq = (id: string) => ({ id, type: 'mcq' as const, prompt: id, time: 20, points: 1000, data: { options: ['a', 'b', 'c', 'd'], correct: 1 } })
const lesson = { id: 'l', updatedAt: 0, title: 'motor', emoji: 'flask', folder: '', cover: '', questions: [mcq('1'), mcq('2'), mcq('3'), mcq('4')] }

const nextQ = (r: Parameters<typeof next>[0]) => (next(r), next(r)) // reveal -> tabla de posiciones -> pregunta (el 2.º next salta los 5 s)
function setup() {
  const r = getRoom(createRoom(lesson))!
  const [lead, thief, other] = ['Líder', 'Ladrón', 'Otro'].map((n) => addPlayer(r, n, 'pix:fox') as Exclude<ReturnType<typeof addPlayer>, 'locked'>)
  r.style = 'classic' // sin drops al azar: los poderes se dan a mano
  next(r) // pregunta 1: solo el líder suma
  answer(r, lead.id, 1); answer(r, thief.id, 0); answer(r, other.id, 0)
  r.style = 'powers'
  return { r, lead, thief, other }
}

// Robo: acierta rápido y le quita el 10 % al 1.º
{
  const { r, lead, thief, other } = setup()
  const before = lead.score
  nextQ(r) // pregunta 2
  thief.power = 'steal'
  usePower(r, thief.id)
  assert.equal(thief.armed, 'steal')
  answer(r, lead.id, 0); answer(r, thief.id, 1); answer(r, other.id, 0)
  const st = r.steals.get(thief.id)!
  assert.equal(st.from, lead.id)
  assert.equal(st.amount, Math.round(before * 0.1), 'roba el 10 %')
  assert.equal(lead.score, before - st.amount)
  assert.equal(r.gained.get(lead.id), -st.amount, 'la víctima ve el descuento')
}

// Escudo del líder bloquea el robo
{
  const { r, lead, thief, other } = setup()
  const before = lead.score
  nextQ(r)
  thief.power = 'steal'; usePower(r, thief.id)
  lead.power = 'shield'; usePower(r, lead.id)
  answer(r, lead.id, 0); answer(r, thief.id, 1); answer(r, other.id, 0)
  assert.deepEqual(r.steals.get(thief.id), { from: lead.id, amount: 0, blocked: true })
  assert.equal(lead.score, before, 'el escudo lo protege')
}

// Apuesta: perder descuenta lo que valía (sin bajar de 0); ganar triplica
{
  const { r, lead, thief, other } = setup()
  const before = lead.score
  nextQ(r)
  lead.power = 'bet'; usePower(r, lead.id)
  other.power = 'bet'; usePower(r, other.id)
  answer(r, lead.id, 0); answer(r, thief.id, 0); answer(r, other.id, 1)
  assert.equal(lead.score, Math.max(0, before - 1000), 'apuesta perdida')
  assert.ok(other.score > 2000, `apuesta ganada x3 (${other.score})`)
}

// Doble y Escudo de racha
{
  const { r, lead, thief, other } = setup()
  nextQ(r)
  lead.power = 'x2'; usePower(r, lead.id)
  thief.streak = 3; thief.power = 'shield'; usePower(r, thief.id)
  answer(r, lead.id, 1); answer(r, thief.id, 0); answer(r, other.id, 1)
  assert.ok(r.gained.get(lead.id)! > r.gained.get(other.id)! * 1.8, 'doble duplica')
  assert.equal(thief.streak, 3, 'el escudo conserva la racha')
}
console.log('ok')
process.exit(0)

// Tabla de posiciones: el reveal pasa por 5 s de tabla antes de la pregunta (un segundo next la salta)
{
  const { r } = setup()
  next(r)
  assert.ok(r.boardUntil > Date.now() && r.phase === 'reveal', 'primero la tabla')
  next(r)
  assert.ok(r.phase === 'question' && r.boardUntil === 0, 'el 2.º next la salta')
}
