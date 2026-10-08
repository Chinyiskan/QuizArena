import assert from 'node:assert/strict'
import { grade, score, hideAnswer, lessonProblems, lessonInputSchema, parseBlanks, tapTokens, type Question } from './questions.ts'

const base = { id: 'x', prompt: 'p', time: 20, points: 1000 }
const mcq: Question = { ...base, type: 'mcq', data: { options: ['a', 'b'], correct: 1 } }
const multi: Question = { ...base, type: 'multi', data: { options: ['a', 'b', 'c'], correct: [0, 2] } }
const tf: Question = { ...base, type: 'tf', data: { correct: true } }
const fill: Question = { ...base, type: 'fill', data: { text: 'La capital de [Francia|francia] es [París]' } }
const dd: Question = { ...base, type: 'dropdown', data: { text: 'She [has|have|is] been to [Paris|Rome|Oslo|Lima]' } }
const order: Question = { ...base, type: 'order', data: { items: ['Alba', 'Mediodía', 'Tarde', 'Noche'] } }
const match: Question = { ...base, type: 'match', data: { pairs: [{ left: 'Francia', right: 'París' }, { left: 'Italia', right: 'Roma' }, { left: 'Perú', right: 'Lima' }] } }
const sort: Question = { ...base, type: 'sort', data: { cats: [{ name: 'Frutas', items: ['Manzana', 'Pera'] }, { name: 'Verduras', items: ['Zanahoria'] }] } }
const drag: Question = { ...base, type: 'drag', data: { text: 'El [sol] es una [estrella]', extra: ['planeta', 'luna'] } }
const table: Question = { ...base, type: 'table', data: { header: true, rows: [['País', 'Capital'], ['Francia', '[París|paris]'], ['[Italia]', 'Roma']] } }
const grid: Question = { ...base, type: 'grid', data: { cols: ['Verdadero', 'Falso'], rows: [{ text: 'El sol es una estrella', correct: 0 }, { text: 'La luna tiene luz propia', correct: 1 }, { text: 'Marte es rojo', correct: 0 }] } }
const tap: Question = { ...base, type: 'tap', data: { text: 'The [cat] sat on the mat and the [dog], too.' } }
const open: Question = { ...base, type: 'open', data: { answers: ['Colombia', 'Rep. de Colombia'] } }

// opción múltiple / selección múltiple / V-F
assert.equal(grade(mcq, 1), 1)
assert.equal(grade(mcq, 0), 0)
assert.equal(grade(mcq, 'basura'), 0)
assert.equal(grade(multi, [2, 0]), 1)
assert.equal(grade(multi, [0]), 0)
assert.equal(grade(multi, [0, 1, 2]), 0)
assert.equal(grade(tf, true), 1)
assert.equal(grade(tf, null), 0)

// completa espacios: sin tildes/mayúsculas, alternativas, parcial
assert.equal(grade(fill, ['FRANCIA', 'paris']), 1)
assert.equal(grade(fill, ['francia', 'roma']), 0.5)
assert.equal(grade(fill, ['x']), 0)
assert.equal(grade(fill, 'no es array'), 0)

// desplegable: la primera opción es la correcta
assert.equal(grade(dd, ['has', 'Paris']), 1)
assert.equal(grade(dd, ['have', 'Paris']), 0.5)
assert.equal(grade(dd, []), 0)

// abierta
assert.equal(grade(open, '  colombia '), 1)
assert.equal(grade(open, 'Perú'), 0)

// reordenar: parcial por posiciones
assert.equal(grade(order, ['Alba', 'Mediodía', 'Tarde', 'Noche']), 1)
assert.equal(grade(order, ['alba', 'tarde', 'mediodia', 'noche']), 0.5)
assert.equal(grade(order, []), 0)

// relacionar: answer[i] = derecha elegida para la izquierda i
assert.equal(grade(match, ['paris', 'Roma', 'Lima']), 1)
assert.equal(grade(match, ['Roma', 'París', 'Lima']), 1 / 3)
assert.equal(grade(match, 'x'), 0)

// categorizar: elemento -> índice de categoría
assert.equal(grade(sort, { Manzana: 0, Pera: 0, Zanahoria: 1 }), 1)
assert.equal(grade(sort, { Manzana: 0, Pera: 1, Zanahoria: 1 }), 2 / 3)
assert.equal(grade(sort, { Manzana: 'a' }), 0)
assert.equal(grade(sort, {}), 0)

// arrastrar al hueco
assert.equal(grade(drag, ['Sol', 'estrella']), 1)
assert.equal(grade(drag, ['luna', 'estrella']), 0.5)

