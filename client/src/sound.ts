// Sonido: archivos de public/sfx/ (WebAudio, recortados y nivelados aquí) con respaldo sintetizado si un archivo falta o aún no cargó.
// Sonido ACTIVADO por defecto en profe y celulares; cada quien lo apaga con su botón (en el celular apaga efectos y música juntos).
// Música de fondo: profe con su propio botón (MusicButton); celular con el mismo botón de sonido.
export type Name =
  | 'start' | 'tick' | 'countdown' | 'right' | 'partial' | 'wrong' | 'reveal' | 'fanfare' | 'submit' | 'streak' | 'join' | 'click'
  | 'pick' | 'drop' | 'get' | 'use' | 'x2' | 'shield' | 'fifty' | 'steal' | 'bet' | 'victim' | 'fuse' | 'boom' | 'defuse' | 'drum' | 'medal' | 'confetti'

const role = () => (location.pathname.startsWith('/host') ? 'host' : 'play')
const key = () => `qa-sound-${role()}`
const read = (k: string, def: boolean) => {
  try { const v = localStorage.getItem(k); return v == null ? def : v === '1' } catch { return def }
}
const write = (k: string, on: boolean) => { try { localStorage.setItem(k, on ? '1' : '0') } catch {} }

export const isOn = () => read(key(), true)
export function setOn(on: boolean) {
  write(key(), on)
  if (on) play('start')
  if (role() === 'play') applyMusic() // en el celular, un solo botón controla efectos y música
}

// ---------- Archivos ----------
// at: segundos a saltar (silencio inicial del archivo); dur: cuánto sonar; vol: nivelación (los archivos vienen a volúmenes distintos)
type Clip = { f: string; at?: number; dur?: number; vol?: number }
const CLIPS: Partial<Record<Name, Clip>> = {
  start: { f: 'question-start' },
  countdown: { f: 'tick', at: 0.33, vol: 1.6 }, // tic-tac rápido de ~3,3 s: se lanza a 4 s del final
  right: { f: 'correct', at: 0.25, vol: 1.8 },
  partial: { f: 'partial', at: 0.1, vol: 2 },
  wrong: { f: 'wrong', vol: 2 },
  reveal: { f: 'reveal', at: 0.12, vol: 1.2 },
  fanfare: { f: 'confetti', at: 0.15 },
  confetti: { f: 'confetti', at: 0.15 },
  submit: { f: 'submit', vol: 1.2 },
  streak: { f: 'streak', at: 0.48, vol: 1.1 },
  join: { f: 'join', vol: 1.1 },
  click: { f: 'ui-click', at: 0.5, dur: 0.35, vol: 0.6 },
  pick: { f: 'drag-pick', at: 0.22, dur: 0.6, vol: 0.9 },
  drop: { f: 'drag-drop', at: 0.22, dur: 0.6, vol: 0.9 },
  get: { f: 'power-get', at: 0.35, dur: 2.6, vol: 0.8 },
  use: { f: 'power-x2', at: 0.18 },
  x2: { f: 'power-x2', at: 0.18 },
  shield: { f: 'power-shield', at: 0.1 },
  fifty: { f: 'power-fifty', vol: 1.3 },
  steal: { f: 'power-steal', at: 0.05, vol: 0.9 },
  bet: { f: 'power-bet', at: 0.08, dur: 1.5, vol: 1.8 }, // el archivo dura 8,8 s: solo el arranque de dados
  victim: { f: 'steal-victim', at: 0.08, vol: 2.2 },
  fuse: { f: 'fuse', vol: 1 }, // mecha de 5,2 s: papa caliente, últimos 5 s
  boom: { f: 'explotion', vol: 0.9 },
  drum: { f: 'podium-drum' },
  medal: { f: 'podium-reveal', vol: 1.1 },
}

