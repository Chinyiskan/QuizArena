// Unit: TOTP (vector del RFC 6238), login, límite de intentos y sesión. pnpm test
import assert from 'node:assert/strict'

process.env.ADMIN_PASSWORD = 'clave-de-prueba-larga'
process.env.ADMIN_TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' // "12345678901234567890"
const { totp, login, isAdmin, logout, clientIp } = await import('./auth.ts')

assert.equal(totp(process.env.ADMIN_TOTP_SECRET, 59_000), '287082', 'RFC 6238, T=59')
assert.equal(totp(process.env.ADMIN_TOTP_SECRET, 1_111_111_109_000), '081804', 'RFC 6238, T=1111111109')

const code = totp(process.env.ADMIN_TOTP_SECRET)
assert.ok(login('a', 'mala', code).error, 'contraseña mala')
assert.ok(login('a', 'clave-de-prueba-larga', '000000').error || code === '000000', 'código malo')
assert.ok(login('a', 'clave-de-prueba-larga', undefined).error, 'sin código')
const ok = login('b', 'clave-de-prueba-larga', code)
assert.ok(ok.cookie, 'login correcto')
assert.ok(isAdmin(`x=1; qa_session=${ok.cookie}`), 'la cookie vale')
assert.ok(!isAdmin('qa_session=inventada'), 'cookie inventada no vale')
logout(`qa_session=${ok.cookie}`)
assert.ok(!isAdmin(`qa_session=${ok.cookie}`), 'logout la invalida')

for (let i = 0; i < 5; i++) login('c', 'mala', code)
assert.match(login('c', 'clave-de-prueba-larga', code).error ?? '', /Demasiados/, 'bloqueo tras 5 fallos, aunque luego acierte')

assert.equal(clientIp('127.0.0.1', { 'cf-connecting-ip': '1.2.3.4' }), '1.2.3.4', 'detrás del túnel')
assert.equal(clientIp('192.168.1.9', { 'cf-connecting-ip': '1.2.3.4' }), '192.168.1.9', 'en la LAN no se cree la cabecera')
console.log('ok')
