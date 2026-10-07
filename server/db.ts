import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { Lesson, LessonInput } from '../shared/questions.ts'

mkdirSync('data', { recursive: true })
const db = new DatabaseSync('data/quizarena.db')
// Lección completa como JSON: cambia el esquema sin migraciones. ponytail: pasar a tablas si hace falta consultar por pregunta.
db.exec('CREATE TABLE IF NOT EXISTS lessons (id TEXT PRIMARY KEY, body TEXT NOT NULL, updated_at INTEGER NOT NULL)')

// Tareas (modo autoguiado): sala completa como JSON, para sobrevivir a reinicios del servidor.
db.exec('CREATE TABLE IF NOT EXISTS hw_rooms (pin TEXT PRIMARY KEY, body TEXT NOT NULL)')
export const hwRooms = {
  all: () => db.prepare('SELECT pin, body FROM hw_rooms').all().map((r: any) => [r.pin, r.body] as [string, string]),
  save: (pin: string, body: string) => void db.prepare('INSERT INTO hw_rooms (pin, body) VALUES (?, ?) ON CONFLICT(pin) DO UPDATE SET body = excluded.body').run(pin, body),
  remove: (pin: string) => void db.prepare('DELETE FROM hw_rooms WHERE pin = ?').run(pin),
}

// Reportes: foto de los resultados de cada partida/tarea. Sobreviven a "Eliminar" la sala.
db.exec('CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, at INTEGER NOT NULL, title TEXT NOT NULL, mode TEXT NOT NULL, players INTEGER NOT NULL, accuracy REAL NOT NULL, closed INTEGER NOT NULL, body TEXT NOT NULL)')
type ReportRow = { id: string; at: number; title: string; mode: string; closed: boolean; players: { results: (number | null)[] }[] }
export const reports = {
  list: () => db.prepare('SELECT id, at, title, mode, players, accuracy, closed FROM reports ORDER BY at DESC').all().map((r: any) => ({ ...r, closed: !!r.closed })),
  get: (id: string) => {
    const r = db.prepare('SELECT body FROM reports WHERE id = ?').get(id) as { body: string } | undefined
    return r && JSON.parse(r.body)
  },
  save: (rep: ReportRow) => {
    const cells = rep.players.flatMap((p) => p.results.filter((c): c is number => c !== null))
    const accuracy = cells.length ? cells.reduce((a, c) => a + c, 0) / cells.length : 0
    db.prepare('INSERT INTO reports (id, at, title, mode, players, accuracy, closed, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET players = excluded.players, accuracy = excluded.accuracy, closed = excluded.closed, body = excluded.body')
      .run(rep.id, rep.at, rep.title, rep.mode, rep.players.length, accuracy, rep.closed ? 1 : 0, JSON.stringify(rep))
  },
  remove: (id: string) => void db.prepare('DELETE FROM reports WHERE id = ?').run(id),
}

const parse = (r: any): Lesson => ({ ...JSON.parse(r.body), id: r.id, updatedAt: r.updated_at })

export const lessons = {
  list: (): Lesson[] => db.prepare('SELECT * FROM lessons ORDER BY updated_at DESC').all().map(parse),
  get: (id: string): Lesson | undefined => {
    const r = db.prepare('SELECT * FROM lessons WHERE id = ?').get(id)
    return r && parse(r)
  },
  save: (input: LessonInput, id: string = randomUUID()): Lesson => {
    const now = Date.now()
    db.prepare('INSERT INTO lessons (id, body, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at').run(id, JSON.stringify(input), now)
    return { ...input, id, updatedAt: now }
  },
  remove: (id: string) => db.prepare('DELETE FROM lessons WHERE id = ?').run(id),
}
