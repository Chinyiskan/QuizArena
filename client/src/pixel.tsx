import { useMemo } from 'react'

// Avatares pixel art de respaldo (cuando public/avatars/ está vacío). Se dibujan en código:
// cada capa es solo la MITAD izquierda (8 columnas) y se refleja, así todos salen simétricos.
// '.' = transparente; cada letra es una clave de la paleta del animal.
type Layer = Record<number, string>

const HEAD: Layer = { 4: '....oooo', 5: '..oobbbb', 6: '.obbbbbb', 7: '.obbbbbb', 8: '.obbbbbb', 9: '.obbbbbb', 10: '.obbbbbb', 11: '.obbbbbb', 12: '.obbbbbb', 13: '..oobbbb', 14: '....oooo' }

const EARS: Record<string, Layer> = {
  pointy: { 0: '.o......', 1: '.oo.....', 2: '.oio....', 3: '.oiio...', 4: '.obbbo..' },
  round: { 1: '..oooo..', 2: '.oeeeeo.', 3: '.oeiieo.', 4: '..oooo..' },
  long: { 0: '....oo..', 1: '...oeeo.', 2: '...oeio.', 3: '...oeio.', 4: '...oeeo.' },
  tuft: { 2: '.o......', 3: '.oo.....', 4: '.obo....' },
  hair: { 2: '.......o', 3: '......ob' },
  none: {},
}

const EYES: Layer = { 8: '...wk...', 9: '...kk...' }
const MUZZLE: Layer = { 10: '....llll', 11: '...lllll', 12: '...lllll', 13: '..oollll' }
const NOSE: Layer = { 10: '.......n' }
const MOUTH: Layer = { 12: '......mm' }
const BLUSH: Layer = { 10: '..ii....' }

const FACES: Record<string, Layer[]> = {
  cute: [MUZZLE, EYES, NOSE, MOUTH, BLUSH],
  panda: [{ 7: '..dd....', 8: '.dddd...', 9: '.dddd...', 10: '..dd....' }, MUZZLE, { 8: '...ww...', 9: '...ww...' }, NOSE, MOUTH],
  owl: [{ 6: '..wwwww.', 7: '..wwwww.', 8: '..wwkkw.', 9: '..wwkkw.', 10: '..wwwww.' }, { 10: '.......y', 11: '......yy', 12: '.......y' }],
  penguin: [{ 8: '...lllll', 9: '..llllll', 10: '..llllll', 11: '..llllll', 12: '...lllll' }, { 8: '...kk...', 9: '...kk...' }, { 10: '.......y', 11: '......yy', 12: '.......y' }],
  frog: [{ 3: '....k...', 11: '..mm....', 12: '....mmmm' }],
  pig: [{ 10: '..lllll.', 11: '..lllll.', 12: '..lllll.', 13: '..oollll' }, EYES, { 11: '.....n..', 12: '.....n..' }, BLUSH],
  tiger: [{ 5: '.......d', 6: '....d..d', 7: '....d...' }, MUZZLE, EYES, NOSE, MOUTH],
  chick: [EYES, { 10: '......yy', 11: '.......y' }, { 10: '..ii....' }],
}

const ACC: Record<string, Layer> = {
  shades: { 8: '..kwkkkk', 9: '...kkkk.' },
  crown: { 1: '.....y.y', 2: '.....yyy', 3: '.....yrr' },
}

const INK = '#1a1033'
type Spec = { ears: string; face: string; acc?: string; pal: Record<string, string> }
const base = { o: INK, k: INK, w: '#ffffff', m: INK }

export const PIXEL_ANIMALS: Record<string, Spec> = {
  fox: { ears: 'pointy', face: 'cute', pal: { ...base, b: '#ff8a3d', i: '#ffe3c2', l: '#fff1de', n: INK } },
  cat: { ears: 'pointy', face: 'cute', acc: 'shades', pal: { ...base, b: '#9aa7b8', i: '#ff9ab8', l: '#dfe6f0', n: '#ff6f91' } },
  bear: { ears: 'round', face: 'cute', pal: { ...base, b: '#a8683a', e: '#a8683a', i: '#d9a06b', l: '#e8c196', n: INK } },
  panda: { ears: 'round', face: 'panda', pal: { ...base, b: '#ffffff', e: INK, i: '#5b4a8a', l: '#ffffff', d: INK, n: INK } },
  bunny: { ears: 'long', face: 'cute', pal: { ...base, b: '#fff1f6', e: '#fff1f6', i: '#ff9ab8', l: '#ffe0ea', n: '#ff6f91' } },
  frog: { ears: 'round', face: 'frog', acc: 'crown', pal: { ...base, b: '#58d36b', e: '#58d36b', i: '#ffffff', y: '#ffd43b', r: '#ff4f9a' } },
  owl: { ears: 'tuft', face: 'owl', pal: { ...base, b: '#b57b4a', y: '#ffb703' } },
  penguin: { ears: 'none', face: 'penguin', acc: 'crown', pal: { ...base, b: '#3a3480', l: '#ffffff', y: '#ff9a1f', r: '#ff4f9a' } },
  pig: { ears: 'round', face: 'pig', acc: 'crown', pal: { ...base, b: '#ff9ab8', e: '#ff7aa3', i: '#ff6f91', l: '#ffc2d4', n: '#c2456b', y: '#ffd43b', r: '#38dbff' } },
  tiger: { ears: 'round', face: 'tiger', acc: 'shades', pal: { ...base, b: '#ffa733', e: '#ffa733', i: '#fff1de', l: '#fff1de', d: INK, n: INK } },
  chick: { ears: 'hair', face: 'chick', pal: { ...base, b: '#ffd43b', i: '#ff9a7a', y: '#ff8a3d' } },
  mouse: { ears: 'round', face: 'cute', pal: { ...base, b: '#c9c3d9', e: '#c9c3d9', i: '#ff9ab8', l: '#eee9f7', n: '#ff6f91' } },
}
export const PIXEL_NAMES = Object.keys(PIXEL_ANIMALS)

/** Compone la matriz 16x16 y la convierte en rectángulos (agrupa píxeles contiguos del mismo color). */
function build(name: string) {
  const spec = PIXEL_ANIMALS[name] ?? PIXEL_ANIMALS.fox
  const m: string[][] = Array.from({ length: 16 }, () => Array(16).fill('.'))
  const stamp = (layer: Layer) => {
    for (const [r, s] of Object.entries(layer))
      for (let c = 0; c < 8; c++) if (s[c] !== '.') (m[+r][c] = s[c]), (m[+r][15 - c] = s[c])
  }
  stamp(HEAD)
  stamp(EARS[spec.ears])
  FACES[spec.face].forEach(stamp)
  if (spec.acc) stamp(ACC[spec.acc])
  const rects: { x: number; y: number; w: number; fill: string }[] = []
  m.forEach((row, y) => {
    for (let x = 0; x < 16; ) {
      const k = row[x]
      let w = 1
      while (x + w < 16 && row[x + w] === k) w++
      if (k !== '.' && spec.pal[k]) rects.push({ x, y, w, fill: spec.pal[k] })
      x += w
    }
  })
  return rects
}

export function PixelAnimal({ name }: { name: string }) {
  const rects = useMemo(() => build(name), [name])
  return (
    <svg viewBox="0 0 16 16" className="h-full w-full" shapeRendering="crispEdges" role="img" aria-label={name}>
      {rects.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />)}
    </svg>
  )
}
