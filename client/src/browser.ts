// Utilidades que funcionan también en contextos NO seguros.
// La app se abre muchas veces por http://IP-de-la-red (p. ej. http://192.168.1.8:5173) y ahí el navegador
// oculta crypto.randomUUID y navigator.clipboard. Usar SIEMPRE estas funciones, nunca esas APIs directo
// (shared/insecure-context.test.ts lo vigila).

/** Id aleatorio único (UUID si el navegador lo permite; si no, 128 bits aleatorios en hexadecimal). */
export function uid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Copia al portapapeles; sin la API moderna usa el método antiguo (textarea + execCommand). */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  const ta = Object.assign(document.createElement('textarea'), { value: text, readOnly: true })
  Object.assign(ta.style, { position: 'fixed', top: '0', opacity: '0' })
  document.body.appendChild(ta)
  ta.select()
  const ok = document.execCommand('copy')
  ta.remove()
  if (!ok) throw new Error('No se pudo copiar')
}
