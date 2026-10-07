// Login del profe: contraseña (+ código TOTP si hay ADMIN_TOTP_SECRET) -> cookie de sesión HttpOnly.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const PASSWORD = process.env.ADMIN_PASSWORD ?? ''
export const TOTP_SECRET = process.env.ADMIN_TOTP_SECRET ?? ''
const SESSION_MS = 12 * 3600e3

/** true si a y b son iguales, en tiempo constante (compara hashes para no filtrar el largo). */
const same = (a: string, b: string) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest())

// ---------- TOTP (RFC 6238: 6 dígitos, 30 s, SHA-1; lo que usan Google Authenticator, Aegis, 2FAS) ----------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export const base32 = (buf: Buffer) => [...buf].map((b) => b.toString(2).padStart(8, '0')).join('').match(/.{1,5}/g)!.map((c) => B32[parseInt(c.padEnd(5, '0'), 2)]).join('')
const unbase32 = (s: string) => {
  const bits = s.toUpperCase().replace(/[^A-Z2-7]/g, '').split('').map((c) => B32.indexOf(c).toString(2).padStart(5, '0')).join('')
  return Buffer.from(bits.match(/.{8}/g)?.map((b) => parseInt(b, 2)) ?? [])
}
export function totp(secret: string, t = Date.now()) {
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(Math.floor(t / 30000)))
  const h = createHmac('sha1', unbase32(secret)).update(msg).digest()
  const o = h[h.length - 1] & 15
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0')
}
/** Acepta el código actual y el de ±30 s (relojes del celular desfasados). */
const totpOk = (code: string) => [-1, 0, 1].some((w) => same(totp(TOTP_SECRET, Date.now() + w * 30000), String(code ?? '').replace(/\s/g, '')))

// ---------- Límite de intentos (login y búsqueda de PIN) ----------
// ponytail: en memoria, se reinicia con el servidor; suficiente para un solo profe.
const hits = new Map<string, { n: number; until: number }>()
/** Cuenta un fallo (si `fail`); true si `key` ya acumuló `max` fallos en la ventana. */
export function tooMany(key: string, max: number, windowMs: number, fail = true) {
  const now = Date.now()
  let h = hits.get(key)
  if (!h || h.until < now) h = { n: 0, until: now + windowMs }
  if (fail) h.n++
  hits.set(key, h)
  if (hits.size > 5000) for (const [k, v] of hits) if (v.until < now) hits.delete(k)
  return h.n >= max
}
/** IP real: detrás de cloudflared todo llega desde 127.0.0.1, así que solo entonces se cree a CF-Connecting-IP. */
export function clientIp(ip: string | undefined, headers: Record<string, unknown>) {
  const local = !ip || /^(::1|127\.|::ffff:127\.)/.test(ip)
  return (local && typeof headers['cf-connecting-ip'] === 'string' && headers['cf-connecting-ip']) || ip || '?'
}

// ---------- Sesiones ----------
// ponytail: en memoria; reiniciar el servidor cierra la sesión (volver a entrar). Pasar a SQLite si molesta.
const sessions = new Map<string, number>() // id -> expira
const COOKIE = 'qa_session'

export function login(ip: string, password: unknown, code: unknown): { cookie?: string; error?: string } {
  if (tooMany(`login:${ip}`, 5, 15 * 60e3, false)) return { error: 'Demasiados intentos. Espera 15 minutos.' }
  if (!same(String(password ?? ''), PASSWORD) || (TOTP_SECRET && !totpOk(String(code ?? '')))) {
    tooMany(`login:${ip}`, 5, 15 * 60e3)
    return { error: TOTP_SECRET ? 'Contraseña o código incorrecto' : 'Contraseña incorrecta' }
  }
  const id = randomBytes(32).toString('base64url')
  sessions.set(id, Date.now() + SESSION_MS)
  return { cookie: id }
}

export const cookieHeader = (id: string, secure: boolean) =>
  `${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${id ? SESSION_MS / 1000 : 0}${secure ? '; Secure' : ''}`

const sessionOf = (cookie: string | undefined) => cookie?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([\\w-]+)`))?.[1]

/** ¿La cookie trae una sesión válida? */
export function isAdmin(cookie: string | undefined) {
  const id = sessionOf(cookie)
  const exp = id && sessions.get(id)
  if (!exp) return false
  if (exp < Date.now()) return (sessions.delete(id!), false)
  return true
}
export const logout = (cookie: string | undefined) => void sessions.delete(sessionOf(cookie) ?? '')

export function checkConfig() {
  if (PASSWORD.length < 12) throw new Error('Define ADMIN_PASSWORD (12+ caracteres) en .env. Genera una con: pnpm totp')
}
