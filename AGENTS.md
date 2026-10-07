# QuizArena

Suite de repaso en vivo para un solo profe (uso personal, free tier). El profe crea lecciones en `/admin`, lanza una partida, comparte el link `/play/PIN` y los estudiantes juegan desde el celular con nombre y avatar. Sin cuentas ni pagos: el profe entra con contraseña + 2FA opcional (ver "Seguridad").

## Stack y comandos

> **Solo pnpm. `npm` y `npx` están prohibidos en este proyecto** (seguridad de cadena de suministro). Un `preinstall` rechaza cualquier instalación que no sea con pnpm. Los scripts de build de dependencias están bloqueados por defecto; se aprueban explícitamente en `pnpm-workspace.yaml` (`allowBuilds`). No agregar dependencias sin necesidad real.

Vite + React 19 + TypeScript + Tailwind v4 + `motion` + `lucide-react` (cliente) · Fastify + Socket.IO + `node:sqlite` (servidor) · Zod (esquemas compartidos).

| Comando | Qué hace |
|---|---|
| `pnpm dev` | API en :3000 + Vite en :5173 (con proxy). Abrir `localhost:5173`. |
| `pnpm clase` | **Para clase**: compila, abre el túnel de Cloudflare, arranca el servidor con `PUBLIC_URL` ya puesta e imprime el link (`scripts/clase.mjs`). Ctrl+C cierra todo. Requiere el puerto 3000 libre. |
| `pnpm build && pnpm start` | Todo en :3000 (lo que se expone con Cloudflare Tunnel). |
| `pnpm test` | Unit tests de puntaje y calificación (`shared/grade.test.ts`). |
| `pnpm test:live` | Prueba de humo host + 2 jugadores (requiere `pnpm start`). |
| `pnpm typecheck` | `tsc --noEmit`. Debe pasar siempre. |
| `pnpm seed` | Crea/actualiza la lección de ejemplo (`demo`). |
| `pnpm totp` | Genera contraseña + clave 2FA para `.env`. |
| `pnpm bots <PIN> [n]` | Mete n jugadores falsos que responden al azar (probar sin 30 celulares). |

Para clase: ver [GUIA-CLASE.md](GUIA-CLASE.md) (túnel, login, `PUBLIC_URL`).

## Arquitectura (lo que hay que respetar)

- `shared/questions.ts`: **fuente de verdad** de los tipos de pregunta (zod de datos y de respuesta + `grade()`), puntaje y `hideAnswer()`. Cliente y servidor lo importan.
- `server/game.ts`: salas **en memoria**, el servidor es la autoridad (temporizador, puntaje, fases `lobby → question → reveal → podium`). El cliente nunca decide si acertó.
- `server/db.ts`: lecciones como JSON en SQLite (`data/quizarena.db`). Las partidas no se persisten todavía.
- `client/src/types/registry.tsx`: UI por tipo (`Editor`, `Player`, `Correct`). **Un tipo nuevo = una entrada en `shared/questions.ts` + una en el registro + su componente.** Nada más.
- El estado se transmite como `leftMs` (ms restantes), nunca como timestamp: los relojes de los celulares no coinciden con el del servidor.
- Mientras `phase === 'question'`, la respuesta correcta **no debe viajar** por el socket (`hideAnswer`). La prueba `test:live` lo verifica.

## Identidad visual (no negociable: nada genérico)

Público: adolescentes y jóvenes. Tono: juguetón, con energía de torneo, nunca infantil ni corporativo.

