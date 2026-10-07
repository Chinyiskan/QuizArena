import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib.ts'
import { Avatar, Logo, Screen } from '../ui.tsx'
import { PIXEL_NAMES, PixelAnimal } from '../pixel.tsx'
import { Next, Rocket } from '../icons.tsx'

export default function Home() {
  const [pin, setPin] = useState('')
  const go = useNavigate()
  const [pics, setPics] = useState<string[]>([]) // avatares del profe para la decoración
  useEffect(() => void api<string[]>('/avatars').then((f) => setPics([...f].sort(() => Math.random() - 0.5).slice(0, 6)), () => {}), [])
  return (
    <Screen className="flex flex-col items-center justify-center text-center">
      <div className="mb-6 flex flex-wrap justify-center gap-2" aria-hidden="true">
        {pics.length
          ? pics.map((f, i) => (
              <span key={f} className="float" style={{ animationDelay: `${i * 0.35}s` }}>
                <Avatar value={`img:${f}`} size={76} />
              </span>
            ))
          : PIXEL_NAMES.slice(0, 7).map((n, i) => (
              <span key={n} className="float h-14 w-14 sm:h-16 sm:w-16" style={{ animationDelay: `${i * 0.35}s` }}>
                <PixelAnimal name={n} />
              </span>
            ))}
      </div>
      <span className="sticker float mb-4">¡a jugar!</span>
      <div className="pop mb-3 text-6xl sm:text-8xl">
        <Logo size="text-6xl sm:text-8xl" />
      </div>
      <p className="mb-8 max-w-md text-lg opacity-80">Repasa, compite y sube al podio. Pon el PIN que te dio tu profe.</p>
      <form
        className="card w-full max-w-sm space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (pin.length === 6) go(`/play/${pin}`)
        }}
      >
        <input
          className="input text-center font-display text-4xl tracking-[0.3em]"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000000"
          aria-label="PIN de la partida"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
        <button className="btn btn-pink btn-big w-full" disabled={pin.length !== 6}>
          Entrar <Rocket />
        </button>
      </form>
      <Link to="/admin" className="mt-10 text-sm opacity-50 hover:opacity-100">
        Soy el profe <Next className="inline" />
      </Link>
    </Screen>
  )
}
