import { useNavigate } from 'react-router'
import { Button } from '@/components/atoms'
import { EmptyState } from '@/components/molecules'
import { useDomain } from '@/lib/domain'

/** La biblioteca navegable llega después del MVP; de momento, un acceso a la entrevista. */
export function LibraryPage() {
  const navigate = useNavigate()
  const domain = useDomain()
  return (
    <div className="flex flex-1 items-center justify-center">
      <EmptyState
        icon="library"
        title="La biblioteca llega pronto"
        description={`Mientras tanto, cuéntame cómo estás y te preparo una lista con las ${domain.nounPlural} del catálogo.`}
        action={<Button onClick={() => navigate(domain.path('entrevista'))}>Empezar</Button>}
      />
    </div>
  )
}
