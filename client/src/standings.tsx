import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Avatar, Confetti, NextIn } from './ui.tsx'
import { Down, Flame, Medal, Skull, Trophy, Up } from './icons.tsx'
import { buzz, play } from './sound.ts'

type P = { id: string; name: string; avatar: string; score: number; streak: number; out?: number }

const BIG = 5 // los primeros 5 con protagonismo; el resto, fichas pequeñas
const names = (xs: P[]) => (xs.length > 2 ? `${xs[0].name}, ${xs[1].name} y ${xs.length - 2} más` : xs.map((x) => x.name).join(' y '))

/** Cuenta de `from` a `to` cuando `go` se activa. */
function Count({ from, to, go }: { from: number; to: number; go: boolean }) {
  const [v, setV] = useState(from)
  useEffect(() => {
    if (!go || from === to) return
    const t0 = performance.now()
    let raf = 0
    const f = (t: number) => {
      const k = Math.min(1, (t - t0) / 900)
      setV(Math.round(from + (to - from) * k))
      if (k < 1) raf = requestAnimationFrame(f)
    }
    raf = requestAnimationFrame(f)
    return () => cancelAnimationFrame(raf)
  }, [go])
  return <>{go ? v : from}</>
}

/**
 * Tabla de posiciones entre el reveal y la siguiente pregunta (~5 s, la dicta el servidor con `boardMs`).
 * Primero se ve el orden de ANTES de la pregunta; al segundo las fichas se reordenan y suben los puntos.
 * El orden previo sale de score − gained: no hace falta ningún dato nuevo del servidor.
 */
