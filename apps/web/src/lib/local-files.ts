// "Mi carpeta": acceso a los archivos de música del dispositivo. Los audios nunca se suben:
// se leen aquí (etiquetas ID3) y suenan desde el propio dispositivo con un blob local.
// Chrome y Edge de escritorio recuerdan la carpeta (File System Access API + IndexedDB);
// el resto usa <input webkitdirectory> y hay que volver a elegirla en cada visita.

export const AUDIO_EXT = /\.(mp3|m4a|aac|flac|ogg|oga|opus|wav|webm)$/i

export interface LocalAudio {
  /** Clave estable en el dispositivo: ruta relativa a la carpeta + tamaño. */
  key: string
  file: File
}

interface DirHandle {
  kind: 'directory'
  name: string
  entries(): AsyncIterable<[string, DirHandle | FileHandle]>
  queryPermission(opts: { mode: 'read' }): Promise<PermissionState>
  requestPermission(opts: { mode: 'read' }): Promise<PermissionState>
}
interface FileHandle {
  kind: 'file'
  name: string
  getFile(): Promise<File>
}

/** Chrome y Edge de escritorio dejan elegir una carpeta y recordarla. */
export const canRememberFolder = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window

export const fileKey = (path: string, file: File) => `${path}|${file.size}`

// ——— Archivos en memoria ———

const registry = new Map<string, File>()

export const registerFiles = (list: LocalAudio[]) => {
  registry.clear()
  for (const { key, file } of list) registry.set(key, file)
}
export const localFileCount = () => registry.size
export const allLocalFiles = (): LocalAudio[] => Array.from(registry, ([key, file]) => ({ key, file }))
export const hasLocalFile = (key: string) => registry.has(key)

let currentUrl: { key: string; url: string } | null = null
/** URL de objeto del archivo (solo existe en esta pestaña). Solo se conserva la de la canción que suena. */
export function localUrl(key: string): string | null {
  const file = registry.get(key)
  if (!file) return null
  if (currentUrl?.key === key) return currentUrl.url
  if (currentUrl) URL.revokeObjectURL(currentUrl.url)
  currentUrl = { key, url: URL.createObjectURL(file) }
  return currentUrl.url
}

// ——— Recorrer carpetas ———

async function walk(dir: DirHandle, prefix: string, out: LocalAudio[], signal?: AbortSignal) {
  for await (const [name, handle] of dir.entries()) {
    if (signal?.aborted) return
    if (handle.kind === 'directory') {
      await walk(handle, `${prefix}${name}/`, out, signal)
    } else if (AUDIO_EXT.test(name)) {
      const file = await handle.getFile()
      out.push({ key: fileKey(`${prefix}${name}`, file), file })
    }
  }
}

export async function scanHandle(handle: DirHandle, signal?: AbortSignal): Promise<LocalAudio[]> {
  const out: LocalAudio[] = []
  await walk(handle, '', out, signal)
  return out
}

/** Archivos de un `<input webkitdirectory>`: `webkitRelativePath` empieza por el nombre de la carpeta. */
export function scanFileList(files: FileList | File[]): LocalAudio[] {
  return Array.from(files)
    .filter((f) => AUDIO_EXT.test(f.name))
    .map((file) => ({ key: fileKey(file.webkitRelativePath.split('/').slice(1).join('/') || file.name, file), file }))
}

// ——— Elegir carpeta ———

export interface PickedFolder {
  name: string
  files: LocalAudio[]
  /** Solo con la File System Access API: permite recordar la carpeta. */
  handle?: DirHandle
}

/** Debe llamarse desde un clic (gesto del usuario). Devuelve `null` si se cancela. */
export async function pickFolder(): Promise<PickedFolder | null> {
  if (canRememberFolder()) {
    try {
      const handle = await (window as unknown as { showDirectoryPicker(o: { mode: 'read' }): Promise<DirHandle> }).showDirectoryPicker({ mode: 'read' })
      return { name: handle.name, handle, files: await scanHandle(handle) }
    } catch (error) {
      if ((error as DOMException).name === 'AbortError') return null
      throw error
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.setAttribute('webkitdirectory', '')
    input.onchange = () => {
      const list = input.files
      if (!list?.length) return resolve(null)
      resolve({ name: list[0].webkitRelativePath.split('/')[0] || 'Mi carpeta', files: scanFileList(list) })
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}

// ——— Recordar la carpeta (IndexedDB) ———

const DB_NAME = 'sintonia-local'
const STORE = 'handles'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idb<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const rememberHandle = (handle: DirHandle) => idb('readwrite', (s) => s.put(handle, 'folder')).catch(() => undefined)
export const forgetHandle = () => idb('readwrite', (s) => s.delete('folder')).catch(() => undefined)
export const recallHandle = (): Promise<DirHandle | null> =>
  idb<DirHandle | undefined>('readonly', (s) => s.get('folder')).then((h) => h ?? null).catch(() => null)

/** ¿Se puede leer la carpeta recordada sin preguntar? Con `ask` (desde un clic) pide el permiso. */
export async function folderPermission(handle: DirHandle, ask: boolean): Promise<boolean> {
  if ((await handle.queryPermission({ mode: 'read' })) === 'granted') return true
  return ask && (await handle.requestPermission({ mode: 'read' })) === 'granted'
}

// ——— Etiquetas ID3 ———

export interface FileTags {
  title: string | null
  artist: string | null
  durationSec: number | null
}

/** Etiquetas del archivo (ID3, MP4, Vorbis…); si no se pueden leer, vienen vacías. */
export async function readTags(file: File): Promise<FileTags> {
  try {
    const { parseBlob } = await import('music-metadata')
    const { common, format } = await parseBlob(file, { skipCovers: true, duration: false })
    return {
      title: common.title?.trim() || null,
      artist: (common.artist ?? common.artists?.join(', '))?.trim() || null,
      durationSec: format.duration ? Math.round(format.duration) : null,
    }
  } catch {
    return { title: null, artist: null, durationSec: null }
  }
}
