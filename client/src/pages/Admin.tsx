import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Lesson } from '../../../shared/questions.ts'
import { api, socket } from '../lib.ts'
import { Logo, Screen } from '../ui.tsx'
import { Book, Chevron, Copy, Download, Edit, Folder, Homework, Key, LessonIcon, Reports, Rocket, Trash, Upload, X } from '../icons.tsx'

function Gate({ onOk }: { onOk: () => void }) {
  const [t, setT] = useState('')
  const [code, setCode] = useState('')
  const [totp, setTotp] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => void api('/auth').then((a) => setTotp(a.totp), () => {}), [])
  return (
    <Screen className="grid place-items-center">
      <form
        className="card w-full max-w-sm space-y-4 p-6 text-center"
        onSubmit={async (e) => {
          e.preventDefault()
          api('/login', 'POST', { password: t, code }).then(() => {
            socket.disconnect().connect() // el socket vuelve a conectar con la cookie nueva (para abrir salas)
            onOk()
          }, (e) => setErr(e.message))
        }}
      >
        <div className="text-5xl"><Key className="mx-auto" /></div>
        <h1 className="text-2xl">Zona del profe</h1>
        <input className="input" type="password" placeholder="Contraseña" aria-label="Contraseña" autoComplete="current-password" value={t} onChange={(e) => setT(e.target.value)} autoFocus />
        {totp && <input className="input text-center tracking-[0.3em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Código 2FA" aria-label="Código de 6 dígitos de tu app 2FA" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />}
        {err && <p className="font-bold text-pink">{err}</p>}
        <button className="btn w-full">Entrar</button>
      </form>
    </Screen>
  )
}

type Room = { pin: string; title: string; mode: 'live' | 'homework'; players: number; closed: boolean }

const pick = ({ title, emoji, folder, cover, questions }: Lesson) => ({ title, emoji, folder, cover, questions })

function download(l: Lesson) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(pick(l), null, 2)], { type: 'application/json' }))
  Object.assign(document.createElement('a'), { href: url, download: `${l.title.replace(/[^\w\-áéíóúñ ]+/gi, '').trim() || 'leccion'}.json` }).click()
  URL.revokeObjectURL(url)
}