export function Standings({ players, gained, meId, index, total, deadline }: { players: P[]; gained: Record<string, number>; meId: string; index: number; total: number; deadline: number }) {
  const [after, setAfter] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAfter(true), 1100); return () => clearTimeout(t) }, [])

  const before = (p: P) => p.score - (gained[p.id] ?? 0)
  const prev = useMemo(() => players.map((p, i) => ({ p, i })).sort((a, b) => before(b.p) - before(a.p) || a.i - b.i).map((x) => x.p), [players, gained])
  const pr = new Map(prev.map((p, i) => [p.id, i]))
  const nr = new Map(players.map((p, i) => [p.id, i]))

  // 10 o menos: todos. Más: los 5 primeros, los 5 últimos y yo.
  const n = players.length
  const shown = players.filter((p, i) => n <= 10 || i < BIG || i >= n - 5 || p.id === meId)
    .sort((a, b) => (after ? nr.get(a.id)! - nr.get(b.id)! : pr.get(a.id)! - pr.get(b.id)!))

  const me = players.find((p) => p.id === meId)
  const myNew = nr.get(meId) ?? -1
  const myPrev = pr.get(meId) ?? -1
  const msg = (() => {
    if (!me) return null
    if (me.out !== undefined) return { tone: 'dark', big: 'Sigues mirando', small: 'Sin bomba, pero con vista de primera fila' }
    const passed = prev.slice(0, myPrev).filter((p) => nr.get(p.id)! > myNew) // iban arriba y ahora están debajo
    const passers = players.slice(0, myNew).filter((p) => pr.get(p.id)! > myPrev) // iban abajo y ahora están arriba
    if (myNew === 0 && myPrev > 0) return { tone: 'up', big: '¡Eres el nuevo líder!', small: passed.length ? `Pasaste a ${names(passed)}` : '' }
    if (myNew === 0) return { tone: 'up', big: '¡Sigues primero!', small: players[1] ? `Ventaja de ${me.score - players[1].score} puntos` : '' }
    if (myNew < myPrev) return { tone: 'up', big: `¡Subiste al #${myNew + 1}!`, small: passed.length ? `Pasaste a ${names(passed)}` : '' }
    if (myNew > myPrev) return { tone: 'down', big: `Bajaste al #${myNew + 1}`, small: passers.length ? (passers.length === 1 ? `${passers[0].name} te pasó. ¡Quítaselo!` : `${names(passers)} te pasaron. ¡A recuperarlo!`) : '' }
    const up = players[myNew - 1]
    return { tone: 'dark', big: `Sigues #${myNew + 1}`, small: up.score === me.score ? `Empatado con ${up.name}` : `A ${up.score - me.score} puntos de ${up.name}` }
  })()
  const climbed = !!me && myNew < myPrev
  useEffect(() => { if (after && climbed) (play('medal'), buzz([30, 30, 60])) }, [after])

  const newLeader = after && players[0].id !== prev[0].id && players[0].id !== meId

  return (
    <>
      {after && myNew === 0 && myPrev > 0 && <Confetti />}
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl leading-none">Tabla de posiciones</h1>
        <span className="sticker">{index + 1}/{total}</span>
      </header>

      <div className="min-h-[5.5rem]" role="status" aria-live="polite">
        {after && msg && (
          <motion.div
            initial={{ scale: 0.6, rotate: -3, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 16 }}
            className={`px-4 py-3 text-center ${msg.tone === 'up' ? 'card bg-lime' : msg.tone === 'down' ? 'card bg-pink !text-white' : 'card-dark'}`}
          >
            <p className="flex items-center justify-center gap-2 font-display text-2xl">
              {msg.tone === 'up' && <Up />}{msg.tone === 'down' && <Down />}{msg.big}
            </p>
            {msg.small && <p className="text-sm font-bold opacity-80">{msg.small}</p>}
          </motion.div>
        )}
      </div>

      <ol className="space-y-2">
        {shown.map((p) => {
          const rank = after ? nr.get(p.id)! : pr.get(p.id)!
          const big = nr.get(p.id)! < BIG
          const d = pr.get(p.id)! - nr.get(p.id)!
          const mineRow = p.id === meId
          return (
            <motion.li
              key={p.id}
              layout
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              className={`flex items-center gap-3 rounded-2xl border-[3px] border-edge text-edge ${mineRow ? 'bg-lime' : 'bg-paper'} ${big ? 'p-2 pr-4' : 'p-1 pr-3 text-sm opacity-90'} ${p.out !== undefined ? 'out-row' : ''} ${after && big && rank === 0 ? 'shadow-[0_4px_0_var(--color-edge)]' : ''}`}
            >
              <span className={`grid place-items-center font-display ${big ? 'w-8 text-xl' : 'w-7 text-base'}`}>{rank < 3 ? <Medal rank={rank} size={big ? '1.6rem' : '1.2rem'} /> : rank + 1}</span>
              <Avatar value={p.avatar} size={big ? 44 : 30} />
              <span className="min-w-0 flex-1 truncate font-bold">{p.name}</span>
              {p.out !== undefined && <Skull aria-label="eliminado" />}
              {p.streak >= 3 && p.out === undefined && <span className="flex items-center gap-0.5 font-display text-fire" aria-label={`racha de ${p.streak}`}><Flame />{p.streak}</span>}
              {after && d !== 0 && (
                <motion.span
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 14, delay: 0.25 }}
                  className={`flex items-center gap-0.5 rounded-full border-2 border-edge px-1.5 font-display text-xs ${d > 0 ? 'bg-lime' : 'bg-pink text-white'}`}
                  aria-label={d > 0 ? `subió ${d}` : `bajó ${-d}`}
                >
                  {d > 0 ? <Up /> : <Down />}{Math.abs(d)}
                </motion.span>
              )}
              <span className={`font-display tabular-nums ${big ? 'text-xl' : 'text-base'}`}><Count from={before(p)} to={p.score} go={after} /></span>
            </motion.li>
          )
        })}
      </ol>

      {n > shown.length && <p className="text-center text-xs font-bold opacity-60">Mostrando {shown.length} de {n}</p>}
      {newLeader && <p className="flex items-center justify-center gap-2 text-center text-sm font-bold"><Trophy />{players[0].name} lidera ahora</p>}
      <div className="mt-auto"><NextIn deadline={deadline} /></div>
    </>
  )
}
