import { z } from 'zod'

// Un tipo de pregunta = un esquema de datos + un esquema de respuesta + grade().
// Para agregar uno: sumar una entrada en `types`, su rama en `questionSchema`, `hideAnswer` y `problemsOf`,
// y una carpeta/archivo en client/src/types/ + su entrada en el registro.

const text = z.string().trim().min(1).max(200)
const options = z.array(text).min(2).max(6)
const sentence = z.string().trim().min(1).max(500)

/** Compara respuestas escritas: sin mayúsculas, tildes ni espacios sobrantes (se escribe desde un celular). */
export const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()

// Huecos en texto: "She [has|have] been" -> segmentos de texto y huecos con sus opciones.
//   completa-espacios: todas las opciones de un hueco son respuestas válidas.
//   menú desplegable:  la PRIMERA opción es la correcta y el resto distractores.
export type Seg = { t: string } | { options: string[] }
const BLANK = /\[([^[\]]*)\]/g

export function parseBlanks(src: string): Seg[] {
  const out: Seg[] = []
  let last = 0
  for (const m of src.matchAll(BLANK)) {
    if (m.index > last) out.push({ t: src.slice(last, m.index) })
    out.push({ options: m[1].split('|').map((s) => s.trim()).filter(Boolean) })
    last = m.index + m[0].length
  }
  if (last < src.length) out.push({ t: src.slice(last) })
  return out
}
export const blanksOf = (src: string) => parseBlanks(src).filter((s): s is { options: string[] } => 'options' in s)

// Texto interactivo: el estudiante toca palabras. El profe marca las correctas con [corchetes].
// Los índices de token se calculan sobre el texto SIN corchetes, así la vista del estudiante (sin marcas) tiene los mismos índices.
export type Tok = { t: string; ok: boolean }
export function tapTokens(src: string): { clean: string; toks: Tok[] } {
  let clean = ''
  const marks: boolean[] = []
  let on = false
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '[') on = true
    else if (src[i] === ']') on = false
    else (clean += src[i], marks.push(on))
  }
  const toks = [...clean.matchAll(/\S+/g)].map((m) => ({
    t: m[0],
    ok: [...m[0]].some((ch, k) => marks[m.index + k] && /[\p{L}\p{N}]/u.test(ch)), // correcta si alguna letra/número del token está marcada
  }))
  return { clean, toks }
}

const gradeBlanks = (src: string, a: string[], ok: (opts: string[], given: string) => boolean) => {
  const blanks = blanksOf(src)
  return blanks.length ? blanks.filter((b, i) => ok(b.options, norm(a[i] ?? ''))).length / blanks.length : 0
}

