import { useNavigate } from 'react-router'
import { Heading, IconButton, Skeleton, Text } from '@/components/atoms'
import { DomainCard, EmptyState } from '@/components/molecules'
import { domainIcon, useDomains } from '@/lib/domain'
import { formatInt } from '@/lib/format'
import { useTheme } from '@/lib/theme'

/** "/": elegir temática. Cada una tiene su biblioteca, sus listas y sus entrevistas. */
export function DomainPickerPage() {
  const navigate = useNavigate()
  const domains = useDomains()
  const { theme, toggle } = useTheme()

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-5 md:px-10">
      <header className="flex items-center justify-between">
        <Heading as="span" size="brand">
          Sintonía
        </Heading>
        <IconButton icon="theme" label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} onClick={toggle} />
      </header>
      <section className="flex flex-1 flex-col justify-center gap-5 py-8">
        <div className="flex flex-col gap-2">
          <Heading size="display">¿Qué te apetece hoy?</Heading>
          <Text tone="muted" size="lead">
            Elige un catálogo. Unas pocas preguntas de sí o no y te preparo una lista a tu medida.
          </Text>
        </div>
        {domains.isError ? (
          <EmptyState icon="retry" title="No puedo cargar los catálogos" description={domains.error.message} />
        ) : (
          <ul className="flex flex-col gap-2.5" aria-busy={domains.isPending}>
            {domains.isPending
              ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 w-full rounded-[14px]" />)
              : domains.data.map((d) => (
                  <li key={d.id}>
                    <DomainCard
                      id={d.id}
                      name={d.name}
                      icon={domainIcon(d.id)}
                      // El catálogo personal empieza vacío: se llena al conectar la cuenta.
                      disabled={d.itemCount === 0 && !d.personal}
                      description={
                        d.personal
                          ? d.itemCount
                            ? `${formatInt(d.itemCount)} ${d.itemNounPlural} de tu ${d.source.name}`
                            : `Conecta tu ${d.source.name} y usa tu propia música`
                          : d.itemCount
                            ? `${formatInt(d.itemCount)} ${d.itemNounPlural} de ${d.source?.name ?? 'su catálogo'}`
                            : `Próximamente · catálogo de ${d.source?.name ?? '—'}`
                      }
                      onSelect={() => navigate(`/${d.id}`)}
                    />
                  </li>
                ))}
          </ul>
        )}
      </section>
    </div>
  )
}
