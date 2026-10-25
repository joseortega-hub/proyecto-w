import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/atoms'
import { BottomSheet, FeedbackForm } from '@/components/molecules'
import { api } from '@/lib/api'
import { useDomains } from '@/lib/domain'
import { compressImage, domainFromPath, feedbackContext, feedbackProblem, MAX_IMAGES, onOpenFeedback, type FeedbackImage, type FeedbackKind } from '@/lib/feedback'

/**
 * Buzón de comentarios, ideas y errores. Vive una vez en la app y se abre desde el menú
 * (`openFeedback()`); la pantalla y la temática actuales se adjuntan solas.
 */
export function FeedbackSheet() {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<FeedbackKind>('error')
  const [message, setMessage] = useState('')
  const [images, setImages] = useState<FeedbackImage[]>([])
  const [compressing, setCompressing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const location = useLocation()
  const domains = useDomains()
  const screen = location.pathname + location.search
  const domainId = domainFromPath(location.pathname, (domains.data ?? []).map((d) => d.id))
  const domainName = domains.data?.find((d) => d.id === domainId)?.name

  useEffect(() => onOpenFeedback(() => setOpen(true)), [])

  const reset = () => {
    setMessage('')
    setImages([])
    setError(null)
    setKind('error')
  }
  const send = useMutation({
    mutationFn: () => api.sendFeedback({ kind, message: message.trim(), screen, domainId, context: feedbackContext(), images }),
    onSuccess: () => {
      toast.success('Gracias, lo hemos recibido', { description: 'Lo revisamos pronto.' })
      reset()
      setOpen(false)
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se ha podido enviar. Prueba otra vez.'),
  })

  const addFiles = async (files: File[]) => {
    setError(null)
    setCompressing(true)
    try {
      const room = MAX_IMAGES - images.length
      const ready: FeedbackImage[] = []
      for (const file of files.slice(0, room)) ready.push(await compressImage(file))
      setImages((prev) => [...prev, ...ready].slice(0, MAX_IMAGES))
      if (files.length > room) setError(`Como mucho ${MAX_IMAGES} imágenes.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido preparar la imagen.')
    } finally {
      setCompressing(false)
    }
  }

  const submit = () => {
    const problem = feedbackProblem({ message, images })
    if (problem) return setError(problem)
    setError(null)
    send.mutate()
  }

  return (
    <BottomSheet
      open={open}
      onClose={() => setOpen(false)}
      title="Buzón de comentarios"
      footer={
        <Button size="md" className="flex-1" disabled={send.isPending || compressing} onClick={submit}>
          {send.isPending ? 'Enviando…' : 'Enviar'}
        </Button>
      }
    >
      <FeedbackForm
        kind={kind}
        onKind={setKind}
        message={message}
        onMessage={setMessage}
        images={images}
        onAddFiles={(files) => void addFiles(files)}
        onRemoveImage={(i) => setImages((prev) => prev.filter((_, j) => j !== i))}
        compressing={compressing}
        contextLabel={[screen, domainName].filter(Boolean).join(' · ')}
        error={error}
      />
    </BottomSheet>
  )
}