- **Look**: noche oscura (`ink`) + neón (`lime`, `pink`, `cyan`, `sun`, `violet`, `fire`), tarjetas crema con **borde grueso y sombra dura** (estilo sticker), botones que se hunden al presionar, leves rotaciones, puntitos de fondo.
- **Tipografía**: Bricolage Grotesque (títulos, 800) + DM Sans (texto). No usar Inter/Roboto.
- **Componentes**: usar las clases de `client/src/index.css` (`.btn`, `.card`, `.card-dark`, `.input`, `.sticker`, `.opt`) y los helpers de `ui.tsx` antes de inventar estilos nuevos.
- **Respuestas**: siempre color **+ forma** (triángulo, círculo, cuadrado, rombo, estrella, hexágono: SVG en `icons.tsx`), nunca solo color.
- **Iconos**: **prohibidos los emojis en la interfaz**. Todo icono sale de `client/src/icons.tsx` (lucide con trazo grueso, tamaño `1em`, color `currentColor`). Para un icono nuevo, exportarlo desde ahí. Tampoco usar glifos de texto tipo ✓ ✕ → ↑.
- **Movimiento**: resortes y `pop` en momentos de recompensa (acertar, podio); respetar `prefers-reduced-motion`.
- **Textos**: español, cercanos, con emoji dosificado. Móvil primero (el estudiante juega con una mano).
- **Avatares**: el profe suelta PNG/JPG/WebP en `public/avatars/` y aparecen solos en el selector (valor `img:archivo.webp`). El servidor los sirve **directo de esa carpeta** (`/avatars/`), así que agregar uno **no requiere volver a compilar**. Se muestran en un cuadrado redondeado (squircle, para no cortar el dibujo como haría un círculo) y **sin** `image-rendering: pixelated` (al reducir 512 px se vería dentado). Si hay avatares del profe, **solo se ofrecen esos**; los 12 animalitos pixel art dibujados en código (`pixel.tsx`, valor `pix:fox`) son el respaldo cuando la carpeta está vacía. En una sala, los avatares ya elegidos por otros salen atenuados y no se pueden tomar (`taken` en `GET /api/rooms/:pin`; es una ayuda, no una regla dura). La pantalla de inicio sortea 6 de ellos como decoración. Los `emoji:` de partidas antiguas se muestran como zorro. Prompt para generar lotes: [docs/prompt-avatares.md](docs/prompt-avatares.md).

## Agentes

Definidos en `.claude/agents/`. Invocarlos según la tarea; el principal coordina y revisa.

| Agente | Cuándo usarlo |
|---|---|
| `arena-designer` | Cualquier pantalla o componente visual nuevo o cambiado. Guardián de la identidad de arriba. |
| `arena-type-builder` | Implementar un tipo de pregunta nuevo (drag & drop, huecos, tablas…). |
| `arena-realtime` | Cambios en salas, fases, puntaje, reconexión o Socket.IO. |
| `arena-sfx` | Efectos, música, mezcla, audio en celulares y quién oye qué (el profe solo oye fases y música, nunca acciones de estudiantes). |
| `arena-qa` | Antes de dar algo por terminado: tests, `typecheck`, partida de prueba en el navegador a tamaño móvil. |

Regla de oro para todos: cambio mínimo que funcione, reutilizar lo que ya existe, y dejar **una** verificación ejecutable para lógica no trivial.

## Plan de la semana

| Día | Entregable | Estado |
|---|---|---|
| 1 | Scaffold, SQLite, registro de tipos, mcq/multi/tf, dashboard CRUD, editor, modo en vivo, join con nombre+avatar | ✅ |
| 2 | Tipos de texto: completa espacios, menú desplegable, respuestas abiertas; duplicar lección; import/export JSON | ✅ |
| 3 | Mejoras del modo en vivo: distribución de respuestas por opción, entrada tardía, podio con más drama, sonidos | ✅ |
| 4 | Drag & drop (dnd-kit): arrastra y suelta, categorizar, reordenar, relacionar | ✅ |
| 5 | Modo tarea autoguiado + panel de progreso en vivo + guía de túnel | ✅ |
| 6 | Iconos SVG + avatares pixel art; tabla de relleno, cuadrícula, texto interactivo, lectura; reportes de resultados | ✅ |
| 7 | Pulido, responsive, prueba con grupo real | ⬜ |

## Convenciones de los tipos del día 2

- Huecos en texto con `[corchetes]`: `fill` acepta todas las opciones de un hueco (`[París|paris]`); `dropdown` toma la **primera** como correcta y `hideAnswer` baraja el resto de forma determinista (semilla = id de pregunta, para que no salten entre emisiones).
- Las respuestas escritas se comparan con `norm()` (sin mayúsculas, tildes ni espacios). Un `fill` da crédito parcial proporcional a huecos acertados; la racha solo sube con respuestas perfectas.
- Validación humana en un solo lugar: `lessonProblems()` de `shared/questions.ts` (la usan el editor y el servidor).
- Los componentes `Player` con estado interno se montan con `key={q.id}` para no arrastrar estado entre preguntas.
- Importar/exportar: archivo `.json` con `{ title, emoji, questions }` (o un arreglo de esos).

