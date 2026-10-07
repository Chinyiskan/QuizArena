import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type ReportData } from '../lib.ts'
import { Back, Check, Contrast, Download, Trash, X } from '../icons.tsx'
import { Avatar, Logo, Screen } from '../ui.tsx'
import { Hardest, Stat, pct } from '../stats.tsx'
import { when } from './Reports.tsx'

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, c) => a + c, 0) / xs.length : null)
const answered = (xs: (number | null)[]) => xs.filter((c): c is number => c !== null)

function Cell({ credit }: { credit: number | null }) {
  const base = 'mx-auto grid h-8 w-8 place-items-center rounded-lg border-2 text-edge'
  if (credit === null) return <span className={`${base} border-dashed border-white/20 text-transparent`} aria-label="sin responder">-</span>
  if (credit === 1) return <span className={`${base} border-edge bg-lime`} aria-label="correcta"><Check /></span>
  if (credit > 0) return <span className={`${base} border-edge bg-sun`} aria-label={`parcial ${pct(credit)}`} title={pct(credit)}><Contrast /></span>
  return <span className={`${base} border-edge bg-pink`} aria-label="incorrecta"><X /></span>
}

/** CSV para Excel/Sheets en español: separador ";", coma decimal y BOM para las tildes. Valores 1 / 0,5 / 0 y vacío si no participó. */
function exportCsv(r: ReportData) {
  // un nombre que empieza con = + - @ Excel lo ejecuta como fórmula aunque vaya entre comillas: se antepone un apóstrofo
  const q = (s: string) => `"${s.replace(/^[=+\-@\t\r]/, "'$&").replaceAll('"', '""')}"`
  const num = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')
  const rows = [
    ['Estudiante', 'Puntos', 'Acierto', ...r.questions.map((x, i) => `P${i + 1}: ${x.prompt}`)].map(q).join(';'),
    ...r.players.map((p) => {
      const m = mean(answered(p.results))
      return [q(p.name), p.score, m === null ? '' : num(m), ...p.results.map((c) => (c === null ? '' : num(c)))].join(';')
    }),
  ]
  const url = URL.createObjectURL(new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' }))
  Object.assign(document.createElement('a'), { href: url, download: `${r.title.replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'reporte'}.csv` }).click()
  URL.revokeObjectURL(url)
}

export default function Report() {
  const { id } = useParams()
  const go = useNavigate()
  const [r, setR] = useState<ReportData | null>(null)
  useEffect(() => void api<ReportData>(`/reports/${id}`).then(setR, () => go('/admin/reports')), [id])
  // mientras la partida o tarea siga en curso, la tabla se actualiza sola cada 5 s (si falla un refresco se queda con lo último)
  const open = !!r && !r.closed
  useEffect(() => {
    if (!open) return
    const t = setInterval(() => void api<ReportData>(`/reports/${id}`).then(setR, () => {}), 5000)
    return () => clearInterval(t)
  }, [open, id])
  if (!r) return <Screen>Cargando…</Screen>

  const colAcc = r.questions.map((_, i) => mean(answered(r.players.map((p) => p.results[i]))))
  const avg = mean(r.players.flatMap((p) => answered(p.results)))
  const del = async () => {
    if (confirm(`¿Borrar el reporte "${r.title}"? No se puede deshacer.`)) {
      await api(`/reports/${r.id}`, 'DELETE')
      go('/admin/reports')
    }
  }

  return (
    <Screen className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <Logo to="/admin" size="text-2xl" />
        <span className="flex gap-2">
          <Link to="/admin/reports" className="btn btn-ghost"><Back /> Reportes</Link>
          <button className="btn btn-cyan !py-1.5" onClick={() => exportCsv(r)}><Download /> Exportar CSV</button>
          <button className="btn btn-ghost" onClick={del} aria-label="Borrar reporte"><Trash /></button>
        </span>
      </header>

      <div>
        <h1 className="text-3xl">{r.title}</h1>
        <p className="opacity-60">
          {when(r.at)} · {r.mode === 'homework' ? 'Tarea' : 'Partida en vivo'}
          {!r.closed && ' · en curso (se actualiza sola)'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="estudiantes" value={String(r.players.length)} />
        <Stat label="acierto promedio" value={avg === null ? '—' : pct(avg)} />
        <Stat label="preguntas" value={String(r.questions.length)} />
      </div>

      <section className="card-dark overflow-x-auto p-3" aria-label="Resultados por estudiante y pregunta">
        <table className="border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-ink2 pr-3 text-left">Estudiante</th>
              <th className="px-2">Pts</th>
              {r.questions.map((x, i) => (
                <th key={i} className="min-w-10 px-0.5 text-center" title={x.prompt}>
                  <div className="font-display">{i + 1}</div>
                  <div className="text-xs font-normal opacity-60">{colAcc[i] === null ? '' : pct(colAcc[i]!)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.players.map((p, pi) => {
              const m = mean(answered(p.results))
              return (
                <tr key={pi}>
                  <td className="sticky left-0 z-10 bg-ink2 py-0.5 pr-3">
                    <div className="flex items-center gap-2">
                      <Avatar value={p.avatar} size={32} />
                      <div className="min-w-0">
                        <div className="max-w-32 truncate font-bold">{p.name}</div>
                        <div className="text-xs opacity-60">{m === null ? '—' : pct(m)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 text-center font-display tabular-nums">{p.score}</td>
                  {p.results.map((c, i) => <td key={i}><Cell credit={c} /></td>)}
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <Hardest stats={r.questions.map((x, i) => ({ prompt: x.prompt, accuracy: colAcc[i], answered: answered(r.players.map((p) => p.results[i])).length }))} />
    </Screen>
  )
}