let ctx: AudioContext | undefined
const buffers = new Map<string, AudioBuffer>()
const inflight = new Set<string>()
/** Descarga y decodifica los efectos (~1 MB). Mientras tanto suena el sintetizado. Reintenta los que fallaron (wifi de salón). */
function load() {
  for (const f of new Set(Object.values(CLIPS).map((c) => c!.f))) {
    if (buffers.has(f) || inflight.has(f)) continue
    inflight.add(f)
    fetch(`/sfx/${f}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((b) => ctx!.decodeAudioData(b)).then((buf) => buffers.set(f, buf)).catch(() => {}).finally(() => inflight.delete(f))
  }
}

function clip(c: Clip) {
  const buf = buffers.get(c.f)
  if (!buf) return undefined
  const src = ctx!.createBufferSource(), g = ctx!.createGain()
  src.buffer = buf
  g.gain.value = c.vol ?? 1
  src.connect(g).connect(ctx!.destination)
  src.start(0, c.at ?? 0, c.dur)
  if (c.dur) { // recorte con salida suave para que no haga clic
    const end = ctx!.currentTime + c.dur
    g.gain.setValueAtTime(c.vol ?? 1, end - 0.08)
    g.gain.linearRampToValueAtTime(0, end)
  }
  return src
}

let fuseSrc: AudioBufferSourceNode | undefined
/** Corta la mecha (cuando la pregunta termina antes de que se acabe el sonido). */
export function stopFuse() {
  try { fuseSrc?.stop() } catch {}
  fuseSrc = undefined
}

// ---------- Respaldo sintetizado ----------
function tone(freq: number, at: number, dur: number, type: OscillatorType = 'sine', vol = 0.15) {
  const c = ctx!, t = c.currentTime + at
  const o = c.createOscillator(), g = c.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(c.destination)
  o.start(t)
  o.stop(t + dur + 0.05)
}

/** Ruido blanco filtrado que cae a graves: la explosión. */
function noise(at: number, dur: number, vol = 0.5) {
  const c = ctx!, t = c.currentTime + at
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain()
  src.buffer = buf
  f.type = 'lowpass'
  f.frequency.setValueAtTime(2400, t)
  f.frequency.exponentialRampToValueAtTime(120, t + dur)
  g.gain.value = vol
  src.connect(f).connect(g).connect(c.destination)
  src.start(t)
}

const right = () => [659, 880, 1175].forEach((f, i) => tone(f, i * 0.09, 0.22, 'triangle'))
const use = () => (tone(300, 0, 0.1, 'sawtooth', 0.06), tone(600, 0.06, 0.1, 'square', 0.05), tone(1200, 0.12, 0.16, 'triangle', 0.1))
const reveal = () => (tone(520, 0, 0.12, 'square', 0.06), tone(780, 0.1, 0.2, 'triangle'))
const fanfare = () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.35, 'triangle', 0.18))
const tick = () => tone(1000, 0, 0.05, 'square', 0.05)
const SYNTH: Record<Name, () => void> = {
  start: () => [392, 523, 659].forEach((f, i) => tone(f, i * 0.08, 0.18, 'triangle')),
  tick,
  countdown: () => [0, 1, 2, 3].forEach((s) => tone(1000, s, 0.05, 'square', 0.05)),
  right, streak: right,
  partial: () => [659, 784].forEach((f, i) => tone(f, i * 0.09, 0.2, 'triangle')),
  wrong: () => (tone(180, 0, 0.3, 'sawtooth', 0.08), tone(130, 0.12, 0.35, 'sawtooth', 0.08)),
  reveal, medal: reveal,
  fanfare, confetti: fanfare, drum: () => [0, 0.12, 0.24, 0.36].forEach((t) => tone(90, t, 0.1, 'triangle', 0.2)),
  submit: () => tone(880, 0, 0.06, 'triangle', 0.08),
  join: () => tone(1320, 0, 0.08, 'sine', 0.08),
  click: () => tone(1500, 0, 0.03, 'square', 0.03),
  pick: () => tone(700, 0, 0.05, 'triangle', 0.06),
  drop: () => tone(500, 0, 0.06, 'triangle', 0.06),
  get: () => [784, 988, 1319, 1568].forEach((f, i) => tone(f, i * 0.06, 0.2, 'sine', 0.12)), // poder nuevo: arpegio brillante
  use, x2: use, shield: use, fifty: use, steal: use, bet: use,
  victim: () => (tone(400, 0, 0.12, 'sawtooth', 0.08), tone(250, 0.1, 0.25, 'sawtooth', 0.08)),
  fuse: () => [0, 1, 2, 3, 4].forEach((s) => tone(1000 + s * 150, s, 0.05, 'square', 0.05)),
  boom: () => {
    noise(0, 1.1, 0.6)
    const c = ctx!, o = c.createOscillator(), g = c.createGain(), t = c.currentTime // golpe grave que cae
    o.frequency.setValueAtTime(140, t)
    o.frequency.exponentialRampToValueAtTime(35, t + 0.6)
    g.gain.setValueAtTime(0.5, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7)
    o.connect(g).connect(c.destination)
    o.start(t)
    o.stop(t + 0.75)
  },
  defuse: () => (tone(1500, 0, 0.05, 'square', 0.05), tone(1500, 0.08, 0.05, 'square', 0.05), [523, 784, 1047].forEach((f, i) => tone(f, 0.2 + i * 0.07, 0.2, 'triangle'))), // clic-clic de cable cortado y alivio
}

export function play(name: Name) {
  if (!isOn()) return
  try {
    ctx ??= new AudioContext()
    void ctx.resume()
    load()
    const c = CLIPS[name]
    const src = c && clip(c)
    if (!src) SYNTH[name]()
    else if (name === 'fuse') fuseSrc = src
    duck()
  } catch {} // sin audio disponible: el juego sigue igual
}

export const buzz = (pattern: number | number[]) => navigator.vibrate?.(pattern)

/** Clic suave en botones y fichas (si el sonido está activado). Se instala una vez en main.tsx. */
export function installClicks() {
  document.addEventListener('pointerdown', (e) => {
    if ((e.target as Element | null)?.closest?.('.btn:not(:disabled), .tile')) play('click')
  }, { passive: true })
  // Los celulares solo dejan sonar WebAudio si el contexto se creó/reanudó en un gesto. Los efectos de la partida llegan por
  // socket (sin gesto), así que cualquier toque deja el audio listo: si no, solo sonaban los que coincidían con un toque.
  for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) document.addEventListener(ev, unlock, { passive: true })
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && unlock()) // iOS lo suspende al bloquear/cambiar de app
}

/** Crea/reanuda el contexto y precarga los efectos (así el primer sonido ya es el archivo y no el de respaldo). */
function unlock() {
  if (!isOn()) return
  try {
    ctx ??= new AudioContext()
    if (ctx.state !== 'running') void ctx.resume()
    load()
  } catch {}
}

// ---------- Música de fondo (solo profe) ----------
// <audio> en vez de WebAudio: se transmite sin decodificar minutos de audio en memoria.
export type Track = 'lobby' | 'game' | 'podium'
const MUSIC_VOL = 0.32
const musicKey = 'qa-music'
export const isMusicOn = () => (role() === 'host' ? read(musicKey, true) : isOn())
let current: { track: Track; el: HTMLAudioElement } | undefined
let wanted: Track | null = null

function fade(el: HTMLAudioElement, to: number, ms: number, then?: () => void) {
  const from = el.volume, t0 = performance.now()
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / ms)
    el.volume = from + (to - from) * k
    if (k < 1) requestAnimationFrame(step)
    else then?.()
  }
  requestAnimationFrame(step)
}

/** Cambia la pista con fundido; `null` la apaga. La misma pista no se reinicia (sigue entre preguntas). */
export function music(track: Track | null) {
  wanted = track
  if (current?.track === track) return
  if (current) { const old = current.el; fade(old, 0, 700, () => old.pause()); current = undefined }
  if (!track || !isMusicOn()) return
  const el = new Audio(`/sfx/music-${track}.mp3`)
  el.loop = track !== 'podium'
  el.volume = 0
  current = { track, el }
  el.play().then(() => fade(el, MUSIC_VOL, 900), () => {
    // el navegador bloquea audio sin un gesto previo: arranca con el primer toque
    current = undefined
    document.addEventListener('pointerdown', () => music(wanted), { once: true })
  })
}

export function setMusicOn(on: boolean) {
  write(musicKey, on)
  applyMusic()
}

function applyMusic() {
  const w = wanted
  if (!isMusicOn()) { music(null); wanted = w } else music(w)
}

/** Baja la música un momento cuando suena un efecto, para que se escuche. */
let duckTimer: ReturnType<typeof setTimeout> | undefined
function duck() {
  if (!current) return
  current.el.volume = MUSIC_VOL * 0.4
  clearTimeout(duckTimer)
  duckTimer = setTimeout(() => current && fade(current.el, MUSIC_VOL, 500), 900)
}
