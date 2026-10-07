import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type ReportMeta } from '../lib.ts'
import { Back, Homework, Inbox, Rocket, Trash } from '../icons.tsx'
import { Logo, Screen } from '../ui.tsx'
import { Bar, pct, tone } from '../stats.tsx'

export const when = (at: number) => new Date(at).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })

export default function Reports() {
  const [list, setList] = useState<ReportMeta[] | null>(null)
  const load = () => api<ReportMeta[]>('/reports').then(setList, () => setList([]))
  useEffect(() => void load(), [])

  const del = async (r: ReportMeta) => {
    if (confirm(`¿Borrar el reporte "${r.title}"? No se puede deshacer.`)) {
      await api(`/reports/${r.id}`, 'DELETE')
      load()
    }
  }

  return (
    <Screen>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Logo to="/admin" />
        <Link to="/admin" className="btn btn-ghost"><Back /> Panel</Link>
      </header>
      <h1 className="mb-5 text-3xl">Reportes</h1>

      {list?.length === 0 && (
        <div className="card-dark p-10 text-center">
          <div className="float mb-3 text-6xl"><Inbox className="mx-auto" /></div>
          <h2 className="mb-1 text-2xl">Aún no hay reportes</h2>
          <p className="opacity-70">Se crean solos al terminar una partida o al recibir la primera respuesta de una tarea.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {list?.map((r) => (
          <article key={r.id} className="card flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              <span className="text-3xl">{r.mode === 'homework' ? <Homework /> : <Rocket />}</span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl leading-tight">{r.title}</h2>
                <p className="text-sm opacity-60">{when(r.at)}</p>
              </div>
              <span className="sticker">{r.mode === 'homework' ? (r.closed ? 'tarea' : 'tarea en curso') : 'en vivo'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm font-bold">
              <span>{r.players} {r.players === 1 ? 'estudiante' : 'estudiantes'}</span>
              <Bar value={r.accuracy} color={tone(r.accuracy)} />
              <span className="font-display">{pct(r.accuracy)}</span>
            </div>
            <div className="flex gap-2">
              <Link to={`/admin/reports/${r.id}`} className="btn btn-cyan flex-1">Ver reporte</Link>
              <button className="btn btn-pink !px-3" onClick={() => del(r)} aria-label="Borrar reporte" title="Borrar"><Trash /></button>
            </div>
          </article>
        ))}
      </div>
    </Screen>
  )
}