export default function Admin() {
  const [ok, setOk] = useState(true) // si la sesión no vale, /lessons responde 401 y aparece el login
  const [list, setList] = useState<Lesson[] | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [err, setErr] = useState('')
  const go = useNavigate()
  const file = useRef<HTMLInputElement>(null)

  const load = () => {
    api<Lesson[]>('/lessons').then(setList, (e) => (e.status === 401 ? setOk(false) : setErr(e.message)))
    api<Room[]>('/rooms').then(setRooms, () => {})
  }
  useEffect(() => void (ok && load()), [ok])

  if (!ok) return <Gate onOk={() => setOk(true)} />

  const launch = (id: string, mode: 'live' | 'homework') =>
    api<{ pin: string }>('/rooms', 'POST', { lessonId: id, mode }).then((r) => go(`/host/${r.pin}`), (e) => setErr(e.message))

  const copy = (l: Lesson) =>
    api('/lessons', 'POST', { ...pick(l), title: `${l.title} (copia)`.slice(0, 80) }).then(load, (e) => setErr(e.message))

  // acepta una lección o un arreglo de lecciones (.json exportado desde aquí)
  const importFiles = async (files: FileList | null) => {
    setErr('')
    for (const f of Array.from(files ?? [])) {
      try {
        for (const l of [JSON.parse(await f.text())].flat()) await api('/lessons', 'POST', pick(l))
      } catch (e) {
        setErr(`${f.name}: ${e instanceof SyntaxError ? 'no es un JSON válido' : (e as Error).message}`)
      }
    }
    if (file.current) file.current.value = ''
    load()
  }

  const [shut, setShut] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('qa-folders-shut') ?? '[]') } catch { return [] } })
  const toggle = (f: string) => setShut((s) => {
    const n = s.includes(f) ? s.filter((x) => x !== f) : [...s, f]
    try { localStorage.setItem('qa-folders-shut', JSON.stringify(n)) } catch {}
    return n
  })
  const folders = [...new Set((list ?? []).map((l) => l.folder ?? '').filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const groups = [...folders, ''].map((f) => [f, (list ?? []).filter((l) => (l.folder ?? '') === f)] as const).filter(([, ls]) => ls.length)
  const move = async (l: Lesson, to: string) => {
    if (to === '__new__') to = (prompt('Nombre de la carpeta') ?? '').trim().slice(0, 40)
    if (to === (l.folder ?? '') || to === '__new__') return
    await api(`/lessons/${l.id}`, 'PUT', { ...pick(l), folder: to }).catch((e) => setErr(e.message))
    load()
  }

  const closeRoom = async (r: Room) => {
    if (confirm(`¿Eliminar ${r.mode === 'homework' ? 'la tarea' : 'la partida'} "${r.title}"? Los resultados quedan guardados en Reportes.`)) {
      await api(`/rooms/${r.pin}`, 'DELETE')
      load()
    }
  }

  const del = async (l: Lesson) => {
    if (confirm(`¿Borrar "${l.title}"? No se puede deshacer.`)) {
      await api(`/lessons/${l.id}`, 'DELETE')
      load()
    }
  }

  return (
    <Screen>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Logo to="/admin" />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <input ref={file} type="file" accept=".json,application/json" multiple hidden onChange={(e) => importFiles(e.target.files)} />
          <button className="btn btn-ghost" onClick={() => api('/logout', 'POST').then(() => setOk(false))}>Salir</button>
          <Link to="/admin/reports" className="btn btn-ghost">
            <Reports /> Reportes
          </Link>
          <button className="btn btn-ghost" onClick={() => file.current?.click()}>
            <Upload /> Importar
          </button>
          <Link to="/admin/lessons/new" className="btn btn-pink">
            + Nueva lección
          </Link>
        </div>
      </header>
      {err && <p className="mb-4 rounded-xl bg-pink/20 p-3 font-bold">{err}</p>}
      {rooms.length > 0 && (
        <section className="mb-8" aria-label="Partidas y tareas activas">
          <h2 className="mb-3 text-sm uppercase tracking-wide opacity-60">Activas ahora</h2>
          <div className="flex flex-wrap gap-3">
            {rooms.map((r) => (
              <div key={r.pin} className="card-dark flex items-center gap-3 py-2 pr-2 pl-4">
                <span className="text-2xl">{r.mode === 'homework' ? <Homework /> : <Rocket />}</span>
                <div className="min-w-0">
                  <div className="max-w-48 truncate font-bold">{r.title}</div>
                  <div className="text-xs opacity-60">PIN {r.pin} · {r.players} {r.players === 1 ? 'jugador' : 'jugadores'}{r.closed ? ' · cerrada' : ''}</div>
                </div>
                <Link to={`/host/${r.pin}`} className="btn btn-cyan !px-3 !py-1.5 !text-base">Abrir</Link>
                <button className="btn btn-ghost !px-2" onClick={() => closeRoom(r)} aria-label="Eliminar" title="Eliminar"><X /></button>
              </div>
            ))}
          </div>
        </section>
      )}
      {list?.length === 0 && (
        <div className="card-dark p-10 text-center">
          <div className="float mb-3 text-6xl"><Book className="mx-auto" /></div>
          <h2 className="mb-1 text-2xl">Aún no hay lecciones</h2>
          <p className="opacity-70">Crea la primera y lánzala a tu grupo.</p>
        </div>
      )}
      {groups.map(([f, ls]) => (
        <section key={f} className="mb-8" aria-label={f || 'Sin carpeta'}>
          {folders.length > 0 && (
            <button className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide opacity-80 hover:opacity-100" aria-expanded={!shut.includes(f)} onClick={() => toggle(f)}>
              <Chevron className={shut.includes(f) ? '-rotate-90' : ''} /> <Folder /> {f || 'Sin carpeta'} <span className="sticker !text-xs">{ls.length}</span>
            </button>
          )}
          {!shut.includes(f) && <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ls.map((l, i) => (
          <article key={l.id} className="card flex flex-col gap-4 overflow-hidden p-5" style={{ transform: `rotate(${[-0.8, 0.6, -0.4][i % 3]}deg)` }}>
            {l.cover && <img src={`/covers/${l.cover}`} alt="" loading="lazy" className="-mx-5 -mt-5 aspect-video w-[calc(100%+2.5rem)] max-w-none border-b-[3px] border-edge object-cover" />}
            <div className="flex items-start gap-3">
              <span className="text-5xl"><LessonIcon name={l.emoji} /></span>
              <div className="min-w-0">
                <h2 className="truncate text-xl leading-tight">{l.title}</h2>
                <span className="sticker mt-1">{l.questions.length} preguntas</span>
              </div>
            </div>
            <div className="mt-auto space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button className="btn whitespace-nowrap !px-3" disabled={!l.questions.length} onClick={() => launch(l.id, 'live')} title="Partida en vivo: tú controlas el ritmo">
                  Lanzar <Rocket />
                </button>
                <button className="btn btn-sun whitespace-nowrap !px-3" disabled={!l.questions.length} onClick={() => launch(l.id, 'homework')} title="Tarea: cada estudiante avanza a su ritmo">
                  Tarea <Homework />
                </button>
              </div>
              <div className="flex gap-2">
                <Link to={`/admin/lessons/${l.id}`} className="btn btn-cyan flex-1 !px-3" aria-label="Editar" title="Editar">
                  <Edit />
                </Link>
                <button className="btn btn-sun flex-1 !px-3" onClick={() => copy(l)} aria-label="Duplicar" title="Duplicar">
                  <Copy />
                </button>
                <button className="btn flex-1 !px-3" onClick={() => download(l)} aria-label="Exportar JSON" title="Exportar JSON">
                  <Download />
                </button>
                <button className="btn btn-pink flex-1 !px-3" onClick={() => del(l)} aria-label="Borrar" title="Borrar">
                  <Trash />
                </button>
              </div>
              <select className="input !py-1 !text-sm" aria-label="Mover a carpeta" value={l.folder ?? ''} onChange={(e) => move(l, e.target.value)}>
                <option value="">Sin carpeta</option>
                {folders.map((x) => <option key={x} value={x}>{x}</option>)}
                <option value="__new__">+ Nueva carpeta…</option>
              </select>
            </div>
          </article>
        ))}
          </div>}
        </section>
      ))}
    </Screen>
  )
}
