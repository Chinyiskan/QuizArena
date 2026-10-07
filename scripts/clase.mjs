// `pnpm clase`: compila, abre el túnel de Cloudflare, arranca el servidor con PUBLIC_URL ya puesta y muestra el link.
// Ctrl+C cierra todo. El túnel va primero porque la URL pública solo se conoce cuando está arriba y el servidor la lee al iniciar.
import { spawn, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'

const PORT = process.env.PORT ?? '3000'
const kids = []
const stop = () => {
  for (const k of kids) {
    try { process.platform === 'win32' ? execSync(`taskkill /pid ${k.pid} /T /F`, { stdio: 'ignore' }) : k.kill() } catch {}
  }
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)

const busy = await new Promise((ok) => {
  const t = createServer().once('error', () => ok(true)).once('listening', () => t.close(() => ok(false)))
  t.listen(Number(PORT), '0.0.0.0')
})
if (busy) (console.error(`El puerto ${PORT} ya está ocupado (¿pnpm dev o start abierto?). Ciérralo y vuelve a correr pnpm clase.`), process.exit(1))

console.log('Compilando…')
try { execSync('pnpm build', { stdio: 'inherit' }) } catch { process.exit(1) }

// barras normales: en una cadena JS "\P" o "\c" se pierden (la ruta quedaba "C:Program Files (x86)cloudflared...")
const bin = ['C:/Program Files (x86)/cloudflared/cloudflared.exe', 'C:/Program Files/cloudflared/cloudflared.exe'].find(existsSync) ?? 'cloudflared'
console.log('Abriendo túnel…')
const tunnel = spawn(bin, ['tunnel', '--url', `http://localhost:${PORT}`], { stdio: ['ignore', 'ignore', 'pipe'] })
kids.push(tunnel)
tunnel.on('error', () => (console.error('No encuentro cloudflared. Instálalo: winget install Cloudflare.cloudflared'), process.exit(1)))
tunnel.on('exit', () => (console.error('El túnel se cerró.'), stop()))

let buf = '', started = false
tunnel.stderr.on('data', (d) => {
  buf += d
  const m = !started && buf.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
  if (!m) return
  started = true
  const url = m[0]
  const server = spawn('pnpm', ['start'], { stdio: 'inherit', shell: true, env: { ...process.env, PUBLIC_URL: url } })
  kids.push(server)
  server.on('exit', stop)
  setTimeout(() => console.log(`\n=== LISTO ===\nProfe:       ${url}/admin\nEstudiantes: el link del lobby ya sale con este dominio\nCtrl+C para cerrar todo\n`), 2500)
})
