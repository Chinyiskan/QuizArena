import { useEffect } from 'react'
import { motion } from 'motion/react'
import { socket, useHw } from '../lib.ts'
import { buzz, music, play } from '../sound.ts'
import { Avatar, Confetti, Explanation, CodeBlock, Passage, Screen, SoundButton } from '../ui.tsx'
import { registry } from '../types/registry.tsx'
import { Book, Flag, Flame, Homework, Like, Lock, Mark, Next, Star, StatusIcon, Trophy } from '../icons.tsx'

/** Vista del estudiante en una tarea: avanza a su ritmo, ve la solución al responder y un resumen al terminar. */
export default function HwPlay({ name, avatar }: { name: string; avatar: string }) {
  const v = useHw()

  useEffect(() => (music('game'), () => music(null)), [])
  useEffect(() => {
    if (v?.stage !== 'feedback') return
    const ok = (v.result?.credit ?? 0) > 0
    play(ok ? 'right' : 'wrong')
    buzz(ok ? 80 : [60, 40, 60])
  }, [v?.stage, v?.pos])

  if (!v) return <Screen />
  const q = v.question
  const R = q && registry[q.type]
  const credit = v.result?.credit ?? 0
  const gained = v.result?.gained ?? 0
  const incomplete = !!v.review?.some((r) => r.credit === null) // cerrada o cortada antes de terminar
  const progress = v.stage === 'done' ? 1 : (v.pos + (v.stage === 'feedback' ? 1 : 0)) / v.total

  return (
    <Screen className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <Avatar value={avatar} size={44} />
        <b className="min-w-0 flex-1 truncate">{name}</b>
        <span className="sticker !text-sm"><Star className="inline" /> {v.score}</span>
        <SoundButton />
      </header>

      <div className="h-3 overflow-hidden rounded-full border-2 border-edge bg-white/10" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
        <motion.div className="h-full bg-lime" animate={{ width: `${progress * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
      </div>

      {v.stage === 'answer' && q && R && (
        <>
          <span className="sticker self-start">Pregunta {v.pos + 1}/{v.total}</span>
          <h1 className="text-2xl leading-tight sm:text-3xl">{q.prompt}</h1>
          <Passage text={q.passage} />
          <CodeBlock code={q.code} />
          <R.Player key={v.pos} q={q} onSubmit={(x) => (socket.emit('hw:answer', x), play('submit'))} />
        </>
      )}

      {v.stage === 'feedback' && q && R && (
        <>
          <motion.div
            initial={{ scale: 0.5, rotate: -6 }}
            animate={{ scale: 1, rotate: 0 }}
            className={`card p-6 text-center ${credit === 1 ? 'bg-lime' : credit > 0 ? 'bg-sun' : 'bg-pink !text-white'}`}
          >
            <div className="text-6xl"><StatusIcon credit={credit} className="mx-auto" /></div>
            <h1 className="text-3xl">{credit === 1 ? `¡Bien! +${gained}` : credit > 0 ? `¡Casi! +${gained}` : 'Esta no'}</h1>
            <p className="font-bold opacity-70">
              {credit > 0 && credit < 1 ? `Acertaste ${Math.round(credit * 100)}% · ` : ''}
              {v.streak > 1 ? <><Flame className="inline" /> racha de {v.streak}</> : 'Mira la respuesta correcta'}
            </p>
          </motion.div>
          <h2 className="text-xl leading-tight opacity-80">{q.prompt}</h2>
          <R.Correct q={q} />
          <Explanation text={q.explanation} />
          <button className="btn btn-pink btn-big w-full" autoFocus onClick={() => socket.emit('hw:next')}>
            {v.pos + 1 >= v.total || v.closed ? <>Ver mis resultados <Flag /></> : <>Siguiente <Next /></>}
          </button>
        </>
      )}

      {v.stage === 'done' && (
        <>
          {!incomplete && v.accuracy >= 0.8 && <Confetti />}
          <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="card bg-sun p-6 text-center">
            <div className="text-7xl">{incomplete ? (v.closed ? <Lock className="mx-auto" /> : <Homework className="mx-auto" />) : v.accuracy >= 0.8 ? <Trophy className="mx-auto" /> : v.accuracy >= 0.5 ? <Like className="mx-auto" /> : <Book className="mx-auto" />}</div>
            <h1 className="text-3xl">{incomplete ? (v.closed ? 'La tarea se cerró' : '¡Hasta aquí!') : '¡Tarea completada!'}</h1>
            <p className="font-display text-xl"><Star className="inline" /> {v.score} puntos · {Math.round(v.accuracy * 100)}% de acierto</p>
          </motion.div>
          <section className="card-dark space-y-2 p-4" aria-label="Tus respuestas">
            <h2 className="text-sm uppercase tracking-wide opacity-60">Tus respuestas</h2>
            {v.review?.map((r, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xl"><Mark credit={r.credit} /></span>
                <span className="min-w-0 flex-1 truncate">{i + 1}. {r.prompt}</span>
              </div>
            ))}
          </section>
        </>
      )}
    </Screen>
  )
}
