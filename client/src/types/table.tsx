import { useState } from 'react'
import { blanksOf, parseBlanks, type Question } from '../../../shared/questions.ts'
import { Bolt, Plus, X } from '../icons.tsx'

type T = Extract<Question, { type: 'table' }>

export function TableEditor({ q, set }: { q: T; set: (q: T) => void }) {
  const { rows, header } = q.data
  const cols = rows[0].length
  const put = (r: string[][], h = header) => set({ ...q, data: { rows: r, header: h } })
  const cell = (r: number, c: number, v: string) => put(rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)))
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold opacity-60">Escribe cada celda. Lo que el estudiante debe completar va entre [corchetes]: [París|paris]. Las celdas sin corchetes se muestran fijas.</p>
      <div className="overflow-x-auto pb-1">
        <table className="w-full border-separate border-spacing-1">
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((c, ci) => (
                  <td key={ci}>
                    <input className={`input min-w-28 !py-1.5 !text-base ${header && r === 0 ? '!bg-sun/60' : ''}`} value={c} maxLength={120} aria-label={`Fila ${r + 1}, columna ${ci + 1}`} onChange={(e) => cell(r, ci, e.target.value)} />
                  </td>
                ))}
                <td className="w-8">{rows.length > 2 && <button type="button" className="min-h-8 min-w-8 px-1 opacity-70 hover:opacity-100" aria-label={`Quitar fila ${r + 1}`} onClick={() => put(rows.filter((_, i) => i !== r))}><X /></button>}</td>
              </tr>
            ))}
            {cols > 2 && (
              <tr>
                {rows[0].map((_, ci) => (
                  <td key={ci} className="text-center">
                    <button type="button" className="inline-flex items-center gap-1 text-xs font-bold opacity-70 hover:opacity-100" aria-label={`Quitar columna ${ci + 1}`} onClick={() => put(rows.map((row) => row.filter((_, j) => j !== ci)))}><X /> columna</button>
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {rows.length < 6 && <button type="button" className="btn btn-ghost !text-edge !border-edge/30" onClick={() => put([...rows, Array(cols).fill('')])}><Plus /> Fila</button>}
        {cols < 5 && <button type="button" className="btn btn-ghost !text-edge !border-edge/30" onClick={() => put(rows.map((row) => [...row, '']))}><Plus /> Columna</button>}
        <label className="ml-auto flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={header} onChange={(e) => put(rows, e.target.checked)} /> La primera fila es encabezado
        </label>
      </div>
    </div>
  )
}

export function TablePlayer({ q, onSubmit, disabled }: { q: T; onSubmit: (v: string[]) => void; disabled?: boolean }) {
  const { rows, header } = q.data
  const [vals, setVals] = useState<string[]>(() => blanksOf(rows.flat().join(' ')).map(() => ''))
  const put = (k: number, v: string) => setVals((p) => p.map((x, j) => (j === k ? v : x)))
  let k = -1
  const cell = (src: string) =>
    parseBlanks(src).map((s, i) => {
      if ('t' in s) return <span key={i}>{s.t}</span>
      const n = ++k
      return <input key={i} className="input !inline-block !w-full !min-w-24 !px-2 !py-1 !text-base !shadow-none" size={8} disabled={disabled} value={vals[n]} aria-label={`Hueco ${n + 1}`} autoComplete="off" autoCapitalize="none" spellCheck={false} onChange={(e) => put(n, e.target.value)} />
    })
  return (
    <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), !disabled && vals.every((v) => v.trim()) && onSubmit(vals))}>
      <div className="overflow-x-auto rounded-2xl border-[3px] border-white/15">
        <table className="w-full border-collapse text-lg">
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((c, ci) => {
                  const head = header && r === 0
                  return head ? (
                    <th key={ci} className="border-2 border-edge bg-sun px-3 py-2 text-left font-display text-edge">{cell(c)}</th>
                  ) : (
                    <td key={ci} className="border-2 border-white/15 bg-ink2 px-3 py-2">{cell(c)}</td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-big w-full" disabled={disabled || vals.some((v) => !v.trim())}>Enviar <Bolt /></button>
    </form>
  )
}

export function TableCorrect({ q }: { q: T }) {
  const { rows, header } = q.data
  const cell = (src: string) =>
    parseBlanks(src).map((s, i) =>
      'options' in s ? <span key={i} className="inline-block rounded-lg border-[3px] border-edge bg-lime px-2 font-display text-edge">{s.options.join(' / ')}</span> : <span key={i}>{s.t}</span>,
    )
  return (
    <div className="overflow-x-auto rounded-2xl border-[3px] border-white/15">
      <table className="w-full border-collapse text-lg">
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((c, ci) => (header && r === 0 ? <th key={ci} className="border-2 border-edge bg-sun px-3 py-2 text-left font-display text-edge">{cell(c)}</th> : <td key={ci} className="border-2 border-white/15 bg-ink2 px-3 py-2">{cell(c)}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
