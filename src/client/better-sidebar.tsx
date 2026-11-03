import { useEffect, useRef, type ReactNode } from 'react'
import type { MemoryClientContext } from './dsh-context.ts'
import type { MemoryTranslate } from './locales.ts'
import type { MemoryBetterSidebarSeat, MemoryWorkspaceScope } from './better-sidebar-seat.ts'
import { MemoryIcon } from './memory-icon.tsx'
import css from './MemoryWorkspace.module.css'

/** Stable type id exposed to Better Sidebar and its persisted tab state. */
export const MEMORY_BETTER_SIDEBAR_TAB_ID = 'dsh-plugin-memory:memory'

interface BetterSidebarTabProps {
  scope: MemoryWorkspaceScope
  visible: boolean
}

interface BetterSidebarTabDescriptor {
  id: string
  title: string | (() => string)
  icon?: ReactNode | ((size: number) => ReactNode)
  order?: number
  single?: boolean
  component: (props: BetterSidebarTabProps) => ReactNode
}

interface BetterSidebarService {
  registerTab(descriptor: BetterSidebarTabDescriptor): () => void
}

interface BetterSidebarMemoryTabProps extends BetterSidebarTabProps {
  seat: MemoryBetterSidebarSeat
}

/** Better Sidebar supplies a DOM seat; the DSH renderer remains the owner. */
function BetterSidebarMemoryTab(props: BetterSidebarMemoryTabProps): JSX.Element {
  const target = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (target.current === null) return
    return props.seat.attach(target.current, props.scope, props.visible)
  }, [props.scope.cwd, props.scope.sessionId, props.seat, props.visible])
  return <div ref={target} className={css.betterSidebarSeat} data-dsh-plugin-memory-better-sidebar-seat />
}

/**
 * Register Memory through Better Sidebar's documented optional service.
 *
 * The service is deliberately a soft dependency. Watching Cordis service
 * changes makes installation order and HMR irrelevant while preserving the
 * standalone Memory sidebar on profiles that do not install Better Sidebar.
 */
export function mountBetterSidebarTab(
  ctx: MemoryClientContext,
  t: MemoryTranslate,
  seat: MemoryBetterSidebarSeat,
): () => void {
  let current: { service: BetterSidebarService; dispose: () => void } | undefined

  const reconcile = (): void => {
    const service = ctx.get('betterSidebar') as BetterSidebarService | undefined
    if (current?.service === service) return
    current?.dispose()
    current = undefined
    if (service === undefined) return
    const dispose = service.registerTab({
      id: MEMORY_BETTER_SIDEBAR_TAB_ID,
      title: () => t('tab.label'),
      icon: size => <MemoryIcon size={size} />,
      order: 55,
      single: true,
      component: ({ scope, visible }) => <BetterSidebarMemoryTab seat={seat} scope={scope} visible={visible} />,
    })
    current = { service, dispose }
  }

  reconcile()
  const unsubscribe = ctx.on('internal/service', (name) => {
    if (name === 'betterSidebar') reconcile()
  })
  return () => {
    unsubscribe()
    current?.dispose()
    current = undefined
  }
}
