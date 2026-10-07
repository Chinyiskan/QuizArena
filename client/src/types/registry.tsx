import type { ReactNode } from 'react'
import { uid } from '../browser.ts'
import type { Question, TypeId } from '../../../shared/questions.ts'
import { ChoiceCorrect, ChoiceEditor, ChoicePlayer } from './choice.tsx'
import { TfCorrect, TfEditor, TfPlayer } from './tf.tsx'
import { BlanksCorrect, BlanksEditor, BlanksPlayer } from './blanks.tsx'
import { OpenCorrect, OpenEditor, OpenPlayer } from './open.tsx'
import { OrderCorrect, OrderEditor, OrderPlayer } from './order.tsx'
import { MatchCorrect, MatchEditor, MatchPlayer } from './match.tsx'
import { SortCorrect, SortEditor, SortPlayer } from './sort.tsx'
import { DragEditor, DragPlayer } from './drag.tsx'
import { TableCorrect, TableEditor, TablePlayer } from './table.tsx'
import { GridCorrect, GridEditor, GridPlayer } from './grid.tsx'
import { TapCorrect, TapEditor, TapPlayer } from './tap.tsx'
import { BlanksCorrect as DragCorrect } from './blanks.tsx'

// Registro de UI por tipo. Para un tipo nuevo: sumarlo en shared/questions.ts y aquí.
export type Entry = {
  /** Datos iniciales al crear una pregunta de este tipo (incompletos a propósito: el editor los valida). */
  blank: () => Question['data']
  Editor: (p: { q: any; set: (q: any) => void }) => ReactNode
  Player: (p: { q: any; onSubmit: (v: any) => void; disabled?: boolean; hidden?: number[] }) => ReactNode
  Correct: (p: { q: any }) => ReactNode
}

export const registry: Record<TypeId, Entry> = {
  mcq: { blank: () => ({ options: ['', '', '', ''], correct: -1 }), Editor: ChoiceEditor, Player: ChoicePlayer, Correct: ChoiceCorrect },
  multi: { blank: () => ({ options: ['', '', '', ''], correct: [] }), Editor: ChoiceEditor, Player: ChoicePlayer, Correct: ChoiceCorrect },
  tf: { blank: () => ({ correct: true }), Editor: TfEditor, Player: TfPlayer, Correct: TfCorrect },
  fill: { blank: () => ({ text: '' }), Editor: BlanksEditor, Player: BlanksPlayer, Correct: BlanksCorrect },
  dropdown: { blank: () => ({ text: '' }), Editor: BlanksEditor, Player: BlanksPlayer, Correct: BlanksCorrect },
  order: { blank: () => ({ items: ['', '', ''] }), Editor: OrderEditor, Player: OrderPlayer, Correct: OrderCorrect },
  match: { blank: () => ({ pairs: [{ left: '', right: '' }, { left: '', right: '' }] }), Editor: MatchEditor, Player: MatchPlayer, Correct: MatchCorrect },
  sort: { blank: () => ({ cats: [{ name: '', items: [''] }, { name: '', items: [''] }] }), Editor: SortEditor, Player: SortPlayer, Correct: SortCorrect },
  drag: { blank: () => ({ text: '', extra: [] }), Editor: DragEditor, Player: DragPlayer, Correct: DragCorrect },
  table: { blank: () => ({ header: true, rows: [['', ''], ['', '']] }), Editor: TableEditor, Player: TablePlayer, Correct: TableCorrect },
  grid: { blank: () => ({ cols: ['Verdadero', 'Falso'], rows: [{ text: '', correct: -1 }, { text: '', correct: -1 }] }), Editor: GridEditor, Player: GridPlayer, Correct: GridCorrect },
  tap: { blank: () => ({ text: '' }), Editor: TapEditor, Player: TapPlayer, Correct: TapCorrect },
  open: { blank: () => ({ answers: [''] }), Editor: OpenEditor, Player: OpenPlayer, Correct: OpenCorrect },
}

export const newQuestion = (type: TypeId): Question =>
  ({ id: uid(), type, prompt: '', time: 20, points: 1000, data: registry[type].blank() }) as Question
