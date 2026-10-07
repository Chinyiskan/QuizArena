# Contexto para continuar: QuizArena, día 7

Pegar esto (o decir "lee CONTEXTO-DIA-7.md") en un chat nuevo abierto en `D:\QuizArena`. El detalle técnico vive en `AGENTS.md` (se carga solo vía `CLAUDE.md`); este archivo resume **qué hay, qué falta y qué trampas ya conocemos**.

## Qué es
Suite de repaso estilo Kahoot + Wayground para **un solo profe** (uso personal, free tier). El profe crea lecciones en `/admin`, lanza una partida en vivo o una tarea, comparte `/play/PIN` y los estudiantes entran desde el celular con nombre y avatar. Corre en su laptop y se expone con Cloudflare Tunnel. Sin cuentas ni pagos; el profe entra con un token (`ADMIN_TOKEN`, por defecto `arena`).

Stack: Vite + React 19 + TS + Tailwind v4 + motion + lucide-react + dnd-kit · Fastify + Socket.IO + `node:sqlite` · Zod. **Solo pnpm (npm/npx prohibidos).**

## Qué ya está hecho (días 1-6 + extras)
- **Dashboard** `/admin`: crear/editar/duplicar/borrar lecciones, importar/exportar JSON, ícono SVG por lección, lista "Activas ahora", reportes.
- **13 tipos de pregunta**: opción múltiple, selección múltiple, V/F, completa espacios, desplegable, respuesta abierta, reordenar, relacionar, categorizar, arrastra y suelta, tabla de relleno, cuadrícula coincidente, texto interactivo. Más **texto de lectura** (`passage`) y **explicación** (`explanation`) opcionales en cualquier pregunta. Crédito parcial donde aplica.
- **Modo en vivo**: lobby con PIN/link, temporizador, puntaje por velocidad + racha, ranking animado, distribución de respuestas, entrada tardía, podio con suspenso/confeti/sonidos, vista proyector. **Modo automático** (tras cada reveal avanza solo; pausa 5/8/12/20 s + tiempo para leer la explicación; pausar/saltar). Reveal en el celular: posición, puntos, distancia al de arriba, respuesta correcta solo a quien falló, explicación, ranking con la fila propia.
- **Modo tarea**: cada estudiante a su ritmo, ve la solución al responder, panel del profe con progreso y preguntas difíciles, "Cerrar tarea", persistida en SQLite (sobrevive reinicios).
- **Reportes**: foto por partida/tarea (estudiantes × preguntas), preguntas más difíciles, exportar CSV (`;` + BOM). Sobreviven a "Eliminar" la sala.
- **Identidad visual**: noche + neón, sticker/borde grueso, Bricolage Grotesque + DM Sans, **sin emojis en la UI** (todo SVG vía `client/src/icons.tsx`), formas + color en las respuestas.
- **Avatares**: 40 webp de ChatGPT en `public/avatars/` (servidos en vivo, sin recompilar; squircle; los ya elegidos salen atenuados); 12 pixel art en código como respaldo (`pixel.tsx`).
- **Robustez**: `ErrorBoundary`, `uid()`/`copyText()` para contextos inseguros (la app se abre por `http://192.168.x.x`), login con contraseña + 2FA y cookie de sesión (ver "Seguridad" en AGENTS.md).
- **Guía de clase**: `GUIA-CLASE.md` (túnel, token, `PUBLIC_URL`, reportes, modos). Prompt de avatares: `docs/prompt-avatares.md`.
- **Pruebas**: `pnpm typecheck`, `pnpm test` (unit + vigilante de contexto inseguro), `pnpm test:live` (3 pruebas de humo: vivo, tarea, automático; requiere API en :3000 y deja la base limpia).

## Qué falta: DÍA 7 = pulido, responsive y prueba con un grupo real

