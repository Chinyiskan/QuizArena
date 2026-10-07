import { useState } from 'react'
import type { Question } from '../../../shared/questions.ts'
import { Bolt, Check, Plus, SHAPES, X } from '../icons.tsx'
import { COLORS } from './choice.tsx'

type G = Extract<Question, { type: 'grid' }>
const tint = (i: number) => ({ ['--c' as string]: `var(--color-${COLORS[i % 6]})` }) as React.CSSProperties

export function GridEditor({ q, set }: { q: G; set: (q: G) => void }) {
  const { cols, rows } = q.data
  const put = (c: string[], r: G['data']['rows']) => set({ ...q, data: { cols: c, rows: r } })
  const dropCol = (ci: number) => put(cols.filter((_, j) => j !== ci), rows.map((r) => ({ ...r, correct: r.correct === ci ? -1 : r.correct > ci ? r.correct - 1 : r.correct })))
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold opacity-60">Los encabezados son las columnas; en cada fila marca cuál es la columna correcta.</p>
      <div className="overflow-x-auto pb-1">
        <table className="w-full border-separate border-spacing-1">
          <thead>
            <tr>
              <th />
              {cols.map((c, ci) => (
                <th key={ci} className="min-w-28">
                  <div className="flex items-center gap-1">
                    <input className="input !bg-sun/60 !py-1.5 !text-base" value={c} maxLength={200} placeholder={`Columna ${ci + 1}`} aria-label={`Columna ${ci + 1}`} onChange={(e) => put(cols.map((x, j) => (j === ci ? e.target.value : x)), rows)} />
                    {cols.length > 2 && <button type="button" className="min-h-8 min-w-8 px-1 opacity-70 hover:opacity-100" aria-label={`Quitar columna ${ci + 1}`} onClick={() => dropCol(ci)}><X /></button>}
                  </div>
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                <td>
                  <input className="input min-w-40 !py-1.5 !text-base" value={r.text} maxLength={200} placeholder={`Fila ${ri + 1}`} aria-label={`Fila ${ri + 1}`} onChange={(e) => put(cols, rows.map((x, j) => (j === ri ? { ...x, text: e.target.value } : x)))} />
                </td>
                {cols.map((_, ci) => (
                  <td key={ci} className="text-center">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={r.correct === ci}
                      aria-label={`Fila ${ri + 1}: columna ${ci + 1} es la correcta`}
                      className={`mx-auto grid h-10 w-10 place-items-center rounded-full border-[3px] border-edge ${r.correct === ci ? 'bg-lime' : 'bg-white'}`}
                      onClick={() => put(cols, rows.map((x, j) => (j === ri ? { ...x, correct: ci } : x)))}
                    >
                      {r.correct === ci && <Check />}
                    </button>
                  </td>
                ))}
                <td>{rows.length > 2 && <button type="button" className="min-h-8 min-w-8 px-1 opacity-70 hover:opacity-100" aria-label={`Quitar fila ${ri + 1}`} onClick={() => put(cols, rows.filter((_, j) => j !== ri))}><X /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        {rows.length < 8 && <button type="button" className="btn btn-ghost !text-edge !border-edge/30" onClick={() => put(cols, [...rows, { text: '', correct: -1 }])}><Plus /> Fila</button>}
        {cols.length < 5 && <button type="button" className="btn btn-ghost !text-edge !border-edge/30" onClick={() => put([...cols, ''], rows)}><Plus /> Columna</button>}
      </div>
    </div>
  )
}

function Head({ cols }: { cols: string[] }) {
  return (
    <tr>
      <th />
      {cols.map((c, ci) => (
        <th key={ci} className="px-1 pb-2 text-center align-bottom font-display text-sm sm:text-base" style={tint(ci)}>
          <span className="mb-1 grid place-items-center text-xl" style={{ color: 'var(--c)' }}>{SHAPES[ci % 6]}</span>
          {c}
        </th>
      ))}
    </tr>
  )
}

export function GridPlayer({ q, onSubmit, disabled }: { q: G; onSubmit: (v: number[]) => void; disabled?: boolean }) {
  const { cols, rows } = q.data
  const [pick, setPick] = useState<number[]>(() => rows.map(() => -1))
  return (
    <div className="space-y-4">
      <p className="text-sm font-bold opacity-70">Toca la columna que corresponde a cada fila</p>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-y-2">
          <thead><Head cols={cols} /></thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                <th scope="row" className="rounded-l-xl bg-ink2 px-3 py-2 text-left font-bold">{r.text}</th>
                {cols.map((_, ci) => (
                  <td key={ci} className={`bg-ink2 px-1 text-center ${ci === cols.length - 1 ? 'rounded-r-xl' : ''}`} style={tint(ci)}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={pick[ri] === ci}
                      aria-label={`${r.text}: ${cols[ci]}`}
                      disabled={disabled}
                      onClick={() => setPick((p) => p.map((x, j) => (j === ri ? ci : x)))}
                      className="mx-auto grid h-11 w-11 place-items-center rounded-full border-[3px] border-edge text-edge transition-transform"
                      style={{ background: pick[ri] === ci ? 'var(--c)' : 'rgb(255 255 255 / .12)', transform: pick[ri] === ci ? 'scale(1.1)' : undefined }}
                    >
                      {pick[ri] === ci && <Check />}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-big w-full" disabled={disabled || pick.includes(-1)} onClick={() => onSubmit(pick)}>Enviar <Bolt /></button>
    </div>
  )
}

export function GridCorrect({ q }: { q: G }) {
  const { cols, rows } = q.data
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-y-2">
        <thead><Head cols={cols} /></thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              <th scope="row" className="rounded-l-xl bg-ink2 px-3 py-2 text-left font-bold">{r.text}</th>
              {cols.map((_, ci) => (
                <td key={ci} className={`bg-ink2 px-1 text-center ${ci === cols.length - 1 ? 'rounded-r-xl' : ''}`} style={tint(ci)}>
                  {r.correct === ci ? (
                    <span className="mx-auto grid h-11 w-11 place-items-center rounded-full border-[3px] border-edge text-edge" style={{ background: 'var(--c)' }}><Check /></span>
                  ) : (
                    <span className="mx-auto block h-11 w-11" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
