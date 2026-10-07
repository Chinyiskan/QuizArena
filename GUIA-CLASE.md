# Guía de clase: del computador a los celulares

Todo corre en tu laptop. Los estudiantes entran por una URL pública que crea Cloudflare Tunnel (gratis, sin cuenta). **La laptop debe estar encendida y con el servidor corriendo mientras dure la clase o la tarea.**

> **Atajo: `pnpm clase`** hace todo lo de abajo en un paso (compila, túnel, servidor y te da el link).

## 1. Una sola vez

- Instala `cloudflared`: `winget install Cloudflare.cloudflared` (descarga el programa de Cloudflare; hazlo tú).
- Opcional: suelta los avatares (PNG/JPG/WebP) en `public/avatars/`.

## 2. Cada clase

En una terminal (PowerShell), dentro de `D:\QuizArena`:

```powershell
pnpm build   # tu contraseña (y el 2FA) viven en .env; ver "Login del profe" abajo
pnpm start
```

En **otra** terminal:

```powershell
cloudflared tunnel --url http://localhost:3000
```

Cloudflare imprime una URL tipo `https://algo-raro.trycloudflare.com`. Esa es la dirección pública.

## 3. Abre TU dashboard desde la URL pública

Entra a `https://algo-raro.trycloudflare.com/admin` (no a `localhost`) con tu contraseña (y el código 2FA si lo activaste). Así el link que copias en el lobby ya sale con la dirección correcta. Si prefieres entrar por `localhost`, define `PUBLIC_URL` antes de `pnpm start`:

```powershell
$env:PUBLIC_URL = "https://algo-raro.trycloudflare.com"
```

## 4. Elegir el modo

- **Lanzar 🚀** (en vivo): tú controlas el ritmo, hay temporizador y ranking. Proyecta tu pantalla o no: los estudiantes ven todo en su celular.
- **Tarea 📝**: cada estudiante avanza a su ritmo, sin reloj, y ve la respuesta correcta al contestar. Tu panel muestra quién va por dónde y qué preguntas costaron más. Las tareas **sobreviven si reinicias el servidor** y se listan en "Activas ahora" del dashboard. Ciérralas con "Cerrar tarea" cuando quieras que ya no se responda.

> En vivo puedes elegir **Manual** (tú avanzas con "Siguiente") o **Automático**: tras cada pregunta se muestran unos segundos la tabla, la posición de cada estudiante, la respuesta correcta y la explicación, y sigue solo. Puedes pausarlo cuando quieras. Escribe la explicación de cada pregunta en el editor para aprovecharlo.

## 5. Después de la clase: Reportes

En el dashboard, **Reportes** guarda solo el resultado de cada partida o tarea: una tabla de estudiantes × preguntas (verde = bien, amarillo = parcial, rojo = mal, vacío = no participó), qué preguntas costaron más y un botón **Exportar CSV** para Excel o Sheets. Los reportes **no se borran** al eliminar la partida o la tarea.

## 6. Antes de la clase (2 minutos)

1. Abre el link público desde tu **celular con datos móviles** (no con el wifi de casa) para confirmar que se ve desde fuera.
2. Prueba con bots si quieres ver el panel lleno: `pnpm bots <PIN> 20`.

## Cosas que conviene saber

- La URL gratuita **cambia cada vez** que reinicias `cloudflared`. Si reinicias el túnel, manda el link nuevo. (Una URL fija requiere un dominio propio en Cloudflare.)
- Si cierras el servidor con una partida **en vivo** abierta, se pierde; las **tareas** no.
- Cualquiera con la URL puede entrar a `/play`, pero solo tú (contraseña + 2FA) puedes usar `/admin`.

## Login del profe (contraseña + 2FA)

- `.env` (no se sube a git) guarda `ADMIN_PASSWORD` y, opcional, `ADMIN_TOTP_SECRET`. Sin contraseña de 12+ caracteres el servidor **no arranca**.
- Credenciales nuevas: `pnpm totp` imprime una contraseña y una clave 2FA. Agrega la clave en Google Authenticator / Aegis / 2FAS ("Introducir clave", por tiempo) y pégalas en `.env`. Reinicia el servidor.
- La sesión dura 12 h en una cookie segura; "Salir" en el dashboard la cierra. Reiniciar el servidor también cierra la sesión.
- 5 intentos fallidos bloquean el login 15 min (por IP).
