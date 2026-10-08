import type { ComponentType, ReactNode } from 'react'
import * as L from 'lucide-react'

// Iconos SVG de la app (lucide). Regla del proyecto: nada de emojis en la interfaz; todo con iconos de aquí.
// Tamaño 1em: heredan el tamaño de letra del texto donde se usan, y el color con `currentColor`.
type P = L.LucideProps
const wrap = (C: L.LucideIcon) => (p: P) => <C size="1em" strokeWidth={2.75} aria-hidden="true" focusable="false" {...p} />

export const Rocket = wrap(L.Rocket)
export const Edit = wrap(L.Pencil)
export const Trash = wrap(L.Trash2)
export const Copy = wrap(L.Copy)
export const Download = wrap(L.Download)
export const Upload = wrap(L.Upload)
export const Lock = wrap(L.Lock)
export const Key = wrap(L.KeyRound)
export const SoundOn = wrap(L.Volume2)
export const SoundOff = wrap(L.VolumeX)
export const Trophy = wrap(L.Trophy)
export const Check = wrap(L.Check)
export const X = wrap(L.X)
export const Timer = wrap(L.Timer)
export const Star = wrap(L.Star)
export const Flame = wrap(L.Flame)
export const Hand = wrap(L.Hand)
export const Bolt = wrap(L.Zap)
export const Save = wrap(L.Save)
export const Plus = wrap(L.Plus)
export const IndentLess = wrap(L.IndentDecrease)
export const IndentMore = wrap(L.IndentIncrease)
export const Folder = wrap(L.Folder)
export const ImagePlus = wrap(L.ImagePlus)
export const Chevron = wrap(L.ChevronDown)
export const Homework = wrap(L.ClipboardList)
export const Up = wrap(L.ArrowUp)
export const Down = wrap(L.ArrowDown)
export const Back = wrap(L.ArrowLeft)
export const Next = wrap(L.ArrowRight)
export const Both = wrap(L.ArrowLeftRight)
export const Game = wrap(L.Gamepad2)
export const Question = wrap(L.CircleHelp)
export const Sparkles = wrap(L.Sparkles)
export const Flag = wrap(L.Flag)
export const Party = wrap(L.PartyPopper)
export const Warn = wrap(L.TriangleAlert)
export const Minus = wrap(L.Minus)
export const Grip = wrap(L.GripVertical)
export const Reports = wrap(L.ChartColumn)
export const Inbox = wrap(L.Inbox)
export const Wave = wrap(L.Hand)
export const Book = wrap(L.BookOpen)
export const CodeIcon = wrap(L.Code)
// Poderes del modo en vivo
export const PowerX2 = wrap(L.Zap)
export const PowerShield = wrap(L.ShieldCheck)
export const PowerFifty = wrap(L.EyeOff)
export const Gift = wrap(L.Gift)
export const MusicIcon = wrap(L.Music)
export const PowerSteal = wrap(L.HandCoins)
export const PowerBet = wrap(L.Dices)
// Papa caliente y estilos de partida
export const Bomb = wrap(L.Bomb)
export const Skull = wrap(L.Skull)
export const Eye = wrap(L.Eye)
export const Target = wrap(L.Target)
// Categorías de la paleta de preguntas
export const CatPick = wrap(L.MousePointerClick)
export const CatWrite = wrap(L.Keyboard)
export const CatMove = wrap(L.Move)
export const CatLook = wrap(L.ScanSearch)
export const Like = wrap(L.ThumbsUp)
export const Sad = wrap(L.Frown)
export const Users = wrap(L.Users)
export const Doc = wrap(L.FileText)
export const Contrast = wrap(L.Contrast)
export const Bulb = wrap(L.Lightbulb)
export const Pause = wrap(L.Pause)

// Estado de una respuesta: perfecta / parcial / fallo / sin responder (null)
export function Mark({ credit, className = '' }: { credit: number | null; className?: string }) {
  if (credit === null) return <L.Minus size="1em" strokeWidth={3} className={`opacity-50 ${className}`} aria-label="sin responder" />
  if (credit === 1) return <L.CircleCheck size="1em" strokeWidth={2.75} className={`text-lime ${className}`} aria-label="correcta" />
  if (credit > 0) return <L.Contrast size="1em" strokeWidth={2.75} className={`text-sun ${className}`} aria-label="parcial" />
  return <L.CircleX size="1em" strokeWidth={2.75} className={`text-pink ${className}`} aria-label="incorrecta" />
}

