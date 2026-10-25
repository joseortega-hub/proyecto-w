// "Mi carpeta": estado de la carpeta del dispositivo, importación por lotes y revisión de nombres.
// La importación vive fuera de React para que siga si se cambia de pantalla.
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { api, type FolderAudioInput, type FolderStatus, type FolderTrackInput } from './api'
import { AUDIO_VERSION, canAnalyzeAudio, createAnalyzer, decodeWindow } from './audio-analysis'
import {
  allLocalFiles,
  folderPermission,
  forgetHandle,
  localFileCount,
  pickFolder,
  songsOnlyDevice,
  readTags,
  recallHandle,
  registerFiles,
  rememberHandle,
  scanHandle,
  type LocalAudio,
} from './local-files'

/** El servidor acepta 12 archivos por petición; MusicBrainz limita a 1 por segundo. */
const BATCH = 8

export type FolderPhase = 'idle' | 'importing' | 'finishing' | 'done' | 'error'

export interface FolderState {
  /** Carpeta en memoria: lista para sonar. `needs-permission`: recordada pero hay que pulsar para dar permiso. */
  access: 'unknown' | 'none' | 'needs-permission' | 'ready'
  folderName: string | null
  /** Audios encontrados en el dispositivo. */
  found: number
  phase: FolderPhase
  step: string
  done: number
  total: number
  error?: string
  /** Análisis del sonido en el dispositivo (Essentia.js), aparte de la identificación. */
  audio: AudioState
}

export interface AudioState {
  phase: 'idle' | 'running' | 'done' | 'unsupported' | 'error'
  done: number
  total: number
  /** Archivos que el navegador no ha podido decodificar (formato raro, demasiado grandes…). */
  failed: number
}

const audioIdle: AudioState = { phase: 'idle', done: 0, total: 0, failed: 0 }
let state: FolderState = { access: 'unknown', folderName: null, found: 0, phase: 'idle', step: '', done: 0, total: 0, audio: audioIdle }
const listeners = new Set<() => void>()
const set = (patch: Partial<FolderState>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l))

export const useFolderState = () => useSyncExternalStore(subscribe, () => state)
export const folderState = () => state

let handleRef: Awaited<ReturnType<typeof recallHandle>> = null

/** Al abrir "Mi carpeta": recupera la carpeta recordada; sin permiso previo, espera un clic. */
export async function restoreFolder() {
  if (state.access !== 'unknown') return
  handleRef = await recallHandle()
  if (!handleRef) return set({ access: 'none' })
  set({ folderName: handleRef.name })
  if (await folderPermission(handleRef, false).catch(() => false)) await loadHandle()
  else set({ access: 'needs-permission' })
}

async function loadHandle() {
  if (!handleRef) return
  const files = await scanHandle(handleRef)
  registerFiles(files)
  set({ access: 'ready', found: files.length })
  return files
}

/** Desde un clic: pide de nuevo el permiso sobre la carpeta recordada. */
export async function reconnectFolder() {
  if (!handleRef || !(await folderPermission(handleRef, true))) return false
  await loadHandle()
  return true
}

/** Desde un clic: elige la carpeta, la recuerda si el navegador deja y devuelve cuántos audios hay. */
export async function chooseFolder(): Promise<LocalAudio[] | null> {
  const picked = await pickFolder()
  if (!picked) return null
  // En móvil se van sumando canciones sueltas; con una carpeta, la elegida sustituye a la anterior.
  const files = songsOnlyDevice() ? [...new Map([...allLocalFiles(), ...picked.files].map((f) => [f.key, f])).values()] : picked.files
  registerFiles(files)
  handleRef = picked.handle ?? null
  if (picked.handle) await rememberHandle(picked.handle)
  else await forgetHandle()
  set({ access: 'ready', folderName: picked.name, found: files.length })
  return files
}

export async function forgetFolder() {
  await forgetHandle()
  handleRef = null
  registerFiles([])
  stopAudio()
  set({ access: 'none', folderName: null, found: 0, phase: 'idle', step: '', done: 0, total: 0, error: undefined, audio: audioIdle })
}

