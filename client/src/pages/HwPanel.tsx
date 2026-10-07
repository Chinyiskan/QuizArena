import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { api, joinUrl, socket, type HwHostView } from '../lib.ts'
import { copyText } from '../browser.ts'
import { Avatar, Logo, Screen } from '../ui.tsx'
import { Bar, Hardest, Stat, pct } from '../stats.tsx'
import { Back, Check, Homework, Lock } from '../icons.tsx'

/** Panel del profe en una tarea: quién va por dónde y qué preguntas costaron más. */
export default function HwPanel({ s, pin }: { s: HwHostView; pin: string }) {
  const [base, setBase] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => void api('/config').then((c) => setBase(c.publicUrl)), [])

  const url = joinUrl(base, pin)
  const finished = s.players.filter((p) => p.finished).length
  const withAnswers = s.players.filter((p) => p.answered)
  const avg = withAnswers.length ? withAnswers.reduce((a, p) => a + p.accuracy, 0) / withAnswers.length : 0
  return (
    <Screen className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <Logo to="/admin" size="text-2xl" />
        <span className="sticker !text-sm"><Homework className="inline" /> Tarea · {s.title}</span>
        <span className="flex gap-2">
          <Link to="/admin" className="btn btn-ghost"><Back /> Panel</Link>
          {!s.closed && <button className="btn btn-pink !py-1.5" onClick={() => confirm('¿Cerrar la tarea? Nadie más podrá responder.') && socket.emit('host:lock', pin)}>Cerrar tarea</button>}
        </span>
      </header>

      {s.closed && <p className="rounded-xl bg-sun/20 p-3 text-center font-bold"><Lock className="mr-1 inline" /> Tarea cerrada: ya no se aceptan respuestas. Los resultados quedan aquí.</p>}

      {!s.closed && (
        <section className="card flex flex-wrap items-center gap-3 p-4">
          <div className="text-center">
            <div className="text-xs font-bold opacity-60">PIN</div>
            <div className="font-display text-4xl tracking-[0.12em]">{pin}</div>
          </div>
          <input className="input min-w-0 flex-1 !text-base" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Link para estudiantes" />
          <button className="btn btn-cyan" onClick={() => copyText(url).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)), () => {})}>
            {copied ? '¡Copiado!' : 'Copiar link'}
          </button>
        </section>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Stat label="estudiantes" value={String(s.players.length)} />
        <Stat label="terminaron" value={`${finished}/${s.players.length}`} />
        <Stat label="acierto promedio" value={withAnswers.length ? pct(avg) : '—'} />
      </div>

      <section aria-label="Progreso por estudiante" className="space-y-2">
        {s.players.length === 0 && <p className="card-dark p-6 text-center opacity-70">Aún nadie entró. Comparte el link de arriba.</p>}
        {s.players.map((p) => (
          <motion.div key={p.id} layout transition={{ type: 'spring', stiffness: 400, damping: 32 }} className="card flex items-center gap-3 p-2 pr-4">
            <Avatar value={p.avatar} size={44} />
            <div className="w-28 min-w-0 sm:w-40">
              <div className="flex items-center gap-1.5 truncate font-bold">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${p.online ? 'bg-lime' : 'bg-edge/30'}`} title={p.online ? 'conectado' : 'desconectado'} />
                {p.name}
              </div>
              <div className="text-xs opacity-60">{p.finished ? <><Check className="inline text-violet" /> terminó</> : `${p.answered}/${s.total} preguntas`}</div>
            </div>
            <Bar value={s.total ? p.answered / s.total : 0} color="var(--color-violet)" />
            <span className="w-12 text-right font-display" style={{ color: p.answered ? undefined : 'transparent' }} title="acierto">{pct(p.accuracy)}</span>
            <span className="w-16 text-right font-display text-xl tabular-nums">{p.score}</span>
          </motion.div>
        ))}
      </section>

      <Hardest stats={s.qstats} />
    </Screen>
  )
}
