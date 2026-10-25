import { Popover } from 'radix-ui'
import { IconButton } from '@/components/atoms'
import { SectionToggles } from '@/components/molecules'
import { SECTION_GROUPS, useHiddenSections } from '@/lib/sections'

type CustomizeMenuProps = {
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}

/** Botón «Personalizar»: qué secciones se ven en el inicio, el resultado y la ficha. */
export function CustomizeMenu({ side = 'bottom', align = 'end' }: CustomizeMenuProps) {
  const { hidden, setHidden, showAll } = useHiddenSections()
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <IconButton icon="customize" label={hidden.length ? `Personalizar (${hidden.length} secciones ocultas)` : 'Personalizar'} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={12}
          className="z-50 max-h-[min(36rem,calc(100dvh-24px))] w-[min(21rem,calc(100vw-24px))] overflow-y-auto overscroll-contain rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-lg outline-none"
        >
          <p className="label-caps px-2.5 pt-1.5">Secciones visibles</p>
          <p className="px-2.5 pt-1 pb-3 text-[13px] text-muted-foreground">Oculta lo que no uses. Lo recuperas aquí cuando quieras.</p>
          <SectionToggles groups={SECTION_GROUPS} hidden={hidden} onChange={setHidden} onShowAll={showAll} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