## Convenciones del día 3

- **Sonido**: `client/src/sound.ts`. Efectos en `public/sfx/*.mp3` decodificados con WebAudio; la tabla `CLIPS` recorta el silencio inicial (`at`), limita la duración (`dur`) y nivela el volumen (`vol`) de cada archivo. Si un archivo falta o aún no cargó, suena el **sintetizado** de respaldo (`SYNTH`). **Uso real = clases virtuales por Meet, estilo Wayground**: cada estudiante juega en su dispositivo y el profe NO comparte pantalla. Por eso, en el estudiante sonido y música arrancan **encendidos** y en el profe **apagados** (por Meet el audio llega comprimido y duplicado). Efectos (`SoundButton`) y música (`MusicButton`) tienen **cada uno su botón**, en ambos roles; preferencias en `qa-snd2-*` / `qa-mus2-*`. Niveles medidos (RMS ~ −23 dB, `vol` en `CLIPS`) con limitador general (`master()`); los sonidos del reveal (`JINGLE`) suenan en **cola**, uno tras otro, y la música baja mientras dure cada efecto. Tic-tac (`countdown`) y mecha (`fuse`) suenan también en el celular del estudiante (a 4 s / 5 s), y se cortan al responder (`stopFuse`) El rol se deduce de la URL (`/host`). Vibración corta en el celular al revelar. Clic suave global en `.btn`/`.tile` (`installClicks`).
- **Música** (profe con `MusicButton`; celular con la pista según fase vía `Play.tsx`/`HwPlay.tsx`; ~5 MB por datos móviles): `music('lobby' | 'game' | 'podium' | null)` con `<audio>` (no se decodifica en memoria), fundidos y atenuación automática cuando suena un efecto. Lobby → `lobby`; preguntas y reveals → `game` (no se reinicia entre preguntas); podio: redoble `drum`, `medal` por puesto y al final `confetti` + `podium`. Los últimos 4 s suena el tic-tac (`countdown`); en **papa caliente**, en vez del tic-tac, la mecha `fuse` (5,2 s) a 5 s del final (`stopFuse()` la corta si la pregunta cierra antes). Robo/Apuesta/robado: `steal`, `bet` (solo el arranque del archivo, recortado con fundido), `victim`.
- **Entrada tardía**: se puede entrar mientras la partida no esté en `podium`; el nuevo empieza con 0 puntos y puede responder la pregunta en curso.
- **Reveal**: el servidor manda `credit` (0..1 por jugador) y `dist` (cuántos eligieron cada opción; `tf` = `[verdadero, falso]`). El celular distingue perfecta / parcial / fallo / sin respuesta.
- **Podio**: suspenso 3.º → 2.º → 1.º con fanfarria y confeti (`Confetti` en `ui.tsx`, CSS puro, oculto con reduced-motion).
- **Proyector**: la pantalla del host lleva la clase `.projector` (respuestas más grandes).

## Convenciones del día 4 (tipos con arrastre)

- Dependencias nuevas: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (instaladas con pnpm).
- `order` (Reordenar): `items` en el orden correcto; el estudiante recibe la lista barajada (nunca resuelta). Crédito parcial por posición. Sin elementos repetidos.
- `match` (Relacionar): `pairs[{left,right}]`; el estudiante recibe `pairs` con `right:''` y un `pool` de derechas barajadas. **Tocar para emparejar** (sin arrastre: más fiable en celular). `answer[i]` = derecha elegida para la izquierda i.
- `sort` (Categorizar): `cats[{name,items}]`; el estudiante recibe categorías vacías + `pool` barajado. `answer` = `{elemento: índiceCategoría}`; por eso un elemento no puede repetirse. Máx. 12 elementos, 4 categorías.
- `drag` (Arrastra y suelta): mismo texto con `[huecos]` que `fill` + `extra` (distractores). El banco = primera opción de cada hueco + distractores, barajado (`bank`).
- `types/dnd.tsx` (`DndArea`, `Chip`, `Zone`) es la mecánica compartida de fichas→zonas: se puede **arrastrar** (ratón, dedo con pulsación corta de 120 ms para no romper el scroll, teclado) o **tocar la ficha y luego la zona**. Usar esto para cualquier tipo nuevo de fichas.
- Todos devuelven crédito parcial proporcional; `hideAnswer` mantiene el barajado determinista (semilla = id).

