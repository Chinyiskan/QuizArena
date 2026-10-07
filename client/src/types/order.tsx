import { useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Question } from '../../../shared/questions.ts'
import { COLORS } from './choice.tsx'
import { Bolt, Down, Grip, Up, X } from '../icons.tsx'

type O = Extract<Question, { type: 'order' }>

export function OrderEditor({ q, set }: { q: O; set: (q: O) => void }) {
  const { items } = q.data
  const put = (a: string[]) => set({ ...q, data: { items: a } })
  const move = (i: number, d: number) => {
    const a = [...items]
    ;[a[i], a[i + d]] = [a[i + d], a[i]]
    put(a)
  }
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold opacity-60">Escríbelos en el orden CORRECTO; el estudiante los verá barajados</p>
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-[3px] border-edge bg-sun font-display">{i + 1}</span>
          <input className="input" value={it} maxLength={200} placeholder={`Elemento ${i + 1}`} aria-label={`Elemento ${i + 1}`} onChange={(e) => put(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" className="min-h-8 min-w-8 px-1 text-xl font-black opacity-60 hover:opacity-100 disabled:opacity-20" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir"><Up /></button>
          <button type="button" className="min-h-8 min-w-8 px-1 text-xl font-black opacity-60 hover:opacity-100 disabled:opacity-20" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Bajar"><Down /></button>
          {items.length > 2 && <button type="button" className="min-h-8 min-w-8 px-1 text-xl font-black opacity-70 hover:opacity-100" onClick={() => put(items.filter((_, j) => j !== i))} aria-label="Quitar"><X /></button>}
        </div>
      ))}
      {items.length < 8 && <button type="button" className="btn btn-ghost !text-edge !border-edge/30" onClick={() => put([...items, ''])}>+ Agregar elemento</button>}
    </div>
  )
}

function Row({ id, pos, onMove, last }: { id: string; pos: number; onMove: (d: number) => void; last: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined, ['--c' as string]: `var(--color-${COLORS[pos % 6]})` }}
      className={`opt !min-h-16 !gap-3 !py-2 ${isDragging ? 'opacity-80' : ''}`}
    >
      <span className="shape !rounded-full font-display">{pos + 1}</span>
      <span className="min-w-0 flex-1">{id}</span>
      <span className="flex items-center gap-1">
        <button type="button" className="min-h-8 min-w-8 px-1.5 text-xl disabled:opacity-25" disabled={pos === 0} onClick={() => onMove(-1)} aria-label="Subir"><Up /></button>
        <button type="button" className="min-h-8 min-w-8 px-1.5 text-xl disabled:opacity-25" disabled={last} onClick={() => onMove(1)} aria-label="Bajar"><Down /></button>
        <span ref={setActivatorNodeRef} {...attributes} {...listeners} className="cursor-grab select-none px-2 text-2xl" style={{ touchAction: 'none' }} aria-label="Arrastrar para reordenar"><Grip /></span>
      </span>
    </li>
  )
}

export function OrderPlayer({ q, onSubmit, disabled }: { q: O; onSubmit: (v: string[]) => void; disabled?: boolean }) {
  const [items, setItems] = useState(q.data.items)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const move = (from: number, to: number) => setItems((a) => arrayMove(a, from, to))
  const onEnd = ({ active, over }: DragEndEvent) => over && active.id !== over.id && move(items.indexOf(String(active.id)), items.indexOf(String(over.id)))
  return (
    <div className="space-y-4">
      <p className="text-sm font-bold opacity-70">Arrastra el asa o usa las flechas para ordenar</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <ol className="space-y-3">
            {items.map((it, i) => <Row key={it} id={it} pos={i} last={i === items.length - 1} onMove={(d) => move(i, i + d)} />)}
          </ol>
        </SortableContext>
      </DndContext>
      <button className="btn btn-big w-full" disabled={disabled} onClick={() => onSubmit(items)}>Enviar <Bolt /></button>
    </div>
  )
}

export function OrderCorrect({ q }: { q: O }) {
  return (
    <ol className="space-y-2">
      {q.data.items.map((it, i) => (
        <li key={i} className="opt !min-h-14" style={{ ['--c' as string]: `var(--color-${COLORS[i % 6]})` }} data-state="right">
          <span className="shape !rounded-full font-display">{i + 1}</span>
          {it}
        </li>
      ))}
    </ol>
  )
}
