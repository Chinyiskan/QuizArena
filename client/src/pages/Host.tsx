import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { api, joinUrl, socket, useCountdown, useDash, useRoom, type LiveView, type RoomView } from '../lib.ts'
import { play, music, stopFuse } from '../sound.ts'
import { copyText } from '../browser.ts'
import { Avatar, Board, Confetti, Logo, NextIn, Screen, MusicButton, SoundButton } from '../ui.tsx'
import HwPanel from './HwPanel.tsx'
import Control from './Control.tsx'
import { Bolt, Bomb, Hand, Medal, Next, Pause, PowerX2, Reports, Sparkles, Target, Trophy, Wave, X } from '../icons.tsx'
import { BombBadge, BombReport } from '../bomb.tsx'
import { STYLES, type Style } from '../../../shared/powers.ts'

const PAUSES = [5, 8, 12, 20]

/** Manual (tú avanzas) o Automático (tras cada pregunta muestra la tabla unos segundos y sigue solo). */
function AutoControl({ s, pin }: { s: LiveView; pin: string }) {
  const secs = Math.round(s.pauseMs / 1000)
  const set = (auto: boolean, sec = secs) => socket.emit('host:auto', pin, auto, sec)
  return (
    <div className="card-dark mx-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 py-2">
      <div role="radiogroup" aria-label="Avance de las preguntas" className="flex overflow-hidden rounded-xl border-[3px] border-edge">
        {[false, true].map((a) => (
          <button key={String(a)} role="radio" aria-checked={s.auto === a} onClick={() => set(a)} className={`flex items-center gap-1.5 px-3 py-1.5 font-display ${s.auto === a ? 'bg-lime text-edge' : 'bg-white/10'}`}>
            {a ? <><Bolt /> Automático</> : <><Hand /> Manual</>}
          </button>
        ))}
      </div>
      {s.auto && (
        <label className="flex items-center gap-2 text-sm font-bold">
          Pausa entre preguntas
          <select className="input !w-auto !py-1 !text-base" value={secs} onChange={(e) => set(true, +e.target.value)}>
            {(PAUSES.includes(secs) ? PAUSES : [...PAUSES, secs].sort((a, b) => a - b)).map((n) => <option key={n} value={n}>{n} s</option>)}
          </select>
        </label>
      )}
    </div>
  )
}

const STYLE_ICON: Record<Style, typeof Bomb> = { classic: Target, powers: PowerX2, bomb: Bomb }

