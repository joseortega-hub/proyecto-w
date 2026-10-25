import type { FeedbackImage } from '../db/schema.js';

export interface FeedbackRow {
  id: string;
  kind: string;
  message: string;
  screen: string | null;
  domainId: string | null;
  context: Record<string, string | number>;
  images: FeedbackImage[];
  status: string;
  createdAt: Date;
}

const EXT: Record<FeedbackImage['type'], string> = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' };
const KIND: Record<string, string> = { error: 'Error', idea: 'Idea', mejora: 'Mejora' };

/** Carpeta de cada comentario: fecha y el principio del id ("2026-10-25_1830_ab12cd34"). */
export function folderName(row: Pick<FeedbackRow, 'id' | 'createdAt'>) {
  const d = row.createdAt.toISOString();
  return `${d.slice(0, 10)}_${d.slice(11, 13)}${d.slice(14, 16)}_${row.id.slice(0, 8)}`;
}

/** Nombre de archivo de cada imagen ("1.jpg", "2.webp"…). */
export const imageFileName = (image: FeedbackImage, index: number) => `${index + 1}.${EXT[image.type] ?? 'bin'}`;

/** Bloque en Markdown de un comentario, con las rutas de sus imágenes ya guardadas. */
export function formatFeedback(row: FeedbackRow, imagePaths: string[]) {
  const ctx = Object.entries(row.context)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
  return [
    `## ${KIND[row.kind] ?? row.kind}${row.status === 'new' ? ' · NUEVO' : ''} · ${row.createdAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    `- id: ${row.id}`,
    `- pantalla: ${row.screen ?? '—'}${row.domainId ? ` · temática: ${row.domainId}` : ''}`,
    ctx ? `- contexto: ${ctx}` : null,
    '',
    row.message,
    '',
    ...imagePaths.map((p) => `- imagen: ${p}`),
  ]
    .filter((l) => l !== null)
    .join('\n');
}
