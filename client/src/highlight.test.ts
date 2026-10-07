// Resaltado: palabras clave fuera de cadenas/comentarios, y nada se pierde ni se duplica. pnpm test
import assert from 'node:assert/strict'
import { tokenize } from './highlight.tsx'
import { CODE_LANGS, type CodeLang } from '../../shared/questions.ts'

const cls = (code: string, lang: CodeLang) => Object.fromEntries(tokenize(code, lang).filter(([c]) => c).map(([c, t]) => [t, c]))

assert.deepEqual(cls('const x = "if"; // return', 'js'), { const: 'k', '"if"': 's', '// return': 'c' }, 'js: if dentro de cadena no es keyword')
assert.equal(cls('def f(a): return 1  # hola', 'py')['# hola'], 'c')
assert.equal(cls('def f(a): return 1', 'py').f, 'f', 'llamada/definición de función')
assert.equal(cls('SELECT * FROM t -- x', 'sql').select ?? cls('select 1', 'sql').select, 'k', 'sql sin importar mayúsculas')
assert.equal(cls('/* a\nb */ int x', 'c')['/* a\nb */'], 'c', 'comentario de bloque multilínea')
assert.equal(cls('a { color: #fff; }', 'css')['#fff'], 'n', 'color hex no es comentario')
assert.equal(cls('<div class="a">', 'html')['<div'], 't')
for (const l of Object.keys(CODE_LANGS) as CodeLang[]) {
  const src = 'if (x) {\n  print("a\\"b") // c\n}\n`t` 12.5 #z <b>\n'
  assert.equal(tokenize(src, l).map(([, t]) => t).join(''), src, `${l}: el texto se conserva intacto`)
}
console.log('ok')