## Convenciones del día 5 (modo tarea)

- Una sala tiene `mode: 'live' | 'homework'`. En tarea no hay fases ni reloj: **cada estudiante tiene su propio avance** (`pos`, `results[]`, `awaiting`) y el servidor sigue siendo la autoridad.
- Canales de socket: `pin` (en vivo), `pin:host` (solo el profe; el panel de tarea), `pin:p:<id>` (vista personal del estudiante, evento `hw`). **Los estudiantes nunca reciben datos de otros en una tarea.**
- Eventos de tarea: `hw:answer`, `hw:next`, `hw:sync` (la pantalla lo pide al montar: el primer `hw` llega antes de que exista), `host:lock` (cierra: nadie responde más; los de a medias ven su resumen).
- La solución de una pregunta solo viaja en la vista del estudiante **después** de que respondió esa pregunta (`stage: 'feedback'`).
- Las tareas se **persisten** en SQLite (`hw_rooms`, JSON) en cada acción y se cargan al arrancar; las partidas en vivo no. Las partidas en vivo abandonadas > 12 h se limpian solas al crear otra sala.
- Puntaje en tarea: sin bono de velocidad (usa la velocidad máxima) pero con racha; parcial proporcional como en vivo.
- Dashboard: lista "Activas ahora" (`GET /api/rooms`, con token) para volver al panel de una tarea; `DELETE /api/rooms/:pin` la elimina.
- Auth: solo son públicos `GET /api/config`, `/api/avatars` y `/api/rooms/<PIN de 6 dígitos>`. Todo lo demás (incluido `DELETE /api/rooms/...`) exige el token.

## Convenciones del día 6

- **Lección**: el campo `emoji` de la lección ahora guarda una **clave de icono** (`book`, `flask`, `rocket`... ver `LESSON_ICONS`); una clave desconocida (lecciones antiguas con emoji) cae en `target`.
- `table` (Tabla de relleno): `rows: string[][]` + `header`. Los huecos van entre `[corchetes]` dentro de las celdas (misma sintaxis que `fill`, alternativas con `|`); se califican en orden de lectura con crédito parcial. Máx. 12 huecos, filas del mismo largo.
- `grid` (Cuadrícula coincidente): `cols[]` + `rows[{text, correct}]`; `answer[i]` = columna elegida para la fila i. `hideAnswer` pone `correct: -1`.
- `tap` (Texto interactivo): texto con `[palabras correctas]`. Los **índices de token se calculan sobre el texto sin corchetes** (`tapTokens`), así la vista del estudiante (sin marcas) tiene los mismos índices. Crédito = (aciertos − errores) / correctas, nunca negativo.
- **Lectura**: no es un tipo aparte sino el campo opcional `passage` de cualquier pregunta (texto que se muestra sobre la pregunta, en celular y en proyector). El editor ofrece "usar el texto de la pregunta anterior".
- **Reportes** (`reports` en SQLite): foto por sala con una fila por estudiante y una columna por pregunta (`null` = no participó). Las partidas en vivo la guardan al llegar al podio (o al terminar antes, con lo jugado); las tareas desde la primera respuesta y se actualizan en cada acción. **Sobreviven a "Eliminar" la sala.** `GET/DELETE /api/reports[/:id]` (con token). UI en `/admin/reports`; exportación CSV con `;` y BOM (Excel en español).
- Helpers de estadísticas compartidos en `client/src/stats.tsx` (`Bar`, `Stat`, `Hardest`).

## Convenciones: modo automático y explicaciones

- **Modo automático (solo en vivo)**: el profe elige Manual o Automático en el lobby y puede cambiarlo en cualquier momento (evento `host:auto`, solo el host). En automático, tras cada reveal el servidor avanza solo después de `pauseMs` (5/8/12/20 s a elegir) **más tiempo para leer la explicación** (50 ms por carácter, máx. 8 s). El profe puede saltar con "Siguiente" o "Pausar automático". La cuenta regresiva viaja como `autoLeftMs` (relativo, igual que `leftMs`). Empezar la partida sigue siendo manual.
- **Explicación**: campo opcional `explanation` en cualquier pregunta. `hideAnswer` la oculta mientras se responde; se muestra en el reveal (celular y proyector) y en el feedback de tareas.
- **Reveal en el celular**: banner de resultado, panel Posición/Puntos, distancia al de arriba, la **respuesta correcta solo para quien no acertó del todo**, la explicación para todos, el ranking (con la fila propia aunque esté fuera del top 5) y la cuenta del automático.