export const types = {
  mcq: {
    label: 'Opción múltiple',
    data: z.object({ options, correct: z.number().int().min(0) }),
    answer: z.number().int(),
    grade: (d: { correct: number }, a: number) => (a === d.correct ? 1 : 0),
  },
  multi: {
    label: 'Selección múltiple',
    data: z.object({ options, correct: z.array(z.number().int()).min(1) }),
    answer: z.array(z.number().int()),
    grade: (d: { correct: number[] }, a: number[]) =>
      a.length === d.correct.length && d.correct.every((i) => a.includes(i)) ? 1 : 0,
  },
  tf: {
    label: 'Verdadero o falso',
    data: z.object({ correct: z.boolean() }),
    answer: z.boolean(),
    grade: (d: { correct: boolean }, a: boolean) => (a === d.correct ? 1 : 0),
  },
  fill: {
    label: 'Completa los espacios',
    data: z.object({ text: sentence }),
    answer: z.array(z.string().max(100)).max(8),
    // calificación parcial: fracción de huecos acertados
    grade: (d: { text: string }, a: string[]) => gradeBlanks(d.text, a, (opts, g) => opts.some((o) => norm(o) === g)),
  },
  dropdown: {
    label: 'Menú desplegable',
    data: z.object({ text: sentence }),
    answer: z.array(z.string().max(100)).max(8),
    grade: (d: { text: string }, a: string[]) => gradeBlanks(d.text, a, (opts, g) => norm(opts[0] ?? '\0') === g),
  },
  order: {
    label: 'Reordenar',
    data: z.object({ items: z.array(text).min(2).max(8) }), // en el orden CORRECTO
    answer: z.array(z.string().max(200)).max(8),
    // parcial: fracción de elementos en su posición
    grade: (d: { items: string[] }, a: string[]) => d.items.filter((it, i) => norm(a[i] ?? '') === norm(it)).length / d.items.length,
  },
  match: {
    label: 'Relacionar',
    data: z.object({
      pairs: z.array(z.object({ left: text, right: text })).min(2).max(6),
      pool: z.array(z.string()).optional(), // solo en la vista del estudiante: derechas barajadas
    }),
    answer: z.array(z.string().max(200)).max(6), // answer[i] = derecha elegida para la izquierda i
    grade: (d: { pairs: { right: string }[] }, a: string[]) => d.pairs.filter((p, i) => norm(a[i] ?? '') === norm(p.right)).length / d.pairs.length,
  },
  sort: {
    label: 'Categorizar',
    data: z.object({
      cats: z.array(z.object({ name: text, items: z.array(z.string().trim().max(200)) })).min(2).max(4),
      pool: z.array(z.string()).optional(), // solo en la vista del estudiante: elementos barajados
    }),
    answer: z.record(z.string(), z.number().int()), // elemento -> índice de categoría
    grade: (d: { cats: { items: string[] }[] }, a: Record<string, number>) => {
      const all = d.cats.flatMap((c, ci) => c.items.map((it) => [it, ci] as const))
      return all.length ? all.filter(([it, ci]) => a[it] === ci).length / all.length : 0
    },
  },
  drag: {
    label: 'Arrastra y suelta',
    data: z.object({
      text: sentence,
      extra: z.array(z.string().trim().max(100)).max(8).default([]), // distractores del banco de palabras
      bank: z.array(z.string()).optional(), // solo en la vista del estudiante: banco barajado
    }),
    answer: z.array(z.string().max(100)).max(8),
    grade: (d: { text: string }, a: string[]) => gradeBlanks(d.text, a, (opts, g) => opts.some((o) => norm(o) === g)),
  },
  table: {
    label: 'Tabla de relleno',
    data: z.object({ rows: z.array(z.array(z.string().max(120)).min(2).max(5)).min(2).max(6), header: z.boolean().default(true) }),
    answer: z.array(z.string().max(100)).max(12),
    grade: (d: { rows: string[][] }, a: string[]) => gradeBlanks(d.rows.flat().join(' '), a, (opts, g) => opts.some((o) => norm(o) === g)),
  },
  grid: {
    label: 'Cuadrícula coincidente',
    data: z.object({ cols: z.array(text).min(2).max(5), rows: z.array(z.object({ text, correct: z.number().int() })).min(2).max(8) }),
    answer: z.array(z.number().int()).max(8), // answer[i] = columna elegida para la fila i (-1 = ninguna)
    grade: (d: { rows: { correct: number }[] }, a: number[]) => d.rows.filter((r, i) => a[i] === r.correct).length / d.rows.length,
  },
  tap: {
    label: 'Texto interactivo',
    data: z.object({ text: z.string().trim().min(1).max(1200) }),
    answer: z.array(z.number().int().min(0).max(600)).max(600),
    // aciertos menos errores, sobre el total de palabras correctas (nunca negativo)
    grade: (d: { text: string }, a: number[]) => {
      const ok = new Set(tapTokens(d.text).toks.flatMap((t, i) => (t.ok ? [i] : [])))
      if (!ok.size) return 0
      let hits = 0, wrong = 0
      for (const i of new Set(a)) ok.has(i) ? hits++ : wrong++
      return Math.max(0, (hits - wrong) / ok.size)
    },
  },
  open: {
    label: 'Respuesta abierta',
    data: z.object({ answers: z.array(text).min(1).max(10) }),
    answer: z.string().max(200),
    grade: (d: { answers: string[] }, a: string) => (d.answers.some((x) => norm(x) === norm(a)) ? 1 : 0),
  },
} as const

export type TypeId = keyof typeof types
export const typeIds = Object.keys(types) as TypeId[]

/** Lenguajes del bloque de código de una pregunta (valor -> nombre visible). */
export const CODE_LANGS = {
  js: 'JavaScript', ts: 'TypeScript', py: 'Python', java: 'Java', cs: 'C#', c: 'C', cpp: 'C++', go: 'Go', rust: 'Rust',
  php: 'PHP', ruby: 'Ruby', swift: 'Swift', kotlin: 'Kotlin', sql: 'SQL', html: 'HTML', css: 'CSS', bash: 'Bash', json: 'JSON', text: 'Texto plano',
} as const
export type CodeLang = keyof typeof CODE_LANGS

