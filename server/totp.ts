// Genera credenciales nuevas para .env: pnpm totp
import { randomBytes } from 'node:crypto'
import { base32 } from './auth.ts'

const secret = base32(randomBytes(20))
console.log(`Copia esto en .env (y no lo compartas):

ADMIN_PASSWORD=${randomBytes(18).toString('base64url')}
ADMIN_TOTP_SECRET=${secret}

En tu app de 2FA (Google Authenticator, Aegis, 2FAS): "Introducir clave" -> nombre QuizArena, clave ${secret}, por tiempo.
O pega este enlace en una app que lo acepte: otpauth://totp/QuizArena:profe?secret=${secret}&issuer=QuizArena
Sin ADMIN_TOTP_SECRET el login pide solo la contraseña.`)
