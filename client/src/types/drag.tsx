import { useState } from 'react'
import { parseBlanks, type Question } from '../../../shared/questions.ts'
import { BlanksEditor } from './blanks.tsx'
import { Chip, DndArea, Zone } from './dnd.tsx'
import { play } from '../sound.ts'
import { Bolt, Check } from '../icons.tsx'

type D = Extract<Question, { type: 'drag' }>

export function DragEditor({ q, set }: { q: D; set: (q: D) => void }) {
  return (
    <div className="space-y-3">
      <BlanksEditor q={q} set={set} />
      <label className="block space-y-1">
        <span className="text-sm font-bold opacity-60">Distractores: palabras de más en el banco (separadas por coma)</span>
        <input
          className="input"
          placeholder="planeta, luna" aria-label="planeta, luna"
          value={q.data.extra.join(', ')}
          onChange={(e) => set({ ...q, data: { ...q.data, extra: e.target.value.split(',').map((x) => x.trim()) } })}
        />
      </label>
    </div>
  )
}

/** Banco de palabras: cada ficha es un índice del banco; `placed[k]` = índice puesto en el hueco k. */
export function DragPlayer({ q, onSubmit, disabled }: { q: D; onSubmit: (v: string[]) => void; disabled?: boolean }) {
  const bank = q.data.bank ?? []
  const segs = parseBlanks(q.data.text)
  const [placed, setPlaced] = useState<(number | null)[]>(() => segs.filter((s) => 'options' in s).map(() => null))
  const [sel, setSel] = useState<number | null>(null)
  const inBank = bank.map((_, i) => i).filter((i) => !placed.includes(i))

  // mueve la ficha `i` al hueco `k` (o al banco si k === null); lo que hubiera en el hueco vuelve al banco
  const put = (i: number, k: number | null) => {
    play('drop')
    setPlaced((p) => p.map((x, j) => (j === k ? i : x === i ? null : x)))
    setSel(null)
  }
  const onDrop = (item: string, zone: string) => put(+item.slice(1), zone === 'bank' ? null : +zone.slice(1))

  let k = -1
  return (
    <div className="space-y-4">
      <DndArea onDrop={onDrop} overlay={(id) => bank[+id.slice(1)]}>
        <p className="card-dark p-4 text-xl leading-[3.6rem]">
          {segs.map((s, n) => {
            if ('t' in s) return <span key={n}>{s.t}</span>
            const b = ++k
            const i = placed[b]
            return (
              <Zone key={n} id={`b${b}`} className="mx-1 inline-flex min-h-12 min-w-24 items-center justify-center align-middle" onClick={() => (sel !== null ? put(sel, b) : i !== null && put(i, null))}>
                {i !== null ? <Chip id={`i${i}`} onClick={() => (sel !== null ? put(sel, b) : put(i, null))}>{bank[i]}</Chip> : <span className="px-2 opacity-40">…</span>}
              </Zone>
            )
          })}
        </p>
        <Zone id="bank" className="flex min-h-16 flex-wrap items-center gap-2 p-3" onClick={() => setSel(null)}>
          {inBank.length ? inBank.map((i) => <Chip key={i} id={`i${i}`} selected={sel === i} onClick={() => setSel(sel === i ? null : i)}>{bank[i]}</Chip>) : <span className="inline-flex items-center gap-1 opacity-50"><Check /> Todas colocadas</span>}
        </Zone>
      </DndArea>
      <button className="btn btn-big w-full" disabled={disabled || placed.includes(null)} onClick={() => onSubmit(placed.map((i) => bank[i!]))}>
        Enviar <Bolt />
      </button>
    </div>
  )
}
