import { createFeedbackSchema, MAX_IMAGE_CHARS, MAX_IMAGES } from './feedback.schema.js';
import { folderName, formatFeedback, imageFileName } from './feedback.format.js';

const png = 'iVBORw0KGgo=';

describe('buzón: validación', () => {
  it('acepta un comentario con imágenes pequeñas y rellena lo que falta', () => {
    const parsed = createFeedbackSchema.parse({ kind: 'error', message: '  El vídeo se queda colgado  ', screen: '/music/biblioteca' });
    expect(parsed.message).toBe('El vídeo se queda colgado');
    expect(parsed.images).toEqual([]);
    expect(createFeedbackSchema.safeParse({ kind: 'idea', message: 'Modo karaoke', images: [{ type: 'image/jpeg', data: png }] }).success).toBe(true);
  });

  it('rechaza tipos raros, textos vacíos, demasiadas imágenes o imágenes enormes', () => {
    expect(createFeedbackSchema.safeParse({ kind: 'queja', message: 'Hola hola' }).success).toBe(false);
    expect(createFeedbackSchema.safeParse({ kind: 'idea', message: '   ' }).success).toBe(false);
    const many = Array.from({ length: MAX_IMAGES + 1 }, () => ({ type: 'image/png', data: png }));
    expect(createFeedbackSchema.safeParse({ kind: 'idea', message: 'Muchas fotos', images: many }).success).toBe(false);
    const big = 'A'.repeat(MAX_IMAGE_CHARS + 4);
    expect(createFeedbackSchema.safeParse({ kind: 'idea', message: 'Una enorme', images: [{ type: 'image/png', data: big }] }).success).toBe(false);
    expect(createFeedbackSchema.safeParse({ kind: 'idea', message: 'No es base64', images: [{ type: 'image/png', data: 'no vale!' }] }).success).toBe(false);
  });

  it('limita el total de las imágenes por debajo del cuerpo JSON', () => {
    const near = 'A'.repeat(MAX_IMAGE_CHARS - (MAX_IMAGE_CHARS % 4));
    const images = Array.from({ length: MAX_IMAGES }, () => ({ type: 'image/jpeg', data: near }));
    expect(createFeedbackSchema.safeParse({ kind: 'mejora', message: 'Tres grandes', images }).success).toBe(false);
  });
});

describe('buzón: pnpm feedback', () => {
  const row = {
    id: 'ab12cd34-0000-4000-8000-000000000000',
    kind: 'error',
    message: 'La ficha se rompe al bajar',
    screen: '/games/biblioteca/1',
    domainId: 'games',
    context: { layout: 'dock', viewport: '390x844' },
    images: [{ type: 'image/webp' as const, data: png }],
    status: 'new',
    createdAt: new Date('2026-10-25T18:30:00Z'),
  };

  it('nombra carpetas e imágenes de forma estable', () => {
    expect(folderName(row)).toBe('2026-10-25_1830_ab12cd34');
    expect(imageFileName(row.images[0], 0)).toBe('1.webp');
  });

  it('resume cada comentario en Markdown con sus imágenes', () => {
    const text = formatFeedback(row, ['data/privado/buzon/2026-10-25_1830_ab12cd34/1.webp']);
    expect(text).toContain('## Error · NUEVO · 2026-10-25 18:30 UTC');
    expect(text).toContain('pantalla: /games/biblioteca/1 · temática: games');
    expect(text).toContain('layout: dock · viewport: 390x844');
    expect(text).toContain('La ficha se rompe al bajar');
    expect(text).toContain('- imagen: data/privado/buzon/2026-10-25_1830_ab12cd34/1.webp');
  });
});
