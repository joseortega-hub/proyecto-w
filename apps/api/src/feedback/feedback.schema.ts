import { z } from 'zod';

export const FEEDBACK_KINDS = ['error', 'idea', 'mejora'] as const;
export const FEEDBACK_STATUSES = ['new', 'read', 'done'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/** Límites pensados para el cuerpo JSON de 1 MB (body-limit.ts): la web comprime antes de enviar. */
export const MAX_MESSAGE = 2000;
export const MAX_IMAGES = 3;
/** ~225 kB por imagen una vez decodificada. */
export const MAX_IMAGE_CHARS = 300_000;
export const MAX_TOTAL_IMAGE_CHARS = 800_000;

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

const imageSchema = z.object({
  type: z.enum(['image/jpeg', 'image/webp', 'image/png']),
  data: z
    .string()
    .max(MAX_IMAGE_CHARS, 'La imagen es demasiado grande')
    .refine((d) => d.length % 4 === 0 && BASE64.test(d), 'La imagen no es base64 válido'),
});

export const createFeedbackSchema = z
  .object({
    kind: z.enum(FEEDBACK_KINDS),
    message: z.string().trim().min(3, 'Cuéntanos algo más').max(MAX_MESSAGE),
    screen: z.string().trim().max(300).optional(),
    domainId: z.string().trim().max(40).optional(),
    context: z.record(z.string().max(40), z.union([z.string().max(300), z.number()])).optional(),
    images: z.array(imageSchema).max(MAX_IMAGES, `Como mucho ${MAX_IMAGES} imágenes`).default([]),
  })
  .refine((f) => f.images.reduce((n, i) => n + i.data.length, 0) <= MAX_TOTAL_IMAGE_CHARS, {
    message: 'Las imágenes ocupan demasiado entre todas',
    path: ['images'],
  });

export type CreateFeedback = z.infer<typeof createFeedbackSchema>;

export const statusSchema = z.object({ status: z.enum(FEEDBACK_STATUSES) });
