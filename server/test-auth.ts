// Login para las pruebas contra el servidor vivo: usa ADMIN_PASSWORD / ADMIN_TOTP_SECRET de .env.
import assert from 'node:assert/strict'
import { io } from 'socket.io-client'
import { totp } from './auth.ts'

export const BASE = process.env.BASE ?? 'http://localhost:3000'
const secret = process.env.ADMIN_TOTP_SECRET
const res = await fetch(BASE + '/api/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ password: process.env.ADMIN_PASSWORD, code: secret ? totp(secret) : undefined }),
})
assert.equal(res.status, 200, 'login de prueba (¿ADMIN_PASSWORD en .env y el servidor reiniciado?)')
export const cookie = res.headers.get('set-cookie')!.split(';')[0]
/** Cabeceras admin: `H` para JSON, `bare` para DELETE sin cuerpo (Fastify rechaza content-type JSON sin cuerpo). */
export const H = { cookie, 'content-type': 'application/json' }
export const bare = { cookie }
export const hostSocket = () => io(BASE, { extraHeaders: { cookie } })
