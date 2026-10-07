import { useState } from 'react'
import type { Question } from '../../../shared/questions.ts'
import { Bolt, Check, SHAPES, X } from '../icons.tsx'

// mcq y multi comparten UI: solo cambia si se elige una o varias.
type Choice = Extract<Question, { type: 'mcq' | 'multi' }>

export const COLORS = ['pink', 'cyan', 'sun', 'lime', 'violet', 'fire']
export { SHAPES }
export const optStyle = (i: number) => ({ '--c': `var(--color-${COLORS[i % 6]})` }) as React.CSSProperties

const isRight = (q: Choice, i: number) => (q.type === 'mcq' ? q.data.correct === i : q.data.correct.includes(i))

export function ChoiceEditor({ q, set }: { q: Choice; set: (q: Choice) => void }) {
  const { options } = q.data
  const patch = (options: string[], correct: number | number[]) => set({ ...q, data: { options, correct } } as Choice)
  const correctList = q.type === 'mcq' ? [q.data.correct] : q.data.correct

  const toggle = (i: number) =>
    q.type === 'mcq' ? patch(options, i) : patch(options, correctList.includes(i) ? correctList.filter((c) => c !== i) : [...correctList, i])

  const remove = (i: number) => {
    const fix = (c: number) => (c > i ? c - 1 : c)
    const kept = correctList.filter((c) => c !== i).map(fix)
    patch(options.filter((_, j) => j !== i), q.type === 'mcq' ? (q.data.correct === i ? -1 : fix(q.data.correct)) : kept)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-bold opacity-60">{q.type === 'mcq' ? 'Marca la respuesta correcta' : 'Marca todas las correctas'}</p>
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggle(i)}
            aria-pressed={correctList.includes(i)}
            aria-label={`Opción ${i + 1} correcta`}
            className={`grid h-11 w-11 shrink-0 place-items-center border-[3px] border-edge text-lg font-black ${q.type === 'mcq' ? 'rounded-full' : 'rounded-lg'} ${correctList.includes(i) ? 'bg-lime' : 'bg-white'}`}
          >
            {correctList.includes(i) && <Check />}
          </button>
          <input
            className="input"
            value={o}
            maxLength={200}
            placeholder={`Opción ${i + 1}`} aria-label={`Opción ${i + 1}`}
            onChange={(e) => patch(options.map((x, j) => (j === i ? e.target.value : x)), q.data.correct)}
          />
          {options.length > 2 && (
            <button type="button" onClick={() => remove(i)} aria-label="Quitar opción" className="min-h-8 min-w-8 px-2 text-xl font-black opacity-70 hover:opacity-100">
              <X />
            </button>
          )}
        </div>
      ))}
      {options.length < 6 && (
        <button type="button" className="btn btn-ghost !text-edge !border-edge/30" onClick={() => patch([...options, ''], q.data.correct)}>
          + Agregar opción
        </button>
      )}
    </div>
  )
}

/** `hidden`: opciones quitadas con el poder 50/50 (solo opción múltiple). */
export function ChoicePlayer({ q, onSubmit, disabled, hidden = [] }: { q: Choice; onSubmit: (v: number | number[]) => void; disabled?: boolean; hidden?: number[] }) {
  const [picked, setPicked] = useState<number[]>([])
  const multi = q.type === 'multi'
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {q.data.options.map((o, i) => (
          <button
            key={i}
            className="opt"
            style={optStyle(i)}
            disabled={disabled || hidden.includes(i)}
            data-state={hidden.includes(i) ? 'wrong' : undefined}
            aria-pressed={picked.includes(i)}
            onClick={() => (multi ? setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i])) : onSubmit(i))}
          >
            <span className="shape">{SHAPES[i]}</span>
            {o}
          </button>
        ))}
      </div>
      {multi && (
        <button className="btn btn-big w-full" disabled={disabled || !picked.length} onClick={() => onSubmit(picked)}>
          Enviar <Bolt />
        </button>
      )}
    </div>
  )
}

export function ChoiceCorrect({ q }: { q: Choice }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {q.data.options.map((o, i) => (
        <div key={i} className="opt" style={optStyle(i)} data-state={isRight(q, i) ? 'right' : 'wrong'}>
          <span className="shape">{isRight(q, i) ? <Check /> : SHAPES[i]}</span>
          {o}
        </div>
      ))}
    </div>
  )
}
