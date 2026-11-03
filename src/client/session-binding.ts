import { useCallback, useSyncExternalStore } from 'react'
import type { SlotScopeAdapter } from '@deepseek-ai/dsh-client-ui-slots'

export type MemorySessionBinding = SlotScopeAdapter['current']

/** Root surfaces follow DSH's default/main binding, independently of its catalog. */
export function useMemorySessionId(binding: MemorySessionBinding): string | undefined {
  const subscribe = useCallback((listener: () => void) => binding.subscribe(listener), [binding])
  const getSnapshot = useCallback(() => binding.getSnapshot().key, [binding])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
