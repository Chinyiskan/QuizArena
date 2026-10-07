import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { cloneElement, useId, useLayoutEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { useCountdown } from './lib.ts'
import { isMusicOn, isOn, setMusicOn, setOn } from './sound.ts'
import { Book, Bulb, CodeIcon, MusicIcon, Skull, Medal, SoundOff, SoundOn, X } from './icons.tsx'
import { PixelAnimal } from './pixel.tsx'
import { CODE_LANGS, type Question } from '../../shared/questions.ts'
import { highlightLines } from './highlight.tsx'

/** Avatar: "pix:fox" (pixel art de respaldo), "img:archivo.png" (public/avatars/) o "emoji:.." (partidas antiguas). */
export function Avatar({ value, size = 56 }: { value: string; size?: number }) {
  const [kind, v] = value.split(/:(.*)/s)
  return (
    <span
      className="inline-grid shrink-0 place-items-center overflow-hidden rounded-[26%] border-[3px] border-edge bg-paper"
      style={{ width: size, height: size, fontSize: size * 0.6 }}
    >
      {kind === 'img' ? (
        <img src={`/avatars/${encodeURIComponent(v)}`} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : kind === 'pix' ? (
        <PixelAnimal name={v} />
      ) : (
        <PixelAnimal name="fox" /> // avatares antiguos en emoji: se muestran como zorro
      )}
    </span>
  )
}

export function Logo({ to = '/', size = 'text-3xl' }: { to?: string; size?: string }) {
  return (
    <Link to={to} className={`font-display ${size} leading-none select-none`} aria-label="QuizArena">
      <span className="text-paper">Quiz</span>
      <span className="inline-block -rotate-3 rounded-lg border-[3px] border-edge bg-lime px-2 text-edge shadow-[3px_3px_0_var(--color-edge)]">Arena</span>
    </Link>
  )
}

export function Screen({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <motion.main initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className={`mx-auto min-h-dvh w-full max-w-5xl px-4 py-5 ${className}`}>
      {children}
    </motion.main>
  )
}

/** Anillo de cuenta regresiva. */
export function Ring({ left, total }: { left: number; total: number }) {
  const pct = Math.max(0, Math.min(1, left / total))
  const hot = left <= 5
  return (
    <div className="relative grid h-20 w-20 place-items-center" role="timer" aria-label={`${Math.ceil(left)} segundos`}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="var(--color-ink2)" stroke="rgb(255 255 255 / .12)" strokeWidth="4" />
        <circle
          cx="18" cy="18" r="15.5" fill="none" strokeWidth="4" strokeLinecap="round" pathLength={1}
          stroke={hot ? 'var(--color-pink)' : 'var(--color-lime)'} strokeDasharray={`${pct} 1`}
        />
      </svg>
      <span className={`relative font-display text-3xl ${hot ? 'text-pink' : ''}`}>{Math.ceil(left)}</span>
    </div>
  )
}

type P = { id: string; name: string; avatar: string; score: number; online: boolean; out?: number }

/** Ranking animado: las filas se reordenan solas con `layout`. Si `meId` quedó fuera del top, su fila se agrega al final. */
/** Ranking. `onKick` (solo el profe) agrega un botón para sacar a un jugador. */
export function Board({ players, gained = {}, limit = 5, meId, onKick }: { players: P[]; gained?: Record<string, number>; limit?: number; meId?: string; onKick?: (p: P) => void }) {
  const mine = meId ? players.findIndex((p) => p.id === meId) : -1
  const rows = players.slice(0, limit).map((p, i) => ({ p, i }))
  if (mine >= limit) rows.push({ p: players[mine], i: mine })
  return (
    <ol className="space-y-2">
      {rows.map(({ p, i }) => (
        <motion.li
          key={p.id}
          layout
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className={`flex items-center gap-3 rounded-2xl border-[3px] border-edge p-2 pr-4 ${p.id === meId ? 'bg-lime text-edge' : 'bg-paper text-edge'} ${mine > limit && i === mine ? 'mt-4' : ''} ${p.out !== undefined ? 'out-row' : ''}`}
        >
          <span className="grid w-8 place-items-center font-display text-xl">{i < 3 ? <Medal rank={i} size="1.6rem" /> : i + 1}</span>
          <Avatar value={p.avatar} size={40} />
          <span className="min-w-0 flex-1 truncate font-bold">{p.name}</span>
          {p.out !== undefined && <Skull aria-label="eliminado" />}
          {!!gained[p.id] && <span className={`font-display text-sm ${gained[p.id] > 0 ? 'text-violet' : 'text-pink'}`}>{gained[p.id] > 0 ? '+' : '−'}{Math.abs(gained[p.id])}</span>}
          <span className="font-display text-xl tabular-nums">{p.score}</span>
          {onKick && <button type="button" className="-mr-2 grid h-8 w-8 place-items-center rounded-lg opacity-40 hover:bg-pink hover:text-white hover:opacity-100 focus-visible:opacity-100" onClick={() => onKick(p)} aria-label={`Sacar a ${p.name}`} title="Sacar de la partida"><X /></button>}
        </motion.li>
      ))}
    </ol>
  )
}

/** Por qué esa es la respuesta (la escribe el profe). */
export function Explanation({ text }: { text?: string }) {
  if (!text) return null
  return (
    <div className="card-dark flex gap-3 p-4">
      <Bulb className="mt-1 shrink-0 text-xl text-sun" />
      <div>
        <p className="text-xs font-bold uppercase tracking-wide opacity-60">Explicación</p>
        <p className="text-lg leading-snug">{text}</p>
      </div>
    </div>
  )
}

/** Cuenta regresiva del modo automático: "Siguiente pregunta en N s". Se monta de nuevo por pregunta (key). */
export function NextIn({ deadline }: { deadline: number }) {
  const left = useCountdown(deadline, true)
  const total = useRef(Math.max(left, 1)).current
  return (
    <div role="timer" aria-label={`Siguiente pregunta en ${Math.ceil(left)} segundos`} className="space-y-1.5">
      <div className="flex items-center justify-between text-sm font-bold opacity-80">
        <span>Siguiente pregunta</span>
        <span className="font-display tabular-nums">{Math.ceil(left)} s</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full border-2 border-edge bg-white/10">
        <div className="h-full bg-lime" style={{ width: `${Math.min(1, left / total) * 100}%`, transition: 'width 0.1s linear' }} />
      </div>
    </div>
  )
}

/** Música de fondo (solo pantalla del profe). Apagada se ve tachada. */
export function MusicButton() {
  const [on, set] = useState(isMusicOn)
  return (
    <button className="btn btn-ghost relative !px-2.5" aria-label={on ? 'Apagar música' : 'Encender música'} aria-pressed={on} onClick={() => (setMusicOn(!on), set(!on))}>
      <MusicIcon className={on ? '' : 'opacity-50'} />
      {!on && <span aria-hidden="true" className="absolute top-1/2 left-1/2 h-[3px] w-6 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded bg-current" />}
    </button>
  )
}

export function SoundButton() {
  const [on, set] = useState(isOn)
  return (
    <button
      className="btn btn-ghost !px-2.5"
      aria-label={on ? 'Silenciar' : 'Activar sonido'}
      aria-pressed={on}
      onClick={() => (setOn(!on), set(!on))}
    >
      {on ? <SoundOn /> : <SoundOff />}
    </button>
  )
}

const CONFETTI = ['pink', 'cyan', 'sun', 'lime', 'violet', 'fire']

/** Lluvia de confeti con CSS puro (se oculta con reduced-motion). */
export function Confetti({ n = 70 }: { n?: number }) {
  const bits = useMemo(
    () => Array.from({ length: n }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 0.8, dur: 2.4 + Math.random() * 1.8, rot: 360 + Math.random() * 720, w: 6 + Math.random() * 8, c: CONFETTI[i % 6] })),
    [n],
  )
  return (
    <div aria-hidden className="confetti-layer">
      {bits.map((b, i) => (
        <span key={i} className="confetti" style={{ left: `${b.left}%`, width: b.w, background: `var(--color-${b.c})`, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, ['--rot' as string]: `${b.rot}deg` }} />
      ))}
    </div>
  )
}

