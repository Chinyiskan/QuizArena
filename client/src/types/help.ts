import type { TypeId } from '../../../shared/questions.ts'

/** Ayuda de cada tipo, para el tooltip del editor: qué es, cómo responde el estudiante y cómo se escribe. */
export const TYPE_HELP: Record<TypeId, { what: string; how: string; tip: string }> = {
  mcq: { what: 'Una sola respuesta correcta entre 2 y 6 opciones.', how: 'Toca una opción.', tip: 'Marca el círculo de la correcta.' },
  multi: { what: 'Varias respuestas correctas a la vez.', how: 'Marca todas las que apliquen y confirma.', tip: 'Crédito parcial si acierta solo algunas.' },
  tf: { what: 'Una afirmación que es verdadera o falsa.', how: 'Toca Verdadero o Falso.', tip: 'Redacta la afirmación sin ambigüedad.' },
  fill: { what: 'Un texto con huecos que se escriben.', how: 'Escribe la palabra de cada hueco.', tip: 'Pon los huecos entre [corchetes]; alternativas con |, como [París|paris].' },
  dropdown: { what: 'Texto con huecos que se eligen de un menú.', how: 'Elige la opción de cada menú.', tip: 'Escribe [correcta|mala1|mala2]: la primera es la correcta.' },
  blocks: { what: 'Armar un programa con bloques desordenados, como en Scratch.', how: 'Toca los bloques en orden y ajusta la sangría.', tip: 'Pega el código que funciona; cada línea es un bloque. Puedes añadir bloques que sobran.' },
  order: { what: 'Poner elementos en el orden correcto.', how: 'Arrastra (o toca y mueve) cada ficha.', tip: 'Escríbelos en el orden correcto; se barajan solos.' },
  match: { what: 'Unir cada elemento con su pareja.', how: 'Toca el elemento y luego su pareja.', tip: 'Crédito parcial por cada pareja bien.' },
  sort: { what: 'Clasificar elementos en categorías.', how: 'Arrastra cada ficha a su categoría.', tip: 'Máx. 4 categorías y 12 elementos; sin repetidos.' },
  drag: { what: 'Completar un texto arrastrando palabras a los huecos.', how: 'Arrastra o toca la palabra y luego el hueco.', tip: 'Agrega distractores para que no sea obvio.' },
  table: { what: 'Una tabla con celdas por completar.', how: 'Escribe en cada celda vacía.', tip: 'Los huecos van entre [corchetes] dentro de las celdas.' },
  grid: { what: 'Cada fila se asigna a una columna (tipo Sí/No/Depende).', how: 'Toca la columna que corresponde a cada fila.', tip: 'Ideal para clasificar casos con las mismas opciones.' },
  tap: { what: 'Tocar las palabras correctas dentro de un texto.', how: 'Toca las palabras que cumplen la consigna.', tip: 'Marca las correctas con [corchetes]; tocar de más resta.' },
  open: { what: 'Respuesta corta escrita por el estudiante.', how: 'Escribe la respuesta.', tip: 'Agrega varias respuestas válidas; no distingue mayúsculas ni tildes.' },
}
