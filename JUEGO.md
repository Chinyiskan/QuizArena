# QuizArena: cómo se juega

El profe crea lecciones en `/admin`, lanza una partida y comparte el link `/play/PIN`. Los estudiantes entran desde el celular con nombre y avatar. Sin cuentas.

## Modos de partida

| Modo | Cómo funciona |
|---|---|
| **En vivo** | Todos juegan a la vez. El servidor lleva el reloj y avanza por fases: lobby → pregunta → reveal → podio. |
| **Tarea** | Sin reloj ni fases. Cada estudiante avanza a su ritmo, ve la solución al responder cada pregunta y el profe sigue el progreso en un panel. Se puede cerrar con "bloquear". |

Se puede entrar tarde a una partida en vivo (mientras no esté en el podio): empiezas con 0 puntos.

## Estilos (solo en vivo)

- **Clásico**: sin poderes, solo puntos.
- **Poderes** (por defecto): al responder puedes ganar un poder de un solo uso.
  - **Doble**: tus puntos x2.
  - **Escudo**: conserva la racha y te protege de robos.
  - **50/50**: quita opciones (solo en opción múltiple).
  - **Robo**: si aciertas rápido, le quitas puntos al 1.º.
  - **Apuesta**: si aciertas, x3; si fallas, pierdes los puntos de la pregunta.
- **Papa caliente**: en cada pregunta hay bombas escondidas entre los jugadores (nadie sabe quién la tiene). Si tienes bomba y no aciertas del todo, explotas y pasas a mirar. Si aciertas, la desactivas. Gana quien se queda en pie.

## Puntaje

- Más puntos por responder rápido y por acertar.
- **Racha**: acertar seguido sube el bono. Solo cuentan las respuestas perfectas.
- **Crédito parcial**: en tipos con varias partes se puntúa proporcional a lo acertado.
- En tarea no hay bono de velocidad, pero sí racha.

## Control del profe

- **Manual**: el profe pulsa "Siguiente" (o barra espaciadora).
- **Automático**: avanza solo tras unos segundos más el tiempo de leer la explicación.
- Panel en vivo con quién contestó, quién acertó, respuestas más comunes, y la respuesta correcta (solo la ve el profe).
- Puede sacar a un jugador con la X.
- Al terminar queda un **reporte** con resultados por estudiante y por pregunta, exportable a CSV.

## Tipos de pregunta (13)

**Elegir**
- **Opción múltiple** (`mcq`): una respuesta correcta entre varias.
- **Selección múltiple** (`multi`): varias respuestas correctas.
- **Verdadero / Falso** (`tf`).

**Escribir**
- **Respuesta abierta** (`open`): el estudiante escribe; se ignoran mayúsculas, tildes y espacios.
- **Completa espacios** (`fill`): texto con huecos `[así]`; admite varias respuestas válidas por hueco.
- **Menú desplegable** (`dropdown`): huecos donde se elige de una lista.
- **Tabla de relleno** (`table`): tabla con huecos en las celdas.

**Mover y unir**
- **Arrastra y suelta** (`drag`): llenar huecos con fichas de un banco (con distractores).
- **Reordenar** (`order`): poner elementos en el orden correcto.
- **Relacionar** (`match`): emparejar izquierda con derecha (se toca, no se arrastra).
- **Categorizar** (`sort`): meter elementos en categorías.

**Observar**
- **Cuadrícula coincidente** (`grid`): por cada fila, elegir la columna que corresponde.
- **Texto interactivo** (`tap`): tocar las palabras correctas dentro de un texto (los errores restan).

## Extras en cualquier pregunta

- **Lectura** (`passage`): un texto que se muestra sobre la pregunta.
- **Código** (`code`): bloque de código con resaltado y números de línea.
- **Explicación**: se muestra después de responder.

## Ambiente

Sonido y música (los estudiantes los oyen por defecto; el profe no, porque juegan por Meet), podio con suspenso y confeti, avatares propios del profe en `public/avatars/`.