// tabla de relleno: huecos en orden de lectura, parcial
assert.equal(grade(table, ['Paris', 'italia']), 1)
assert.equal(grade(table, ['x', 'Italia']), 0.5)

// cuadrícula: answer[i] = columna elegida por fila
assert.equal(grade(grid, [0, 1, 0]), 1)
assert.equal(grade(grid, [0, 0, 1]), 1 / 3)
assert.equal(grade(grid, [-1, -1, -1]), 0)

// texto interactivo: aciertos menos errores, nunca negativo; la puntuación pegada no cuenta aparte
const tk = tapTokens('The [cat] sat on the mat and the [dog], too.')
assert.deepEqual(tk.toks.flatMap((t, i) => (t.ok ? [t.t] : [])), ['cat', 'dog,'])
const idx = (w: string) => tk.toks.findIndex((t) => t.t === w)
assert.equal(grade(tap, [idx('cat'), idx('dog,')]), 1)
assert.equal(grade(tap, [idx('cat')]), 0.5)
assert.equal(grade(tap, [idx('cat'), idx('mat')]), 0)
assert.equal(grade(tap, [idx('mat'), idx('sat'), idx('on')]), 0)
assert.equal(grade(tap, 'x'), 0)

// puntaje
assert.equal(score(1000, 1, 0), 1000)
assert.equal(score(1000, 0, 0), 500)
assert.equal(score(1000, 1, 3), 1150)
assert.equal(score(1000, 1, 99), 1250)

// la solución no sale en la vista del estudiante
assert.equal((hideAnswer(mcq).data as { correct: number }).correct, -1)
assert.deepEqual(hideAnswer(open).data, { answers: [] })
const hf = JSON.stringify(hideAnswer(fill).data)
assert.ok(!/Francia|París/i.test(hf) && hf.includes('[]'), 'fill no filtra respuestas')
const hd = hideAnswer(dd)
assert.deepEqual(hideAnswer(dd), hd, 'el barajado del desplegable es estable entre emisiones')
const optsOf = (q: Question) => parseBlanks((q.data as { text: string }).text).flatMap((s) => ('options' in s ? [[...s.options].sort()] : []))
assert.deepEqual(optsOf(hd), optsOf(dd), 'mismas opciones, distinto orden')
assert.equal(parseBlanks('a [b|c] d').length, 3)

// ninguna vista del estudiante revela la solución
const ho = hideAnswer(order).data as { items: string[] }
assert.deepEqual([...ho.items].sort(), [...(order.data as { items: string[] }).items].sort())
assert.notDeepEqual(ho.items, (order.data as { items: string[] }).items, 'reordenar no llega resuelto')
const hm = hideAnswer(match).data as { pairs: { left: string; right: string }[]; pool: string[] }
assert.ok(hm.pairs.every((p) => p.right === '') && hm.pool.length === 3, 'relacionar: derechas fuera de las parejas')
const hs = hideAnswer(sort).data as { cats: { items: string[] }[]; pool: string[] }
assert.ok(hs.cats.every((c) => !c.items.length) && hs.pool.length === 3, 'categorizar: sin elementos en categorías')
const hdg = hideAnswer(drag).data as { text: string; bank: string[] }
assert.ok(hdg.text === 'El [] es una []' && hdg.bank.length === 4, 'arrastrar: banco = respuestas + distractores')
assert.deepEqual(hideAnswer(drag), hideAnswer(drag), 'barajado estable')
// con la sal secreta del servidor el barajado ya no se deduce del id (público): cambia con la sal y es estable con la misma
const big: Question = { ...order, data: { items: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] } }
assert.deepEqual(hideAnswer(big, 's1'), hideAnswer(big, 's1'), 'misma sal: mismo orden entre emisiones')
assert.notDeepEqual(hideAnswer(big, 's1').data, hideAnswer(big).data, 'sin la sal no se reproduce el barajado')

const ht = hideAnswer(table).data as { rows: string[][] }
assert.ok(!JSON.stringify(ht).match(/París|Italia/) && ht.rows[1][1] === '[]', 'tabla: sin respuestas')
assert.ok((hideAnswer(grid).data as { rows: { correct: number }[] }).rows.every((r) => r.correct === -1), 'cuadrícula: sin correctas')
const hp = hideAnswer(tap).data as { text: string }
assert.ok(!hp.text.includes('[') && tapTokens(hp.text).toks.length === tk.toks.length && tapTokens(hp.text).toks.every((t) => !t.ok), 'texto interactivo: mismos índices, sin marcas')

// la explicación tampoco se filtra mientras se responde
const withExp: Question = { ...mcq, explanation: 'Porque 2+2 = 4' }
assert.equal(hideAnswer(withExp).explanation, undefined, 'explicación oculta durante la pregunta')
assert.equal(withExp.explanation, 'Porque 2+2 = 4')

