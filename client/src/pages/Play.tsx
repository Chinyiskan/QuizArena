import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { api, socket, useCountdown, useRoom, type MeView } from '../lib.ts'
import { buzz, music, play, stopFuse } from '../sound.ts'
import { DropCard, PowerTray } from '../power.tsx'
import { BoomCard, BombBadge, DefusedCard, Explosion, SpectatorCard } from '../bomb.tsx'
import { POWERS, STYLES } from '../../../shared/powers.ts'
import { Avatar, Board, Confetti, Explanation, CodeBlock, Logo, NextIn, Passage, Ring, Screen, MusicButton, SoundButton } from '../ui.tsx'
import { PIXEL_NAMES } from '../pixel.tsx'
import { registry } from '../types/registry.tsx'
import HwPlay from './HwPlay.tsx'
import { Game, Hand, Medal, Party, Question, Rocket, Star, StatusIcon, Wave } from '../icons.tsx'

type Me = { id?: string; key?: string; name: string; avatar: string } // key: secreta, prueba que este celular es este jugador al reconectar
const KEY = (pin: string) => `qa-player-${pin}`
const load = (pin: string): Me | null => {
  try { return JSON.parse(localStorage.getItem(KEY(pin)) ?? 'null') } catch { return null }
}

function JoinForm({ pin, onJoin, error }: { pin: string; onJoin: (m: Me) => void; error: string }) {
  const [name, setName] = useState('')
  const [files, setFiles] = useState<string[] | null>(null)
  const [taken, setTaken] = useState<string[]>([]) // avatares que ya eligieron otros en esta sala
  // si el profe subió avatares, son los únicos que se ofrecen; los de código son solo el respaldo
  const options = files === null ? [] : files.length ? files.map((f) => `img:${f}`) : PIXEL_NAMES.map((n) => `pix:${n}`)
  const [avatar, setAvatar] = useState('')
  useEffect(() => void api<string[]>('/avatars').then(setFiles, () => setFiles([])), [])
  useEffect(() => {
    const f = () => api<{ taken?: string[] }>(`/rooms/${pin}`).then((r) => setTaken(r.taken ?? []), () => {})
    f()
    const t = setInterval(f, 4000)
    return () => clearInterval(t)
  }, [pin])
  // valor inicial: uno libre al azar; si el elegido lo toma otro mientras tanto, se cambia por uno libre
  const free = options.filter((a) => !taken.includes(a))
  useEffect(() => {
    if (!options.length || (avatar && !(taken.includes(avatar) && free.length))) return
    const pool = free.length ? free : options
    setAvatar(pool[Math.floor(Math.random() * pool.length)])
  }, [options.length, taken.join('|')])
  useEffect(() => void document.querySelector('[role=radio][aria-checked=true]')?.scrollIntoView({ block: 'nearest' }), [avatar])
  return (
    <form className="card mx-auto w-full max-w-md space-y-5 p-5" onSubmit={(e) => (e.preventDefault(), name.trim() && avatar && onJoin({ name: name.trim(), avatar }))}>
      <h1 className="text-center text-3xl">¿Quién eres?</h1>
      <input className="input text-center !text-2xl" placeholder="Tu nombre" value={name} maxLength={20} autoFocus onChange={(e) => setName(e.target.value)} aria-label="Tu nombre" />
      <div role="radiogroup" aria-label="Elige tu avatar" className="grid max-h-80 grid-cols-4 justify-items-center gap-3 overflow-y-auto p-2">
        {options.map((a, i) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={a === avatar}
            disabled={taken.includes(a) && a !== avatar}
            aria-label={taken.includes(a) ? `Avatar ${i + 1} (ocupado)` : `Avatar ${i + 1}`}
            onClick={() => setAvatar(a)}
            className={`rounded-[26%] transition-transform ${a === avatar ? 'scale-110 outline-4 outline-offset-2 outline-pink' : taken.includes(a) ? 'opacity-25 grayscale' : 'opacity-80 hover:opacity-100'}`}
          >
            <Avatar value={a} size={64} />
          </button>
        ))}
      </div>
      {error && <p className="text-center font-bold text-pink" role="alert">{error}</p>}
      <button className="btn btn-pink btn-big w-full" disabled={!name.trim() || !avatar}>¡Listo! <Game /></button>
    </form>
  )
}