/** Fragmento de código de una pregunta: monoespaciado, con números de línea y colores por lenguaje. Se desplaza si es largo. */
export function CodeBlock({ code }: { code?: Question['code'] }) {
  const lines = useMemo(() => (code?.text.trim() ? highlightLines(code.text.replace(/\s+$/, ''), code.lang) : []), [code?.text, code?.lang])
  if (!code || !lines.length) return null
  return (
    <figure className="code-block max-h-80 overflow-auto" aria-label={`Código en ${CODE_LANGS[code.lang]}`}>
      <figcaption className="sticky left-0 flex items-center gap-2 border-b border-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wide opacity-70">
        <CodeIcon /> {CODE_LANGS[code.lang]}
      </figcaption>
      <pre className="py-3 text-[0.95rem] leading-relaxed sm:text-base"><code>
        {lines.map((l, i) => <span key={i} className="code-line">{l}</span>)}
      </code></pre>
    </figure>
  )
}

/** Texto de lectura que acompaña a una pregunta; se desplaza si es largo. */
export function Passage({ text }: { text?: string }) {
  if (!text) return null
  return (
    <figure className="card-dark max-h-56 overflow-y-auto p-4" aria-label="Texto de lectura">
      <figcaption className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide opacity-60">
        <Book /> Lee el texto
      </figcaption>
      <p className="whitespace-pre-wrap text-lg leading-relaxed">{text}</p>
    </figure>
  )
}

