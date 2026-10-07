import assert from 'node:assert/strict'
import { bombCount, bombOver, hideWrong, pickBombs, rollDrop, stealAmount } from './powers.ts'

// 50/50: nunca oculta la correcta, siempre deja al menos una incorrecta
for (let correct = 0; correct < 6; correct++)
  for (let n = Math.max(3, correct + 1); n <= 6; n++) {
    const h = hideWrong(n, correct)
    assert.ok(!h.includes(correct), 'no oculta la correcta')
    assert.equal(h.length, n === 3 ? 1 : 2)
    assert.equal(new Set(h).size, h.length, 'sin repetidos')
  }
assert.deepEqual(hideWrong(2, 0), [], 'con 2 opciones no hay nada que quitar')

// caída: el último tiene más probabilidad que el primero; rnd=0 siempre cae, rnd≈1 nunca
const rate = (rank: number) => Array.from({ length: 20000 }, () => rollDrop(rank, 10, false)).filter(Boolean).length / 20000
assert.ok(rate(9) > rate(0) + 0.15, 'quien va atrás recibe más poderes')
assert.ok(rollDrop(0, 10, false, () => 0), 'rnd 0 cae')
assert.equal(rollDrop(9, 10, true, () => 0.999), undefined, 'rnd alto no cae')
const seq = (...v: number[]) => () => v.shift()!
assert.deepEqual([0.1, 0.3, 0.5, 0.7, 0.9].map((r) => rollDrop(0, 1, true, seq(0, r))), ['x2', 'shield', 'fifty', 'steal', 'bet'], 'reparto de tipos')

// robo: 10 % con tope
assert.equal(stealAmount(1000), 100)
assert.equal(stealAmount(9000), 300)
assert.equal(stealAmount(0), 0)

// papa caliente
assert.deepEqual([0, 1, 2, 3, 4, 8, 30].map(bombCount), [0, 1, 1, 1, 1, 2, 8], 'cantidad de bombas')
for (let n = 2; n < 40; n++) assert.ok(bombCount(n) < n && bombCount(n) >= 1, `con ${n} vivos siempre sobrevive alguien`)
assert.ok(bombOver(0, 5) && bombOver(1, 5) && !bombOver(1, 1) && !bombOver(2, 5), 'fin de la partida')
const alive = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const b = pickBombs(alive)
assert.equal(b.length, 2)
assert.ok(b.every((x) => alive.includes(x)) && new Set(b).size === 2, 'bombas entre los vivos, sin repetir')
console.log('ok')