/** Icono grande de resultado: hereda el color del banner donde se use. */
export function StatusIcon({ credit, className }: { credit: number | null; className?: string }) {
  const C = credit === null ? L.Timer : credit === 1 ? L.CircleCheck : credit > 0 ? L.Contrast : L.CircleX
  return <C size="1em" strokeWidth={2.5} aria-hidden="true" className={className} />
}

// Formas de las respuestas (color + forma, nunca solo color). SVG rellenos con currentColor.
const svg = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false">{d}</svg>
)
export const SHAPES: ReactNode[] = [
  svg(<path d="M12 3 22 20H2z" strokeLinejoin="round" stroke="currentColor" strokeWidth="2" />), // triángulo
  svg(<circle cx="12" cy="12" r="9" />), // círculo
  svg(<rect x="4" y="4" width="16" height="16" rx="2" />), // cuadrado
  svg(<path d="M12 2 22 12 12 22 2 12z" strokeLinejoin="round" stroke="currentColor" strokeWidth="2" />), // rombo
  svg(<path d="m12 2.5 2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.3 1.3-6.6L2.5 9.5l6.6-.8z" strokeLinejoin="round" stroke="currentColor" strokeWidth="1.5" />), // estrella
  svg(<path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7z" strokeLinejoin="round" stroke="currentColor" strokeWidth="1.5" />), // hexágono
]

/** Medalla de podio: oro, plata y bronce con su número. */
const MEDAL = [['#ffd43b', '#e0a800'], ['#dfe6f0', '#9aa7b8'], ['#ff9d5c', '#c26a2a']]
export function Medal({ rank, size = '1em' }: { rank: number; size?: string }) {
  const [fill, edge] = MEDAL[rank] ?? ['#c6ff3d', '#7fb800']
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-label={`puesto ${rank + 1}`} role="img">
      <path d="M7 2h4l1 6H8zM17 2h-4l-1 6h4z" fill="#ff4f9a" stroke="#0a0720" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="12" cy="15" r="7" fill={fill} stroke="#0a0720" strokeWidth="1.6" />
      <circle cx="12" cy="15" r="4.6" fill="none" stroke={edge} strokeWidth="1.2" />
      <text x="12" y="18" textAnchor="middle" fontSize="8" fontWeight="800" fill="#0a0720" fontFamily="Bricolage Grotesque, sans-serif">{rank + 1}</text>
    </svg>
  )
}

// Iconos de tipo de pregunta
export const TYPE_ICONS: Record<string, ComponentType<P>> = {
  mcq: wrap(L.CircleDot),
  multi: wrap(L.ListChecks),
  tf: wrap(L.Scale),
  fill: wrap(L.PenLine),
  dropdown: wrap(L.ChevronsUpDown),
  order: wrap(L.ArrowUpDown),
  match: wrap(L.Link2),
  sort: wrap(L.Layers),
  drag: wrap(L.Puzzle),
  open: wrap(L.MessageSquareText),
  table: wrap(L.Table),
  grid: wrap(L.Grid3x3),
  tap: wrap(L.MousePointerClick),
  blocks: wrap(L.Blocks),
}

// Iconos que el profe puede elegir para una lección (se guarda la clave en el campo `emoji` de la lección).
export const LESSON_ICONS: Record<string, ComponentType<P>> = {
  book: wrap(L.BookOpen), flask: wrap(L.FlaskConical), globe: wrap(L.Globe), calc: wrap(L.Calculator),
  atom: wrap(L.Atom), palette: wrap(L.Palette), music: wrap(L.Music), code: wrap(L.Code),
  languages: wrap(L.Languages), leaf: wrap(L.Leaf), hourglass: wrap(L.Hourglass), dna: wrap(L.Dna),
  rocket: wrap(L.Rocket), trophy: wrap(L.Trophy), brain: wrap(L.Brain), bulb: wrap(L.Lightbulb),
  puzzle: wrap(L.Puzzle), map: wrap(L.Map), heart: wrap(L.Heart), bolt: wrap(L.Zap),
  star: wrap(L.Star), flag: wrap(L.Flag), target: wrap(L.Target), microscope: wrap(L.Microscope),
  landmark: wrap(L.Landmark), telescope: wrap(L.Telescope), bug: wrap(L.Bug), cpu: wrap(L.Cpu),
}
export function LessonIcon({ name, className }: { name: string; className?: string }) {
  const C = LESSON_ICONS[name] ?? LESSON_ICONS.target // lecciones antiguas guardaban un emoji: caen en el icono por defecto
  return <C className={className} />
}
// Panel del profe
export const Offline = wrap(L.WifiOff)
export const Clock = wrap(L.Clock)
export const Hourglass = wrap(L.Hourglass)
