// `pnpm musica`: recodifica la música de fondo para que pese la mitad (cada estudiante la descarga desde TU laptop, por el túnel).
// Lee los originales de music-src/*.mp3 (nunca se tocan: son tu copia maestra) y escribe public/sfx/music-*.m4a.
// AAC-LC 96 kbps estéreo: a ese bitrate suena mejor que un MP3 equivalente y lo reproducen iPhone, Android y Chrome.
// Requiere ffmpeg: winget install Gyan.FFmpeg (el script lo busca en el PATH y en la carpeta de winget).
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const KBPS = process.env.KBPS ?? '96'
// Limitador suave antes de codificar: los originales ya rozan 0 dBFS y AAC añade picos extra al comprimir (saturaría al reproducir).
// Solo recorta los picos sueltos; el volumen general no cambia.
const LIMIT = 'alimiter=limit=0.8:attack=5:release=60:level=disabled'
const SRC = 'music-src'
const OUT = 'public/sfx'

function findFfmpeg() {
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return 'ffmpeg' } catch {}
  // recién instalado con winget, el PATH de esta terminal aún no lo ve
  const pk = join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData/Local'), 'Microsoft/WinGet/Packages')
  if (existsSync(pk)) for (const d of readdirSync(pk)) {
    if (!d.startsWith('Gyan.FFmpeg')) continue
    for (const v of readdirSync(join(pk, d))) {
      const exe = join(pk, d, v, 'bin', 'ffmpeg.exe')
      if (existsSync(exe)) return exe
    }
  }
  console.error('No encuentro ffmpeg. Instálalo con: winget install Gyan.FFmpeg')
  process.exit(1)
}

if (!existsSync(SRC)) (console.error(`Falta la carpeta ${SRC}/ con los MP3 originales.`), process.exit(1))
mkdirSync(OUT, { recursive: true })
const ffmpeg = findFfmpeg()
const mb = (f) => (statSync(f).size / 1e6).toFixed(2)
let before = 0, after = 0
for (const f of readdirSync(SRC).filter((f) => /\.mp3$/i.test(f))) {
  const out = join(OUT, f.replace(/\.mp3$/i, '.m4a'))
  // faststart: el índice va al principio, así empieza a sonar sin bajar todo el archivo
  execFileSync(ffmpeg, ['-y', '-v', 'error', '-i', join(SRC, f), '-vn', '-af', LIMIT, '-c:a', 'aac', '-b:a', `${KBPS}k`, '-aac_coder', 'twoloop', '-movflags', '+faststart', out])
  before += statSync(join(SRC, f)).size
  after += statSync(out).size
  console.log(`${f}  ${mb(join(SRC, f))} MB -> ${mb(out)} MB`)
}
console.log(`Total: ${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(1)} MB (${KBPS} kbps)`)
