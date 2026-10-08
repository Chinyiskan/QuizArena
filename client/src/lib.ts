import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import type { dashOf, hwHostView, hwPlayerView, meOf, reportOf, view } from '../../server/game.ts'

export type ReportData = ReturnType<typeof reportOf>
export type ReportMeta = { id: string; at: number; title: string; mode: 'live' | 'homework'; players: number; accuracy: number; closed: boolean }
export type LiveView = ReturnType<typeof view>
export type HwHostView = ReturnType<typeof hwHostView>
export type HwPlayerView = ReturnType<typeof hwPlayerView>
/** Extras que solo recibe el profe en vivo (evento 'dash'). */
export type DashView = ReturnType<typeof dashOf>
/** Lo privado del jugador en vivo (evento 'me', solo por su canal). */
export type MeView = ReturnType<typeof meOf>
/** Lo que recibe 'state': el profe puede estar en una partida en vivo o en una tarea. */
export type RoomView = LiveView | HwHostView

export async function api<T = any>(path: string, method = 'GET', json?: unknown): Promise<T> {
  const res = await fetch('/api' + path, {
    method,
    headers: json ? { 'content-type': 'application/json' } : {}, // la sesión del profe va en una cookie HttpOnly
    body: json ? JSON.stringify(json) : undefined,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(body.error ?? res.statusText), { status: res.status })
  return body
}

/** Reduce la imagen a 960x540 (recorte centrado, WebP) en el navegador y la sube. Devuelve el nombre del archivo. */
export async function uploadCover(file: File): Promise<string> {
  const img = await createImageBitmap(file).catch(() => { throw new Error('No se pudo leer la imagen') })
  const W = 960, H = 540
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const k = Math.max(W / img.width, H / img.height)
  c.getContext('2d')!.drawImage(img, (W - img.width * k) / 2, (H - img.height * k) / 2, img.width * k, img.height * k)
  const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/webp', 0.82))
  if (!blob || blob.type !== 'image/webp') throw new Error('Tu navegador no puede convertir a WebP')
  const res = await fetch('/api/covers', { method: 'POST', headers: { 'content-type': 'image/webp' }, body: blob })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? res.statusText)
  return body.name
}

export const socket = io()
// Si el servidor corta la conexión (p. ej. el límite anti-spam), socket.io NO reintenta solo: se reconecta tras un respiro.
socket.on('disconnect', (reason) => void (reason === 'io server disconnect' && setTimeout(() => socket.connect(), 2000)))

/** Escucha el estado de la sala. `onConnect` se ejecuta en cada (re)conexión para volver a entrar. */
export function useRoom<T extends RoomView = LiveView>(onConnect: () => void) {
  const cb = useRef(onConnect)
  cb.current = onConnect
  const [state, setState] = useState<(T & { deadline: number; autoDeadline: number; at: number }) | null>(null)
  const [closed, setClosed] = useState(false)
  useEffect(() => {
    const onState = (s: T) => setState({ ...s, at: performance.now(), deadline: performance.now() + ('leftMs' in s ? s.leftMs : 0), autoDeadline: performance.now() + ('autoLeftMs' in s ? s.autoLeftMs : 0) })
    const onClosed = () => setClosed(true)
    const onConn = () => cb.current()
    socket.on('state', onState).on('closed', onClosed).on('connect', onConn)
    if (socket.connected) onConn()
    return () => void socket.off('state', onState).off('closed', onClosed).off('connect', onConn)
  }, [])
  return { state, closed }
}

/** Extras del profe en vivo: quién respondió, bien/mal en vivo y la pregunta con su solución. Llega justo después de 'state'. */
export function useDash() {
  const [d, setD] = useState<DashView | null>(null)
  useEffect(() => {
    socket.on('dash', setD)
    return () => void socket.off('dash', setD)
  }, [])
  return d
}

/** Vista personal del modo tarea: llega por el evento 'hw'. Al montar pide sincronizarse (el 'hw' del join llegó antes). */
export function useHw() {
  const [v, setV] = useState<HwPlayerView | null>(null)
  useEffect(() => {
    const on = (x: HwPlayerView) => setV(x)
    socket.on('hw', on)
    socket.emit('hw:sync')
    return () => void socket.off('hw', on)
  }, [])
  return v
}

/** Segundos restantes hasta `deadline` (performance.now()), refrescado cada 100ms. */
export function useCountdown(deadline: number, active: boolean) {
  const [now, setNow] = useState(performance.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(t)
  }, [active, deadline])
  return Math.max(0, (deadline - now) / 1000)
}

export const joinUrl = (base: string, pin: string) => `${base || location.origin}/play/${pin}`
