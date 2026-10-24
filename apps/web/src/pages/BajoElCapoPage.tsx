import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button, Heading, IconButton, Skeleton, Spinner, Switch, Text } from '@/components/atoms'
import { EmptyState, JudgeVerdict } from '@/components/molecules'
import { ProviderCompare, SummaryPanel, TraceTimeline } from '@/components/organisms'
import { lastSession, useCompare, useDemoMode, useJudge, useOpsPanel } from '@/lib/ops'

/** /bajo-el-capo — observabilidad de la IA: línea de tiempo, resumen, comparativa de proveedores y juez. */
export function BajoElCapoPage() {
  const navigate = useNavigate()
  const sessionId = lastSession()
  const panel = useOpsPanel(sessionId)
  const compare = useCompare(sessionId)
  const judge = useJudge(sessionId)
  const [demo, setDemo] = useDemoMode()
  const [wait, setWait] = useState(0)

  // Cuenta atrás hasta poder volver a comparar (límite de una cada 30 s).
  const serverWait = panel.data?.cooldown.compare ?? 0
  useEffect(() => setWait(serverWait), [serverWait])
  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  const data = panel.data
  return (
    <div data-domain="music" className="pt-safe px-safe min-h-dvh bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-6 md:py-10">
        <header className="flex items-start gap-3">
          <IconButton icon="back" label="Volver" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Heading size="title">Bajo el capó</Heading>
            <Text tone="muted" size="sm">
              Qué IA respondió, cuánto tardó y qué pasó cuando una se cayó. Solo metadatos: nunca guardo lo que escribes ni lo que respondes. Se borran a las 48 h.
            </Text>
          </div>
        </header>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3">
          <span className="flex flex-col">
            <Text className="font-bold">Modo demo</Text>
            <Text size="xs" tone="muted">
              Durante la entrevista, un panel pequeño enseña las decisiones de la IA en directo.
            </Text>
          </span>
          <Switch checked={demo} onCheckedChange={setDemo} label="Modo demo" />
        </div>

        {panel.isError ? (
          <EmptyState icon="retry" title="No puedo cargar el panel" description={panel.error.message} action={<Button onClick={() => panel.refetch()}>Reintentar</Button>} />
        ) : !data ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-40" />
          </div>
        ) : (
          <>
            <section className="flex flex-col gap-3">
              <Heading as="h2" size="section">
                Última entrevista
              </Heading>
              {data.rows.length === 0 ? (
                <EmptyState
                  icon="activity"
                  title="Todavía no hay trazas"
                  description="Haz una entrevista (o activa el modo demo y hazla mirando el panel) y vuelve aquí."
                  action={
                    <Link to="/" className="font-bold underline">
                      Ir a una entrevista
                    </Link>
                  }
                />
              ) : (
                <TraceTimeline rows={data.rows} />
              )}
            </section>

            <section className="flex flex-col gap-3">
              <Heading as="h2" size="section">
                {data.rows.length ? 'Resumen de esta entrevista' : 'Resumen de las últimas 48 h'}
              </Heading>
              <SummaryPanel summary={data.rows.length ? data.summary : data.global} />
              {data.rows.length > 0 && data.global.calls > data.summary.calls && (
                <Text size="xs" tone="muted">
                  En las últimas 48 h, de toda la app: {data.global.calls} llamadas, {data.global.fallbackPct} % con respaldo.
                </Text>
              )}
            </section>

            <ProviderCompare
              result={compare.data ?? null}
              running={compare.isPending}
              waitSec={compare.isPending ? 0 : wait}
              disabled={!data.canCompare}
              error={compare.error?.message ?? null}
              onRun={() => {
                setWait(30)
                compare.mutate()
              }}
            />

            <section aria-label="Evaluar la lista" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" size="md" onClick={() => judge.mutate()} disabled={!sessionId || judge.isPending}>
                  {judge.isPending && <Spinner className="size-4" />}
                  Evaluar esta lista
                </Button>
                <Text size="xs" tone="muted" className="max-w-xs">
                  Un LLM actúa de juez: puntúa de 1 a 5 si la lista encaja con tu perfil. Solo cuando lo pides.
                </Text>
              </div>
              {judge.error && (
                <Text size="sm" className="text-destructive" role="alert">
                  {judge.error.message}
                </Text>
              )}
              {judge.data && <JudgeVerdict {...judge.data} />}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
