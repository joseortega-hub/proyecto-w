import { Button, Icon, Text } from '@/components/atoms'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface YouTubeConnectCardProps {
  status: 'disconnected' | 'connected' | 'expired'
  channelTitle?: string | null
  itemCount?: number
  /** Fecha aproximada en que Google pedirá volver a conectar (modo de pruebas: 7 días). */
  expiresAt?: string | null
  /** Sin cliente OAuth configurado en el servidor. */
  unavailable?: boolean
  busy?: boolean
  onConnect?: () => void
  onImport?: () => void
  onDisconnect?: () => void
  className?: string
}

const day = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

/** Tarjeta para conectar la cuenta de YouTube, volver a conectarla o actualizar la música. */
export function YouTubeConnectCard({
  status,
  channelTitle,
  itemCount = 0,
  expiresAt,
  unavailable,
  busy,
  onConnect,
  onImport,
  onDisconnect,
  className,
}: YouTubeConnectCardProps) {
  if (status === 'connected') {
    return (
      <Card className={cn('gap-3 rounded-[14px] px-4 py-3.5 shadow-none', className)}>
        <div className="flex items-start gap-3">
          <Icon name="youtube" className="mt-0.5 size-5 flex-none text-domain" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <strong className="truncate text-[15px]">Conectado{channelTitle ? ` como ${channelTitle}` : ''}</strong>
            <Text size="sm" tone="muted">
              {itemCount} canciones de tus listas y tus «Me gusta».
              {expiresAt && ` Google te pedirá volver a conectar hacia el ${day(expiresAt)}.`}
            </Text>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="md" variant="secondary" className="flex-1" disabled={busy} onClick={onImport}>
            <Icon name="retry" /> Actualizar mi música
          </Button>
          <Button size="md" variant="ghost" disabled={busy} onClick={onDisconnect} aria-label="Desconectar YouTube y borrar mi música de Sintonía">
            <Icon name="unplug" /> Desconectar
          </Button>
        </div>
      </Card>
    )
  }

  const expired = status === 'expired'
  return (
    <Card className={cn('gap-3 rounded-[14px] border-domain/40 bg-domain-soft px-4 py-3.5 shadow-none', className)}>
      <div className="flex items-start gap-3">
        <Icon name="youtube" className="mt-0.5 size-5 flex-none text-domain" />
        <div className="flex flex-col gap-0.5">
          <strong className="text-[15px]">{expired ? 'Vuelve a conectar tu YouTube' : 'Usa tu propia música'}</strong>
          <Text size="sm" tone="muted">
            {expired
              ? 'Google caduca el permiso cada 7 días mientras la app está en pruebas. Tu música sigue aquí; reconecta para actualizarla o guardar listas.'
              : 'Conecta tu cuenta de Google y traigo las canciones de tus listas y tus «Me gusta» de YouTube y YouTube Music. Las listas que te prepare se pueden guardar en tu cuenta.'}
          </Text>
        </div>
      </div>
      <Button size="md" block disabled={busy || unavailable} onClick={onConnect}>
        <Icon name="youtube" /> {expired ? 'Volver a conectar' : 'Conectar con Google'}
      </Button>
      {unavailable && (
        <Text size="xs" tone="muted">
          Falta configurar el acceso a Google en el servidor.
        </Text>
      )}
    </Card>
  )
}