// validación humana
assert.deepEqual(lessonProblems({ title: 't', questions: [{ ...mcq, data: { options: ['a', 'b'], correct: 5 } }] }), ['Pregunta 1: marca la respuesta correcta'])
assert.deepEqual(lessonProblems({ title: 't', questions: [{ ...fill, data: { text: 'sin huecos' } }, { ...dd, data: { text: 'x [a]' } }] }).length, 2)
assert.deepEqual(lessonProblems({ title: 't', questions: [fill, dd, open, order, match, sort, drag, table, grid, tap] }), [])
assert.equal(lessonProblems({ title: 't', questions: [{ ...table, data: { header: true, rows: [['a', 'b'], ['c', 'd']] } }] }).length, 1, 'tabla sin huecos')
assert.equal(lessonProblems({ title: 't', questions: [{ ...grid, data: { cols: ['a', 'b'], rows: [{ text: 'x', correct: 5 }, { text: 'y', correct: 0 }] } }] }).length, 1, 'cuadrícula con columna fuera de rango')
assert.equal(lessonProblems({ title: 't', questions: [{ ...tap, data: { text: 'sin marcas' } }] }).length, 1, 'texto sin palabras marcadas')
assert.deepEqual(lessonProblems({ title: 't', questions: [{ ...open, passage: 'Un texto de lectura' }] }), [])
assert.equal(lessonProblems({ title: 't', questions: [{ ...order, data: { items: ['a', 'A', 'b'] } }] }).length, 1, 'repetidos en reordenar')
assert.equal(lessonProblems({ title: 't', questions: [{ ...sort, data: { cats: [{ name: 'x', items: ['a'] }, { name: 'y', items: ['a'] }] } }] }).length, 1, 'elemento en dos categorías')
assert.equal(lessonProblems({ title: 't', questions: [{ ...match, data: { pairs: [{ left: 'a', right: '' }, { left: 'b', right: 'c' }] } }] }).length, 1)

// bloques de código: texto + sangría por posición; poner de más también resta; las líneas repetidas no confunden
const L1 = [{ t: 'for i in x:', i: 0 }, { t: 'if i:', i: 1 }, { t: 'print(i)', i: 2 }, { t: 'print(i)', i: 1 }]
const blocks: Question = { ...base, type: 'blocks', data: { lang: 'py', lines: L1, extra: ['while True:'], indent: true } }
assert.equal(grade(blocks, L1), 1)
assert.equal(grade(blocks, [L1[0], L1[1], L1[2], { t: 'print(i)', i: 2 }]), 3 / 4, 'sangría mal en una línea')
assert.equal(grade(blocks, [L1[1], L1[0], L1[2], L1[3]]), 2 / 4, 'dos líneas cambiadas')
assert.equal(grade(blocks, [...L1, { t: 'while True:', i: 0 }]), 4 / 5, 'bloque de sobra incluido')
assert.equal(grade({ ...blocks, data: { ...blocks.data, indent: false } } as Question, L1.map((l) => ({ ...l, i: 0 }))), 1, 'sin calificar sangría')
assert.equal(grade(blocks, 'x'), 0)
const hb = hideAnswer(blocks).data as { lines: unknown[]; bank: string[]; extra: string[] }
assert.deepEqual([...hb.bank].sort(), ['for i in x:', 'if i:', 'print(i)', 'print(i)', 'while True:'], 'banco = bloques + distractores')
assert.equal(hb.lines.length + hb.extra.length, 0, 'no viaja la solución')
assert.deepEqual(lessonProblems({ title: 't', questions: [blocks] }), [])
assert.equal(lessonProblems({ title: 't', questions: [{ ...blocks, data: { ...blocks.data, extra: ['IF i:'] } } as Question] }).length, 1, 'distractor igual a un bloque')
assert.equal(lessonProblems({ title: 't', questions: [{ ...blocks, data: { ...blocks.data, lines: [L1[0]] } } as Question] }).length, 1, 'mínimo 2 líneas')

// carpeta y portada: por defecto vacías; la portada solo acepta nombres de archivo generados (nada de rutas)
const L = { title: 't', questions: [mcq] }
assert.equal(lessonInputSchema.parse(L).folder, '')
assert.equal(lessonInputSchema.parse({ ...L, cover: '0123456789abcdef.webp' }).cover, '0123456789abcdef.webp')
for (const cover of ['../x.webp', 'a.svg', '0123456789abcdef.webp/../x']) assert.equal(lessonInputSchema.safeParse({ ...L, cover }).success, false, cover)

console.log('ok')
