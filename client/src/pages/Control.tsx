import { useMemo, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import type { Question } from '../../../shared/questions.ts'
import type { DashView, LiveView } from '../lib.ts'
import { Avatar, Explanation, Ring } from '../ui.tsx'
import { registry } from '../types/registry.tsx'
import { SHAPES, optStyle } from '../types/choice.tsx'
import { Bar, pct, tone } from '../stats.tsx'
import { Check, Flame, Hand, Minus, Offline, Skull, Warn, X } from '../icons.tsx'

type Player = LiveView['players'][number]
type Status = { key: string; label: string; icon: ReactNode; cls: string }

/** Cómo respondió el grupo, EN VIVO (solo tipos de opciones). Los estudiantes no ven esto mientras responden. */
function Dist({ q, dist }: { q: Question; dist: number[] }) {
  if (q.type !== 'mcq' && q.type !== 'multi' && q.type !== 'tf') return null
  const rows =
    q.type === 'tf'
      ? [{ label: 'Verdadero', shape: <Check />, color: 1, right: q.data.correct }, { label: 'Falso', shape: <X />, color: 0, right: !q.data.correct }]
      : q.data.options.map((label, i) => ({ label, shape: SHAPES[i], color: i, right: q.type === 'mcq' ? q.data.correct === i : q.data.correct.includes(i) }))
  const max = Math.max(1, ...dist)
  return (
    <section className="card-dark space-y-2 p-4" aria-label="Cómo responde el grupo">
      <h3 className="text-sm uppercase tracking-wide opacity-60">Cómo responde el grupo</h3>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2" style={optStyle(r.color)}>
          <span className="w-5 text-center">{r.shape}</span>
          <span className={`w-28 truncate text-sm ${r.right ? 'font-extrabold' : 'opacity-70'}`}>{r.right && <Check className="mr-1 inline" />}{r.label}</span>
          <div className="h-5 flex-1 rounded-md bg-white/10">
            <motion.div
              animate={{ width: `${(dist[i] / max) * 100}%` }}
              transition={{ type: 'spring', stiffness: 160, damping: 22 }}
              className={`h-full rounded-md border-[3px] border-edge ${dist[i] ? '' : 'invisible'}`}
              style={{ background: 'var(--c)', opacity: r.right ? 1 : 0.55 }}
            />
          </div>
          <span className="w-7 text-right font-display text-lg tabular-nums">{dist[i]}</span>
        </div>
      ))}
    </section>
  )
}

/** Tarjeta de número grande (bien / mal / faltan…). */
function Tile({ label, value, color, icon }: { label: string; value: number | string; color?: string; icon: ReactNode }) {
  return (
    <div className="card-dark flex items-center gap-3 p-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-[3px] border-edge text-xl text-edge" style={{ background: color ?? 'var(--color-paper)' }}>{icon}</span>
      <div className="leading-tight">
        <div className="font-display text-3xl tabular-nums">{value}</div>
        <div className="text-xs font-bold uppercase tracking-wide opacity-60">{label}</div>
      </div>
    </div>
  )
}

/**
 * Mesa de control del profe en vivo. No es una pantalla para proyectar (el profe no comparte pantalla):
 * qué pregunta va, quién respondió y quién falta, cuántos bien y mal EN VIVO, la solución y el podio completo.
 */
