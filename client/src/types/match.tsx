import { useState } from 'react'
import type { Question } from '../../../shared/questions.ts'
import { COLORS, SHAPES } from './choice.tsx'
import { Bolt, Both, X } from '../icons.tsx'

type M = Extract<Question, { type: 'match' }>
const tint = (i: number) => ({ ['--c' as string]: `var(--color-${COLORS[i % 6]})` }) as React.CSSProperties

export function MatchEditor({ q, set }: { q: M; set: (q: M) => void }) {
  const { pairs } = q.data
  const put = (p: M['data']['pairs']) => set({ ...q, data: { pairs: p } })
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold opacity-60">Cada fila es una pareja; el estudiante verá la columna derecha barajada</p>
      {pairs.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className="input" value={p.left} maxLength={200} placeholder="Izquierda" aria-label="Izquierda" onChange={(e) => put(pairs.map((x, j) => (j === i ? { ...x, left: e.target.value } : x)))} />
          <Both className="shrink-0" />
          <input className="input" value={p.right} maxLength={200} placeholder="Derecha" aria-label="Derecha" onChange={(e) => put(pairs.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)))} />
          {pairs.length > 2 && <button type="button" className="min-h-8 min-w-8 px-1 text-xl font-black opacity-70 hover:opacity-100" onClick={() => put(pairs.filter((_, j) => j !== i))} aria-label="Quitar pareja"><X /></button>}
        </div>
      ))}
      {pairs.length < 6 && <button type="button" className="btn btn-ghost !text-edge !border-edge/30" onClick={() => put([...pairs, { left: '', right: '' }])}>+ Agregar pareja</button>}
    </div>
  )
}

/** Tocar para emparejar: toca una de la izquierda y luego su pareja a la derecha. Cada pareja lleva color + forma. */
export function MatchPlayer({ q, onSubmit, disabled }: { q: M; onSubmit: (v: string[]) => void; disabled?: boolean }) {
  const lefts = q.data.pairs.map((p) => p.left)
  const pool = q.data.pool ?? []
  const [link, setLink] = useState<(number | null)[]>(() => lefts.map(() => null)) // izquierda i -> índice del pool
  const [sel, setSel] = useState<number | null>(null)
  const owner = (j: number) => link.indexOf(j) // izquierda que usa la derecha j (o -1)

  const tapLeft = (i: number) => {
    if (link[i] !== null) setLink((l) => l.map((x, k) => (k === i ? null : x))) // deshacer
    setSel(sel === i && link[i] === null ? null : i)
  }
  const tapRight = (j: number) => {
    if (sel === null) return owner(j) >= 0 ? setLink((l) => l.map((x) => (x === j ? null : x))) : undefined
    setLink((l) => l.map((x, k) => (k === sel ? j : x === j ? null : x)))
    setSel(null)
  }

  const badge = (i: number) => <span className="shape !h-8 !w-8 !text-base">{SHAPES[i % 6]}</span>
  return (
    <div className="space-y-4">
      <p className="text-sm font-bold opacity-70">Toca uno de la izquierda y luego su pareja de la derecha</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-3">
          {lefts.map((l, i) => (
            <button key={i} className="opt !min-h-16 !py-2 !text-lg" style={tint(i)} aria-pressed={sel === i} onClick={() => tapLeft(i)} disabled={disabled}>
              {badge(i)}
              <span className="min-w-0 flex-1 break-words">{l}</span>
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {pool.map((r, j) => {
            const o = owner(j)
            return (
              <button key={j} className="opt !min-h-16 !py-2 !text-lg" style={o >= 0 ? tint(o) : { ['--c' as string]: 'white' }} onClick={() => tapRight(j)} disabled={disabled}>
                {o >= 0 && badge(o)}
                <span className="min-w-0 flex-1 break-words">{r}</span>
              </button>
            )
          })}
        </div>
      </div>
      <button className="btn btn-big w-full" disabled={disabled || link.includes(null)} onClick={() => onSubmit(link.map((j) => pool[j!]))}>Enviar <Bolt /></button>
    </div>
  )
}

export function MatchCorrect({ q }: { q: M }) {
  return (
    <div className="space-y-2">
      {q.data.pairs.map((p, i) => (
        <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="opt !min-h-14 !py-1.5 !text-lg" style={tint(i)} data-state="right"><span className="shape !h-8 !w-8 !text-base">{SHAPES[i % 6]}</span>{p.left}</div>
          <Both className="text-xl" />
          <div className="opt !min-h-14 !py-1.5 !text-lg" style={tint(i)} data-state="right"><span className="shape !h-8 !w-8 !text-base">{SHAPES[i % 6]}</span>{p.right}</div>
        </div>
      ))}
    </div>
  )
}
