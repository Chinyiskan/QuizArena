// Resaltado de sintaxis mínimo y sin dependencias: comentarios, cadenas, números y palabras clave por lenguaje.
// ponytail: no entiende gramáticas (plantillas anidadas, regex literales); si hace falta más, sustituir por shiki/highlight.js.
import type { ReactNode } from 'react'
import type { CodeLang } from '../../shared/questions.ts'

const words = (s: string) => new Set(s.split(' '))
const C_LIKE = 'if else for while do switch case break continue return new this null true false class static void int float double char long short bool boolean string const let var function try catch finally throw throws import export from default async await public private protected extends implements interface enum struct typeof instanceof in of'
const KEYWORDS: Partial<Record<CodeLang, Set<string>>> = {
  js: words(C_LIKE + ' undefined yield delete super'),
  ts: words(C_LIKE + ' undefined type readonly as keyof namespace abstract declare'),
  java: words(C_LIKE + ' final package abstract synchronized super'),
  cs: words(C_LIKE + ' using namespace var readonly override virtual abstract sealed ref out'),
  c: words(C_LIKE + ' typedef sizeof unsigned signed extern include define NULL'),
  cpp: words(C_LIKE + ' typedef sizeof unsigned template typename namespace using nullptr include define auto virtual override'),
  go: words('func package import var const type struct interface map chan go defer return if else for range switch case default break continue select nil true false'),
  rust: words('fn let mut const struct enum impl trait pub use mod match if else for while loop return self Self true false Some None Ok Err move ref as in where async await'),
  php: words(C_LIKE + ' echo foreach elseif function array isset unset namespace use'),
  ruby: words('def end if elsif else unless while until for in do return class module self nil true false begin rescue ensure yield require puts then case when and or not'),
  swift: words('func let var if else for while switch case default return class struct enum protocol extension init self nil true false guard in import try catch throw async await'),
  kotlin: words('fun val var if else for while when return class object interface data enum init this null true false import package in is as try catch throw'),
  py: words('def class if elif else for while in not and or is return import from as with try except finally raise lambda None True False pass break continue yield global del async await print'),
  sql: words('SELECT FROM WHERE INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE ALTER DROP JOIN INNER LEFT RIGHT OUTER ON GROUP BY ORDER HAVING LIMIT AS AND OR NOT NULL IS IN LIKE DISTINCT COUNT SUM AVG MIN MAX PRIMARY KEY FOREIGN REFERENCES UNION ASC DESC'),
  bash: words('if then else elif fi for while do done case esac function return echo cd ls export in'),
  css: words(''), json: words('true false null'), html: words(''), text: words(''),
}
const COMMENT: Partial<Record<CodeLang, string>> = { py: '#', ruby: '#', bash: '#', sql: '--' }
const NO_COMMENT = new Set<CodeLang>(['json', 'text'])

type Tok = [cls: string, text: string]

export function tokenize(code: string, lang: CodeLang): Tok[] {
  if (lang === 'text') return [['', code]]
  const kw = KEYWORDS[lang]!
  const line = COMMENT[lang] ?? '//'
  const out: Tok[] = []
  // orden importa: comentarios y cadenas primero para no resaltar palabras clave dentro de ellos
  const re = new RegExp(
    [
      NO_COMMENT.has(lang) ? '(?!)' : lang === 'html' ? '<!--[\\s\\S]*?-->' : `${line.replace(/[/#*-]/g, '\\$&')}[^\\n]*|${lang === 'py' || lang === 'ruby' || lang === 'bash' || lang === 'sql' ? '(?!)' : '/\\*[\\s\\S]*?\\*/'}`,
      '"(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\'|`(?:\\\\.|[^`\\\\])*`',
      '\\b\\d[\\d_.]*(?:e[+-]?\\d+)?\\b|#[0-9a-fA-F]{3,8}\\b',
      lang === 'html' ? '</?[a-zA-Z][\\w-]*|/?>' : '[A-Za-z_$][\\w$]*',
    ].join('|'),
    'g',
  )
  let last = 0
  for (const m of code.matchAll(re)) {
    const t = m[0], i = m.index!
    if (i > last) out.push(['', code.slice(last, i)])
    last = i + t.length
    const c =
      /^(\/\/|\/\*|#(?![0-9a-fA-F]{3,8}\b)|--|<!--)/.test(t) && !(lang === 'css' && t[0] === '#') ? 'c'
      : /^["'`]/.test(t) ? 's'
      : /^(\d|#)/.test(t) ? 'n'
      : lang === 'html' ? 't'
      : kw.has(lang === 'sql' ? t.toUpperCase() : t) ? 'k'
      : /^[A-Z]/.test(t) ? 'y' // tipos y clases
      : /^\s*\(/.test(code.slice(last)) ? 'f' : ''
    out.push([c, t])
  }
  if (last < code.length) out.push(['', code.slice(last)])
  return out
}

/** Divide los tokens por líneas (un comentario de bloque puede abarcar varias) para numerarlas. */
export function highlightLines(code: string, lang: CodeLang): ReactNode[][] {
  const lines: ReactNode[][] = [[]]
  tokenize(code, lang).forEach(([c, t], k) =>
    t.split('\n').forEach((part, j) => {
      if (j) lines.push([])
      if (part) lines[lines.length - 1].push(c ? <span key={`${k}-${j}`} className={`tk-${c}`}>{part}</span> : part)
    }),
  )
  return lines
}
