import { Heading, Skeleton, Text, type IconName } from '@/components/atoms'
import { ComboSlot, type ComboEntry } from '@/components/molecules'
import { Card } from '@/components/ui/card'

export interface ComboSlotView {
  domainId: string
  icon: IconName
  name: string
  role: string
  why: string
  entries: ComboEntry[]
}

interface ComboCardProps {
  /** «El combo de esta noche». */
  title: string
  /** Una línea que explica de dónde sale («Según la hora, el tiempo y tus gustos»). */
  subtitle?: string
  slots: ComboSlotView[]
  loading?: boolean
}

/** «El combo de esta noche»: una propuesta que cruza temáticas, sin entrevista ni IA en directo. */
export function ComboCard({ title, subtitle, slots, loading }: ComboCardProps) {
  return (
    <Card className="gap-4 rounded-[22px] px-4 py-5 shadow-none md:px-6" aria-busy={loading}>
      <div className="flex flex-col gap-1">
        <Heading as="h2" size="title" className="text-[26px]">
          {title}
        </Heading>
        {subtitle && (
          <Text size="sm" tone="muted">
            {subtitle}
          </Text>
        )}
      </div>
      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-[12px]" />
          ))}
        </div>
      ) : (
        slots.map((s) => <ComboSlot key={s.domainId} {...s} />)
      )}
    </Card>
  )
}
