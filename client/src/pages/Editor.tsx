import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CODE_LANGS, lessonProblems, typeIds, types, type CodeLang, type LessonInput, type Question, type TypeId } from '../../../shared/questions.ts'
import { api, uploadCover } from '../lib.ts'
import { uid } from '../browser.ts'
import { Back, Book, CodeIcon, Copy, Down, Folder, ImagePlus, LESSON_ICONS, LessonIcon, Plus, Save, Star, TYPE_ICONS, Timer, Trash, Up, Warn } from '../icons.tsx'
import { CodeBlock, Logo, Screen, Tip } from '../ui.tsx'
import { CatLook, CatMove, CatPick, CatWrite } from '../icons.tsx'
import { newQuestion, registry } from '../types/registry.tsx'
import { TYPE_HELP } from '../types/help.ts'

const TIMES = [10, 15, 20, 30, 45, 60, 90]
const POINTS = [0, 500, 1000, 2000]
// si la lección trae un valor fuera de la lista (p. ej. 40s importado), se muestra igual en vez de caer en el primero
const withCurrent = (xs: number[], v: number) => (xs.includes(v) ? xs : [...xs, v].sort((a, b) => a - b))
const ghost = 'btn btn-ghost !text-edge !border-edge/30'

export default function Editor() {
  const { id } = useParams()
  const isNew = id === 'new'
  const go = useNavigate()
  const [lesson, setLesson] = useState<LessonInput | null>(isNew ? { title: '', emoji: 'target', folder: '', cover: '', questions: [newQuestion('mcq')] } : null)
  const [errs, setErrs] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [folders, setFolders] = useState<string[]>([])
  const [coverErr, setCoverErr] = useState('')
  const coverIn = useRef<HTMLInputElement>(null)
  useEffect(() => void api<{ folder?: string }[]>('/lessons').then((ls) => setFolders([...new Set(ls.map((l) => l.folder ?? '').filter(Boolean))].sort()), () => {}), [])
  const onCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setCoverErr('')
    try { const cover = await uploadCover(f); setLesson((l) => l && { ...l, cover }) } catch (x) { setCoverErr((x as Error).message) }
  }
  const [open, setOpen] = useState<Record<string, boolean>>({}) // textos de lectura desplegados

  useEffect(() => void (!isNew && api<LessonInput>(`/lessons/${id}`).then((l) => ((saved.current = JSON.stringify(l)), setLesson(l)), () => go('/admin'))), [id])
  // cambios sin guardar: avisa antes de cerrar la pestaña o de salir con "Volver"/el logo
  const saved = useRef('')
  const dirty = !!lesson && JSON.stringify(lesson) !== saved.current && (!isNew || lesson.title !== '' || lesson.questions.length > 1 || !!lesson.questions[0]?.prompt)
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    addEventListener('beforeunload', warn)
    return () => removeEventListener('beforeunload', warn)
  }, [dirty])
  const leave = (e: React.MouseEvent) => void (dirty && (e.target as Element).closest('a') && !confirm('Tienes cambios sin guardar. ¿Salir igual?') && e.preventDefault())
  const [added, setAdded] = useState('') // id de la pregunta recién agregada: se lleva a la vista
  useEffect(() => void (added && document.getElementById(`q-${added}`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })), [added])
  if (!lesson) return <Screen>Cargando…</Screen>

  const setQs = (questions: Question[]) => setLesson({ ...lesson, questions })
  const add = (t: TypeId) => { const nq = newQuestion(t); setLesson((l) => l && { ...l, questions: [...l.questions, nq] }); setAdded(nq.id) }
  const setQ = (i: number, q: Question) => setQs(lesson.questions.map((x, j) => (j === i ? q : x)))
  const move = (i: number, d: number) => {
    const qs = [...lesson.questions]
    ;[qs[i], qs[i + d]] = [qs[i + d], qs[i]]
    setQs(qs)
  }

  const save = async () => {
    const p = lessonProblems(lesson)
    setErrs(p)
    if (p.length) return
    setSaving(true)
    try {
      await api(isNew ? '/lessons' : `/lessons/${id}`, isNew ? 'POST' : 'PUT', lesson)
      saved.current = JSON.stringify(lesson)
      go('/admin')
    } catch (e) {
      // tus cambios siguen en pantalla: si fue la sesión, entra en otra pestaña y vuelve a guardar aquí
      setErrs([(e as { status?: number }).status === 401 ? 'Tu sesión expiró. Abre el panel en otra pestaña, entra y vuelve a Guardar aquí (no pierdes nada).' : (e as Error).message])
      setSaving(false)
    }
  }

  const pal = { onAdd: add, onSave: save, saving, errs }

  return (
    <Screen className="pb-24 !max-w-[1360px] lg:pb-8">
      <header className="mb-6 flex items-center justify-between" onClickCapture={leave}>
        <Logo to="/admin" />
        <Link to="/admin" className="btn btn-ghost">
          <Back /> Volver
        </Link>
      </header>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6">
      <div className="min-w-0">

      <div className="card mb-6 space-y-3 p-4">
        <input className="input !text-2xl font-display" placeholder="Título de la lección" aria-label="Título de la lección" value={lesson.title} maxLength={80} onChange={(e) => setLesson({ ...lesson, title: e.target.value })} />
        <div role="radiogroup" aria-label="Ícono de la lección" className="flex flex-wrap gap-2">
          {Object.keys(LESSON_ICONS).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={lesson.emoji === k}
              aria-label={k}
              onClick={() => setLesson({ ...lesson, emoji: k })}
              className={`grid h-11 w-11 place-items-center rounded-xl border-[3px] border-edge text-2xl transition-transform ${lesson.emoji === k ? 'scale-110 bg-lime shadow-[0_3px_0_var(--color-edge)]' : 'bg-white opacity-70 hover:opacity-100'}`}
            >
              <LessonIcon name={k} />
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 font-bold"><Folder />
            <input className="input !w-56 !py-1.5 !text-base" list="carpetas" placeholder="Carpeta (opcional)" aria-label="Carpeta" value={lesson.folder ?? ''} maxLength={40} onChange={(e) => setLesson({ ...lesson, folder: e.target.value })} />
          </label>
          <datalist id="carpetas">{folders.map((f) => <option key={f} value={f} />)}</datalist>
          <input ref={coverIn} type="file" accept="image/*" hidden onChange={onCover} />
          <button type="button" className={ghost} onClick={() => coverIn.current?.click()}><ImagePlus /> {lesson.cover ? 'Cambiar portada' : 'Agregar portada'}</button>
          {lesson.cover && <button type="button" className={ghost} onClick={() => setLesson({ ...lesson, cover: '' })}><Trash /> Quitar</button>}
          {coverErr && <span className="font-bold text-pink">{coverErr}</span>}
        </div>
        {lesson.cover && <img src={`/covers/${lesson.cover}`} alt="Portada de la lección" className="aspect-video w-full max-w-sm rounded-xl border-[3px] border-edge object-cover" />}
      </div>

      <div className="space-y-6">
        {lesson.questions.map((q, i) => {
          const R = registry[q.type]
          const prev = lesson.questions[i - 1]?.passage
          const showPassage = open[q.id] || !!q.passage
          return (
            <section key={q.id} id={`q-${q.id}`} className="card scroll-mt-6 p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="sticker !text-sm">#{i + 1}</span>
                <select
                  className="input !w-auto !py-1 !text-base"
                  value={q.type}
                  aria-label="Tipo de pregunta"
                  onChange={(e) => {
                    const type = e.target.value as Question['type']
                    setQ(i, { ...newQuestion(type), id: q.id, prompt: q.prompt, passage: q.passage, code: q.code, explanation: q.explanation, time: q.time, points: q.points })
                  }}
                >
                  {typeIds.map((t) => (
                    <option key={t} value={t}>{types[t].label}</option>
                  ))}
                </select>
                <span className="ml-auto flex gap-1">
                  <button className={ghost} disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir"><Up /></button>
                  <button className={ghost} disabled={i === lesson.questions.length - 1} onClick={() => move(i, 1)} aria-label="Bajar"><Down /></button>
                  <button className={ghost} onClick={() => setQs(lesson.questions.flatMap((x, j) => (j === i ? [x, { ...structuredClone(x), id: uid() }] : [x])))} aria-label="Duplicar"><Copy /></button>
                  <button className={ghost} onClick={() => setQs(lesson.questions.filter((_, j) => j !== i))} aria-label="Borrar pregunta"><Trash /></button>
                </span>
              </div>

              {showPassage ? (
                <div className="mb-4 space-y-2">
                  <textarea className="input min-h-28 resize-y !font-medium" placeholder="Texto de lectura que verán los estudiantes junto a la pregunta…" aria-label="Texto de lectura que verán los estudiantes junto a la pregunta…" maxLength={2000} value={q.passage ?? ''} onChange={(e) => setQ(i, { ...q, passage: e.target.value })} />
                  <div className="flex flex-wrap gap-3 text-sm font-bold">
                    {prev && q.passage !== prev && <button type="button" className="underline" onClick={() => setQ(i, { ...q, passage: prev })}>Usar el texto de la pregunta anterior</button>}
                    <button type="button" className="underline opacity-70" onClick={() => (setQ(i, { ...q, passage: undefined }), setOpen({ ...open, [q.id]: false }))}>Quitar texto</button>
                  </div>
                </div>
              ) : (
                <button type="button" className={`${ghost} mb-4 mr-2 !py-1`} onClick={() => setOpen({ ...open, [q.id]: true })}>
                  <Book /> Agregar texto de lectura
                </button>
              )}

              {q.code ? (
                <div className="mb-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                    <label className="flex items-center gap-2"><CodeIcon /> Lenguaje
                      <select className="input !w-auto !py-1 !text-base" value={q.code.lang} onChange={(e) => setQ(i, { ...q, code: { ...q.code!, lang: e.target.value as CodeLang } })}>
                        {Object.entries(CODE_LANGS).map(([k, name]) => <option key={k} value={k}>{name}</option>)}
                      </select>
                    </label>
                    <button type="button" className="ml-auto underline opacity-70" onClick={() => setQ(i, { ...q, code: undefined })}>Quitar código</button>
                  </div>
                  <textarea
                    className="input min-h-32 resize-y !text-base !font-medium font-mono"
                    style={{ fontFamily: 'ui-monospace, Consolas, monospace', tabSize: 2 }}
                    spellCheck={false} autoCapitalize="off" autoCorrect="off" wrap="off" maxLength={1500}
                    placeholder="Pega o escribe el código…" aria-label="Código de la pregunta" aria-describedby={`codehint-${q.id}`}
                    value={q.code.text}
                    onChange={(e) => setQ(i, { ...q, code: { ...q.code!, text: e.target.value } })}
                    onKeyDown={(e) => {
                      // Tab indenta (útil al escribir código); Esc y luego Tab sirve para salir del campo con el teclado
                      const el = e.currentTarget
                      if (e.key === 'Escape') el.dataset.esc = '1'
                      else if (e.key === 'Tab' && !e.shiftKey && el.dataset.esc !== '1') {
                        e.preventDefault()
                        const { selectionStart: a, selectionEnd: b, value } = el
                        setQ(i, { ...q, code: { ...q.code!, text: value.slice(0, a) + '  ' + value.slice(b) } })
                        requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2))
                      } else if (e.key !== 'Shift') el.dataset.esc = ''
                    }}
                  />
                  <p id={`codehint-${q.id}`} className="text-xs font-bold opacity-70">{q.code.text.length}/1500 · Tab indenta; Esc y luego Tab para salir del campo.</p>
                  {q.code.text.trim() && <div className="rounded-2xl bg-ink p-3"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-paper opacity-70">Así lo verán</p><CodeBlock code={q.code} /></div>}
                </div>
              ) : (
                <button type="button" className={`${ghost} mb-4 !py-1`} onClick={() => setQ(i, { ...q, code: { lang: 'js', text: '' } })}>
                  <CodeIcon /> Agregar código
                </button>
              )}

              <textarea className="input mb-4 min-h-24 resize-y" placeholder={['fill', 'dropdown', 'drag', 'table', 'tap'].includes(q.type) ? 'Instrucción, p. ej. "Completa la oración"' : 'Escribe la pregunta…'} aria-label={['fill', 'dropdown', 'drag', 'table', 'tap'].includes(q.type) ? 'Instrucción, p. ej. "Completa la oración"' : 'Escribe la pregunta…'} maxLength={400} value={q.prompt} onChange={(e) => setQ(i, { ...q, prompt: e.target.value })} />
              <R.Editor q={q} set={(nq) => setQ(i, nq)} />
              <textarea className="input mt-4 min-h-16 resize-y !text-base !font-medium" placeholder="Explicación (opcional): por qué es esa la respuesta. Se muestra al revelar, sobre todo a quienes fallaron." maxLength={600} value={q.explanation ?? ''} aria-label="Explicación" onChange={(e) => setQ(i, { ...q, explanation: e.target.value })} />

              <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold">
                <label className="flex items-center gap-2">
                  <Timer /> Tiempo
                  <select className="input !w-auto !py-1 !text-base" value={q.time} onChange={(e) => setQ(i, { ...q, time: +e.target.value })}>
                    {withCurrent(TIMES, q.time).map((t) => <option key={t} value={t}>{t}s</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <Star /> Puntos
                  <select className="input !w-auto !py-1 !text-base" value={q.points} onChange={(e) => setQ(i, { ...q, points: +e.target.value })}>
                    {withCurrent(POINTS, q.points).map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
              </div>
            </section>
          )
        })}
      </div>

      <div className="mt-6 lg:hidden"><Palette {...pal} /></div>
      </div>
      <aside className="sticky top-4 hidden lg:block"><Palette {...pal} side="left" /></aside>
      </div>

      <button className="btn fixed right-4 bottom-4 z-10 !px-4 !py-2 lg:hidden" disabled={saving} onClick={save} aria-label="Guardar lección">
        {saving ? 'Guardando…' : <><Save /> Guardar</>}
      </button>
    </Screen>
  )
}

// Paleta de tipos de pregunta, por categorías. En escritorio vive en una columna fija a la derecha.
const CATS: { name: string; Icon: typeof CatPick; c: string; types: TypeId[] }[] = [
  { name: 'Elegir', Icon: CatPick, c: 'var(--color-lime)', types: ['mcq', 'multi', 'tf', 'dropdown'] },
  { name: 'Escribir', Icon: CatWrite, c: 'var(--color-cyan)', types: ['fill', 'open', 'table', 'blocks'] },
  { name: 'Mover y unir', Icon: CatMove, c: 'var(--color-pink)', types: ['order', 'match', 'sort', 'drag'] },
  { name: 'Observar', Icon: CatLook, c: 'var(--color-sun)', types: ['grid', 'tap'] },
]

function Palette({ onAdd, onSave, saving, errs, side = 'top' }: { onAdd: (t: TypeId) => void; onSave: () => void; saving: boolean; errs: string[]; side?: 'top' | 'left' }) {
  return (
    <div className="card-dark space-y-3 p-3.5">
      <div className="flex items-center gap-2">
        <p className="flex items-center gap-2 font-display text-xl"><Plus /> Agregar pregunta</p>
        <button type="button" className="btn ml-auto hidden !px-3 !py-1 !text-base lg:inline-flex" disabled={saving} onClick={onSave} aria-label="Guardar lección">
          {saving ? 'Guardando…' : <><Save /> Guardar</>}
        </button>
      </div>
      {CATS.map(({ name, Icon, c, types: ids }) => (
        <section key={name} aria-label={name} style={{ '--c': c } as React.CSSProperties}>
          <h3 className="mb-1.5 flex items-center gap-2 text-sm uppercase tracking-wide">
            <span className="grid h-7 w-7 place-items-center rounded-lg border-2 border-edge text-base text-edge" style={{ background: c }}><Icon /></span>
            {name}
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
            {ids.map((t) => {
              const TIcon = TYPE_ICONS[t]
              return (
                <Tip key={t} side={side} tip={<><b className="font-display text-base">{types[t].label}</b><span className="mt-1 block">{TYPE_HELP[t].what}</span><span className="mt-1.5 block"><b>Estudiante:</b> {TYPE_HELP[t].how}</span><span className="mt-1.5 block"><b>Profe:</b> {TYPE_HELP[t].tip}</span></>}>
                  <button type="button" className="tile" onClick={() => onAdd(t)}>
                    <span className="tile-icon"><TIcon /></span>
                    <span>{types[t].label}</span>
                  </button>
                </Tip>
              )
            })}
          </div>
        </section>
      ))}
      {errs.length > 0 && (
        <ul className="space-y-1 border-t border-white/10 pt-3 text-sm font-bold text-pink" role="alert">
          {errs.slice(0, 3).map((e) => <li key={e} className="flex items-start gap-1.5"><Warn className="mt-0.5 shrink-0" /> <span>{e}</span></li>)}
          {errs.length > 3 && <li className="opacity-70">y {errs.length - 3} más…</li>}
        </ul>
      )}
    </div>
  )
}