### 1. Verificaciones que NUNCA se han hecho (prioridad alta)
- [ ] **Cloudflare Tunnel real**: `cloudflared` no está probado. Seguir `GUIA-CLASE.md` y abrir el link público desde un celular con **datos móviles**. Cambiar `ADMIN_TOKEN`.
- [ ] **Dedos reales**: arrastre (reordenar, categorizar, arrastra y suelta) y escritura (huecos, tabla) en un celular físico, Android e iPhone. En iOS revisar zoom al enfocar inputs (<16 px) y alturas `dvh`.
- [ ] **Carga**: `pnpm bots <PIN> 30` en vivo y en tarea; revisar fluidez, orden del ranking con 30+ y el proyector a 1080p.
- [ ] **Sonido** (nunca se ha oído, solo se probó que no rompa) y **confeti/podio** a ojo humano.
- [ ] **CSV** abierto en Excel/Sheets en español (tildes y separador `;`).
- [ ] Panda pixel (respaldo) feo; solo importa si se vacía `public/avatars/`.

### 2. Pulido sugerido
- Revisión de **responsive**: 360 px (celular chico), tablet y proyector; textos cortados, tablas anchas (`table`, `grid`) y editor en móvil.
- **Accesibilidad**: foco visible con teclado, contraste de textos sobre neón, `aria-live` en cambios de fase, `prefers-reduced-motion`.
- Estados de carga/error/vacío en dashboard, editor, reportes.
- **Host**: atajos de teclado (espacio = siguiente), expulsar a un jugador (hoy no existe) y nombres repetidos/inapropiados.
- Mensaje "Se acabó el tiempo" cuando la respuesta llega justo tarde (hoy dice "Uy, esta no").
- Copia de seguridad: documentar copiar `data/quizarena.db`.
- Opcional: QR en el lobby, buscador de lecciones, sonidos más pulidos.

### 3. Deuda conocida (ver también AGENTS.md)
- Las partidas **en vivo** viven en memoria (se pierden al reiniciar; tareas y reportes no).
- El token viaja en cabecera `x-admin`: suficiente para uso personal sobre HTTPS, no para más.
- Los avatares de 512 px pesan ~30 KB c/u; si hace falta, generar miniaturas (sin dependencias nativas).

## Trampas ya conocidas (ahorran tiempo)
- **No matar los procesos del usuario**: él corre `pnpm dev` (API :3000 + Vite :5173). `pnpm start` falla con EADDRINUSE; las pruebas de humo funcionan igual contra la API de su `pnpm dev`. Para probar el build compilado hay que pedirle que pare su dev o usar `PORT`.
- **Hooks del entorno** bloquean `curl` y `node -e fetch(...)` en Bash: para llamar a la API usar el `javascript_tool` del navegador (`fetch` same-origin, con la sesión del navegador) o scripts `.ts` con `tsx` que importen `server/test-auth.ts` (login con `.env`).
- **Heredoc de Python**: las barras invertidas se "reducen" a la mitad; evitar `\n`/`\S` en cadenas de reemplazo (usar `chr(10)`, escribir archivos con la herramienta Write).
- **`DELETE` sin cuerpo** no debe llevar `content-type: application/json` (Fastify responde 400).
- **Limpieza**: tras probar, borrar salas y reportes de prueba (`DELETE /api/rooms/:pin`, `/api/reports/:id`) y lecciones de prueba; `closeRoom` vuelve a guardar el reporte de una partida en vivo (borrar la sala **antes** del reporte).
- **Capturas del navegador integrado**: salen atenuadas si se toman a mitad de una animación de entrada; el viewport móvil emulado a veces duplica o amplía la captura. Verificar con `javascript_tool` (DOM) antes de culpar a la app.
- Probar siempre también desde **`http://IP-LAN`** (contexto inseguro), no solo `localhost`.

## Preferencias del usuario
Español informal ("bro"). Quiere calidad y personalidad visual, nada genérico; **cero emojis en la interfaz** (SVG), **solo pnpm**, diseño pensado para jóvenes. Prefiere que se le diga qué quedó sin verificar. Trabajo mínimo y reutilizando lo existente (modo "ponytail"): una verificación ejecutable por lógica no trivial.

## Cómo arrancar el nuevo chat
1. Abrir el chat en la carpeta `D:\QuizArena`.
2. Decir: *"Lee CONTEXTO-DIA-7.md y AGENTS.md y arranquemos el día 7. Empieza por las verificaciones de la sección 1 que puedas hacer tú (carga con bots, responsive, accesibilidad) y dime cuáles tengo que hacer yo en dispositivos reales."*