/** Tooltip accesible: aparece al pasar el mouse (con una pequeña espera) o al enfocar con teclado, y se cierra con Escape.
 *  Se dibuja con `position: fixed` para que ningún contenedor con scroll lo recorte, y se mantiene dentro de la pantalla. */
export function Tip({ tip, side = 'top', children }: { tip: ReactNode; side?: 'top' | 'left'; children: ReactElement<{ 'aria-describedby'?: string }> }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 })
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const wrap = useRef<HTMLSpanElement>(null)
  const pop = useRef<HTMLSpanElement>(null)
  const show = (delay: number) => (clearTimeout(timer.current), void (timer.current = setTimeout(() => setOpen(true), delay)))
  const hide = () => (clearTimeout(timer.current), setOpen(false))
  useLayoutEffect(() => {
    if (!open || !wrap.current || !pop.current) return
    const a = wrap.current.getBoundingClientRect(), w = pop.current.offsetWidth, h = pop.current.offsetHeight, m = 8, gap = 12
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi))
    setPos(
      side === 'left' && a.left - gap - w >= m
        ? { left: a.left - gap - w, top: clamp(a.top + a.height / 2 - h / 2, m, innerHeight - h - m) }
        : side === 'left'
          ? { left: clamp(a.left, m, innerWidth - w - m), top: clamp(a.top - gap - h, m, innerHeight - h - m) } // no cabe a la izquierda: arriba
          : { left: clamp(a.left, m, innerWidth - w - m), top: a.top - gap - h >= m ? a.top - gap - h : a.bottom + gap },
    )
  }, [open, side])
  return (
    <span ref={wrap} className="relative inline-block" onMouseEnter={() => show(250)} onMouseLeave={hide} onFocus={() => show(0)} onBlur={hide} onKeyDown={(e) => e.key === 'Escape' && hide()}>
      {cloneElement(children, { 'aria-describedby': open ? id : undefined })}
      {createPortal(
      <span
        ref={pop} id={id} role="tooltip" style={{ left: pos.left, top: pos.top }} data-open={open}
        className={`pointer-events-none fixed z-50 w-64 rounded-2xl border-[3px] border-edge bg-paper p-3 text-left text-sm font-medium leading-snug text-edge shadow-[4px_4px_0_var(--color-edge)] transition-opacity duration-150 ${open ? 'opacity-100' : 'invisible opacity-0'}`}
      >
        {tip}
      </span>,
      document.body, // fuera de tarjetas con backdrop-filter/transform: ahí `fixed` se calcula respecto a la tarjeta
      )}
    </span>
  )
}