## Contexto inseguro (la app se abre por http://IP-de-la-red)

- Al probar desde el celular o por `http://192.168.x.x:5173` el navegador **oculta** `crypto.randomUUID`, `navigator.clipboard` y otras APIs de contexto seguro. Usar siempre `uid()` y `copyText()` de `client/src/browser.ts`; `pnpm test` (`shared/insecure-context.test.ts`) falla si aparecen directo en `client/src`.
- `client/src/ErrorBoundary.tsx` envuelve toda la app: un error al dibujar muestra "Algo se rompió" con Recargar / Ir al inicio, en vez de dejar la pantalla en blanco sin salida.

## Código en preguntas y ayuda del editor

- **Código**: campo opcional `code: { lang, text }` (máx. 1500 caracteres) en cualquier pregunta, como `passage`; lenguajes en `CODE_LANGS` (`shared/questions.ts`). Se muestra con `CodeBlock` (`ui.tsx`) en celular, proyector y tarea, con números de línea y scroll horizontal. Resaltado propio sin dependencias en `client/src/highlight.tsx` (comentarios, cadenas, números, palabras clave; no entiende gramáticas); prueba en `highlight.test.ts`. Colores `.tk-*` en `index.css`.
- **Tooltip** `Tip` (`ui.tsx`): hover con 250 ms de espera o foco de teclado, Escape cierra, se mantiene dentro de la pantalla, `aria-describedby`. Los textos de ayuda de cada tipo viven en `client/src/types/help.ts` (un tipo nuevo también necesita su entrada ahí: `TYPE_HELP` es `Record<TypeId,…>` y el typecheck lo exige).

## Panel del profe (mesa de control, no pantalla de proyector)

El profe **no comparte pantalla** (clases por Meet): su panel es para él. `Control.tsx` (en vivo) y `HwPanel.tsx` (tarea).

- **En vivo** (`pages/Control.tsx`): temporizador, pregunta, contadores EN VIVO (contestaron / bien / mal / faltan, con "sin conexión" aparte), acierto del grupo, tabla de **todos** los estudiantes con estado (Pensando… / Bien / Parcial / Mal / Sin responder / Desconectado / Eliminado; siempre icono + color), puntos ganados, racha, filtro "solo los que faltan", botón X para sacar a alguien, **respuesta correcta visible solo para el profe**, distribución en vivo (opción múltiple, V/F, selección múltiple), "equivocaciones más comunes" (`answerLabel`) y explicación. Atajo: **barra espaciadora** = cerrar/siguiente. En el podio, "Ver reporte". Compacto (solo iconos) en pantallas < sm.
- **Evento `dash`** (`dashOf` en `game.ts`): se emite SOLO al canal `pin:host`, justo después de `state`: `answered[]`, `credit{}` (cada respuesta se califica al llegar: `Answer.credit`), `key` (la pregunta CON solución), `dist`, `wrong[]`, `reportId`. **Nunca va a un estudiante**; `server/dash.test.ts` y `smoke-security.test.ts` lo vigilan. El cliente lo lee con `useDash()`.
- **Tarea** (`HwPanel.tsx`): contadores (sin empezar / en curso / terminaron / acierto), aviso de "quietos" (5+ min sin avanzar, `Player.lastAt`, llega como `idleMs` relativo) y desconectados, filtros con contadores, orden (puntos / más atrasados / más quietos / nombre), "va en la 3/6 · hace 2 min", X para sacar, "Tabla completa" (Reporte) y, en "preguntas que más costaron", las **equivocaciones más repetidas** (`Result.pick`, guardado solo si falló).
- **Reporte** (`Report.tsx`): se actualiza solo cada 5 s mientras la partida/tarea siga en curso.
- `answerLabel(q, valor)` (shared/questions.ts) da el texto de una respuesta solo donde se lee como frase (mcq, multi, tf, open, fill, dropdown, drag); en los demás tipos no hay texto útil y no se lista.

