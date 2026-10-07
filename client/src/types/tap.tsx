import { useRef, useState } from 'react'
import { tapTokens, type Question } from '../../../shared/questions.ts'
import { Bolt } from '../icons.tsx'

type P = Extract<Question, { type: 'tap' }>
const isWord = (t: string) => /[\p{L}\p{N}]/u.test(t)

export function TapEditor({ q, set }: { q: P; set: (q: P) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const { text } = q.data
  const { toks } = tapTokens(text)
  const found = toks.filter((t) => t.ok).length
  const wrap = () => {
    const el = ref.current!
    const { selectionStart: a, selectionEnd: b } = el
    if (a === b) return
    set({ ...q, data: { text: `${text.slice(0, a)}[${text.slice(a, b)}]${text.slice(b)}` } })
    requestAnimationFrame(() => (el.focus(), el.setSelectionRange(a + 1, b + 1)))
  }
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold opacity-60">Escribe el texto y encierra entre [corchetes] las palabras que el estudiante debe encontrar (la instrucción va arriba, p. ej. "Toca los verbos").</p>
      <textarea ref={ref} className="input min-h-28 resize-y" maxLength={1200} value={text} placeholder="The [cat] sat on the mat and the [dog] barked." aria-label="The [cat] sat on the mat and the [dog] barked." onChange={(e) => set({ ...q, data: { text: e.target.value } })} />
      <button type="button" className="btn btn-sun !py-1.5 !text-base" onClick={wrap}>[ ] Marcar selección como correcta</button>
      {text && (
        <p className="text-lg leading-[2.4rem]">
          {toks.map((t, i) => (
            <span key={i}>
              <span className={t.ok ? 'rounded-lg border-[3px] border-edge bg-lime px-1.5 font-display' : ''}>{t.t}</span>{' '}
            </span>
          ))}
          <span className="ml-1 text-sm font-bold opacity-60">({found} {found === 1 ? 'palabra' : 'palabras'} por encontrar)</span>
        </p>
      )}
    </div>
  )
}

export function TapPlayer({ q, onSubmit, disabled }: { q: P; onSubmit: (v: number[]) => void; disabled?: boolean }) {
  const { toks } = tapTokens(q.data.text)
  const [sel, setSel] = useState<number[]>([])
  const toggle = (i: number) => setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))
  return (
    <div className="space-y-4">
      <p className="text-sm font-bold opacity-70">Toca las palabras que correspondan. Cada error resta.</p>
      <p className="card-dark p-4 text-xl leading-[2.6rem]">
        {toks.map((t, i) => (
          <span key={i}>
            {isWord(t.t) ? (
              <button type="button" className="tok" aria-pressed={sel.includes(i)} disabled={disabled} onClick={() => toggle(i)}>{t.t}</button>
            ) : (
              <span>{t.t}</span>
            )}{' '}
          </span>
        ))}
      </p>
      <button className="btn btn-big w-full" disabled={disabled || !sel.length} onClick={() => onSubmit(sel)}>Enviar <Bolt /></button>
    </div>
  )
}

export function TapCorrect({ q }: { q: P }) {
  const { toks } = tapTokens(q.data.text)
  return (
    <p className="card-dark p-4 text-xl leading-[2.6rem]">
      {toks.map((t, i) => (
        <span key={i}>
          <span className={t.ok ? 'rounded-lg border-[3px] border-edge bg-lime px-1.5 font-display text-edge' : 'opacity-70'}>{t.t}</span>{' '}
        </span>
      ))}
    </p>
  )
}
