import { DomainIcon, Heading, Text, VibeDot, type IconName } from '@/components/atoms'
import type { CalendarCell } from '@/lib/story'
import { Card } from '@/components/ui/card'

export interface RecentVibe {
  id: string
  domainName: string
  icon: IconName
  domainId: string
  /** «sáb 24 oct». */
  dateLabel: string
  emoji: string
  text: string
  gradient: string
  onOpen: () => void
}

interface VibeCalendarProps {
  cells: CalendarCell[]
  /** Semanas (columnas) que dibuja `cells`. */
  weeks: number
  streak: number
  recent: RecentVibe[]
}

const dayName = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

/**
 * Calendario de vibras tipo GitHub: cada día lleva el color de la vibra de su última lista.
 * Las celdas son pequeñas y solo informan; lo que se toca es la lista de «Tus últimas vibras».
 */
export function VibeCalendar({ cells, weeks, streak, recent }: VibeCalendarProps) {
  return (
    <Card className="gap-4 rounded-[22px] px-4 py-5 shadow-none md:px-6">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Heading as="h2" size="section">
            Tu calendario de vibras
          </Heading>
          <Text size="sm" tone="muted">
            El color de cada día es la vibra de tu última lista: azul, más melancólica; naranja, más alegre; más intenso, más energía.
          </Text>
        </div>
        {streak > 1 && (
          <Text font="mono" size="sm" className="flex-none rounded-full bg-accent px-3 py-1 font-bold text-accent-foreground">
            🔥 {streak} días
          </Text>
        )}
      </div>
      <div className="grid grid-flow-col grid-rows-7 gap-[3px] md:gap-1" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}>
        {cells.map((c) => (
          <VibeDot
            key={c.key}
            hidden={c.future}
            gradient={c.day?.gradient}
            label={`${dayName.format(c.date)}${c.day ? ` · ${c.day.emoji} ${c.day.text}${c.count > 1 ? ` (+${c.count - 1} más)` : ''}` : ' · sin lista'}`}
          />
        ))}
      </div>
      {recent.length > 0 && (
        <div className="flex flex-col gap-1">
          <Text font="label">Tus últimas vibras</Text>
          <ul className="flex flex-col">
            {recent.map((r) => (
              <li key={r.id} data-domain={r.domainId}>
                <button type="button" onClick={r.onOpen} className="flex min-h-11 w-full items-center gap-3 rounded-[10px] px-1 py-1.5 text-left hover:bg-secondary">
                  <span aria-hidden className="size-6 flex-none rounded-[6px]" style={{ backgroundImage: r.gradient }} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-bold">
                      {r.emoji} {r.text}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {r.dateLabel} · {r.domainName}
                    </span>
                  </span>
                  <DomainIcon icon={r.icon} size="sm" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
