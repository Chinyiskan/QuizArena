// Vigila que el cliente no use APIs que solo existen en contextos seguros (HTTPS/localhost).
// La app se abre por http://IP-de-la-red y ahí revientan: usar uid() y copyText() de client/src/browser.ts.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const BAD = /crypto\.randomUUID|navigator\.clipboard|crypto\.subtle|navigator\.mediaDevices|navigator\.serviceWorker/
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]))

const offenders = files('client/src')
  .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('browser.ts'))
  .filter((f) => BAD.test(readFileSync(f, 'utf8')))
assert.deepEqual(offenders, [], `APIs de contexto seguro fuera de browser.ts: ${offenders.join(', ')}`)
console.log('ok')
