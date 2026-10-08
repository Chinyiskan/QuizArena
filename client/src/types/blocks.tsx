import { useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CODE_LANGS, type CodeLang, type Question } from '../../../shared/questions.ts'
import { Bolt, Grip, IndentLess, IndentMore, Plus, X } from '../icons.tsx'
import { play } from '../sound.ts'

type B = Extract<Question, { type: 'blocks' }>
type Line = { t: string; i: number }

/** Color por tipo de bloque, deducido del texto (como las categorías de Scratch): control, acción o datos. */
const CONTROL = /^(if|elif|else|for|while|do|switch|case|def|function|class|try|catch|except|finally|with|end|fi|done|begin)\b|^[}\])]/
const ACTION = /^(return|print|console|echo|printf|puts|System|break|continue|raise|throw|yield)\b/
const hue = (t: string) => {
  const s = t.trim()
  return CONTROL.test(s) ? 'var(--color-sun)' : ACTION.test(s) ? 'var(--color-pink)' : 'var(--color-cyan)'
}
const INDENT = 1 // rem por nivel de sangría

/** Editor: el profe pega el código que funciona; cada línea es un bloque y la sangría sale de los espacios iniciales. */
export function parseCode(text: string): Line[] {
  const rows = text.split('\n').map((r) => r.replace(/\s+$/, '')).filter((r) => r.trim())
  const lead = (r: string) => r.match(/^[ \t]*/)![0].replace(/\t/g, '    ').length
  const unit = Math.min(...rows.map(lead).filter(Boolean), 4) || 4
  return rows.map((r) => ({ t: r.trim(), i: Math.min(3, Math.round(lead(r) / unit)) }))
}
const unparse = (ls: Line[]) => ls.map((l) => '    '.repeat(l.i) + l.t).join('\n')

export function BlocksEditor({ q, set }: { q: B; set: (q: B) => void }) {
  const d = q.data
  const [text, setText] = useState(unparse(d.lines))
  const put = (p: Partial<B['data']>) => set({ ...q, data: { ...d, ...p } })
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold opacity-60">Pega el código que funciona. Cada línea será un bloque; el estudiante los verá barajados y deberá ordenarlos.</p>
      <div className="flex flex-wrap items-center gap-3">
        <select className="input !w-auto !py-1 !text-base" aria-label="Lenguaje" value={d.lang} onChange={(e) => put({ lang: e.target.value })}>
          {Object.entries(CODE_LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="flex items-center gap-2 font-bold">
          <input type="checkbox" checked={d.indent} onChange={(e) => put({ indent: e.target.checked })} /> Calificar también la sangría
        </label>
      </div>
      <textarea
        className="input min-h-40 font-mono !text-base" spellCheck={false} aria-label="Código en el orden correcto" placeholder={'def suma(a, b):\n    total = a + b\n    return total'}
        value={text} onChange={(e) => { setText(e.target.value); put({ lines: parseCode(e.target.value) }) }}
      />
      <p className="text-sm font-bold opacity-60">{d.lines.length} bloques (máx. 15, sangría hasta 3 niveles)</p>
      <div className="space-y-2">
        <p className="text-sm font-bold opacity-60">Bloques que sobran (opcional, para confundir)</p>
        {d.extra.map((x, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className="input font-mono" value={x} maxLength={120} aria-label={`Bloque de sobra ${i + 1}`} onChange={(e) => put({ extra: d.extra.map((y, j) => (j === i ? e.target.value : y)) })} />
            <button type="button" className="min-h-8 min-w-8 px-1 text-xl font-black opacity-70 hover:opacity-100" onClick={() => put({ extra: d.extra.filter((_, j) => j !== i) })} aria-label="Quitar"><X /></button>
          </div>
        ))}
        {d.extra.length < 4 && <button type="button" className="btn btn-ghost !text-edge !border-edge/30" onClick={() => put({ extra: [...d.extra, ''] })}><Plus /> Bloque de sobra</button>}
      </div>
    </div>
  )
}

function Block({ t, i = 0, state }: { t: string; i?: number; state?: 'right' }) {
  return (
    <span className="blk" data-state={state} style={{ ['--c' as string]: hue(t), marginLeft: `${i * INDENT}rem` }}>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{t}</span>
    </span>
  )
}

type Item = { k: number; t: string; i: number }

function Row({ it, indent, onIndent, onBack }: { it: Item; indent: boolean; onIndent: (d: number) => void; onBack: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: it.k })
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }} className={`flex items-center gap-0.5 ${isDragging ? 'opacity-80' : ''}`}>
      <span ref={setActivatorNodeRef} {...attributes} {...listeners} className="cursor-grab select-none text-2xl" style={{ touchAction: 'none' }} aria-label="Arrastrar para reordenar"><Grip /></span>
      <div className="min-w-0 flex-1"><Block t={it.t} i={indent ? it.i : 0} /></div>
      {indent && (
        <>
          <button type="button" className="min-h-9 min-w-8 text-xl disabled:opacity-25" disabled={it.i === 0} onClick={() => onIndent(-1)} aria-label="Menos sangría"><IndentLess /></button>
          <button type="button" className="min-h-9 min-w-8 text-xl disabled:opacity-25" disabled={it.i === 3} onClick={() => onIndent(1)} aria-label="Más sangría"><IndentMore /></button>
        </>
      )}
      <button type="button" className="min-h-9 min-w-8 text-xl opacity-70 hover:opacity-100" onClick={onBack} aria-label="Devolver al banco"><X /></button>
    </li>
  )
}

