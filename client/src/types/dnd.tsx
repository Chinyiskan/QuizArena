import { useState, type ReactNode } from 'react'
import { play } from '../sound.ts'
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'

// Mecánica compartida por "Arrastra y suelta" y "Categorizar": fichas que van a zonas.
// Se puede ARRASTRAR (ratón, dedo con pulsación corta, teclado) o TOCAR ficha y luego tocar la zona.

export function DndArea({ onDrop, overlay, children }: { onDrop: (item: string, zone: string) => void; overlay: (id: string) => ReactNode; children: ReactNode }) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }), // pulsación corta: así el scroll con el dedo sigue funcionando
    useSensor(KeyboardSensor),
  )
  const [active, setActive] = useState<string | null>(null)
  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => (setActive(String(e.active.id)), play('pick'))}
      onDragCancel={() => setActive(null)}
      onDragEnd={(e) => (setActive(null), e.over && onDrop(String(e.active.id), String(e.over.id)))} // el sonido de soltar lo da `put` de cada tipo (también al tocar)
    >
      {children}
      <DragOverlay>{active ? <span className="chip rotate-2 !cursor-grabbing">{overlay(active)}</span> : null}</DragOverlay>
    </DndContext>
  )
}

export function Chip({ id, selected, onClick, children }: { id: string; selected?: boolean; onClick?: () => void; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      aria-pressed={!!selected}
      onClick={(e) => (e.stopPropagation(), play('pick'), onClick?.())}
      className="chip"
      style={{ opacity: isDragging ? 0.3 : 1 }}
    >
      {children}
    </button>
  )
}

export function Zone({ id, className = '', onClick, children }: { id: string; className?: string; onClick?: () => void; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} onClick={onClick} className={`zone ${isOver ? 'zone-over' : ''} ${className}`}>
      {children}
    </div>
  )
}
