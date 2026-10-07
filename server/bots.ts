// Jugadores falsos para probar una partida sin 30 celulares: pnpm bots <PIN> [cantidad]
import { io } from 'socket.io-client'
import { blanksOf, parseBlanks, tapTokens } from '../shared/questions.ts'

const [pin, n = '5'] = process.argv.slice(2)
if (!pin) throw new Error('Uso: pnpm bots <PIN> [cantidad]')
const NAMES = ['Luna', 'Mateo', 'Valen', 'Santi', 'Isa', 'Dani', 'Sofi', 'Nico', 'Cami', 'Juli']
const AVATARS = ['fox', 'cat', 'bear', 'panda', 'bunny', 'frog', 'owl', 'penguin', 'pig', 'tiger']
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

function answerFor(q: any) {
  const blanks = q.data.text ? parseBlanks(q.data.text).flatMap((x) => ('options' in x ? [x.options] : [])) : []
  return (
      q.type === 'mcq' ? Math.floor(Math.random() * q.data.options.length)
    : q.type === 'multi' ? q.data.options.flatMap((_: string, j: number) => (Math.random() < 0.4 ? [j] : []))
    : q.type === 'tf' ? Math.random() < 0.5
    : q.type === 'order' ? q.data.items
    : q.type === 'table' ? blanksOf(q.data.rows.flat().join(' ')).map(() => 'x')
    : q.type === 'grid' ? q.data.rows.map(() => Math.floor(Math.random() * q.data.cols.length))
    : q.type === 'tap' ? tapTokens(q.data.text).toks.flatMap((_, i) => (Math.random() < 0.15 ? [i] : []))
    : q.type === 'match' ? q.data.pool
    : q.type === 'sort' ? Object.fromEntries(q.data.pool.map((it: string) => [it, Math.floor(Math.random() * q.data.cats.length)]))
    : q.type === 'drag' ? q.data.bank.slice(0, blanks.length)
    : q.type === 'dropdown' ? blanks.map(pick)
    : q.type === 'fill' ? blanks.map(() => 'x')
    : 'x'
  )
}

for (let i = 0; i < +n; i++) {
  const s = io(process.env.BASE ?? 'http://localhost:3000')
  let last = -1
  s.on('connect', () => s.emit('player:join', pin, `${NAMES[i % 10]}${i >= 10 ? i : ''}`, `pix:${AVATARS[i % 10]}`, undefined, () => {}))
  // modo tarea: responde, mira la retroalimentación y pasa a la siguiente, cada bot a su ritmo
  s.on('hw', (v) => {
    if (v.stage === 'answer') setTimeout(() => s.emit('hw:answer', answerFor(v.question)), 800 + Math.random() * 3000)
    if (v.stage === 'feedback') setTimeout(() => s.emit('hw:next'), 500 + Math.random() * 1500)
  })
  s.on('state', (st) => {
    if (st.phase !== 'question' || st.index === last) return
    last = st.index
    const answer = answerFor(st.question)
    setTimeout(() => s.emit('player:answer', answer), 500 + Math.random() * 6000)
  })
}
console.log(`${n} bots en la sala ${pin}`)