/** Estilo de partida (solo en el lobby): clásico, con poderes o papa caliente. */
function StylePicker({ s, pin }: { s: LiveView; pin: string }) {
  return (
    <div role="radiogroup" aria-label="Modo de juego" className="mx-auto grid w-full max-w-3xl gap-3 sm:grid-cols-3">
      {(Object.keys(STYLES) as Style[]).map((k) => {
        const Icon = STYLE_ICON[k], on = s.style === k
        return (
          <button key={k} role="radio" aria-checked={on} onClick={() => socket.emit('host:style', pin, k)}
            className={`card relative flex flex-col items-start gap-1 p-4 text-left transition-transform ${on ? '-rotate-1 scale-[1.03] bg-lime' : 'bg-paper opacity-75 hover:opacity-100'}`}>
            <span className="flex items-center gap-2 font-display text-xl"><span className={k === 'bomb' && on ? 'bomb-tick' : ''}><Icon /></span> {STYLES[k].name}</span>
            <span className="text-sm font-medium leading-snug">{STYLES[k].desc}</span>
            {on && <span className="sticker absolute -top-3 right-3">Elegido</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Podio con suspenso: 3.º, 2.º y al final el 1.º con confeti y fanfarria. */
function Podium({ players, bomb }: { players: LiveView['players']; bomb?: boolean }) {
  const order = [2, 1, 0].filter((r) => players[r])
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = order.map((_, i) =>
      setTimeout(() => {
        setStep(i + 1)
        play('medal')
        if (i === order.length - 1) setTimeout(() => (play('confetti'), music('podium')), 400) // el 1.º: confeti y música de victoria
      }, 1500 + i * 2000),
    )
    play('drum') // redoble mientras aparecen 3.º, 2.º y 1.º
    return () => t.forEach(clearTimeout)
  }, [])
  const done = step >= order.length
  const shown = (rank: number) => order.indexOf(rank) < step
  return (
    <>
      {done && <Confetti />}
      <h1 role="status" className="pop text-center text-5xl">{done ? <><Trophy className="inline" /> {bomb ? '¡Último en pie!' : '¡Campeón!'}</> : <><Sparkles className="inline" /> ¿Quién se lleva el oro?</>}</h1>
      <div className="flex min-h-60 items-end justify-center gap-3">
        {[1, 0, 2].map((rank) => {
          const p = players[rank]
          return (
            p && shown(rank) && (
              <motion.div key={p.id} initial={{ y: 200, opacity: 0, scale: 0.7 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 180, damping: 14 }} className="flex flex-col items-center gap-1">
                <Avatar value={p.avatar} size={rank === 0 ? 110 : 80} />
                <b className="max-w-24 truncate sm:max-w-32 text-lg">{p.name}</b>
                <div className={`card grid w-24 place-items-center sm:w-32 text-center ${['h-48 bg-sun', 'h-36 bg-cyan', 'h-28 bg-fire'][rank]}`}>
                  <Medal rank={rank} size="2.75rem" />
                  <span className="font-display text-2xl">{p.score}</span>
                </div>
              </motion.div>
            )
          )
        })}
      </div>
      {done && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-xl">
          <Board players={players} limit={8} />
        </motion.div>
      )}
    </>
  )
}

export default function Host() {
  const { pin = '' } = useParams()
  const go = useNavigate()
  const { state: s, closed } = useRoom<RoomView>(() =>
    socket.emit('host:open', pin, (ok: boolean) => !ok && go('/admin')),
  )
  if (closed) return <Screen className="grid place-items-center text-center"><p className="text-2xl">Partida terminada <Wave className="inline" /></p></Screen>
  if (!s) return <Screen>Conectando…</Screen>
  return s.mode === 'homework' ? <HwPanel s={s} pin={pin} /> : <LiveHost s={s} pin={pin} />
}

function LiveHost({ s, pin }: { s: LiveView & { deadline: number; autoDeadline: number }; pin: string }) {
  const go = useNavigate()
  const [base, setBase] = useState('')
  const [copied, setCopied] = useState(false)
  const left = useCountdown(s.deadline, s.phase === 'question')
  const d = useDash()
  useEffect(() => void api('/config').then((c) => setBase(c.publicUrl)), [])

  // sonidos de fase (el podio maneja los suyos) y cuenta regresiva de los últimos 5 s
  useEffect(() => {
    if (s.phase === 'question') play('start')
    if (s.phase === 'reveal') play(s.booms.length ? 'boom' : 'reveal')
    if (s.phase !== 'question') stopFuse() // si se cierra antes, la mecha se corta
    music(s.phase === 'lobby' ? 'lobby' : s.phase === 'podium' ? null : 'game') // el podio pone la suya al final
  }, [s.phase, s.index])
  useEffect(() => () => music(null), []) // salir de la pantalla apaga la música
  const count = s.players.length
  const sec = Math.ceil(left)
  // últimos segundos: tic-tac; en papa caliente, la mecha de una bomba encendida (5 s)
  useEffect(() => void (s.phase === 'question' && (s.style === 'bomb' ? s.bombs > 0 && sec === 5 && play('fuse') : sec === 4 && play('countdown'))), [sec])

  const url = joinUrl(base, pin)
  const next = () => socket.emit('host:next', pin)
  const kick = (p: { id: string; name: string }) => confirm(`¿Sacar a "${p.name}" de la partida?`) && socket.emit('host:kick', pin, p.id)
  const end = () => {
    socket.emit('host:close', pin)
    go('/admin')
  }
  // barra espaciadora = siguiente / cerrar (con el cursor lejos del botón); no cuenta si se está escribiendo o sobre un botón
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.code !== 'Space' || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName) || (s.phase !== 'question' && s.phase !== 'reveal')) return
      e.preventDefault()
      next()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [s.phase])

  return (
    <Screen className="!max-w-[min(96vw,1280px)] flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <Logo to="/admin" size="text-2xl" />
        <span className="sticker !text-sm">{s.title}</span>
        <span className="flex gap-2">
          <MusicButton />
          <SoundButton />
          <button className="btn btn-ghost" onClick={() => confirm('¿Terminar la partida?') && end()}>Terminar</button>
        </span>
      </header>

      {s.phase === 'lobby' && (
        <>
          <section className="card mx-auto w-full max-w-2xl space-y-4 p-6 text-center">
            <p className="font-bold opacity-60">Entra con este link o con el PIN</p>
            <p className="pop font-display text-7xl tracking-[0.15em] sm:text-8xl">{pin}</p>
            <div className="flex gap-2">
              <input className="input !text-base" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Link para estudiantes" />
              <button
                className="btn btn-cyan shrink-0"
                onClick={() => copyText(url).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)), () => {})}
              >
                {copied ? '¡Copiado!' : 'Copiar'}
              </button>
            </div>
          </section>

          <section className="flex flex-wrap justify-center gap-3" aria-live="polite">
            {s.players.length === 0 && <p className="opacity-60">Esperando jugadores…</p>}
            {s.players.map((p) => (
              <motion.div key={p.id} initial={{ scale: 0, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} className="flex items-center gap-2 rounded-full border-[3px] border-edge bg-paper py-1 pr-4 pl-1 text-edge">
                <Avatar value={p.avatar} size={40} />
                <b>{p.name}</b>
                <button type="button" className="-mr-2 grid h-7 w-7 place-items-center rounded-full opacity-40 hover:bg-pink hover:text-white hover:opacity-100 focus-visible:opacity-100" onClick={() => kick(p)} aria-label={`Sacar a ${p.name}`} title="Sacar de la partida"><X /></button>
              </motion.div>
            ))}
          </section>

          <AutoControl s={s} pin={pin} />
          <StylePicker s={s} pin={pin} />
          <div className="text-center">
            <button className="btn btn-pink btn-big" disabled={!s.players.length} onClick={next}>
              Empezar ({s.players.length}) <Bolt />
            </button>
          </div>
        </>
      )}

      {(s.phase === 'question' || s.phase === 'reveal') && (
        <Control
          s={s} d={d} left={left} onKick={kick}
          controls={
            s.phase === 'question' ? (
              <>
                <button className="btn btn-sun" onClick={next} title="Atajo: barra espaciadora">Cerrar ahora</button>
                <AutoControl s={s} pin={pin} />
              </>
            ) : (
              <>
                {s.auto && <div className="w-48"><NextIn key={s.index} deadline={s.autoDeadline} /></div>}
                {s.auto && <button className="btn btn-ghost" onClick={() => socket.emit('host:auto', pin, false)}><Pause /> Pausar</button>}
                <button className="btn btn-pink" onClick={next} title="Atajo: barra espaciadora">{s.index + 1 >= s.total || (s.style === 'bomb' && s.alive <= 1 && s.players.length > 1) ? <>Ver podio <Trophy /></> : <>Siguiente <Next /></>}</button>
                {!s.auto && <AutoControl s={s} pin={pin} />}
              </>
            )
          }
          extra={
            <>
              {s.style === 'bomb' && s.phase === 'question' && <BombBadge bombs={s.bombs} alive={s.alive} hot={left <= 5} />}
              {s.style === 'bomb' && s.phase === 'reveal' && <BombReport players={s.players} booms={s.booms} defused={s.defused} alive={s.alive} />}
              {s.phase === 'reveal' && Object.entries(s.steals).map(([thief, st]) => (
                <p key={thief} className="text-center font-display text-lg text-pink">
                  {st.blocked ? `${s.players.find((p) => p.id === st.from)?.name} bloqueó con su escudo el robo de ${s.players.find((p) => p.id === thief)?.name}` : `${s.players.find((p) => p.id === thief)?.name} le robó ${st.amount} puntos a ${s.players.find((p) => p.id === st.from)?.name}`}
                </p>
              ))}
              {s.phase === 'reveal' && Object.keys(s.drops).length > 0 && <p className="flex items-center justify-center gap-2 text-center font-display text-lg"><PowerX2 /> {Object.keys(s.drops).length} {Object.keys(s.drops).length === 1 ? 'jugador consiguió un poder' : 'jugadores consiguieron poderes'}</p>}
            </>
          }
        />
      )}

      {s.phase === 'podium' && (
        <>
          <Podium players={s.players} bomb={s.style === 'bomb'} />
          <div className="flex flex-wrap justify-center gap-3">
            {d?.reportId && <Link to={`/admin/reports/${d.reportId}`} className="btn btn-cyan btn-big"><Reports /> Ver reporte</Link>}
            <button className="btn btn-big" onClick={end}>Terminar</button>
          </div>
        </>
      )}
    </Screen>
  )
}