## Modos de partida, poderes y papa caliente (solo en vivo)

- **Estilo** (`Room.style`, `shared/powers.ts` → `STYLES`): `classic` (sin poderes), `powers` (por defecto) o `bomb` (papa caliente). Lo elige el profe en el lobby (`host:style`); a mitad de partida se ignora. `view()` expone `style` y `powers` (= style 'powers').
- **Poderes** (`POWERS`): Doble (x2), Escudo (conserva la racha y **bloquea robos** al 1.º), 50/50 (solo `mcq`), **Robo** (aciertas perfecto con ≥ 50 % del tiempo → le quitas `stealAmount` = 10 % con tope 300 al 1.º *de antes de la pregunta*; si eres el 1.º no hace nada) y **Apuesta** (perfecto: x3; si no: pierdes `points` de la pregunta, sin bajar de 0). Reparto aleatorio (`rollDrop`): 30 % + hasta 25 % según qué tan atrás vas + 10 % si acertaste perfecto; inventario de 1. `view()` informa `drops` y `steals` (solo en reveal). Doble/Escudo/Robo/Apuesta quedan en `Player.armed`; 50/50 viaja **solo** por el canal personal (`hide`).
- **Papa caliente**: al empezar cada pregunta `pickBombs` esconde `bombCount(vivos)` bombas (~1 cada 4, nunca todos). **Quién las tiene es secreto**: `Room.bombs` nunca viaja; el estado solo trae `bombs` (cuántas) y `alive`. En el reveal, quien tenía bomba y no acertó perfecto explota (`Player.out = índice`, `booms`), quien acertó la desactiva (`defused`). Los eliminados observan: no responden, no cuentan para "todos respondieron", no se califican (en el reporte, `null`). Quien entra tarde a una papa caliente empezada entra observando. Termina al acabarse las preguntas o con `bombOver` (queda 1 en pie o ninguno). Ranking: vivos primero, luego quien explotó más tarde, desempata el puntaje.
- **UI**: `client/src/power.tsx` (poderes, `Sparks` con colores), `client/src/bomb.tsx` (`BombBadge`, `Explosion` en portal con destello/ondas/metralla y sacudida de `main`, `BoomCard`, `DefusedCard`, `SpectatorCard`, `BombReport` del proyector). Selector `StylePicker` en `Host.tsx`. Sonidos sintetizados `boom` (ruido filtrado + golpe grave) y `defuse`. Todo se apaga con reduced-motion.
- **Pruebas**: `shared/powers.test.ts` y `server/powers-engine.test.ts` (motor sin azar: Robo, bloqueo con Escudo, Apuesta, Doble) en `pnpm test`; `server/smoke-power.test.ts` y `server/smoke-bomb.test.ts` en `pnpm test:live`. El modo tarea no tiene poderes ni bombas.

## Editor: paleta de preguntas

Columna fija (`sticky`, 22 rem, **sin scroll**: las 13 fichas caben en 700 px de alto; mantenerlo así si se agregan tipos) a la derecha en pantallas ≥ lg, y al final en móvil. **Guardar** vive en el encabezado de esa columna (en móvil, botón flotante pequeño) y los errores de validación salen al pie de la columna; ya no hay barra inferior. Tipos agrupados por categoría (`CATS` en `Editor.tsx`: Elegir, Escribir, Mover y unir, Observar) con fichas `.tile` del color de su categoría. Una pregunta nueva se lleva a la vista sola. `Tip` ahora se dibuja en un portal con `position: fixed` (las tarjetas con `backdrop-filter` rompen `fixed` si no).

## Seguridad

