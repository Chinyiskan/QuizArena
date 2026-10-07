import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { api, joinUrl, socket, type HwHostView } from '../lib.ts'
import { copyText } from '../browser.ts'
import { Avatar, Logo, Screen } from '../ui.tsx'
import { Bar, Hardest, Stat, pct } from '../stats.tsx'
import { Back, Check, Clock, Homework, Lock, Offline, Reports, X } from '../icons.tsx'

type Row = HwHostView['players'][number]
const QUIET_MS = 5 * 60e3 // sin actividad por tanto tiempo (y sin terminar) = "quieto": quizá está atascado o se fue

const ago = (ms: number) => (ms < 45e3 ? 'ahora' : ms < 3600e3 ? `hace ${Math.max(1, Math.round(ms / 60e3))} min` : `hace ${Math.round(ms / 3600e3)} h`)
type Filter = 'all' | 'new' | 'going' | 'done' | 'quiet' | 'off'
type Sort = 'score' | 'progress' | 'name' | 'quiet'
const FILTERS: [Filter, string][] = [['all', 'Todos'], ['new', 'Sin empezar'], ['going', 'En curso'], ['done', 'Terminaron'], ['quiet', 'Quietos'], ['off', 'Desconectados']]

/** Panel del profe en una tarea: quién va por dónde, quién necesita atención y qué preguntas costaron más. */
export default function HwPanel({ s, pin }: { s: HwHostView & { at: number }; pin: string }) {
  const [base, setBase] = useState('')
  const [copied, setCopied] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('score')
  const [now, setNow] = useState(performance.now())
  useEffect(() => void api('/config').then((c) => setBase(c.publicUrl)), [])
  useEffect(() => { const t = setInterval(() => setNow(performance.now()), 15e3); return () => clearInterval(t) }, []) // "hace 3 min" avanza solo

  const url = joinUrl(base, pin)
  const idle = (p: Row) => (p.idleMs === null ? null : p.idleMs + (now - s.at)) // idleMs llega relativo: se suma lo que pasó desde que llegó
  const isNew = (p: Row) => p.answered === 0
  const isQuiet = (p: Row) => !p.finished && p.online && (idle(p) ?? 0) >= QUIET_MS && !isNew(p)
  const count = {
    new: s.players.filter(isNew).length,
    done: s.players.filter((p) => p.finished).length,
    going: s.players.filter((p) => !isNew(p) && !p.finished).length,
    quiet: s.players.filter(isQuiet).length,
    off: s.players.filter((p) => !p.online && !p.finished).length,
  }
  const withAnswers = s.players.filter((p) => p.answered)
  const avg = withAnswers.length ? withAnswers.reduce((a, p) => a + p.accuracy, 0) / withAnswers.length : 0

  const keep: Record<Filter, (p: Row) => boolean> = {
    all: () => true, new: isNew, going: (p) => !isNew(p) && !p.finished, done: (p) => p.finished, quiet: isQuiet, off: (p) => !p.online && !p.finished,
  }
  const sorters: Record<Sort, (a: Row, b: Row) => number> = {
    score: (a, b) => b.score - a.score,
    progress: (a, b) => a.answered - b.answered || b.score - a.score, // los más atrasados primero
    name: (a, b) => a.name.localeCompare(b.name, 'es'),
    quiet: (a, b) => (idle(b) ?? -1) - (idle(a) ?? -1),
  }
  const rows = s.players.filter(keep[filter]).sort(sorters[sort])
  const kick = (p: Row) => confirm(`¿Sacar a "${p.name}" de la tarea? Se borra su avance.`) && socket.emit('host:kick', pin, p.id)

  return (
    <Screen className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <Logo to="/admin" size="text-2xl" />
        <span className="sticker !text-sm"><Homework className="inline" /> Tarea · {s.title}</span>
        <span className="flex gap-2">
          {s.reportId && <Link to={`/admin/reports/${s.reportId}`} className="btn btn-cyan !py-1.5"><Reports /> Tabla completa</Link>}
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="estudiantes" value={String(s.players.length)} />
        <Stat label="sin empezar" value={String(count.new)} />
        <Stat label="en curso" value={String(count.going)} />
        <Stat label="terminaron" value={`${count.done}/${s.players.length}`} />
        <Stat label="acierto promedio" value={withAnswers.length ? pct(avg) : '—'} />
      </div>

      {(count.quiet > 0 || count.off > 0) && !s.closed && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border-[3px] border-sun px-4 py-2 text-sm font-bold" role="status">
          {count.quiet > 0 && <span><Clock className="mr-1 inline" />{count.quiet} {count.quiet === 1 ? 'lleva' : 'llevan'} más de 5 min sin avanzar</span>}
          {count.off > 0 && <span><Offline className="mr-1 inline" />{count.off} sin conexión sin terminar</span>}
        </p>
      )}

      <section aria-label="Progreso por estudiante" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="radiogroup" aria-label="Filtrar estudiantes" className="flex flex-wrap gap-1.5">
            {FILTERS.map(([k, label]) => (
              <button key={k} role="radio" aria-checked={filter === k} onClick={() => setFilter(k)} className={`rounded-full border-[3px] border-edge px-3 py-0.5 text-sm font-bold ${filter === k ? 'bg-lime text-edge' : 'bg-white/10'}`}>
                {label}{k !== 'all' && <span className="ml-1 opacity-70">{count[k]}</span>}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm font-bold">
            Ordenar
            <select className="input !w-auto !py-1 !text-base" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="score">Puntos</option>
              <option value="progress">Más atrasados primero</option>
              <option value="quiet">Más quietos primero</option>
              <option value="name">Nombre</option>
            </select>
          </label>
        </div>

        {s.players.length === 0 && <p className="card-dark p-6 text-center opacity-70">Aún nadie entró. Comparte el link de arriba.</p>}
        {s.players.length > 0 && rows.length === 0 && <p className="card-dark p-4 text-center opacity-70">Nadie en este grupo.</p>}
        {rows.map((p) => {
          const i = idle(p)
          const quiet = isQuiet(p)
          return (
            <motion.div key={p.id} layout transition={{ type: 'spring', stiffness: 400, damping: 32 }} className={`card flex items-center gap-3 p-2 pr-3 ${quiet ? '!border-sun' : ''}`}>
              <Avatar value={p.avatar} size={44} />
              <div className="w-32 min-w-0 sm:w-48">
                <div className="flex items-center gap-1.5 truncate font-bold">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${p.online ? 'bg-lime outline outline-2 outline-edge' : 'bg-edge/30'}`} title={p.online ? 'conectado' : 'sin conexión'} />
                  {p.name}
                </div>
                <div className="truncate text-xs opacity-70">
                  {p.finished ? <><Check className="inline text-violet" /> terminó</>
                    : isNew(p) ? 'no ha empezado'
                    : <>va en la {Math.min(p.pos + 1, s.total)}/{s.total}{i !== null && <span className={quiet ? 'font-extrabold text-pink' : ''}> · {ago(i)}</span>}</>}
                </div>
              </div>
              <Bar value={s.total ? p.answered / s.total : 0} color="var(--color-violet)" />
              <span className="w-12 text-right font-display" style={{ color: p.answered ? undefined : 'transparent' }} title="acierto">{pct(p.accuracy)}</span>
              <span className="w-16 text-right font-display text-xl tabular-nums">{p.score}</span>
              <button type="button" className="grid h-8 w-8 place-items-center rounded-lg opacity-30 hover:bg-pink hover:text-white hover:opacity-100 focus-visible:opacity-100" onClick={() => kick(p)} aria-label={`Sacar a ${p.name}`} title="Sacar de la tarea"><X /></button>
            </motion.div>
          )
        })}
      </section>

      <Hardest stats={s.qstats} />
    </Screen>
  )
}
