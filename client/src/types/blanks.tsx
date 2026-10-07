import { useRef, useState } from 'react'
import { parseBlanks, type Question } from '../../../shared/questions.ts'
import { Bolt, Check } from '../icons.tsx'

// "Completa los espacios" y "Menú desplegable" comparten texto con [huecos]; cambia cómo responde el estudiante.
type B = Extract<Question, { type: 'fill' | 'dropdown' | 'drag' }>

const SENTENCE = 'card-dark p-4 text-xl leading-[3.2rem]'
const chip = 'mx-1 inline-block rounded-lg border-[3px] border-edge px-2 py-0.5 font-display text-edge'

export function BlanksEditor({ q, set }: { q: B; set: (q: any) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const fill = q.type !== 'dropdown' // fill y drag se escriben igual
  const { text } = q.data
  const patch = (t: string) => set({ ...q, data: { ...q.data, text: t } }) // conserva `extra` si es drag

  // convierte la selección en hueco (o inserta uno vacío) y deja la selección dentro de los corchetes
  const wrap = () => {
    const el = ref.current!
    const { selectionStart: a, selectionEnd: b } = el
    patch(`${text.slice(0, a)}[${text.slice(a, b)}]${text.slice(b)}`)
    requestAnimationFrame(() => (el.focus(), el.setSelectionRange(a + 1, b + 1)))
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-bold opacity-60">
        {q.type === 'drag'
          ? 'Encierra cada respuesta entre [corchetes]: irá al banco de palabras para arrastrarla al hueco.'
          : fill
          ? 'Escribe la frase y encierra cada respuesta entre [corchetes]. Varias válidas: [París|paris].'
          : 'Pon la opción correcta primero: [has|have|is]. Los estudiantes las verán barajadas.'}
      </p>
      <textarea
        ref={ref}
        className="input min-h-24 resize-y"
        maxLength={500}
        value={text}
        placeholder={fill ? 'La capital de [Francia] es [París]' : 'She [has|have|is] been to [Paris|Rome|Oslo]'} aria-label={fill ? 'La capital de [Francia] es [París]' : 'She [has|have|is] been to [Paris|Rome|Oslo]'}
        onChange={(e) => patch(e.target.value)}
      />
      <button type="button" className="btn btn-sun !py-1.5 !text-base" onClick={wrap}>
        [ ] Convertir selección en hueco
      </button>
      {text && (
        <div>
          <p className="mb-1 text-sm font-bold opacity-60">Así lo verá el estudiante / respuestas:</p>
          <p className="text-lg leading-[3rem]">
            {parseBlanks(text).map((s, i) =>
              'options' in s ? (
                <span key={i} className={`${chip} bg-lime`}>
                  {s.options.length ? (fill ? s.options.join(' / ') : s.options.map((o, j) => <span key={j}>{j > 0 && ' · '}{j === 0 ? <><Check className="inline" /> {o}</> : o}</span>)) : '___'}
                </span>
              ) : (
                <span key={i}>{s.t}</span>
              ),
            )}
          </p>
        </div>
      )}
    </div>
  )
}

export function BlanksPlayer({ q, onSubmit, disabled }: { q: B; onSubmit: (v: string[]) => void; disabled?: boolean }) {
  const segs = parseBlanks(q.data.text)
  const [vals, setVals] = useState<string[]>(() => segs.filter((s) => 'options' in s).map(() => ''))
  const put = (k: number, v: string) => setVals((p) => p.map((x, j) => (j === k ? v : x)))
  let k = -1
  return (
    <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), !disabled && vals.every((v) => v.trim()) && onSubmit(vals))}>
      <p className={SENTENCE}>
        {segs.map((s, i) => {
          if ('t' in s) return <span key={i}>{s.t}</span>
          const n = ++k
          const common = { disabled, value: vals[n], 'aria-label': `Hueco ${n + 1}`, className: 'input mx-1 !inline-block !w-auto !px-2 !py-1 !text-lg !shadow-none' }
          return q.type === 'fill' ? (
            <input key={i} {...common} size={9} autoComplete="off" autoCapitalize="none" spellCheck={false} onChange={(e) => put(n, e.target.value)} />
          ) : (
            <select key={i} {...common} onChange={(e) => put(n, e.target.value)}>
              <option value="">…</option>
              {s.options.map((o) => <option key={o}>{o}</option>)}
            </select>
          )
        })}
      </p>
      <button className="btn btn-big w-full" disabled={disabled || vals.some((v) => !v.trim())}>
        Enviar <Bolt />
      </button>
    </form>
  )
}

export function BlanksCorrect({ q }: { q: B }) {
  return (
    <p className={SENTENCE}>
      {parseBlanks(q.data.text).map((s, i) =>
        'options' in s ? (
          <span key={i} className={`${chip} bg-lime`}>{q.type !== 'dropdown' ? s.options.join(' / ') : s.options[0]}</span>
        ) : (
          <span key={i}>{s.t}</span>
        ),
      )}
    </p>
  )
}
