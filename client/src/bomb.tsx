// Papa caliente: contador de bombas escondidas, explosión a pantalla completa y tarjetas de resultado.
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { Bomb, Eye, Skull } from './icons.tsx'
import { FIRE, Sparks } from './power.tsx'
import { Avatar } from './ui.tsx'

type P = { id: string; name: string; avatar: string }

/** «N bombas escondidas»: nadie sabe quién las tiene. Late más rápido en los últimos 5 s. */
export function BombBadge({ bombs, alive, hot, big }: { bombs: number; alive: number; hot?: boolean; big?: boolean }) {
  if (!bombs) return null
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border-[3px] border-edge bg-ink2 px-3 py-1 font-display ${big ? 'text-2xl' : 'text-base'}`} role="status">
      <span className={`bomb-tick ${hot ? 'hot' : ''}`}><Bomb /></span>
      {bombs} {bombs === 1 ? 'bomba escondida' : 'bombas escondidas'}
      <span className="opacity-60">· {alive} en pie</span>
    </span>
  )
}

/** Explosión a pantalla completa (destello, ondas, metralla y sacudida). Con reduced-motion solo queda la tarjeta. */
export function Explosion() {
  useEffect(() => {
    const main = document.querySelector('main')
    main?.classList.add('shake')
    const t = setTimeout(() => main?.classList.remove('shake'), 600)
    return () => (clearTimeout(t), main?.classList.remove('shake'))
  }, [])
  return createPortal(
    <div className="boom-layer" aria-hidden="true">
      <div className="boom-flash" />
      <div className="boom-ring" />
      <div className="boom-ring" />
      <div className="relative h-1 w-1"><Sparks n={28} spread={260} colors={FIRE} /></div>
    </div>,
    document.body,
  )
}

/** Celular: te explotó la bomba. */
export function BoomCard() {
  return (
    <motion.div initial={{ scale: 2.2, rotate: -12, opacity: 0 }} animate={{ scale: 1, rotate: -2, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 12 }} className="card bg-fire p-6 text-center" role="status">
      <div className="text-7xl"><Bomb className="mx-auto" /></div>
      <h1 className="font-display text-6xl tracking-tight">¡BOOM!</h1>
      <p className="font-bold">Tenías la bomba y no la desactivaste.</p>
      <p className="mt-2 inline-flex items-center gap-2 rounded-full border-2 border-edge bg-white/60 px-3 py-1 text-sm font-bold"><Eye /> Ahora estás en modo observador</p>
    </motion.div>
  )
}

/** Celular: tenías bomba y acertaste. */
export function DefusedCard() {
  return (
    <motion.div initial={{ y: 30, scale: 0.7, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 15, delay: 0.2 }} className="card relative flex items-center gap-3 bg-lime px-4 py-3" role="status">
      <Sparks n={14} spread={90} />
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border-[3px] border-edge bg-white/60 text-3xl"><Bomb /></span>
      <div className="leading-tight"><b className="font-display text-xl">¡Bomba desactivada!</b><div className="text-sm font-bold opacity-80">La tenías y te salvaste. Ya pasó a otro… o no.</div></div>
    </motion.div>
  )
}

/** Celular: ya estás fuera. */
export function SpectatorCard() {
  return (
    <div className="card-dark flex items-center gap-3 p-4" role="status">
      <span className="text-3xl opacity-70"><Skull /></span>
      <div><b className="font-display text-lg">Modo observador</b><p className="text-sm opacity-70">Explotaste, pero puedes seguir la partida y ver quién queda en pie.</p></div>
    </div>
  )
}

/** Proyector: quién explotó y quién se salvó en este reveal. */
export function BombReport({ players, booms, defused, alive }: { players: P[]; booms: string[]; defused: string[]; alive: number }) {
  const by = (ids: string[]) => ids.map((id) => players.find((p) => p.id === id)).filter((p): p is P => !!p)
  const boomed = by(booms), saved = by(defused)
  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 text-center">
      {boomed.length > 0 ? (
        <motion.div initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 13 }} className="card bg-fire p-4">
          <p className="font-display text-5xl"><Bomb className="inline" /> ¡BOOM!</p>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            {boomed.map((p, i) => (
              <motion.span key={p.id} initial={{ scale: 1.6, rotate: 0 }} animate={{ scale: 1, rotate: i % 2 ? 4 : -4 }} transition={{ delay: 0.15 + i * 0.12, type: 'spring' }} className="flex items-center gap-2 rounded-full border-[3px] border-edge bg-paper py-1 pr-4 pl-1 text-edge grayscale">
                <Avatar value={p.avatar} size={40} /><b>{p.name}</b><Skull />
              </motion.span>
            ))}
          </div>
        </motion.div>
      ) : (
        <p className="font-display text-2xl">Nadie explotó… esta vez.</p>
      )}
      {saved.length > 0 && <p className="font-bold"><Bomb className="inline" /> Se salvaron con bomba en mano: {saved.map((p) => p.name).join(', ')}</p>}
      <p className="sticker !text-base">{alive} en pie</p>
    </div>
  )
}
