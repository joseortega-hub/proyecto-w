import { Component, type ErrorInfo, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DEFAULT_LAYOUT, getLayout, setLayout } from '@/lib/layout'

interface State {
  failed: boolean
}

/**
 * Límite de errores del marco de las temáticas. Si algo falla con una estructura distinta de
 * la Clásica, vuelve a la Clásica y avisa con un toast en vez de dejar la pantalla en blanco.
 * Si falla también con la Clásica, enseña un aviso con un botón para recargar.
 */
export class LayoutBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Fallo en el marco de la temática', error, info.componentStack)
    if (getLayout() === DEFAULT_LAYOUT) return
    setLayout(DEFAULT_LAYOUT)
    toast.error('No hemos podido aplicar esa estructura', { description: 'Hemos vuelto a la Clásica. Puedes cambiarla en «Personalizar».' })
    this.setState({ failed: false })
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="pt-safe px-safe fixed inset-0 grid place-items-center p-6 text-center">
        <div className="flex max-w-sm flex-col items-center gap-3">
          <p className="text-lg font-bold">Algo no ha ido bien</p>
          <p className="text-muted-foreground">Recarga la página para seguir donde lo dejaste.</p>
          <Button onClick={() => window.location.reload()}>Recargar</Button>
        </div>
      </div>
    )
  }
}
