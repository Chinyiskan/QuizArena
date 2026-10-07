import { useState } from 'react'
import type { Question } from '../../../shared/questions.ts'
import { Bolt, X } from '../icons.tsx'

type O = Extract<Question, { type: 'open' }>

export function OpenEditor({ q, set }: { q: O; set: (q: O) => void }) {
  const { answers } = q.data
  const put = (a: string[]) => set({ ...q, data: { answers: a } })
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold opacity-60">Respuestas aceptadas (no importan mayúsculas ni tildes)</p>
      {answers.map((a, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className="input" value={a} maxLength={200} placeholder={i ? 'Otra forma válida' : 'Respuesta correcta'} aria-label={i ? 'Otra forma válida' : 'Respuesta correcta'} onChange={(e) => put(answers.map((x, j) => (j === i ? e.target.value : x)))} />
          {answers.length > 1 && (
            <button type="button" aria-label="Quitar respuesta" className="min-h-8 min-w-8 px-2 text-xl font-black opacity-70 hover:opacity-100" onClick={() => put(answers.filter((_, j) => j !== i))}><X /></button>
          )}
        </div>
      ))}
      {answers.length < 10 && (
        <button type="button" className="btn btn-ghost !text-edge !border-edge/30" onClick={() => put([...answers, ''])}>+ Otra respuesta válida</button>
      )}
    </div>
  )
}

export function OpenPlayer({ onSubmit, disabled }: { q: O; onSubmit: (v: string) => void; disabled?: boolean }) {
  const [v, setV] = useState('')
  return (
    <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), !disabled && v.trim() && onSubmit(v))}>
      <input className="input !text-2xl" value={v} disabled={disabled} maxLength={200} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="Escribe tu respuesta…" aria-label="Tu respuesta" onChange={(e) => setV(e.target.value)} />
      <button className="btn btn-big w-full" disabled={disabled || !v.trim()}>Enviar <Bolt /></button>
    </form>
  )
}

export function OpenCorrect({ q }: { q: O }) {
  return (
    <div className="card-dark flex flex-wrap items-center gap-2 p-4">
      <span className="font-bold opacity-70">Respuesta:</span>
      {q.data.answers.map((a) => (
        <span key={a} className="rounded-lg border-[3px] border-edge bg-lime px-3 py-1 font-display text-lg text-edge">{a}</span>
      ))}
    </div>
  )
}
