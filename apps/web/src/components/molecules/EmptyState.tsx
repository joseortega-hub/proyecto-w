import type { ReactNode } from 'react'
import { Heading, Icon, type IconName, Text } from '@/components/atoms'

interface EmptyStateProps {
  icon?: IconName
  title: string
  description?: string
  action?: ReactNode
}

/** Pantalla o bloque vacío (sin listas, error, próximamente…). */
export function EmptyState({ icon = 'sparkles', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-accent text-accent-foreground">
        <Icon name={icon} className="size-6" />
      </span>
      <Heading as="h2" size="section">
        {title}
      </Heading>
      {description && (
        <Text tone="muted" size="sm" className="max-w-xs">
          {description}
        </Text>
      )}
      {action}
    </div>
  )
}
