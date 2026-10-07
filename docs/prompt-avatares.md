# Prompt para generar avatares de animalitos (pixel art)

Cómo usarlo: abre **un solo chat** nuevo en ChatGPT (con generación de imágenes), pega el **PROMPT MAESTRO** una vez y luego pide los avatares de la lista de uno en uno ("hazme el 1", "hazme el 2"...). Mantener todo en el mismo chat ayuda a que el estilo salga parejo.

Guarda cada imagen con un nombre corto sin espacios (`zorro-gafas.png`) y suéltala en `D:\QuizArena\public\avatars\`. Aparecen solas en el selector de los estudiantes (no hace falta reiniciar nada). No necesitas redimensionarlas: la app las recorta en círculo y las muestra con píxeles nítidos.

## PROMPT MAESTRO (pégalo una vez)

```
Vas a generar una colección de avatares de animales en PIXEL ART para una app de quizzes para adolescentes. Todos deben compartir EXACTAMENTE el mismo estilo:

- Pixel art estilo 16-bit, con píxeles gruesos y bien definidos (se nota la cuadrícula, nada de suavizado ni degradados).
- Paleta limitada y saturada (máx. ~12 colores por imagen), colores vivos tipo neón: lima, rosa, cian, amarillo, violeta, naranja.
- Contorno oscuro de 1 píxel (azul casi negro #1a1033) alrededor del personaje.
- Encuadre: cabeza y hombros (busto), de frente o ligeramente ladeado, centrado y grande, ocupando ~80% del cuadro.
- Fondo: un único color plano y pastel (distinto en cada imagen), sin degradados, sin marco, sin sombra proyectada, sin texto, sin marcas de agua.
- Formato cuadrado 1:1, 1024x1024.
- Personalidad: graciosos, con actitud, expresivos, un poco locos. Nada violento ni inapropiado. Aptos para un salón de clase.

Para cada avatar te daré: ANIMAL + ACCESORIO + POSE. Genera una sola imagen por mensaje y no escribas texto aparte. Si lo entiendes, responde solo "Listo" y espera el primero.
```

## Plantilla por avatar

```
Avatar #N: [ANIMAL] con [ACCESORIO], [POSE / EXPRESIÓN]. Mismo estilo que los anteriores.
```

## 40 combinaciones para empezar

| # | Animal | Accesorio | Pose / expresión |
|---|---|---|---|
| 1 | zorro | gafas de sol redondas | señal de paz con la mano |
| 2 | gato gris | sombrero de fiesta | lengua afuera, ojos cerrados |
| 3 | oso pardo | gorro de chef | sosteniendo una pizza |
| 4 | panda | auriculares gamer | pulgar arriba |
| 5 | conejo | corona dorada torcida | guiño y sonrisa |
| 6 | rana | sombrero de mago | sacando la lengua larga |
| 7 | búho | birrete de graduación | leyendo un libro |
| 8 | pingüino | bufanda a rayas | saludando con la aleta |
| 9 | cerdito | antifaz de superhéroe y capa | puño al frente, volando |
| 10 | tigre | bandana roja | brazos cruzados, cara de malote |
| 11 | pollito | casco de astronauta | flotando, asombrado |
| 12 | ratón | bigote falso gigante | comiendo un queso |
| 13 | perro salchicha | gorro de pirata y parche | ladrando "arr" |
| 14 | koala | corona de flores | abrazando una ramita de eucalipto |
| 15 | mapache | antifaz de ladrón y gorra | sosteniendo una dona |
| 16 | jirafa | corbatín de lunares | cuello larguísimo, sonrisa tímida |
| 17 | elefante | sombrero de copa y monóculo | levantando la trompa como saludo |
| 18 | león | melena con rulos y gafas de sol | rugido de estrella de rock |
| 19 | mono | gorra de béisbol al revés | comiendo una banana |
| 20 | tiburón | gorro de natación y gafas | sonrisa dientona, aleta arriba |
| 21 | pulpo | cuatro sombreros apilados | cada tentáculo haciendo algo distinto |
| 22 | dinosaurio T-rex | gafas 3D | brazos cortitos haciendo "yeah" |
| 23 | unicornio | audífonos y brillos | guiñando, con arcoíris de fondo |
| 24 | murciélago | gafas de aviador | colgado de cabeza, sonriendo |
| 25 | zorrillo | boina de pintor | sosteniendo un pincel |
| 26 | capibara | sombrero de paja | relajado, con una naranja en la cabeza |
| 27 | llama | sombrero andino y ponchito | escupiendo corazones, divertida |
| 28 | tortuga | casco de skate | dando una vuelta en skate |
| 29 | cocodrilo | corbata y maletín | cara de jefe serio |
| 30 | hámster | cachetes llenos de semillas | ojos enormes brillantes |
| 31 | flamenco | gafas de corazón | en una pata, pose elegante |
| 32 | lobo | capucha de abrigo | aullando a la luna |
| 33 | ardilla | gafas de buzo | sosteniendo una bellota gigante |
| 34 | alpaca | bufanda de arcoíris | cara de "no me importa nada" |
| 35 | abeja | antenas con corazones | volando con un tarro de miel |
| 36 | cangrejo | sombrero de playa | tijeras arriba, celebrando |
| 37 | axolote | corona de flores | sonrisa tierna, branquias rosadas |
| 38 | gallo | gorro de cocinero | cantando con el pico abierto |
| 39 | oveja | sombrero vaquero | lazo en una pezuña |
| 40 | cuy | auriculares y micrófono | cantando a todo pulmón |

## Consejos

- Si un resultado sale distinto al resto, di: "rehazlo con el mismo estilo exacto que el #1".
- Si ChatGPT te deja pedir fondo transparente, también sirve; si no, el fondo de color plano queda bonito dentro del círculo.
- Para más variedad pídele a ChatGPT: "dame 20 combinaciones nuevas de animal + accesorio + pose, más locas que estas", y sigue el mismo proceso.
- Si metes muchos (30–40), el selector de los estudiantes hace scroll. Cuando hay avatares en la carpeta, el selector ofrece solo esos (los dibujados en código quedan de respaldo). En una partida, el avatar que ya eligió un compañero sale atenuado para que no se repitan.
