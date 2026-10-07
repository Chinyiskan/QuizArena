import { useState } from 'react'
import type { Question } from '../../../shared/questions.ts'
import { COLORS, SHAPES } from './choice.tsx'
import { Chip, DndArea, Zone } from './dnd.tsx'
import { play } from '../sound.ts'
import { Bolt, Check, X } from '../icons.tsx'

type S = Extract<Question, { type: 'sort' }>
const tint = (i: number) => ({ ['--c' as string]: `var(--color-${COLORS[i % 6]})` }) as React.CSSProperties

export function SortEditor({ q, set }: { q: S; set: (q: S) => void }) {
  const { cats } = q.data
  const put = (c: S['data']['cats']) => set({ ...q, data: { cats: c } })
  const edit = (ci: number, f: (c: S['data']['cats'][number]) => S['data']['cats'][number]) => put(cats.map((c, i) => (i === ci ? f(c) : c)))
  return (
    <div className="space-y-4">
      <p className="text-sm font-bold opacity-60">Define las categorías y los elementos de cada una; el estudiante los verá mezclados</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {cats.map((c, ci) => (
          <div key={ci} className="space-y-2 rounded-2xl border-[3px] border-edge p-3" style={{ background: `color-mix(in srgb, var(--color-${COLORS[ci % 6]}) 35%, white)` }}>
            <div className="flex items-center gap-2">
              <span className="font-display text-xl">{SHAPES[ci % 6]}</span>
              <input className="input !py-1.5" value={c.name} maxLength={200} placeholder={`Categoría ${ci + 1}`} aria-label={`Categoría ${ci + 1}`} onChange={(e) => edit(ci, (x) => ({ ...x, name: e.target.value }))} />
              {cats.length > 2 && <button type="button" className="min-h-8 min-w-8 px-1 text-xl font-black opacity-70 hover:opacity-100" onClick={() => put(cats.filter((_, i) => i !== ci))} aria-label="Quitar categoría"><X /></button>}
            </div>
            {c.items.map((it, ii) => (
              <div key={ii} className="flex items-center gap-2">
                <input className="input !py-1 !text-base" value={it} maxLength={200} placeholder="Elemento" aria-label="Elemento" onChange={(e) => edit(ci, (x) => ({ ...x, items: x.items.map((y, j) => (j === ii ? e.target.value : y)) }))} />
                {c.items.length > 1 && <button type="button" className="min-h-8 min-w-8 px-1 font-black opacity-70 hover:opacity-100" onClick={() => edit(ci, (x) => ({ ...x, items: x.items.filter((_, j) => j !== ii) }))} aria-label="Quitar elemento"><X /></button>}
              </div>
            ))}
            <button type="button" className="text-sm font-bold underline" onClick={() => edit(ci, (x) => ({ ...x, items: [...x.items, ''] }))}>+ elemento</button>
          </div>
        ))}
      </div>
      {cats.length < 4 && <button type="button" className="btn btn-ghost !text-edge !border-edge/30" onClick={() => put([...cats, { name: '', items: [''] }])}>+ Agregar categoría</button>}
    </div>
  )
}

/** `placed[i]` = categoría de la ficha i del pool (null = en el banco). */
export function SortPlayer({ q, onSubmit, disabled }: { q: S; onSubmit: (v: Record<string, number>) => void; disabled?: boolean }) {
  const pool = q.data.pool ?? []
  const [placed, setPlaced] = useState<(number | null)[]>(() => pool.map(() => null))
  const [sel, setSel] = useState<number | null>(null)
  const put = (i: number, c: number | null) => (play('drop'), setPlaced((p) => p.map((x, j) => (j === i ? c : x))), setSel(null))
  const onDrop = (item: string, zone: string) => put(+item.slice(1), zone === 'bank' ? null : +zone.slice(1))
  const chip = (i: number) => <Chip key={i} id={`i${i}`} selected={sel === i} onClick={() => setSel(sel === i ? null : i)}>{pool[i]}</Chip>

  return (
    <div className="space-y-4">
      <p className="text-sm font-bold opacity-70">Arrastra cada ficha a su categoría (o tócala y luego toca la categoría)</p>
      <DndArea onDrop={onDrop} overlay={(id) => pool[+id.slice(1)]}>
        <Zone id="bank" className="flex min-h-16 flex-wrap items-center gap-2 p-3" onClick={() => sel !== null && put(sel, null)}>
          {placed.includes(null) ? pool.map((_, i) => placed[i] === null && chip(i)) : <span className="inline-flex items-center gap-1 opacity-50"><Check /> Todas colocadas</span>}
        </Zone>
        <div className="grid gap-3 sm:grid-cols-2">
          {q.data.cats.map((c, ci) => (
            <Zone key={ci} id={`c${ci}`} className="min-h-28 space-y-2 p-3" onClick={() => sel !== null && put(sel, ci)}>
              <div className="flex items-center gap-2 font-display text-lg" style={{ color: `var(--color-${COLORS[ci % 6]})` }}>
                <span>{SHAPES[ci % 6]}</span>
                <span className="text-paper">{c.name}</span>
              </div>
              <div className="flex flex-wrap gap-2">{pool.map((_, i) => placed[i] === ci && chip(i))}</div>
            </Zone>
          ))}
        </div>
      </DndArea>
      <button className="btn btn-big w-full" disabled={disabled || placed.includes(null)} onClick={() => onSubmit(Object.fromEntries(pool.map((it, i) => [it, placed[i]!])))}>Enviar <Bolt /></button>
    </div>
  )
}

export function SortCorrect({ q }: { q: S }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {q.data.cats.map((c, ci) => (
        <div key={ci} className="opt !block !min-h-0" style={tint(ci)} data-state="right">
          <div className="mb-2 flex items-center gap-2"><span className="shape">{SHAPES[ci % 6]}</span>{c.name}</div>
          <div className="flex flex-wrap gap-2">{c.items.map((it, i) => <span key={i} className="chip !cursor-default !text-base">{it}</span>)}</div>
        </div>
      ))}
    </div>
  )
}