export function BlocksPlayer({ q, onSubmit, disabled }: { q: B; onSubmit: (v: Line[]) => void; disabled?: boolean }) {
  const bank = q.data.bank ?? []
  const [prog, setProg] = useState<Item[]>([])
  const used = new Set(prog.map((p) => p.k))
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const onEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setProg((a) => arrayMove(a, a.findIndex((x) => x.k === active.id), a.findIndex((x) => x.k === over.id)))
  }
  return (
    <div className="space-y-4">
      <p className="text-sm font-bold opacity-70">Toca los bloques para armar el código{q.data.indent ? ' y ajusta la sangría' : ''}</p>
      <div className="flex flex-wrap gap-3 pb-2" aria-label="Bloques disponibles">
        {bank.map((t, k) => !used.has(k) && (
          <button key={k} type="button" className="max-w-full text-left" onClick={() => (play('pick'), setProg((a) => [...a, { k, t, i: 0 }]))}><Block t={t} /></button>
        ))}
        {used.size === bank.length && <span className="text-sm font-bold opacity-50">No quedan bloques</span>}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
        <SortableContext items={prog.map((p) => p.k)} strategy={verticalListSortingStrategy}>
          <ol className="zone min-h-24 space-y-3 !items-stretch p-3 pb-4" aria-label="Tu programa">
            {!prog.length && <li className="py-6 text-center text-sm font-bold opacity-50">Tu programa va aquí</li>}
            {prog.map((it) => (
              <Row key={it.k} it={it} indent={q.data.indent}
                onIndent={(d) => setProg((a) => a.map((x) => (x.k === it.k ? { ...x, i: Math.max(0, Math.min(3, x.i + d)) } : x)))}
                onBack={() => setProg((a) => a.filter((x) => x.k !== it.k))} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <button className="btn btn-big w-full" disabled={disabled || !prog.length} onClick={() => onSubmit(prog.map((p) => ({ t: p.t, i: q.data.indent ? p.i : 0 })))}>Enviar <Bolt /></button>
    </div>
  )
}

export function BlocksCorrect({ q }: { q: B }) {
  return (
    <ol className="space-y-3" aria-label={`Solución en ${CODE_LANGS[q.data.lang as CodeLang] ?? ''}`}>
      {q.data.lines.map((l, k) => <li key={k}><Block t={l.t} i={q.data.indent ? l.i : 0} state="right" /></li>)}
    </ol>
  )
}
