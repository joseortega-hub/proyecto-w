import { useNavigate } from 'react-router'
import { Button } from '@/components/atoms'
import { EmptyState } from '@/components/molecules'

/** La biblioteca navegable llega después del MVP; de momento, un acceso a la entrevista. */
export function LibraryPage() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-1 items-center justify-center">
      <EmptyState
        icon="library"
        title="La biblioteca llega pronto"
        description="Mientras tanto, cuéntame cómo estás y te preparo una lista con el catálogo de Jamendo."
        action={<Button onClick={() => navigate('/entrevista')}>Empezar</Button>}
      />
    </div>
  )
}