const base = {
  id: z.string().min(1),
  prompt: z.string().trim().min(1).max(400),
  passage: z.string().trim().max(2000).optional(), // texto de lectura que acompaña a la pregunta (Lectura)
  code: z.object({ lang: z.enum(Object.keys(CODE_LANGS) as [CodeLang, ...CodeLang[]]), text: z.string().max(1500) }).optional(), // fragmento de código que acompaña a la pregunta
  explanation: z.string().trim().max(600).optional(), // por qué es la respuesta; se muestra al revelar
  time: z.number().int().min(5).max(120),
  points: z.number().int().min(0).max(2000),
}

export const questionSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('mcq'), data: types.mcq.data }),
  z.object({ ...base, type: z.literal('multi'), data: types.multi.data }),
  z.object({ ...base, type: z.literal('tf'), data: types.tf.data }),
  z.object({ ...base, type: z.literal('fill'), data: types.fill.data }),
  z.object({ ...base, type: z.literal('dropdown'), data: types.dropdown.data }),
  z.object({ ...base, type: z.literal('order'), data: types.order.data }),
  z.object({ ...base, type: z.literal('match'), data: types.match.data }),
  z.object({ ...base, type: z.literal('sort'), data: types.sort.data }),
  z.object({ ...base, type: z.literal('drag'), data: types.drag.data }),
  z.object({ ...base, type: z.literal('table'), data: types.table.data }),
  z.object({ ...base, type: z.literal('grid'), data: types.grid.data }),
  z.object({ ...base, type: z.literal('tap'), data: types.tap.data }),
  z.object({ ...base, type: z.literal('open'), data: types.open.data }),
])
export type Question = z.infer<typeof questionSchema>

export const lessonInputSchema = z.object({
  title: z.string().trim().min(1).max(80),
  emoji: z.string().max(8).default('🎯'),
  questions: z.array(questionSchema).max(100),
})
export type LessonInput = z.infer<typeof lessonInputSchema>
export type Lesson = LessonInput & { id: string; updatedAt: number }

/** 0..1. Una respuesta malformada puntúa 0 en vez de romper la partida. */
export function grade(q: Question, answer: unknown): number {
  const t = types[q.type]
  const parsed = t.answer.safeParse(answer)
  if (!parsed.success) return 0
  return (t.grade as (d: unknown, a: unknown) => number)(q.data, parsed.data)
}

/** Problemas de una pregunta, en español. Se usa en el editor (antes de guardar) y en el servidor. */
function problemsOf(q: Question): string[] {
  const out: string[] = []
  if (!q.prompt.trim()) out.push('falta el enunciado')
  if (q.code && !q.code.text.trim()) out.push('el bloque de código está vacío (escríbelo o quítalo)')
  switch (q.type) {
    case 'mcq':
    case 'multi': {
      const { options: o, correct } = q.data
      const list = typeof correct === 'number' ? [correct] : correct
      if (o.some((x) => !x.trim())) out.push('hay opciones vacías')
      if (!list.length || list[0] < 0 || list.some((c) => c >= o.length)) out.push('marca la respuesta correcta')
      break
    }
    case 'order': {
      const items = q.data.items.map((x) => norm(x))
      if (items.some((x) => !x)) out.push('hay elementos vacíos')
      if (new Set(items).size !== items.length) out.push('hay elementos repetidos')
      break
    }
    case 'match':
      if (q.data.pairs.some((p) => !p.left.trim() || !p.right.trim())) out.push('completa todas las parejas')
      break
    case 'sort': {
      const all = q.data.cats.flatMap((c) => c.items.map((x) => norm(x)))
      if (q.data.cats.some((c) => !c.name.trim())) out.push('una categoría no tiene nombre')
      if (q.data.cats.some((c) => !c.items.some((x) => x.trim()))) out.push('cada categoría necesita al menos un elemento')
      if (all.some((x) => !x)) out.push('hay elementos vacíos')
      if (new Set(all).size !== all.length) out.push('un elemento no puede repetirse ni estar en dos categorías')
      if (all.length > 12) out.push('máximo 12 elementos en total')
      break
    }
    case 'fill':
    case 'dropdown':
    case 'drag': {
      const blanks = blanksOf(q.data.text)
      const min = q.type === 'dropdown' ? 2 : 1
      if (!blanks.length) out.push('escribe al menos un hueco entre corchetes, p. ej. [respuesta]')
      else if (blanks.some((b) => b.options.length < min))
        out.push(q.type !== 'dropdown' ? 'hay un hueco vacío []' : 'cada hueco necesita 2 o más opciones: [correcta|otra|otra]')
      if (blanks.length > 8) out.push('máximo 8 huecos')
      break
    }
    case 'table': {
      const blanks = blanksOf(q.data.rows.flat().join(' '))
      if (q.data.rows.some((r) => r.length !== q.data.rows[0].length)) out.push('todas las filas deben tener las mismas columnas')
      if (!blanks.length) out.push('escribe al menos un hueco entre corchetes en alguna celda, p. ej. [respuesta]')
      else if (blanks.some((b) => !b.options.length)) out.push('hay un hueco vacío []')
      if (blanks.length > 12) out.push('máximo 12 huecos')
      break
    }
    case 'grid':
      if (q.data.cols.some((c) => !c.trim()) || q.data.rows.some((r) => !r.text.trim())) out.push('completa los encabezados y las filas')
      if (q.data.rows.some((r) => r.correct < 0 || r.correct >= q.data.cols.length)) out.push('marca la columna correcta de cada fila')
      break
    case 'tap':
      if (!tapTokens(q.data.text).toks.some((t) => t.ok)) out.push('marca al menos una palabra correcta entre [corchetes]')
      break
    case 'open':
      if (!q.data.answers.some((a) => a.trim())) out.push('agrega al menos una respuesta aceptada')
      break
  }
  return out
}

