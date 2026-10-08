// Panel del profe: lo que solo ve él (solución, quién respondió, bien/mal en vivo) y las equivocaciones comunes. pnpm test
// (salas en memoria con un Socket.IO falso que registra qué se emite y a qué canal)
import assert from 'node:assert/strict'
import { answerLabel } from '../shared/questions.ts'
import { addPlayer, answer, createRoom, dashOf, getRoom, hwAnswer, hwHostView, initGame, next, view } from './game.ts'

const sent: { room: string; ev: string; data: any }[] = []
initGame({
  to: (room: string) => ({ emit: (ev: string, data: any) => sent.push({ room, ev, data }) }),
  sockets: { adapter: { rooms: { get: () => ({ size: 1 }) } } }, // hay un profe conectado
} as any)

const mcq = { id: 'a', type: 'mcq' as const, prompt: 'Color del cielo', time: 20, points: 1000, data: { options: ['Rojo', 'Azul', 'Verde'], correct: 1 } }
const open = { id: 'b', type: 'open' as const, prompt: 'Layout moderno', time: 20, points: 1000, data: { answers: ['flexbox'] } }
const lesson = { id: 'l', updatedAt: 0, title: 'panel', emoji: 'flask', folder: '', cover: '', questions: [mcq, open] }
type P = Exclude<ReturnType<typeof addPlayer>, 'locked'>

// ---------- answerLabel: texto legible de lo que respondió ----------
assert.equal(answerLabel(mcq, 0), 'Rojo')
assert.equal(answerLabel(mcq, 99), undefined, 'índice inexistente: sin texto')
assert.equal(answerLabel(mcq, { x: 1 }), undefined, 'respuesta malformada: sin texto')
assert.equal(answerLabel(open, '  floatt  '), 'floatt')
assert.equal(answerLabel(open, ''), '(vacío)')
assert.equal(answerLabel({ ...mcq, type: 'tf', data: { correct: true } } as any, false), 'Falso')
assert.equal(answerLabel({ ...mcq, type: 'multi', data: { options: ['x', 'y', 'z'], correct: [0] } } as any, [2, 0]), 'x + z')
assert.equal(answerLabel({ id: 'o', type: 'order', prompt: 'o', time: 10, points: 1, data: { items: ['a', 'b'] } } as any, ['b', 'a']), undefined, 'ordenar: sin texto útil')

// ---------- en vivo ----------
const r = getRoom(createRoom(lesson))!
const [ana, beto, cami] = ['Ana', 'Beto', 'Cami'].map((n) => addPlayer(r, n, 'pix:fox') as P)
next(r) // pregunta 1
answer(r, ana.id, 1) // bien
answer(r, beto.id, 0) // mal: Rojo
const d = dashOf(r)
assert.deepEqual([...d.answered].sort(), [ana.id, beto.id].sort(), 'el profe ve quién respondió y quién falta (Cami)')
assert.equal(d.credit[ana.id], 1, 'bien EN VIVO, antes de revelar')
assert.equal(d.credit[beto.id], 0, 'mal EN VIVO')
assert.equal(d.credit[cami.id], undefined)
assert.equal((d.key!.data as { correct: number }).correct, 1, 'el profe ve la solución durante la pregunta')
assert.deepEqual(d.dist, [1, 1, 0], 'distribución en vivo')
assert.deepEqual(d.wrong, [{ label: 'Rojo', n: 1 }], 'equivocación más común')

// a los estudiantes NUNCA les llega la solución ni el panel
const pub = view(r)
assert.equal((pub.question!.data as { correct: number }).correct, -1, 'el estado público oculta la solución')
assert.ok(!('answered' in (pub.players[0] as object)) && !('credit' in (pub.players[0] as object)))
const dashes = sent.filter((m) => m.ev === 'dash')
assert.ok(dashes.length > 0 && dashes.every((m) => m.room === `${r.pin}:host`), "'dash' solo viaja por el canal del profe")
assert.ok(sent.filter((m) => m.ev === 'state' && m.room === r.pin).every((m) => m.data.question?.data?.correct !== 1), "'state' público no filtra la solución")

// ---------- tarea: estado de cada estudiante y equivocaciones comunes ----------
const hw = getRoom(createRoom(lesson, 'homework'))!
const [h1, h2, h3] = ['Uno', 'Dos', 'Tres'].map((n) => addPlayer(hw, n, 'pix:fox') as P)
hwAnswer(hw, h1, 1) // mcq bien
hwAnswer(hw, h2, 0) // mcq mal: Rojo
hwAnswer(hw, h3, 0) // mcq mal: Rojo
const v = hwHostView(hw)
assert.deepEqual(v.qstats[0].wrong, [{ label: 'Rojo', n: 2 }], 'en tarea también: la opción equivocada más elegida')
const row = (id: string) => v.players.find((p) => p.id === id)!
assert.ok(row(h1.id).idleMs !== null && row(h1.id).idleMs! < 2000, 'se informa hace cuánto estuvo activo (relativo)')
assert.equal(row(h1.id).pos, 0)
console.log('ok')
