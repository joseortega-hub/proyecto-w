import { Skeleton, Text } from '@/components/atoms'
import { AttributeMeter } from '@/components/molecules'
import { Card } from '@/components/ui/card'
import type { Attribute } from '@/lib/api'

interface MoodProfileProps {
  attributes: Pick<Attribute, 'key' | 'label' | 'description'>[]
  scales?: Record<string, number>
}

/** El perfil de ánimo como barras por atributo. Sin datos, esqueleto de carga. */
export function MoodProfile({ attributes, scales }: MoodProfileProps) {
  return (
    <Card aria-label="Tu perfil de ánimo" className="gap-3.5 rounded-[16px] p-[18px] shadow-none">
      <Text font="label">Tu perfil de ánimo</Text>
      {attributes.map((a) =>
        scales ? (
          <AttributeMeter key={a.key} label={a.label} value={scales[a.key] ?? 0.5} hint={a.description} />
        ) : (
          <Skeleton key={a.key} className="h-5 w-full" />
        ),
      )}
    </Card>
  )
}
