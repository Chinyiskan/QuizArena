// Sonido: archivos de public/sfx/ (WebAudio, recortados y nivelados aquí) con respaldo sintetizado si un archivo falta o aún no cargó.
// Uso real: clases virtuales (Meet). Cada estudiante juega en SU dispositivo y oye sus efectos y su música; el profe solo mira su panel
// (no comparte pantalla), así que en el profe todo arranca APAGADO (por Meet el audio llega comprimido y duplicado) y en el estudiante ENCENDIDO.
// Efectos y música tienen cada uno su botón (SoundButton / MusicButton), en el profe y en el estudiante: quien tiene datos limitados apaga solo la música.
// Las claves llevan "2" para que las preferencias guardadas con los valores por defecto antiguos no manden.
export type Name =
  | 'start' | 'tick' | 'countdown' | 'right' | 'partial' | 'wrong' | 'reveal' | 'fanfare' | 'submit' | 'streak' | 'join' | 'click'
  | 'pick' | 'drop' | 'get' | 'use' | 'x2' | 'shield' | 'fifty' | 'steal' | 'bet' | 'victim' | 'fuse' | 'boom' | 'defuse' | 'drum' | 'medal' | 'confetti'

const role = () => (location.pathname.startsWith('/host') ? 'host' : 'play')
const key = () => `qa-snd2-${role()}`
const read = (k: string, def: boolean) => {
  try { const v = localStorage.getItem(k); return v == null ? def : v === '1' } catch { return def }
}
const write = (k: string, on: boolean) => { try { localStorage.setItem(k, on ? '1' : '0') } catch {} }

export const isOn = () => read(key(), role() === 'play')
export function setOn(on: boolean) {
  write(key(), on)
  if (on) play('start')
}

// ---------- Archivos ----------
// at: segundos a saltar (silencio inicial del archivo); dur: cuánto sonar; vol: nivelación (los archivos vienen a volúmenes distintos)
type Clip = { f: string; at?: number; dur?: number; vol?: number }
const CLIPS: Partial<Record<Name, Clip>> = {
  // vol = nivelación medida (RMS ~ -23 dB; la música suena a ~ -23 dB y baja a ~ -30 mientras suena un efecto). El tic-tac y el
  // acierto van un poco más arriba. Antes los poderes salían 7-10 dB más fuertes que acertar/fallar y el tic-tac quedaba bajo la música.
  start: { f: 'question-start', vol: 0.85 },
  countdown: { f: 'tick', at: 0.33, dur: 3.3, vol: 1.7 }, // tic-tac rápido de ~3,3 s: se lanza a 4 s del final
  right: { f: 'correct', at: 0.25, vol: 2.6 },
  partial: { f: 'partial', at: 0.1, vol: 2.3 },
  wrong: { f: 'wrong', vol: 2.2 },
  reveal: { f: 'reveal', at: 0.12, vol: 0.9 },
  fanfare: { f: 'confetti', at: 0.15, vol: 1.1 },
  confetti: { f: 'confetti', at: 0.15, vol: 1.1 },
  submit: { f: 'submit', vol: 0.85 },
  streak: { f: 'streak', at: 0.48, dur: 1.1, vol: 0.66 },
  join: { f: 'join', vol: 0.56 },
  click: { f: 'ui-click', at: 0.5, dur: 0.35, vol: 0.75 },
  pick: { f: 'drag-pick', at: 0.22, dur: 0.6, vol: 0.36 },
  drop: { f: 'drag-drop', at: 0.22, dur: 0.6, vol: 0.35 },
  get: { f: 'power-get', at: 0.35, dur: 1.2, vol: 0.36 },
  use: { f: 'power-x2', at: 0.18, vol: 0.58 },
  x2: { f: 'power-x2', at: 0.18, vol: 0.58 },
  shield: { f: 'power-shield', at: 0.1, vol: 0.53 },
  fifty: { f: 'power-fifty', vol: 0.52 },
  steal: { f: 'power-steal', at: 0.05, vol: 1 },
  bet: { f: 'power-bet', at: 0.08, dur: 1.5, vol: 2.9 }, // el archivo dura 8,8 s: solo el arranque de dados
  victim: { f: 'steal-victim', at: 0.08, dur: 1.1, vol: 1.9 },
  fuse: { f: 'fuse', vol: 0.67 }, // mecha de 5,2 s: papa caliente, últimos 5 s
  boom: { f: 'explotion', vol: 0.59 },
  drum: { f: 'podium-drum', vol: 0.94 },
  medal: { f: 'podium-reveal', vol: 0.6 },
}