export default function Control({ s, d, left, controls, extra, onKick }: {
  s: LiveView
  d: DashView | null
  left: number
  controls: ReactNode
  extra?: ReactNode // papa caliente, robos, poderes nuevos…
  onKick: (p: { id: string; name: string }) => void
}) {
  const reveal = s.phase === 'reveal'
  const q = d?.key ?? s.question
  const R = q && registry[q.type]
  const [onlyPending, setOnlyPending] = useState(false)

  const answered = useMemo(() => new Set(d?.answered ?? []), [d])
  const credit = (p: Player) => (answered.has(p.id) ? d?.credit[p.id] : undefined)
  const playing = s.players.filter((p) => p.out === undefined)
  const done = playing.filter((p) => answered.has(p.id))
  const right = done.filter((p) => credit(p) === 1).length
  const partial = done.filter((p) => (credit(p) ?? 0) > 0 && credit(p)! < 1).length
  const wrong = done.length - right - partial
  const pending = playing.filter((p) => !answered.has(p.id) && p.online)
  const offline = s.players.filter((p) => !p.online).length
  const accuracy = done.length ? done.reduce((a, p) => a + (credit(p) ?? 0), 0) / done.length : null

  const status = (p: Player): Status => {
    const c = credit(p)
    if (p.out !== undefined) return { key: 'out', label: 'Eliminado', icon: <Skull />, cls: 'bg-white/10' }
    if (c === 1) return { key: 'ok', label: 'Bien', icon: <Check />, cls: 'bg-lime text-edge' }
    if (c !== undefined && c > 0) return { key: 'part', label: 'Parcial', icon: <Minus />, cls: 'bg-sun text-edge' }
    if (c === 0) return { key: 'bad', label: 'Mal', icon: <X />, cls: 'bg-pink text-white' }
    if (!p.online) return { key: 'off', label: 'Desconectado', icon: <Offline />, cls: 'bg-white/10' }
    return reveal
      ? { key: 'none', label: 'Sin responder', icon: <Minus />, cls: 'border-2 border-pink text-pink' }
      : { key: 'wait', label: 'Pensando…', icon: <Hand />, cls: 'border-2 border-cyan text-cyan' }
  }

  const rows = onlyPending ? s.players.filter((p) => p.out === undefined && !answered.has(p.id)) : s.players

  return (
    <div className="space-y-4">
      <section className="card-dark flex flex-wrap items-center gap-4 p-4">
        {s.phase === 'question' && q ? <Ring left={left} total={q.time} /> : <span className="sticker !text-base">Resultado</span>}
        <div className="min-w-0 flex-1">
          <span className="sticker !text-sm">Pregunta {s.index + 1}/{s.total}</span>
          <h1 className="mt-1 line-clamp-2 text-xl leading-tight font-extrabold sm:text-2xl" title={q?.prompt}>{q?.prompt}</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">{controls}</div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Resumen en vivo" aria-live="polite">
        <Tile label="Contestaron" value={`${done.length}/${playing.length}`} icon={<Hand />} color="var(--color-cyan)" />
        <Tile label="Bien" value={right + (partial ? `+${partial}` : '')} icon={<Check />} color="var(--color-lime)" />
        <Tile label="Mal" value={wrong} icon={<X />} color="var(--color-pink)" />
        <Tile label={offline ? `Faltan · ${offline} sin conexión` : 'Faltan'} value={pending.length} icon={offline ? <Offline /> : <Minus />} color="var(--color-sun)" />
      </section>
      {accuracy !== null && (
        <div className="flex items-center gap-3 px-1 text-sm font-bold">
          <span className="w-28 opacity-70">Acierto del grupo</span>
          <Bar value={accuracy} color={tone(accuracy)} />
          <span className="w-12 text-right font-display text-lg">{pct(accuracy)}</span>
        </div>
      )}

      {extra}

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <section className="card space-y-2 p-3 text-edge" aria-label="Estudiantes">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <h2 className="text-lg font-extrabold">Estudiantes ({s.players.length})</h2>
            {!reveal && (
              <button type="button" role="switch" aria-checked={onlyPending} onClick={() => setOnlyPending(!onlyPending)} className={`rounded-full border-[3px] border-edge px-3 py-0.5 text-sm font-bold ${onlyPending ? 'bg-cyan' : 'bg-paper'}`}>
                Solo los que faltan
              </button>
            )}
          </div>
          {rows.length === 0 && <p className="p-4 text-center font-bold opacity-60">{onlyPending ? 'Todos respondieron.' : 'Aún no hay estudiantes.'}</p>}
          <ol className="space-y-1.5">
            {rows.map((p) => {
              const st = status(p)
              const rank = s.players.indexOf(p)
              const gain = s.gained[p.id]
              return (
                <motion.li key={p.id} layout transition={{ type: 'spring', stiffness: 400, damping: 32 }} className={`flex items-center gap-2 rounded-xl border-[3px] border-edge p-1.5 pr-2 ${p.out !== undefined ? 'out-row' : 'bg-white/60'}`}>
                  <span className="w-6 text-center font-display text-lg sm:w-7">{rank + 1}</span>
                  <Avatar value={p.avatar} size={34} />
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate font-bold">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${p.online ? 'bg-lime outline outline-2 outline-edge' : 'bg-edge/30'}`} title={p.online ? 'conectado' : 'sin conexión'} />
                    <span className="truncate">{p.name}</span>
                  </span>
                  {p.streak >= 3 && <span className="hidden items-center gap-0.5 text-sm font-bold text-fire sm:flex" title={`racha de ${p.streak}`}><Flame />{p.streak}</span>}
                  <span title={st.label} className={`flex h-7 w-8 shrink-0 items-center justify-center gap-1 rounded-lg text-sm font-extrabold sm:w-36 sm:px-2 ${st.cls}`}>{st.icon}<span className="hidden truncate sm:inline">{st.label}</span></span>
                  <span className={`hidden w-12 text-right font-display text-sm sm:block ${gain && gain < 0 ? 'text-pink' : 'text-violet'}`}>{reveal && gain ? `${gain > 0 ? '+' : '−'}${Math.abs(gain)}` : ''}</span>
                  <span className="w-14 text-right font-display text-xl tabular-nums">{p.score}</span>
                  <button type="button" className="grid h-7 w-7 place-items-center rounded-lg opacity-30 hover:bg-pink hover:text-white hover:opacity-100 focus-visible:opacity-100" onClick={() => onKick(p)} aria-label={`Sacar a ${p.name}`} title="Sacar de la partida"><X /></button>
                </motion.li>
              )
            })}
          </ol>
        </section>

        <aside className="space-y-4" aria-label="La pregunta">
          {q && R && (
            <section className="card-dark space-y-2 p-4">
              <h3 className="text-sm uppercase tracking-wide opacity-60">Respuesta correcta <span className="normal-case">(solo la ves tú)</span></h3>
              <R.Correct q={q} />
            </section>
          )}
          {d?.dist && q && <Dist q={q} dist={d.dist} />}
          {d && d.wrong.length > 0 && (
            <section className="card-dark space-y-2 p-4" aria-label="Equivocaciones más comunes">
              <h3 className="flex items-center gap-1.5 text-sm uppercase tracking-wide opacity-60"><Warn /> Equivocaciones más comunes</h3>
              {d.wrong.map((w) => (
                <div key={w.label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-bold" title={w.label}>«{w.label}»</span>
                  <span className="shrink-0 rounded-md bg-pink px-2 font-display text-white">×{w.n}</span>
                </div>
              ))}
            </section>
          )}
          {q && <Explanation text={q.explanation} />}
        </aside>
      </div>
    </div>
  )
}
