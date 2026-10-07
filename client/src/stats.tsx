import { motion } from 'motion/react'

export const pct = (x: number) => `${Math.round(x * 100)}%`
export const tone = (x: number) => (x < 0.5 ? 'var(--color-pink)' : x < 0.8 ? 'var(--color-sun)' : 'var(--color-lime)')

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-dark p-4 text-center">
      <div className="font-display text-3xl">{value}</div>
      <div className="text-sm opacity-60">{label}</div>
    </div>
  )
}

export function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-4 flex-1 overflow-hidden rounded-full border-2 border-edge bg-white/10">
      <motion.div initial={{ width: 0 }} animate={{ width: pct(value) }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} className="h-full" style={{ background: color }} />
    </div>
  )
}

export type QStat = { prompt: string; answered: number; accuracy: number | null; wrong?: { label: string; n: number }[] }

/** Preguntas ordenadas de la que más costó a la que menos (solo las que alguien respondió). */
export function Hardest({ stats }: { stats: QStat[] }) {
  const rows = stats
    .map((x, i) => ({ ...x, n: i + 1 }))
    .filter((x) => x.accuracy !== null)
    .sort((a, b) => a.accuracy! - b.accuracy!)
  if (!rows.length) return null
  return (
    <section className="card-dark space-y-2 p-4" aria-label="Preguntas más difíciles">
      <h2 className="text-sm uppercase tracking-wide opacity-60">Preguntas que más costaron</h2>
      {rows.map((x) => (
        <div key={x.n}>
          <div className="flex items-center gap-3">
            <span className="sticker !rotate-0">#{x.n}</span>
            <span className="w-32 truncate text-sm sm:w-64" title={x.prompt}>{x.prompt}</span>
            <Bar value={x.accuracy!} color={tone(x.accuracy!)} />
            <span className="w-12 text-right font-display">{pct(x.accuracy!)}</span>
            <span className="hidden w-16 text-right text-xs opacity-60 sm:inline">{x.answered} resp.</span>
          </div>
          {!!x.wrong?.length && (
            <p className="mt-1 pl-12 text-xs opacity-70">
              Se equivocaron más con: {x.wrong.map((w, i) => <span key={w.label}>{i > 0 && ' · '}<b className="text-pink">«{w.label}»</b> ×{w.n}</span>)}
            </p>
          )}
        </div>
      ))}
    </section>
  )
}