let ctx: AudioContext | undefined
let bus: DynamicsCompressorNode | undefined
/** Salida común con limitador: varios efectos a la vez (o un pico a >0 dB) ya no saturan ni se oyen rotos. */
function master() {
  if (!bus) {
    bus = ctx!.createDynamicsCompressor()
    bus.threshold.value = -8
    bus.knee.value = 6
    bus.ratio.value = 12
    bus.attack.value = 0.003
    bus.release.value = 0.15
    bus.connect(ctx!.destination)
  }
  return bus
}
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

/** Programa el clip `wait` s más tarde; `cap` limita su duración (con salida suave). Devuelve el nodo y cuánto sonará. */
function clip(c: Clip, wait = 0, cap = Infinity) {
  const buf = buffers.get(c.f)
  if (!buf) return undefined
  const src = ctx!.createBufferSource(), g = ctx!.createGain()
  src.buffer = buf
  const vol = c.vol ?? 1, t = ctx!.currentTime + wait
  const len = Math.min(c.dur ?? buf.duration - (c.at ?? 0), cap)
  g.gain.value = vol
  src.connect(g).connect(master())
  src.start(t, c.at ?? 0, len)
  if (c.dur || len < buf.duration - (c.at ?? 0)) { // recorte con salida suave para que no haga clic
    g.gain.setValueAtTime(vol, t + len - 0.08)
    g.gain.linearRampToValueAtTime(0, t + len)
  }
  return { src, len }
}

let timerSrc: AudioBufferSourceNode | undefined // tic-tac o mecha en curso
/** Corta el tic-tac / la mecha (la pregunta terminó antes, o el estudiante ya respondió). */
export function stopFuse() {
  try { timerSrc?.stop() } catch {}
  timerSrc = undefined
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
  o.connect(g).connect(master())
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
  src.connect(f).connect(g).connect(master())
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
    o.connect(g).connect(master())
    o.start(t)
    o.stop(t + 0.75)
  },
  defuse: () => (tone(1500, 0, 0.05, 'square', 0.05), tone(1500, 0.08, 0.05, 'square', 0.05), [523, 784, 1047].forEach((f, i) => tone(f, 0.2 + i * 0.07, 0.2, 'triangle'))), // clic-clic de cable cortado y alivio
}

/** Los sonidos del reveal (acierto, racha, poder nuevo, robo...) suenan UNO TRAS OTRO: antes se lanzaban casi juntos y se pisaban. */
const JINGLE_FIRST = new Set<Name>(['right', 'partial', 'wrong', 'boom']) // abren el reveal: reinician la cola
const JINGLE = new Set<Name>([...JINGLE_FIRST, 'streak', 'get', 'victim', 'defuse'])
const JINGLE_CAP = 1.7 // s máx. del sonido que abre el reveal; los demás de la cola, 0,9 s
const JINGLE_MAX_WAIT = 3 // si le tocaría sonar más tarde que esto, ya no tiene sentido: se omite
let jingleFree = 0 // instante (reloj de audio) en que termina el último de la cola

export function play(name: Name) {
  if (!isOn()) return
  try {
    ctx ??= new AudioContext()
    void ctx.resume()
    load()
    const c = CLIPS[name]
    let wait = 0
    if (JINGLE.has(name)) {
      if (JINGLE_FIRST.has(name)) jingleFree = 0
      wait = Math.max(0, jingleFree - ctx.currentTime - 0.1) // 0,1 s de solape para que no suene a hueco
      if (wait > JINGLE_MAX_WAIT) return
    }
    const r = c && clip(c, wait, JINGLE_FIRST.has(name) ? JINGLE_CAP : JINGLE.has(name) ? 0.9 : Infinity)
    if (!r) SYNTH[name]()
    else {
      if (name === 'fuse' || name === 'countdown') timerSrc = r.src
      if (JINGLE.has(name)) jingleFree = ctx.currentTime + wait + r.len
    }
    duck(r ? (wait + r.len) * 1000 : 900)
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
const musicKey = () => `qa-mus2-${role()}`
export const isMusicOn = () => read(musicKey(), role() === 'play')
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
  write(musicKey(), on)
  applyMusic()
}

function applyMusic() {
  const w = wanted
  if (!isMusicOn()) { music(null); wanted = w } else music(w)
}

/** Baja la música mientras suena un efecto (todo lo que dure, no un tiempo fijo: el tic-tac dura 3,3 s y la música lo tapaba al volver a subir). */
let duckTimer: ReturnType<typeof setTimeout> | undefined
let duckUntil = 0
function duck(ms = 900) {
  if (!current) return
  current.el.volume = MUSIC_VOL * 0.4
  duckUntil = Math.max(duckUntil, performance.now() + ms)
  clearTimeout(duckTimer)
  duckTimer = setTimeout(() => current && fade(current.el, MUSIC_VOL, 500), duckUntil - performance.now())
}
