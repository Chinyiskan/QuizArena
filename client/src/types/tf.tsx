import type { Question } from '../../../shared/questions.ts'
import { optStyle } from './choice.tsx'
import { Check, X } from '../icons.tsx'

type TF = Extract<Question, { type: 'tf' }>
const SIDES = [
  { v: true, label: 'Verdadero', shape: <Check />, color: 1 },
  { v: false, label: 'Falso', shape: <X />, color: 0 },
]

export function TfEditor({ q, set }: { q: TF; set: (q: TF) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold opacity-60">¿Cuál es la respuesta correcta?</p>
      <div className="grid grid-cols-2 gap-3">
        {SIDES.map((s) => (
          <button key={s.label} type="button" className="opt" style={optStyle(s.color)} aria-pressed={q.data.correct === s.v} onClick={() => set({ ...q, data: { correct: s.v } })}>
            <span className="shape">{s.shape}</span>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function TfPlayer({ onSubmit, disabled }: { q: TF; onSubmit: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {SIDES.map((s) => (
        <button key={s.label} className="opt !min-h-32 flex-col justify-center text-center !text-xl sm:!text-2xl" style={optStyle(s.color)} disabled={disabled} onClick={() => onSubmit(s.v)}>
          <span className="shape">{s.shape}</span>
          {s.label}
        </button>
      ))}
    </div>
  )
}

export function TfCorrect({ q }: { q: TF }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {SIDES.map((s) => (
        <div key={s.label} className="opt flex-col justify-center text-center !text-xl sm:!text-2xl" style={optStyle(s.color)} data-state={q.data.correct === s.v ? 'right' : 'wrong'}>
          <span className="shape">{s.shape}</span>
          {s.label}
        </div>
      ))}
    </div>
  )
}
