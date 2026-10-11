import { useMemo, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { types, type Question } from '../../../shared/questions.ts'
import type { DashView, LiveView } from '../lib.ts'
import { Avatar, Ring } from '../ui.tsx'
import { registry } from '../types/registry.tsx'
import { SHAPES, optStyle } from '../types/choice.tsx'
import { pct, tone } from '../stats.tsx'
import { Bulb, Check, Flame, Hand, Minus, Offline, Skull, Warn, X } from '../icons.tsx'

type Player = LiveView['players'][number]
type Key = 'ok' | 'part' | 'bad' | 'wait' | 'none' | 'off' | 'out'
type Status = { key: Key; label: string; icon: ReactNode; tile: string }
type Filter = 'all' | 'pending' | 'ok' | 'part' | 'bad' | 'off'
type Sort = 'score' | 'status' | 'name'

const SHORT: Record<Key, string> = { ok: 'Bien', part: 'Parcial', bad: 'Mal', wait: 'Piensa', none: 'Falta', off: 'Offline', out: 'Fuera' } // fichas chicas
const SORT_ORDER: Record<Key, number> = { wait: 0, none: 0, bad: 1, part: 2, ok: 3, off: 4, out: 5 } // "Estado": primero a quien hay que mirar

/** Cómo respondió el grupo, EN VIVO (opción múltiple, selección múltiple y V/F). Marca cuál es la correcta. */
function Dist({ q, dist }: { q: Question; dist: number[] }) {
  if (q.type !== 'mcq' && q.type !== 'multi' && q.type !== 'tf') return null
  const rows =
    q.type === 'tf'
      ? [{ label: 'Verdadero', shape: <Check />, color: 1, right: q.data.correct }, { label: 'Falso', shape: <X />, color: 0, right: !q.data.correct }]
      : q.data.options.map((label, i) => ({ label, shape: SHAPES[i], color: i, right: q.type === 'mcq' ? q.data.correct === i : q.data.correct.includes(i) }))
  const max = Math.max(1, ...dist)
  return (
    <section className="card-dark space-y-1.5 p-3" aria-label="Cómo responde el grupo">
      <h3 className="text-xs font-bold uppercase tracking-wide opacity-60">Respuestas del grupo · <Check className="inline text-lime" /> correcta</h3>
      {rows.map((r, i) => (
        <div key={i} style={optStyle(r.color)} className={`rounded-lg p-1 ${r.right ? 'bg-lime/15 outline outline-2 outline-lime' : ''}`}>
          <div className="flex items-start gap-2 text-sm leading-snug">
            <span className="mt-0.5 w-4 shrink-0 text-center">{r.shape}</span>
            <span className={`min-w-0 flex-1 break-words ${r.right ? 'font-extrabold' : 'opacity-80'}`} title={r.label}>{r.label}</span>
            {r.right && <Check className="mt-0.5 shrink-0 text-lime" aria-label="correcta" />}
            <span className="w-7 shrink-0 text-right font-display text-lg leading-none tabular-nums">{dist[i]}</span>
          </div>
          <div className="mt-0.5 ml-6 h-2 rounded-full bg-white/10">
            <motion.div
              animate={{ width: `${(dist[i] / max) * 100}%` }}
              transition={{ type: 'spring', stiffness: 160, damping: 22 }}
              className={`h-full rounded-full ${dist[i] ? '' : 'invisible'}`}
              style={{ background: 'var(--c)', opacity: r.right ? 1 : 0.6 }}
            />
          </div>
        </div>
      ))}
    </section>
  )
}

/** Contador del resumen: icono de color + número (+ nombre en pantallas anchas). */
function Count({ icon, color, n, label }: { icon: ReactNode; color: string; n: number; label: string }) {
  return (
    <span className="flex items-center gap-1.5" title={label}>
      <span className="grid h-7 w-7 place-items-center rounded-lg border-[3px] border-edge text-sm text-edge" style={{ background: color }}>{icon}</span>
      <b className="font-display text-2xl leading-none tabular-nums">{n}</b>
      <span className="hidden text-xs font-bold uppercase tracking-wide opacity-60 2xl:inline">{label}</span>
    </span>
  )
}

/**
 * Mesa de control del profe en vivo (el profe no comparte pantalla; es SU panel). En escritorio ocupa exactamente la
 * ventana, sin scroll de página: arriba pregunta + reloj + acciones + resumen del grupo; a la izquierda un muro con
 * todos los estudiantes (filtro y orden); a la derecha, lo que necesita saber de la pregunta (solución, distribución,
 * errores comunes, explicación). En pantallas chicas todo se apila y la página se desplaza.
 */
export default function Control({ s, d, left, header, controls, extra, onKick }: {
  s: LiveView
  d: DashView | null
  left: number
  header: ReactNode
  controls: ReactNode
  extra?: ReactNode // papa caliente, robos, poderes nuevos…
  onKick: (p: { id: string; name: string }) => void
}) {
  const reveal = s.phase === 'reveal'
  const q = d?.key ?? s.question
  const R = q && registry[q.type]
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('score')

  const answered = useMemo(() => new Set(d?.answered ?? []), [d])
  const credit = (p: Player) => (answered.has(p.id) ? d?.credit[p.id] : undefined)

  const status = (p: Player): Status => {
    const c = credit(p)
    if (p.out !== undefined) return { key: 'out', label: 'Eliminado', icon: <Skull />, tile: 'border-white/15 bg-ink2 opacity-60' }
    if (c === 1) return { key: 'ok', label: 'Bien', icon: <Check />, tile: 'border-edge bg-lime text-edge shadow-[0_3px_0_var(--color-edge)]' }
    if (c !== undefined && c > 0) return { key: 'part', label: 'Parcial', icon: <Minus />, tile: 'border-edge bg-sun text-edge shadow-[0_3px_0_var(--color-edge)]' }
    if (c === 0) return { key: 'bad', label: 'Mal', icon: <X />, tile: 'border-edge bg-pink text-white shadow-[0_3px_0_var(--color-edge)]' }
    if (!p.online) return { key: 'off', label: 'Sin conexión', icon: <Offline />, tile: 'border-dashed border-white/25 bg-ink2 opacity-60' }
    return reveal
      ? { key: 'none', label: 'Sin responder', icon: <Minus />, tile: 'border-pink bg-ink3 text-pink' }
      : { key: 'wait', label: 'Pensando…', icon: <Hand />, tile: 'border-cyan/70 bg-ink3 text-cyan' }
  }

  const sts = new Map(s.players.map((p) => [p, status(p)]))
  const n = (k: Key) => s.players.filter((p) => sts.get(p)!.key === k).length
  const count = { ok: n('ok'), part: n('part'), bad: n('bad'), wait: n('wait') + n('none'), off: n('off') }
  const playing = s.players.filter((p) => p.out === undefined).length
  const done = count.ok + count.part + count.bad
  const accuracy = done ? s.players.reduce((a, p) => a + (credit(p) ?? 0), 0) / done : null

  const FILTERS: [Filter, string, number][] = [
    ['all', 'Todos', s.players.length],
    ['pending', reveal ? 'Sin responder' : 'Faltan', count.wait],
    ['ok', 'Bien', count.ok],
    ['part', 'Parcial', count.part],
    ['bad', 'Mal', count.bad],
    ['off', 'Sin conexión', count.off],
  ]
  const keep = (p: Player) => {
    const k = sts.get(p)!.key
    return filter === 'all' || (filter === 'pending' ? k === 'wait' || k === 'none' : k === filter)
  }
  const rank = new Map(s.players.map((p, i) => [p, i + 1]))
  const rows = s.players.filter(keep).sort(
    sort === 'name' ? (a, b) => a.name.localeCompare(b.name, 'es')
    : sort === 'status' ? (a, b) => SORT_ORDER[sts.get(a)!.key] - SORT_ORDER[sts.get(b)!.key] || rank.get(a)! - rank.get(b)!
    : (a, b) => rank.get(a)! - rank.get(b)!,
  )

  const dense = rows.length > 16 // muchos estudiantes: fichas más chicas para que quepan todos sin desplazarse
  const choice = !!q && (q.type === 'mcq' || q.type === 'multi' || q.type === 'tf') && !!d?.dist // la distribución ya marca la correcta
  const seg = (k: number, color: string) => (k ? <div key={color} className="h-full transition-[width] duration-300" style={{ width: `${(k / Math.max(1, playing)) * 100}%`, background: color }} /> : null)

  return (
    <main className="mx-auto flex w-full max-w-[1920px] flex-col gap-3 p-3 lg:h-dvh lg:overflow-hidden lg:p-4">
      {header}

      <section className="card-dark grid shrink-0 items-center gap-x-5 gap-y-3 p-3 lg:grid-cols-[auto_minmax(0,1fr)_auto]" aria-label="Pregunta en curso">
        {s.phase === 'question' && q ? <Ring left={left} total={Math.max(q.time, left)} /> : <span className="grid h-20 w-20 place-items-center rounded-full border-[3px] border-lime text-4xl text-lime" title="Resultado" role="img" aria-label="Resultado"><Check /></span>}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="sticker !text-sm">Pregunta {s.index + 1}/{s.total}</span>
            {q && <span className="text-xs font-bold uppercase tracking-wide opacity-60">{types[q.type].label} · {q.points} pts</span>}
          </div>
          <h1 className="mt-1 line-clamp-2 text-xl leading-tight font-extrabold 2xl:text-2xl" title={q?.prompt}>{q?.prompt}</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">{controls}</div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 lg:col-span-3" role="status" aria-live="polite" aria-label="Resumen en vivo">
          <span className="font-display text-2xl tabular-nums" title="Han respondido">{done}<span className="opacity-50">/{playing}</span> <span className="text-xs font-bold uppercase tracking-wide opacity-60">respondieron</span></span>
          <div className="flex h-6 min-w-40 flex-1 overflow-hidden rounded-full border-[3px] border-edge bg-white/10" aria-hidden="true">
            {seg(count.ok, 'var(--color-lime)')}{seg(count.part, 'var(--color-sun)')}{seg(count.bad, 'var(--color-pink)')}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Count icon={<Check />} color="var(--color-lime)" n={count.ok} label="Bien" />
            <Count icon={<Minus />} color="var(--color-sun)" n={count.part} label="Parcial" />
            <Count icon={<X />} color="var(--color-pink)" n={count.bad} label="Mal" />
            <Count icon={<Hand />} color="var(--color-cyan)" n={count.wait} label={reveal ? 'Sin responder' : 'Faltan'} />
            {count.off > 0 && <Count icon={<Offline />} color="var(--color-paper)" n={count.off} label="Sin conexión" />}
          </div>
          {accuracy !== null && <span className="font-display text-2xl tabular-nums" style={{ color: tone(accuracy) }} title="Acierto del grupo">{pct(accuracy)} <span className="text-xs font-bold uppercase tracking-wide opacity-60">acierto</span></span>}
        </div>
      </section>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_clamp(21rem,27vw,30rem)]">
        <section className="card-dark flex min-h-0 flex-col gap-2.5 p-3" aria-label="Estudiantes">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="text-lg font-extrabold">Estudiantes <span className="opacity-50">{s.players.length}</span></h2>
            <div role="radiogroup" aria-label="Filtrar estudiantes" className="flex flex-wrap gap-1.5">
              {FILTERS.filter(([k, , c]) => k === 'all' || k === filter || c > 0).map(([k, label, c]) => (
                <button key={k} role="radio" aria-checked={filter === k} onClick={() => setFilter(k)} className={`rounded-full border-[3px] border-edge px-2.5 py-0.5 text-sm font-bold ${filter === k ? 'bg-lime text-edge' : 'bg-white/10'}`}>
                  {label}<span className="ml-1 opacity-70">{c}</span>
                </button>
              ))}
            </div>
            <label className="ml-auto flex items-center gap-2 text-sm font-bold">
              Ordenar
              <select className="input !w-auto !py-0.5 !text-base" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="score">Puntos</option>
                <option value="status">Estado (faltan primero)</option>
                <option value="name">Nombre</option>
              </select>
            </label>
          </div>

          {s.players.length === 0 && <p className="m-auto p-6 text-center font-bold opacity-60">Aún no hay estudiantes.</p>}
          {s.players.length > 0 && rows.length === 0 && <p className="m-auto p-6 text-center font-bold opacity-60">{filter === 'pending' ? 'Todos respondieron.' : 'Nadie en este grupo.'}</p>}
          <ol className={`grid min-h-0 flex-1 auto-rows-min content-start gap-2 overflow-y-auto p-1 ${dense ? 'grid-cols-[repeat(auto-fill,minmax(clamp(10.5rem,11vw,14rem),1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))]'}`}>
            {rows.map((p) => {
              const st = sts.get(p)!
              const gain = s.gained[p.id]
              return (
                <motion.li key={p.id} layout transition={{ type: 'spring', stiffness: 400, damping: 32 }} className={`group relative flex items-center gap-2 rounded-xl border-[3px] p-1.5 pr-2 ${st.tile}`}>
                  <span className="absolute -top-2 -left-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-edge bg-paper px-1 font-display text-[11px] leading-none text-edge" title={`Puesto ${rank.get(p)}`}>{rank.get(p)}</span>
                  <Avatar value={p.avatar} size={dense ? 36 : 42} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${p.online ? 'bg-lime outline outline-2 outline-edge' : 'bg-edge/40'}`} title={p.online ? 'conectado' : 'sin conexión'} />
                      <span className="truncate" title={p.name}>{p.name}</span>
                      {p.streak >= 3 && <span className="flex shrink-0 items-center text-xs font-bold text-fire" title={`racha de ${p.streak}`}><Flame />{p.streak}</span>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs font-extrabold">
                      <span className="shrink-0">{st.icon}</span>
                      <span className="truncate">{dense ? SHORT[st.key] : st.label}</span>
                      <span className="ml-auto shrink-0 font-display text-lg leading-none tabular-nums">{p.score}</span>
                    </div>
                  </div>
                  {reveal && !!gain && <span className="absolute -top-2 -right-1.5 rounded-full border-2 border-edge bg-paper px-1.5 font-display text-[11px] leading-5 text-edge group-hover:hidden group-focus-within:hidden">{gain > 0 ? '+' : '−'}{Math.abs(gain)}</span>}
                  <button type="button" className="absolute -top-2 -right-1.5 hidden h-6 w-6 place-items-center rounded-full border-2 border-edge bg-pink text-white group-hover:grid group-focus-within:grid" onClick={() => onKick(p)} aria-label={`Sacar a ${p.name}`} title="Sacar de la partida"><X /></button>
                </motion.li>
              )
            })}
          </ol>
        </section>

        <aside className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto lg:pr-1" aria-label="La pregunta">
          {extra}
          {choice && q && d?.dist && <Dist q={q} dist={d.dist} />}
          {!choice && q && R && (
            <section className="card-dark space-y-2 p-3">
              <h3 className="text-xs font-bold uppercase tracking-wide opacity-60">Respuesta correcta <span className="normal-case">(solo la ves tú)</span></h3>
              <R.Correct q={q} />
            </section>
          )}
          {d && d.wrong.length > 0 && !choice && ( // en opciones la distribución ya muestra cuáles eligieron mal
            <section className="card-dark space-y-2 p-3" aria-label="Equivocaciones más comunes">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide opacity-60"><Warn /> Equivocaciones más comunes</h3>
              {d.wrong.map((w) => (
                <div key={w.label} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0 break-words font-bold">«{w.label}»</span>
                  <span className="shrink-0 rounded-md bg-pink px-2 font-display text-white">×{w.n}</span>
                </div>
              ))}
            </section>
          )}
          {q?.explanation && (
            <section className="card-dark flex gap-2.5 p-3" aria-label="Explicación">
              <Bulb className="mt-0.5 shrink-0 text-sun" />
              <p className="max-h-36 overflow-y-auto text-sm leading-snug">{q.explanation}</p>
            </section>
          )}
        </aside>
      </div>
    </main>
  )
}
