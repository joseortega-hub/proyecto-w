import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { Button, Heading, Spinner, Text } from '@/components/atoms'
import { ReviewCandidate } from '@/components/molecules'
import { api } from '@/lib/api'
import { usePerreoReview } from '@/lib/perreo'

/** «Por revisar»: las cuentas dudosas de Instagram, para confirmarlas o descartarlas una a una. */
export function PerreoReviewPage() {
  const navigate = useNavigate()
  const client = useQueryClient()
  const review = usePerreoReview()
  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'accept' | 'reject' }) => api.perreoDecide(id, decision),
    onSuccess: () => client.invalidateQueries({ queryKey: ['perreo', 'review'] }),
  })
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-5 md:px-10 md:py-8">
      <Button variant="ghost" size="md" className="self-start" onClick={() => navigate('/perreo/artistas')}>
        ← Artistas
      </Button>
      <div className="flex flex-col gap-1">
        <Heading>Por revisar</Heading>
        <Text tone="muted">Cuentas que sigues en Instagram y que podrían ser artistas, pero no estoy seguro. Confirma o descarta cada una.</Text>
      </div>
      {review.isPending ? (
        <Spinner label="Buscando dudas…" />
      ) : review.isError ? (
        <Text tone="muted">No pude cargar la lista. Prueba otra vez en un momento.</Text>
      ) : (
        <>
          {review.data.pending.length === 0 ? (
            <Text className="py-6 text-center">Nada pendiente, bro. Todo claro 🔥</Text>
          ) : (
            <ul className="flex flex-col gap-3">
              {review.data.pending.map((item) => (
                <li key={item.id}>
                  <ReviewCandidate item={item} busy={decide.isPending} onDecide={(decision) => decide.mutate({ id: item.id, decision })} />
                </li>
              ))}
            </ul>
          )}
          {review.data.accepted + review.data.rejected > 0 && (
            <Text tone="muted" size="sm">
              {review.data.accepted} confirmadas y {review.data.rejected} descartadas. Para que entren sus fichas, desde tu PC: <code>pnpm perreo:instagram --apply-review --prod</code>, luego <code>pnpm perreo:instagram:import</code> y <code>pnpm perreo:load --prod</code>.
            </Text>
          )}
        </>
      )}
    </div>
  )
}