export default function Play() {
  const { pin = '' } = useParams()
  const [room, setRoom] = useState<{ title: string; open: boolean; mode: 'live' | 'homework' } | 'bad' | 'busy' | null>(null)
  const [me, setMe] = useState<Me | null>(() => load(pin))
  const [error, setError] = useState('')
  const [sentIdx, setSentIdx] = useState(-1)
  const [hide, setHide] = useState<{ index: number; hide: number[] } | null>(null) // opciones quitadas por mi 50/50
  const [priv, setPriv] = useState<MeView>({ power: undefined, armed: undefined, answered: -1 }) // lo mío que no ven los demás: poder, poder activado, si ya respondí
  const [kicked, setKicked] = useState(false)
  useEffect(() => {
    const onKick = () => (localStorage.removeItem(KEY(pin)), setKicked(true))
    socket.on('hide', setHide).on('me', setPriv).on('kicked', onKick)
    return () => void socket.off('hide', setHide).off('me', setPriv).off('kicked', onKick)
  }, [pin])

  const join = (m: Me) =>
    socket.emit('player:join', pin, m.name, m.avatar, m.id, m.key, (r: { id?: string; key?: string; error?: string }) => {
      if (r.id) {
        const full = { ...m, id: r.id, key: r.key }
        localStorage.setItem(KEY(pin), JSON.stringify(full))
        setMe(full)
        setError('')
      } else {
        localStorage.removeItem(KEY(pin))
        setMe(null)
        setError(r.error ?? 'No se pudo entrar')
      }
    })

  // en cada (re)conexión, si ya tengo identidad, vuelvo a entrar con el mismo id
  const { state: s, closed } = useRoom(() => { const m = load(pin); if (m) join(m) })
  useEffect(() => void api(`/rooms/${pin}`).then(setRoom, (e) => setRoom(e.status === 429 ? 'busy' : 'bad')), [pin])
  const left = useCountdown(s?.deadline ?? 0, s?.phase === 'question')

  // retroalimentación al revelar: sonido (si el estudiante lo activó) y vibración corta
  const myCredit = s && me?.id ? s.credit[me.id] ?? 0 : 0
  const myRank = s && me?.id ? s.players.findIndex((p) => p.id === me.id) : -1
  const myDrop = s && me?.id ? s.drops[me.id] : undefined
  const boomed = !!(s && me?.id && s.booms.includes(me.id))
  const defused = !!(s && me?.id && s.defused.includes(me.id))
  const wasOut = (s?.players.find((p) => p.id === me?.id)?.out ?? Infinity) < (s?.index ?? 0) // ya estaba fuera antes de esta pregunta

  // tic-tac en MI dispositivo (el profe no comparte pantalla): a 4 s del final, o la mecha a 5 s en papa caliente. Se corta al responder o al cerrarse la pregunta.
  const sec = Math.ceil(left)
  const sentNow = !!s && (sentIdx === s.index || priv.answered === s.index)
  const isOut = s?.players.find((p) => p.id === me?.id)?.out !== undefined
  useEffect(() => {
    if (s?.phase !== 'question' || sentNow || isOut || !me?.id) return
    if (s.style === 'bomb' ? s.bombs > 0 && sec === 5 : sec === 4) play(s.style === 'bomb' ? 'fuse' : 'countdown')
  }, [sec])
  useEffect(() => { if (s?.phase !== 'question' || sentNow) stopFuse() }, [s?.phase, sentNow])
  useEffect(() => {
    if (s?.phase === 'reveal' && !wasOut) {
      if (boomed) (play('boom'), buzz([400, 80, 200]))
      else {
        play(myCredit === 1 ? 'right' : myCredit > 0 ? 'partial' : 'wrong')
        buzz(myCredit > 0 ? 80 : [60, 40, 60])
      }
      if (defused) play('defuse')
      if (Object.values(s.steals).some((st) => st.from === me?.id && !st.blocked)) (play('victim'), buzz([80, 40, 80])) // me robaron
      if (myDrop) (play('get'), buzz([30, 30, 60]))
      if (myCredit === 1 && !boomed && (s.players.find((p) => p.id === me?.id)?.streak ?? 0) >= 3) play('streak') // racha de 3+: al final de la cola
    }
    if (s?.phase === 'podium') {
      play(myRank === 0 ? 'fanfare' : 'reveal')
      buzz(myRank === 0 ? [80, 40, 80, 40, 200] : 100)
    }
  }, [s?.phase, s?.index])

  // música de fondo según la fase (la tarea pone la suya en HwPlay); se apaga con el botón de sonido
  const hw = typeof room === 'object' && room?.mode === 'homework'
  const track = !me?.id || hw ? null : s?.phase === 'podium' ? 'podium' : !s || s.phase === 'lobby' ? 'lobby' : 'game'
  useEffect(() => { if (!hw) music(track) }, [track, hw])
  useEffect(() => () => music(null), [])

  if (room === 'bad' || room === 'busy' || closed || kicked)
    return (
      <Screen className="grid place-items-center text-center">
        <div className="space-y-4">
          <div className="text-6xl">{closed ? <Wave className="mx-auto" /> : kicked ? <Hand className="mx-auto" /> : <Question className="mx-auto" />}</div>
          <h1 className="text-3xl">{closed ? 'La partida terminó' : kicked ? 'El profe te sacó de la partida' : room === 'busy' ? 'Demasiados intentos desde tu red' : 'Ese PIN no existe'}</h1>
          {room === 'busy' && !closed && !kicked && <p className="opacity-70">Espera unos minutos y recarga la página.</p>}
          <Link to="/" className="btn">Volver</Link>
        </div>
      </Screen>
    )
  if (!room) return <Screen />

  if (!me?.id)
    return (
      <Screen className="flex flex-col justify-center gap-6">
        <div className="text-center"><Logo size="text-4xl" /><p className="mt-3 opacity-70">{room.title}</p></div>
        <JoinForm pin={pin} onJoin={join} error={error} />
      </Screen>
    )

  if (room.mode === 'homework') return <HwPlay name={me.name} avatar={me.avatar} />

  const mine = s?.players.find((p) => p.id === me.id)
  const rank = s ? s.players.findIndex((p) => p.id === me.id) : -1
  const q = s?.question
  const R = q && registry[q.type]
  const gained = s?.gained[me.id] ?? 0
  const credit = s?.credit[me.id] ?? 0
  // el servidor dice si mi respuesta llegó: tras recargar no se vuelve a preguntar, y si llegó tarde dice "Se acabó el tiempo"
  const answeredIt = !!s && priv.answered === s.index
  const sent = !!s && (sentIdx === s.index || answeredIt)

  return (
    <Screen className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <Avatar value={me.avatar} size={44} />
        <b className="min-w-0 flex-1 truncate">{me.name}</b>
        <span className="sticker !text-sm"><Star className="inline" /> {mine?.score ?? 0}</span>
        <MusicButton />
        <SoundButton />
      </header>

      {(!s || s.phase === 'lobby') && (
        <div className="grid flex-1 place-items-center text-center">
          <div className="space-y-4">
            <div className="float inline-block"><Avatar value={me.avatar} size={140} /></div>
            <h1 role="status" className="text-4xl">¡Estás dentro, {me.name}!</h1>
            <p className="opacity-70">{s ? `${s.players.length} jugando` : ''} · mira la pantalla del profe</p>
            {s && <p className="mx-auto max-w-xs text-sm font-bold opacity-70"><b className="font-display">{STYLES[s.style].name}:</b> {s.style === 'powers' ? `mientras juegas ganas poderes (${Object.values(POWERS).map((p) => p.name).join(', ')}). ¡Úsalos con cabeza!` : s.style === 'bomb' ? 'en cada pregunta hay bombas escondidas y nadie sabe quién las tiene. Si te toca y fallas: BOOM.' : STYLES.classic.desc}</p>}
          </div>
        </div>
      )}

      {s?.phase === 'question' && q && R && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Ring left={left} total={q.time} />
            <span className="sticker">{s.index + 1}/{s.total}</span>
            {s.style === 'bomb' && mine?.out === undefined && <BombBadge bombs={s.bombs} alive={s.alive} hot={left <= 5} />}
          </div>
          <h1 role="status" className="text-2xl leading-tight sm:text-3xl">{q.prompt}</h1>
          <Passage text={q.passage} />
          <CodeBlock code={q.code} />
          {mine?.out !== undefined && <SpectatorCard />}
          {s.powers && (priv.armed || (!sent && priv.power)) && (
            <PowerTray
              power={sent ? undefined : priv.power} armed={priv.armed}
              canUse={priv.power === 'fifty' ? q.type === 'mcq' && hide?.index !== s.index : priv.power === 'steal' ? rank > 0 : true}
              onUse={() => (socket.emit('player:power'), play(priv.power ?? 'use'), buzz(40))}
            />
          )}
          {mine?.out !== undefined ? (
            <div className="pointer-events-none opacity-60"><R.Player key={q.id} q={q} onSubmit={() => {}} disabled /></div>
          ) : sent ? (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card-dark grid flex-1 place-items-center p-8 text-center">
              <div><div className="mb-2 text-6xl"><Rocket className="mx-auto" /></div><p className="font-display text-2xl">¡Respuesta enviada!</p><p className="opacity-70">Esperando al resto…</p></div>
            </motion.div>
          ) : (
            <R.Player key={q.id} q={q} hidden={hide?.index === s.index ? hide.hide : undefined} onSubmit={(v) => (socket.emit('player:answer', v), setSentIdx(s.index), play('submit'))} />
          )}
        </>
      )}

      {s?.phase === 'reveal' && q && R && (
        <>
          {boomed && <Explosion key={s.index} />}
          {boomed ? <BoomCard /> : wasOut ? <SpectatorCard /> : (
          <motion.div
            initial={{ scale: 0.5, rotate: -6 }}
            animate={{ scale: 1, rotate: 0 }}
            className={`card p-6 text-center ${credit === 1 ? 'bg-lime' : credit > 0 ? 'bg-sun' : 'bg-pink !text-white'}`}
          >
            <div className="text-6xl"><StatusIcon credit={credit > 0 || answeredIt ? credit : null} className="mx-auto" /></div>
            <h1 role="status" className="text-3xl">
              {credit === 1 ? `¡Bien! +${gained}` : credit > 0 ? `¡Casi! +${gained}` : answeredIt ? 'Uy, esta no' : 'Se acabó el tiempo'}
            </h1>
            {credit > 0 && credit < 1 && <p className="font-bold opacity-70">Acertaste {Math.round(credit * 100)}%</p>}
            {priv.armed === 'x2' && credit > 0 && <p className="font-bold">Doble activado: puntos x2</p>}
            {priv.armed === 'shield' && credit < 1 && <p className="font-bold">Escudo: tu racha sigue viva</p>}
            {priv.armed === 'bet' && <p className="font-bold">{credit === 1 ? 'Apuesta ganada: puntos x3' : `Apuesta perdida: ${gained}`}</p>}
          </motion.div>
          )}
          {defused && <DefusedCard />}
          <Steals s={s} meId={me.id} />

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="card-dark p-3">
              <div className="text-xs font-bold uppercase tracking-wide opacity-60">Posición</div>
              <div className="font-display text-3xl">#{rank + 1}<span className="text-base opacity-60"> de {s.players.length}</span></div>
            </div>
            <div className="card-dark p-3">
              <div className="text-xs font-bold uppercase tracking-wide opacity-60">Puntos</div>
              <div className="font-display text-3xl tabular-nums">{mine?.score ?? 0}</div>
            </div>
          </div>
          {mine && (
            <p className="text-center text-sm font-bold opacity-80">
              {rank > 0
                ? s.players[rank - 1].score === mine.score ? `Empatado con el #${rank}` : `A ${s.players[rank - 1].score - mine.score} puntos del #${rank}`
                : s.players[1] ? `¡Vas primero! Ventaja de ${mine.score - s.players[1].score} puntos` : '¡Vas primero!'}
            </p>
          )}

          {credit < 1 && (
            <section className="space-y-2">
              <h2 className="text-sm uppercase tracking-wide opacity-60">La respuesta correcta</h2>
              <R.Correct q={q} />
            </section>
          )}
          {myDrop && <DropCard power={myDrop} />}
          <Explanation text={q.explanation} />
          <Board players={s.players} gained={s.gained} meId={me.id} limit={5} />
          {s.auto ? <NextIn key={s.index} deadline={s.autoDeadline} /> : <p className="text-center text-sm opacity-60">Esperando al profe…</p>}
        </>
      )}

      {s?.phase === 'podium' && (
        <>
          {rank === 0 && <Confetti />}
          <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="card bg-sun p-6 text-center">
            <div className="grid place-items-center text-7xl">{rank < 3 ? <Medal rank={rank} size="5rem" /> : <Party />}</div>
            <h1 role="status" className="text-3xl">{rank === 0 ? (s.style === 'bomb' ? '¡ÚLTIMO EN PIE!' : '¡CAMPEÓN!') : `Terminaste #${rank + 1}`}</h1>
            <p className="font-display text-xl">{mine?.score} puntos</p>
          </motion.div>
          <Board players={s.players} meId={me.id} limit={8} />
        </>
      )}
    </Screen>
  )
}

/** Robos del reveal que me tocan: los que hice, los que me hicieron y los que bloqueó mi escudo. */
function Steals({ s, meId }: { s: { steals: Record<string, { from: string; amount: number; blocked?: boolean }>; players: { id: string; name: string }[] }; meId: string }) {
  const name = (id: string) => s.players.find((p) => p.id === id)?.name ?? '¿?'
  const lines = Object.entries(s.steals).flatMap(([thief, { from, amount, blocked }]) =>
    thief === meId ? [blocked ? `${name(from)} tenía escudo: tu robo rebotó` : `¡Le robaste ${amount} puntos a ${name(from)}!`]
    : from === meId ? [blocked ? `Tu escudo bloqueó el robo de ${name(thief)}` : `${name(thief)} te robó ${amount} puntos`]
    : [],
  )
  if (!lines.length) return null
  return (
    <motion.div initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.3 }} className="card bg-pink p-4 text-center font-display text-lg" role="status">
      {lines.map((l) => <p key={l}>{l}</p>)}
    </motion.div>
  )
}