export function lessonProblems(l: Pick<LessonInput, 'title' | 'questions'>): string[] {
  const out: string[] = []
  if (!l.title.trim()) out.push('Ponle un título a la lección')
  if (!l.questions.length) out.push('Agrega al menos una pregunta')
  l.questions.forEach((q, i) => problemsOf(q).forEach((p) => out.push(`Pregunta ${i + 1}: ${p}`)))
  return out
}

// Barajado determinista (semilla = id de la pregunta + sal secreta del servidor): la vista pública se emite en cada
// respuesta recibida y las opciones no pueden saltar de lugar entre emisiones. Sin la sal, cualquiera con el id
// (público) y esta función (viaja en el código del navegador) podía deshacer el barajado y ver la respuesta.
function rng(seed: string) {
  let a = 0
  for (const c of seed) a = (Math.imul(a, 31) + c.charCodeAt(0)) | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function shuffled<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Quita lo que no debe ver el estudiante mientras responde (la solución Y la explicación). */
export const hideAnswer = (q: Question, salt = ''): Question => ({ ...hideData(q, q.id + salt), explanation: undefined })

function hideData(q: Question, seed: string): Question {
  switch (q.type) {
    case 'tf': return { ...q, data: { correct: false } }
    case 'mcq': return { ...q, data: { ...q.data, correct: -1 } }
    case 'multi': return { ...q, data: { ...q.data, correct: [] } }
    case 'open': return { ...q, data: { answers: [] } }
    case 'table': return { ...q, data: { ...q.data, rows: q.data.rows.map((r) => r.map((c) => c.replace(BLANK, '[]'))) } }
    case 'grid': return { ...q, data: { ...q.data, rows: q.data.rows.map((r) => ({ text: r.text, correct: -1 })) } }
    case 'tap': return { ...q, data: { text: tapTokens(q.data.text).clean } }
    case 'order': {
      let a = shuffled(q.data.items, rng(seed))
      if (a.every((x, i) => x === q.data.items[i])) a = [...a.slice(1), a[0]] // nunca llega ya resuelto
      return { ...q, data: { items: a } }
    }
    case 'match':
      return { ...q, data: { pairs: q.data.pairs.map((p) => ({ left: p.left, right: '' })), pool: shuffled(q.data.pairs.map((p) => p.right), rng(seed)) } }
    case 'sort':
      return { ...q, data: { cats: q.data.cats.map((c) => ({ name: c.name, items: [] })), pool: shuffled(q.data.cats.flatMap((c) => c.items), rng(seed)) } }
    case 'drag': {
      // banco = primera opción de cada hueco + distractores
      const words = [...blanksOf(q.data.text).map((b) => b.options[0]), ...q.data.extra].filter(Boolean)
      return { ...q, data: { text: q.data.text.replace(BLANK, '[]'), extra: [], bank: shuffled(words, rng(seed)) } }
    }
    case 'fill': return { ...q, data: { text: q.data.text.replace(BLANK, '[]') } }
    case 'dropdown': {
      const rand = rng(seed)
      return { ...q, data: { text: q.data.text.replace(BLANK, (_, inner: string) => `[${shuffled(inner.split('|').map((s) => s.trim()).filter(Boolean), rand).join('|')}]`) } }
    }
  }
}

/** Puntos: más rápido = más puntos (mitad base + mitad por velocidad) + bono de racha. */
export function score(points: number, timeLeftRatio: number, streak: number): number {
  const speed = 0.5 + 0.5 * Math.max(0, Math.min(1, timeLeftRatio))
  return Math.round(points * speed) + Math.min(streak, 5) * 50
}
