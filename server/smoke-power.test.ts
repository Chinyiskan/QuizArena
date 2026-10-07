// Poderes del modo en vivo contra el servidor vivo. Uso: pnpm test:live
import assert from 'node:assert/strict'
import { io } from 'socket.io-client'
import { BASE, H, bare, hostSocket } from './test-auth.ts'

const post = (p: string, b: unknown) => fetch(BASE + p, { method: 'POST', headers: H, body: JSON.stringify(b) }).then((r) => r.json())
const ack = (s: ReturnType<typeof io>, ...a: unknown[]) => new Promise<any>((res) => s.emit(...([a[0], ...a.slice(1), res] as [string, ...unknown[]])))
const questions = Array.from({ length: 16 }, (_, i) => ({ id: `q${i}`, type: 'mcq', prompt: `P${i}`, time: 20, points: 1000, data: { options: ['a', 'b', 'c', 'd'], correct: 1 } }))
const lesson = await post('/api/lessons', { title: 'Poderes', emoji: 'flask', questions })

async function room(powers: boolean) {
  const { pin } = await post('/api/rooms', { lessonId: lesson.id })
  const host = hostSocket(), a = io(BASE), b = io(BASE)
  const box: { s?: any; hide?: any; meA?: any; meB?: any } = {}
  host.on('state', (s) => (box.s = s))
  b.on('hide', (h) => (box.hide = h))
  // el poder de cada uno viaja solo por su canal personal ('me'), nunca en el estado que ven todos
  a.on('me', (m) => (box.meA = m))
  b.on('me', (m) => (box.meB = m))
  assert.ok(await ack(host, 'host:open', pin))
  const ja = await ack(a, 'player:join', pin, 'Ana', 'pix:fox', undefined)
  const jb = await ack(b, 'player:join', pin, 'Beto', 'pix:fox', undefined)
  if (!powers) host.emit('host:style', pin, 'classic')
  const until = async (f: () => boolean) => { for (let i = 0; i < 100 && !f(); i++) await new Promise((r) => setTimeout(r, 30)); assert.ok(f(), 'timeout') }
  const round = async (i: number, beforeAnswer?: () => Promise<void>) => {
    host.emit('host:next', pin)
    await until(() => box.s.phase === 'question' && box.s.index === i)
    await beforeAnswer?.()
    a.emit('player:answer', 1) // Ana siempre acierta; Beto va detrás
    b.emit('player:answer', i % 2 ? 1 : 0)
    await until(() => box.s.phase === 'reveal')
    assert.ok(box.s.players.every((p: any) => !('power' in p) && !('armed' in p) && !('key' in p)), 'el ranking público no lleva poderes ni claves')
  }
  return { pin, host, a, b, ja, jb, box, until, round, close: () => (host.disconnect(), a.disconnect(), b.disconnect(), fetch(BASE + `/api/rooms/${pin}`, { method: 'DELETE', headers: bare })) }
}

// con poderes desactivados no cae ninguno
{
  const t = await room(false)
  for (let i = 0; i < 6; i++) await t.round(i)
  assert.ok(!t.box.meA?.power && !t.box.meB?.power && !Object.keys(t.box.s.drops).length, 'sin poderes si el profe los apagó')
  await t.close()
}

// con poderes: cae alguno, se usa y se consume
{
  const t = await room(true)
  let i = 0, power: string | undefined
  for (; i < 14 && !power; i++) {
    await t.round(i)
    power = t.box.meB?.power
  }
  assert.ok(power, 'tras varias rondas, Beto (el de atrás) recibió un poder')
  assert.equal(t.box.s.drops[t.jb.id], power, 'la caída se informa en el reveal')
  t.box.hide = undefined
  await t.round(i, async () => {
    t.b.emit('player:power')
    await t.until(() => (power === 'fifty' ? !!t.box.hide : t.box.meB?.armed === power))
    await new Promise((r) => setTimeout(r, 100))
    const me = t.box.meB
    if (power === 'fifty') {
      assert.equal(t.box.hide.hide.length, 2, '50/50 oculta dos opciones')
      assert.ok(!t.box.hide.hide.includes(1), 'nunca oculta la correcta')
      assert.equal(me.power, undefined, 'se consumió')
    } else assert.equal(me.power, undefined, 'el poder activado sale del inventario')
    assert.notEqual(t.box.s.question.data.correct, 1, 'la respuesta correcta no viaja')
  })
  await t.close()
}

await fetch(BASE + `/api/lessons/${lesson.id}`, { method: 'DELETE', headers: bare })
console.log('ok')
process.exit(0)
