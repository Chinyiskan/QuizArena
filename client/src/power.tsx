// Poderes del modo en vivo: tarjeta del inventario, aviso de poder nuevo y chispas.
import { useMemo, type ComponentType } from 'react'
import { motion } from 'motion/react'
import { POWERS, type Power } from '../../shared/powers.ts'
import { Gift, PowerBet, PowerFifty, PowerShield, PowerSteal, PowerX2 } from './icons.tsx'

const LOOK: Record<Power, { Icon: ComponentType<{ className?: string }>; bg: string }> = {
  x2: { Icon: PowerX2, bg: 'bg-sun' },
  shield: { Icon: PowerShield, bg: 'bg-cyan' },
  fifty: { Icon: PowerFifty, bg: 'bg-violet' },
  steal: { Icon: PowerSteal, bg: 'bg-pink' },
  bet: { Icon: PowerBet, bg: 'bg-fire' },
}
export const PowerIcon = ({ power, className }: { power: Power; className?: string }) => {
  const { Icon } = LOOK[power]
  return <Icon className={className} />
}

const COLORS = ['var(--color-lime)', 'var(--color-pink)', 'var(--color-cyan)', 'var(--color-sun)', 'var(--color-violet)']
export const FIRE = ['var(--color-fire)', 'var(--color-sun)', '#ff3d3d', 'var(--color-paper)']
/** Ráfaga de chispas desde el centro del contenedor (que debe ser `relative`). CSS puro; se oculta con reduced-motion. */
export function Sparks({ n = 12, spread = 70, colors = COLORS }: { n?: number; spread?: number; colors?: string[] }) {
  const sparks = useMemo(
    () => Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4, d = spread * (0.6 + Math.random() * 0.5)
      return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, c: colors[i % colors.length], delay: Math.random() * 60 }
    }),
    [n, spread, colors],
  )
  return (
    <span className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden="true">
      {sparks.map((s, i) => <i key={i} className="spark" style={{ '--dx': `${s.dx}px`, '--dy': `${s.dy}px`, background: s.c, animationDelay: `${s.delay}ms` } as React.CSSProperties} />)}
    </span>
  )
}

/** Inventario del jugador durante la pregunta: toca para activar. `canUse` = hay algo que el poder pueda hacer ahora. */
export function PowerTray({ power, armed, canUse, onUse }: { power?: Power; armed?: Power; canUse: boolean; onUse: () => void }) {
  if (armed)
    return (
      <motion.div key={armed} initial={{ scale: 0.6, rotate: -6 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 14 }} className={`power-armed card relative flex items-center gap-3 px-4 py-2 ${LOOK[armed].bg}`} role="status">
        <Sparks />
        <PowerIcon power={armed} className="text-3xl" />
        <div className="leading-tight"><b className="font-display text-lg">{POWERS[armed].name} activo</b><div className="text-sm font-bold opacity-80">{POWERS[armed].desc}</div></div>
      </motion.div>
    )
  if (!power) return null
  return (
    <motion.button
      key={power} type="button" disabled={!canUse} onClick={onUse}
      initial={{ scale: 0.4, rotate: 8, opacity: 0 }} animate={{ scale: 1, rotate: -1, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 14 }}
      className={`power-card card relative flex w-full items-center gap-3 px-4 py-2 text-left disabled:opacity-60 ${LOOK[power].bg}`}
      aria-label={`Usar poder ${POWERS[power].name}: ${POWERS[power].desc}`}
    >
      <Sparks n={10} spread={60} />
      <PowerIcon power={power} className="text-3xl" />
      <span className="leading-tight"><b className="font-display text-lg">{POWERS[power].name}</b><span className="block text-sm font-bold opacity-80">{canUse ? POWERS[power].desc : 'No sirve en esta pregunta; guárdalo para otra.'}</span></span>
      {canUse && <span className="sticker ml-auto shrink-0">Usar</span>}
    </motion.button>
  )
}

/** Aviso al revelar: «¡Poder nuevo!». */
export function DropCard({ power }: { power: Power }) {
  return (
    <motion.div initial={{ y: 30, scale: 0.7, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 16, delay: 0.25 }} className={`card relative flex items-center gap-3 px-4 py-3 ${LOOK[power].bg}`} role="status">
      <Sparks n={14} spread={90} />
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border-[3px] border-edge bg-white/60 text-3xl"><Gift /></span>
      <div className="leading-tight"><div className="text-xs font-bold uppercase tracking-wide opacity-70">¡Poder nuevo!</div><b className="font-display text-xl"><PowerIcon power={power} className="mr-1 inline" />{POWERS[power].name}</b><div className="text-sm font-bold opacity-80">{POWERS[power].desc}</div></div>
    </motion.div>
  )
}