const fileName = (key: string) => key.slice(0, key.lastIndexOf('|')).split('/').pop() ?? key
const pool = async <T, R>(list: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> => {
  const out: R[] = []
  for (let i = 0; i < list.length; i += size) out.push(...(await Promise.all(list.slice(i, i + size).map(fn))))
  return out
}

let running = false

/**
 * Identifica en el servidor los audios que aún no conoce: etiquetas ID3 aquí, el resto
 * (IA + MusicBrainz) allí, por lotes, y al final termina atributos y embeddings pendientes.
 * Es reanudable: solo envía las claves que el servidor no tiene.
 */
export async function importFolder(files: LocalAudio[], queryClient: QueryClient) {
  if (running) return
  running = true
  try {
    set({ phase: 'importing', step: 'Mirando qué canciones son nuevas', done: 0, total: 0, error: undefined })
    const known = new Set(await api.folderKeys())
    const fresh = files.filter((f) => !known.has(f.key))
    set({ total: fresh.length })
    for (let i = 0; i < fresh.length; i += BATCH) {
      set({ step: `Identificando tus canciones (${i}/${fresh.length})`, done: i })
      const batch = fresh.slice(i, i + BATCH)
      const tracks: FolderTrackInput[] = await pool(batch, 4, async ({ key, file }) => ({ key, fileName: file.name || fileName(key), ...(await readTags(file)) }))
      await api.folderAdd(tracks)
      void queryClient.invalidateQueries({ queryKey: ['folder'] })
    }
    set({ phase: 'finishing', step: 'Preparando la búsqueda semántica', done: fresh.length })
    for (let round = 0, left = Infinity; round < 60; round++) {
      const status = await api.folderResume()
      const now = status.unanalyzed + status.unembedded
      // Sin cupo de IA o sin avance: queda pendiente para la próxima vez.
      if (!now || status.quota || now >= left) break
      left = now
    }
    set({ phase: 'done', step: 'Listo' })
  } catch (error) {
    set({ phase: 'error', error: (error as Error).message })
  } finally {
    running = false
    void queryClient.invalidateQueries({ queryKey: ['folder'] })
    void queryClient.invalidateQueries({ queryKey: ['domains'] })
    void queryClient.invalidateQueries({ queryKey: ['taste', 'folder'] })
  }
  // Con los nombres ya guardados, se mide el sonido en segundo plano.
  if (state.phase === 'done') void analyzeAudio(queryClient)
}

// ——— Análisis del sonido (Essentia.js) ———

/** Mediciones por envío: si se corta, lo enviado ya cuenta y se sigue por ahí. */
const AUDIO_BATCH = 5
const setAudio = (patch: Partial<AudioState>) => set({ audio: { ...state.audio, ...patch } })
let audioRun = 0

export const stopAudio = () => {
  audioRun++
  if (state.audio.phase === 'running') setAudio({ phase: 'idle' })
}

/**
 * Mide en el dispositivo el tempo, la tonalidad, la energía y la bailabilidad de los archivos
 * que el servidor aún no tiene medidos. Un archivo cada vez (memoria del móvil), en un worker
 * (la interfaz no se bloquea) y por lotes reanudables. Sin Web Audio o WASM no hace nada.
 */
export async function analyzeAudio(queryClient: QueryClient) {
  if (state.audio.phase === 'running') return
  if (!canAnalyzeAudio()) return setAudio({ phase: 'unsupported' })
  const run = ++audioRun
  setAudio({ phase: 'running', done: 0, total: 0, failed: 0 })
  const analyzer = createAnalyzer()
  const outbox: FolderAudioInput[] = []
  const flush = async () => {
    if (!outbox.length) return
    await api.folderAudio(outbox.splice(0))
    void queryClient.invalidateQueries({ queryKey: ['folder'] })
    void queryClient.invalidateQueries({ queryKey: ['item'] })
  }
  try {
    const pending = new Set(await api.folderAudioPending())
    const files = allLocalFiles().filter((f) => pending.has(f.key))
    setAudio({ total: files.length })
    let failed = 0
    let measured = 0
    for (const [i, { key, file }] of files.entries()) {
      if (run !== audioRun) break
      try {
        const result = await analyzer.analyze(await decodeWindow(file))
        outbox.push({ key, ...result, version: AUDIO_VERSION })
        measured++
      } catch (error) {
        failed++
        // Si Essentia no carga (sin red, CDN caído) no tiene sentido seguir probando.
        if (!measured && failed >= 3) throw error
      }
      setAudio({ done: i + 1, failed })
      if (outbox.length >= AUDIO_BATCH) await flush()
    }
    await flush()
    if (run === audioRun) setAudio({ phase: 'done' })
  } catch {
    if (run === audioRun) setAudio({ phase: 'error' })
  } finally {
    analyzer.close()
  }
}

// ——— Consultas ———

export const useFolderStatus = (enabled = true) =>
  useQuery({
    queryKey: ['folder', 'status'],
    queryFn: api.folderStatus,
    enabled,
    staleTime: 5_000,
  })

export const useFolderTracks = (enabled = true) =>
  useQuery({ queryKey: ['folder', 'tracks'], queryFn: api.folderTracks, enabled })

export function useCorrectTrack() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, title, artist }: { id: string; title: string; artist: string | null }) => api.folderCorrect(id, { title, artist }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['folder'] })
      void queryClient.invalidateQueries({ queryKey: ['taste', 'folder'] })
    },
  })
}

/** Borra del servidor los datos de la carpeta y olvida la carpeta recordada (los archivos no se tocan). */
export function useForgetFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.folderForget()
      await forgetFolder()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['folder'] })
      void queryClient.invalidateQueries({ queryKey: ['domains'] })
      void queryClient.invalidateQueries({ queryKey: ['taste', 'folder'] })
    },
  })
}

export type { FolderStatus }
export { localFileCount }
