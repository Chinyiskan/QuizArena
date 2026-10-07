// Crea una lección de ejemplo para probar rápido: npm run seed
import { lessons } from './db.ts'

lessons.save({
  title: 'Present Perfect',
  emoji: 'hourglass',
  questions: [
    { id: '1', type: 'mcq', prompt: 'She ___ to Paris twice.', time: 20, points: 1000, explanation: 'Con "twice" (dos veces) usamos el present perfect: has + participio. Con "she" va "has".', data: { options: ['has been', 'have been', 'was', 'is going'], correct: 0 } },
    { id: '2', type: 'tf', prompt: '"I have seen him yesterday" is correct.', time: 15, points: 1000, explanation: '"Yesterday" marca un momento terminado del pasado: ahí se usa el pasado simple (saw), no el present perfect.', data: { correct: false } },
    { id: '3', type: 'multi', prompt: 'Pick the past participles', time: 20, points: 1000, explanation: 'Los participios son gone y done. Went y did son pasados simples.', data: { options: ['gone', 'went', 'done', 'did'], correct: [0, 2] } },
    { id: '4', type: 'fill', prompt: 'Complete the sentence', time: 25, points: 1000, data: { text: 'I [have|’ve] already [seen] that movie.' } },
    { id: '5', type: 'dropdown', prompt: 'Choose the right words', time: 25, points: 1000, data: { text: 'She [has|have|is] [been|be|was] to Paris twice.' } },
    { id: '7', type: 'order', prompt: 'Order the verb forms', time: 30, points: 1000, explanation: 'Orden de las formas: base (go), pasado (went), participio (gone).', data: { items: ['go', 'went', 'gone'] } },
    { id: '8', type: 'match', prompt: 'Match the verb with its past participle', time: 30, points: 1000, data: { pairs: [{ left: 'write', right: 'written' }, { left: 'eat', right: 'eaten' }, { left: 'see', right: 'seen' }] } },
    { id: '9', type: 'sort', prompt: 'Regular or irregular?', time: 40, points: 1000, data: { cats: [{ name: 'Regular', items: ['walk', 'play', 'work'] }, { name: 'Irregular', items: ['go', 'eat'] }] } },
    { id: '10', type: 'drag', prompt: 'Drag the words into the sentence', time: 30, points: 1000, data: { text: 'She [has] already [finished] her homework.', extra: ['have', 'finish'] } },
    { id: '11', type: 'table', prompt: 'Complete the table', time: 40, points: 1000, data: { header: true, rows: [['Verb', 'Past', 'Participle'], ['go', 'went', '[gone]'], ['eat', '[ate]', '[eaten]'], ['see', '[saw]', 'seen']] } },
    { id: '12', type: 'grid', prompt: 'Regular or irregular?', time: 40, points: 1000, data: { cols: ['Regular', 'Irregular'], rows: [{ text: 'walk', correct: 0 }, { text: 'go', correct: 1 }, { text: 'play', correct: 0 }, { text: 'eat', correct: 1 }] } },
    { id: '13', type: 'tap', prompt: 'Tap the verbs', time: 30, points: 1000, data: { text: 'The cat [sat] on the mat while the dog [ran] in the garden.' } },
    { id: '14', type: 'mcq', prompt: 'How many times has Mia visited Cusco?', passage: 'Mia has lived in Lima since 2019. She has visited Cusco twice and Arequipa once, but she has never been to Iquitos.', time: 30, points: 1000, data: { options: ['Once', 'Twice', 'Never', 'Three times'], correct: 1 } },
    { id: '6', type: 'open', prompt: 'Past participle of "write"', time: 20, points: 1000, data: { answers: ['written'] } },
  ],
}, 'demo') // id fijo: correr el seed de nuevo actualiza la misma lección
console.log('lección de ejemplo creada')
