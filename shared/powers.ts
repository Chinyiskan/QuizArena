// Poderes y modos del juego en vivo. Lógica pura (la usan el servidor y las pruebas); los textos también los muestra la UI.
export type Power = 'x2' | 'shield' | 'fifty' | 'steal' | 'bet'
/** Estilo de partida que elige el profe en el lobby. */
export type Style = 'classic' | 'powers' | 'bomb'

export const POWERS: Record<Power, { name: string; desc: string }> = {
  x2: { name: 'Doble', desc: 'Esta pregunta vale el doble si aciertas.' },
  shield: { name: 'Escudo', desc: 'Si fallas, no pierdes tu racha. También bloquea robos.' },
  fifty: { name: '50/50', desc: 'Quita opciones incorrectas (solo opción múltiple).' },
  steal: { name: 'Robo', desc: 'Si aciertas rápido, le robas puntos al 1.º.' },
  bet: { name: 'Apuesta', desc: 'Aciertas: puntos x3. Fallas: pierdes lo que valía.' },
}

export const STYLES: Record<Style, { name: string; desc: string }> = {
  classic: { name: 'Clásico', desc: 'Puntos por acierto y velocidad. Sin sorpresas.' },
  powers: { name: 'Con poderes', desc: 'Caen poderes al azar, más a quien va atrás.' },
  bomb: { name: 'Papa caliente', desc: 'Bombas escondidas. Si te toca y fallas: BOOM, quedas fuera.' },
}

/**
 * ¿Cae un poder tras revelar? Más probable para quien va atrás (rank 0 = primero) y un poco más si acertó perfecto:
 * da emoción y deja la partida abierta sin regalar la victoria. `rnd` se inyecta para poder probarlo.
 */
export function rollDrop(rank: number, players: number, perfect: boolean, rnd: () => number = Math.random): Power | undefined {
  const behind = players > 1 ? rank / (players - 1) : 0
  if (rnd() >= 0.3 + 0.25 * behind + (perfect ? 0.1 : 0)) return
  const r = rnd()
  return r < 0.22 ? 'x2' : r < 0.42 ? 'shield' : r < 0.62 ? 'fifty' : r < 0.8 ? 'steal' : 'bet'
}

/** Índices de opciones incorrectas a ocultar con 50/50: dos (o una si hay solo 3 opciones); siempre queda al menos una incorrecta. */
export function hideWrong(options: number, correct: number, rnd: () => number = Math.random): number[] {
  const wrong = Array.from({ length: options }, (_, i) => i).filter((i) => i !== correct)
  shuffle(wrong, rnd)
  return wrong.slice(0, Math.min(2, wrong.length - 1)).sort((a, b) => a - b)
}

/** Robo: 10 % de los puntos del 1.º, con tope de 300 (que duela, pero no decida la partida). */
export const stealAmount = (leaderScore: number) => Math.min(300, Math.round(leaderScore * 0.1))
/** Para que el robo cuente hay que acertar perfecto y con al menos la mitad del tiempo. */
export const STEAL_MIN_LEFT = 0.5

// ---------- Papa caliente ----------

/** Cuántas bombas se esconden en una pregunta: ~1 por cada 4 vivos, y nunca todos (siempre sobrevive alguien). Jugando solo, 1. */
export const bombCount = (alive: number) => (alive <= 1 ? alive : Math.max(1, Math.min(alive - 1, Math.round(alive / 4))))

/** ¿Se acabó la partida de papa caliente? Cuando no queda nadie, o queda uno solo y había rivales. */
export const bombOver = (alive: number, players: number) => alive === 0 || (alive === 1 && players > 1)

/** Elige en secreto quién tiene bomba. */
export function pickBombs(alive: string[], rnd: () => number = Math.random): string[] {
  return shuffle([...alive], rnd).slice(0, bombCount(alive.length))
}

function shuffle<T>(xs: T[], rnd: () => number) {
  for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]] }
  return xs
}
