# QuizArena

Suite de repaso en vivo estilo Kahoot para clases, hecha para un solo profe y pensada para correr en su propia laptop. El profe crea lecciones, lanza una partida y comparte un link `/play/PIN`; los estudiantes juegan desde el celular con nombre y avatar, sin cuentas.

Proyecto personal full-stack en TypeScript: tiempo real con WebSockets, servidor autoritativo, 13 tipos de pregunta, sonido y música, modo tarea, reportes y una identidad visual propia.

## Características

- **Dos modos de partida**
  - **En vivo**: todos a la vez, con fases `lobby → pregunta → reveal → podio`, puntaje por velocidad y racha, ranking animado y podio con suspenso y confeti.
  - **Tarea**: cada estudiante avanza a su ritmo; el profe sigue el progreso en un panel y puede cerrarla.
- **Estilos de juego**: clásico, con **poderes** (Doble, Escudo, 50/50, Robo, Apuesta) o **papa caliente** (bombas secretas que eliminan jugadores).
- **13 tipos de pregunta** con crédito parcial: opción múltiple, selección múltiple, V/F, completar espacios, desplegable, respuesta abierta, reordenar, relacionar, categorizar, arrastrar y soltar, tabla de relleno, cuadrícula y texto interactivo. Admiten texto de lectura, bloques de código con resaltado, y explicación.
- **Panel del profe** en tiempo real: estado de cada estudiante, distribución de respuestas, errores comunes, modo automático, +10 s, expulsar jugadores.
- **Reportes** por partida o tarea (estudiantes × preguntas), con exportación a CSV compatible con Excel en español.
- **Móvil primero**: pensado para jugar con una mano; entrada tardía y reconexión automática.
- **Sin cuentas ni pagos**: login del profe con contraseña + 2FA (TOTP) opcional.

## Tecnologías

| Capa | Stack |
|---|---|
| Cliente | React 19, Vite, TypeScript, Tailwind CSS v4, `motion`, `lucide-react`, `@dnd-kit`, React Router |
| Servidor | Fastify 5, Socket.IO, `node:sqlite` (SQLite nativo de Node) |
| Compartido | Zod: esquemas, calificación y puntaje en un único módulo usado por cliente y servidor |
| Audio | WebAudio + `<audio>`, con sonidos sintetizados de respaldo |
| Exposición | Cloudflare Tunnel (`cloudflared`) para abrir la laptop a internet durante la clase |
| Tooling | pnpm (obligatorio), tsx, concurrently |

## Cómo funciona

```
 Celulares (React)  ──┐
                      ├── Socket.IO / HTTP ──►  Fastify + Socket.IO  ──► SQLite (lecciones, tareas, reportes)
 Panel del profe    ──┘                          └─ salas en memoria (game.ts)
```

- **Servidor autoritativo.** `server/game.ts` mantiene las salas en memoria y decide el reloj, la calificación y las fases. El cliente nunca decide si acertó.
- **Una sola fuente de verdad para las preguntas.** `shared/questions.ts` define cada tipo (esquema Zod, `grade()`, `hideAnswer()`); un tipo nuevo es una entrada ahí, una en `client/src/types/registry.tsx` y su componente.
- **Sin filtrar respuestas.** Mientras se responde, la solución nunca viaja por el socket (`hideAnswer`, con barajado determinista y sal secreta por proceso). Los datos del profe van por un canal aparte (`pin:host`) y los personales por uno por jugador.
- **Relojes desacoplados.** El estado viaja como milisegundos restantes (`leftMs`), no como timestamps, porque los relojes de los celulares no coinciden.
- **Persistencia.** Lecciones, tareas y reportes en SQLite; las partidas en vivo viven en memoria.

### Seguridad

- Sesión por cookie `HttpOnly` + `SameSite=Strict`, contraseña con `timingSafeEqual`, TOTP (RFC 6238) implementado con `node:crypto`, bloqueo tras 5 fallos.
- Rutas protegidas decididas por la ruta que elige el router, no por el texto de la URL.
- Todo argumento de socket se valida como `unknown`; límite de eventos por conexión, tamaño de mensaje y jugadores por sala; rechazo de `Origin` ajenos.
- Identidad de jugador con `id` público + `key` secreta para reconectar; límite de intentos de PIN por IP.
- Cabeceras CSP, `X-Frame-Options`, `nosniff`; protección contra inyección de fórmulas en el CSV.
- Las credenciales viven en `.env` (ignorado por git) y los datos en `data/` (también ignorado).

## Estructura

```
client/src/       interfaz (páginas, tipos de pregunta, sonido, componentes visuales)
server/           API, motor de juego, auth, base de datos y pruebas de humo
shared/           esquemas, calificación y puntaje compartidos
public/           avatares, efectos de sonido, música
scripts/          pnpm clase (túnel), recodificado de música
docs/             prompt para generar avatares
```

## Puesta en marcha

Requiere Node 22+ (por `node:sqlite`) y **pnpm**. `npm` y `npx` están deshabilitados a propósito por seguridad de la cadena de suministro.

```bash
pnpm install
pnpm totp        # genera ADMIN_PASSWORD y ADMIN_TOTP_SECRET para pegar en .env
pnpm seed        # opcional: lección de ejemplo
pnpm dev         # API en :3000 y Vite en :5173 -> abrir http://localhost:5173
```

Crea un archivo `.env` en la raíz con lo que imprimió `pnpm totp`:

```
ADMIN_PASSWORD=...
ADMIN_TOTP_SECRET=...   # opcional; sin él el login pide solo la contraseña
```

Para dar una clase: `pnpm clase` compila, abre el túnel de Cloudflare e imprime el link público (ver [GUIA-CLASE.md](GUIA-CLASE.md)).

### Scripts útiles

| Comando | Qué hace |
|---|---|
| `pnpm test` | Pruebas unitarias (calificación, poderes, autenticación, resaltado, motor) |
| `pnpm test:live` | Pruebas de humo con jugadores simulados (requiere `pnpm start`) |
| `pnpm typecheck` | Verificación de tipos |
| `pnpm bots <PIN> [n]` | Mete n jugadores falsos para probar sin 30 celulares |
| `pnpm build && pnpm start` | Versión de producción en :3000 |

## Documentación interna

- [AGENTS.md](AGENTS.md): arquitectura, convenciones y decisiones de diseño detalladas.
- [JUEGO.md](JUEGO.md): cómo se juega.
- [GUIA-CLASE.md](GUIA-CLASE.md): cómo dar una clase con el túnel.

## Límites conocidos

Las partidas en vivo y las sesiones del profe están en memoria: reiniciar el servidor las pierde (las lecciones, tareas y reportes no). Está diseñado para un profe y un grupo por vez, no como servicio multiusuario.
