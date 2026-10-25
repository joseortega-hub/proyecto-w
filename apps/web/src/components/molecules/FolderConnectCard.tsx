import { Button, Icon, Text } from '@/components/atoms'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface FolderConnectCardProps {
  /** `none`: sin carpeta; `needs-permission`: recordada pero el navegador pide un clic; `ready`: leída en esta visita. */
  access: 'unknown' | 'none' | 'needs-permission' | 'ready'
  folderName?: string | null
  /** Audios encontrados ahora en el dispositivo. */
  found?: number
  /** Canciones ya identificadas en la cuenta. */
  itemCount?: number
  /** Canciones con nombre sin confirmar. */
  review?: number
  /** Chrome y Edge de escritorio recuerdan la carpeta; el resto hay que elegirla cada vez. */
  canRemember?: boolean
  /** Móvil: se eligen canciones sueltas en vez de una carpeta, y hay que volver a elegirlas en cada visita. */
  songsMode?: boolean
  busy?: boolean
  onChoose?: () => void
  onReconnect?: () => void
  onImport?: () => void
  onReview?: () => void
  onForget?: () => void
  className?: string
}

/** Tarjeta de "Mi carpeta": elegir la carpeta, reconectarla o añadir lo nuevo, con el aviso de privacidad. */
export function FolderConnectCard({
  access,
  folderName,
  found = 0,
  itemCount = 0,
  review = 0,
  canRemember = true,
  songsMode = false,
  busy,
  onChoose,
  onReconnect,
  onImport,
  onReview,
  onForget,
  className,
}: FolderConnectCardProps) {
  const privacy = (
    <Text size="xs" tone="muted" className="flex items-start gap-1.5">
      <Icon name="check" className="mt-0.5 size-3.5 flex-none text-domain" />
      Tus canciones no salen de tu dispositivo: solo subo artista, título y cómo suenan, para poder preguntarte y recomendarte.
    </Text>
  )

  if (access === 'ready' || (access === 'needs-permission' && itemCount > 0)) {
    const reconnect = access === 'needs-permission'
    const toAdd = Math.max(0, found - itemCount)
    return (
      <Card className={cn('gap-3 rounded-[14px] px-4 py-3.5 shadow-none', className)}>
        <div className="flex items-start gap-3">
          <Icon name="folder" className="mt-0.5 size-5 flex-none text-domain" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <strong className="truncate text-[15px]">{folderName ?? 'Tu carpeta'}</strong>
            <Text size="sm" tone="muted">
              {reconnect
                ? `${itemCount} canciones identificadas. Para que suenen, da permiso a esta carpeta.`
                : `${itemCount} canciones identificadas${found ? ` de ${found} en el dispositivo` : ''}.`}
              {!canRemember && !reconnect && (songsMode ? ' El móvil no recuerda los archivos: elígelos de nuevo cada vez que quieras escucharlos.' : ' Este navegador no recuerda la carpeta: tendrás que elegirla cada vez.')}
            </Text>
          </div>
        </div>
        {privacy}
        <div className="flex flex-wrap gap-2">
          {reconnect ? (
            <Button size="md" className="flex-1" disabled={busy} onClick={onReconnect}>
              <Icon name="folder" /> Dar permiso a la carpeta
            </Button>
          ) : (
            <Button size="md" variant="secondary" className="flex-1" disabled={busy} onClick={onImport}>
              <Icon name="retry" /> {songsMode ? 'Añadir más canciones' : toAdd > 0 ? `Añadir ${toAdd} canciones nuevas` : 'Buscar canciones nuevas'}
            </Button>
          )}
          {review > 0 && (
            <Button size="md" variant="secondary" disabled={busy} onClick={onReview}>
              Revisar {review}
            </Button>
          )}
          <Button size="md" variant="ghost" disabled={busy} onClick={onForget} aria-label="Olvidar la carpeta y borrar mis datos de Sintonía">
            <Icon name="trash" /> Olvidar
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className={cn('gap-3 rounded-[14px] border-domain/40 bg-domain-soft px-4 py-3.5 shadow-none', className)}>
      <div className="flex items-start gap-3">
        <Icon name="folder" className="mt-0.5 size-5 flex-none text-domain" />
        <div className="flex flex-col gap-0.5">
          <strong className="text-[15px]">{itemCount > 0 ? (songsMode ? 'Elige tus canciones otra vez para que suenen' : 'Elige tu carpeta otra vez para que suene') : 'Usa la música que ya tienes'}</strong>
          <Text size="sm" tone="muted">
            {itemCount > 0
              ? `Ya conozco ${itemCount} canciones tuyas. Para escucharlas, elige de nuevo ${songsMode ? 'esos archivos' : 'la misma carpeta'}: no vuelvo a identificar las que ya están.`
              : `${songsMode ? 'Elige las canciones que quieras desde tu móvil.' : 'Elige la carpeta donde guardas tus canciones.'} Las identifico por sus etiquetas y, si los nombres vienen sucios, los limpio y los confirmo con MusicBrainz.`}
          </Text>
        </div>
      </div>
      <Button size="md" block disabled={busy} onClick={onChoose}>
        <Icon name="folder" /> {songsMode ? 'Elegir canciones…' : 'Elige tu carpeta…'}
      </Button>
      {privacy}
      <Text size="xs" tone="muted">
        {songsMode
          ? 'En el móvil se eligen canciones sueltas (marca muchas a la vez) y hay que volver a elegirlas en cada visita. Para elegir una carpeta entera y que se recuerde, usa Chrome o Edge en el PC.'
          : canRemember
          ? 'Funciona en Chrome y Edge de escritorio.'
          : 'Tu navegador no puede recordar la carpeta: funciona, pero tendrás que elegirla en cada visita. En Chrome o Edge de escritorio la recuerda.'}
      </Text>
    </Card>
  )
}