- **Login**: `server/auth.ts`. `ADMIN_PASSWORD` (obligatoria, 12+) y `ADMIN_TOTP_SECRET` (opcional, TOTP RFC 6238 con `node:crypto`) en `.env`, que cargan `pnpm dev`/`start`/`test:live` con `--env-file-if-exists`. `POST /api/login` da una cookie `qa_session` HttpOnly + SameSite=Strict (+ Secure si llega por HTTPS), 12 h. 5 fallos = 15 min de bloqueo. Comparaciones con `timingSafeEqual`.
- **Público**: solo `GET /api/config|avatars|auth|rooms/:pin` y `POST /api/login|logout` (set `PUBLIC` en `index.ts`). Todo lo demás exige sesión, y `host:open` la lee del handshake del socket (tras el login el cliente reconecta el socket). **La autenticación se decide con `req.routeOptions.url` (la ruta que eligió el router), nunca con el texto de `req.url`**: el router decodifica y `/%61pi/lessons` se saltaba el login.
- **Sockets**: todo handler con callback usa `fn(cb)` (un cliente sin callback tumbaba el servidor), máx. 30 eventos/s por conexión (el cliente se reconecta solo a los 2 s), 150 jugadores por sala, `maxHttpBufferSize` 100 KB y se rechaza cualquier `Origin` de otro sitio. **Todo argumento de socket es `unknown`: comprobar `typeof` antes de usarlo** (`String()` de `{"toString":1}` lanza y tumbaba el proceso). Red de seguridad: `uncaughtException`/`unhandledRejection` se registran sin caer (con `pnpm clase`, caerse = perder túnel y link).
- **Identidad del jugador**: el `id` es público (va en el ranking); al entrar se recibe además una `key` secreta (`localStorage`) y reconectarse exige `id + key` (`isReturning`). `player:join(pin, nombre, avatar, id, key, cb)`; sin `key` el callback puede ir en su lugar (bots, pruebas). El nombre se limpia de caracteres de control y de dirección de texto (`clean`).
- **Estado público vs. privado (en vivo)**: `view().players` lleva solo `id, name, avatar, score, streak, online, out`. Lo propio de cada jugador (poder guardado, poder activado y `answered` = índice de la pregunta que ya respondió o -1) viaja por su canal (`me`, tras cada `state`). Así no se ven los poderes ajenos y, al recargar, el celular sabe si ya respondió (y si la respuesta llegó tarde dice "Se acabó el tiempo").
- **Desconexión**: un jugador solo queda offline si no le queda ningún socket en su canal (el celular pudo volver con otro antes de que el viejo se diera por caído). Si se va el único que faltaba por responder, se revela sin esperar al reloj.
- **Profe**: `host:next` ignora los clics durante los primeros 1,5 s de una pregunta (`hostNext`: el doble clic o un clic justo cuando avanza el automático se saltaban la pregunta). `host:kick` saca a un jugador (botón X en el lobby y en el ranking del reveal); el celular recibe `kicked` y puede volver a entrar con otro nombre, desde 0.
- **Barajado**: `hideAnswer(q, SALT)` con una sal secreta por proceso (`game.ts`): con solo el id (público) se podía deshacer el barajado y deducir la respuesta.
- **PIN**: `crypto.randomInt`; 300 PIN fallidos por IP cada 10 min (HTTP y `player:join`; todo un colegio sale por la misma IP). Las reconexiones con `id + key` no cuentan ni se bloquean. Detrás del túnel la IP sale de `CF-Connecting-IP` solo si la conexión viene de localhost.
- **CSV**: celdas que empiezan con `= + - @` llevan un apóstrofo (Excel las ejecutaría como fórmula); decimales con coma.
- **Cabeceras**: CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` (la CSP solo afecta al build).
- Pruebas: `server/auth.test.ts` (en `pnpm test`); `server/smoke-security.test.ts` (en `pnpm test:live`) cubre cada bug de arriba. Las de humo inician sesión con `server/test-auth.ts` (`BASE` para otro puerto).

## Deuda conocida

- Las partidas viven en memoria: si se reinicia el servidor, se pierden las salas activas (las lecciones no).
- Sesiones y límites de intentos en memoria: reiniciar el servidor cierra la sesión del profe.
- La música (3 pistas `.m4a`, AAC 96 kbps estéreo, ~5 MB en total) suena en los celulares y la sirve TU laptop por el túnel: con 30 estudiantes son ~150 MB al empezar (más ~1,5 MB de efectos y 1,3 MB de avatares por celular). Los **originales MP3 (192 kbps) están en `music-src/`** (copia maestra); `pnpm musica` los recodifica a `public/sfx/` (ffmpeg, `KBPS=64 pnpm musica` para pesar menos; limitador suave porque los originales rozan 0 dBFS y AAC suma picos). Si aún pesa: servirla desde un CDN (jsDelivr) o bajar `KBPS`. Siguen sin archivo (suenan sintetizados): `defuse` (bomba desactivada) y el aviso de tiempo agotado.
