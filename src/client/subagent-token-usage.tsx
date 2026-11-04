/** Memory token-usage projection for DSH's fork-backed subagent token metric. */
import { createElement, type ComponentType, type ReactElement } from 'react'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-store'
import type { StoredEntry } from '@deepseek-ai/dsh-client-ui-slots'
import type { MemoryClientContext, MemorySessionListState, MemorySessionSummary } from "./dsh-context.ts"
import { isRecord } from './is-record.ts'

const MEMORY_SUBAGENT_TOKEN_USAGE_KEY = 'memorySubagentTokenUsage'
const SUBAGENT_LINEAGE_SLOT = 'conversation.session.header.lineage'
const SUBAGENT_LOCALE = 'subagent'
const MEMORY_SHADOW_PRIORITY = -100

interface MemoryTokenUsageProjection {
  uncachedInputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

type ProjectionRecord = Readonly<Record<string, unknown>>
type LineageProps = Record<string, unknown> & {
  useSessions: SnapshotSelectorHook<MemorySessionListState>
}
type LineageComponent = ComponentType<LineageProps>

const scopedSnapshots = new WeakMap<MemorySessionListState, MemorySessionListState>()

function isTokenUsage(value: unknown): value is MemoryTokenUsageProjection {
  if (!isRecord(value)) return false
  const usage = value as Record<keyof MemoryTokenUsageProjection, unknown>
  return ['uncachedInputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens']
    .every((key) => {
      const count = usage[key as keyof MemoryTokenUsageProjection]
      return typeof count === 'number' && Number.isSafeInteger(count) && count >= 0
    })
}

/**
 * Present the child-local projection under the generic key expected by the
 * released official catalog component. All other consumers continue seeing
 * DSH's complete-log `tokenUsage` value.
 */
export function scopeSubagentTokenUsage(state: MemorySessionListState): MemorySessionListState {
  const cached = scopedSnapshots.get(state)
  if (cached !== undefined) return cached
  let byId: MemorySessionListState['byId'] | undefined
  for (const [id, summary] of Object.entries(state.byId)) {
    if (summary.origin !== 'subagent') continue
    const projections = summary.projectionValues as ProjectionRecord | undefined
    const scopedUsage = projections?.[MEMORY_SUBAGENT_TOKEN_USAGE_KEY]
    if (!isTokenUsage(scopedUsage)) continue
    byId ??= { ...state.byId }
    byId[id as keyof typeof byId] = {
      ...summary,
      projectionValues: {
        ...projections,
        tokenUsage: scopedUsage,
      } as NonNullable<MemorySessionSummary['projectionValues']>,
    }
  }
  const scoped = byId === undefined ? state : { ...state, byId }
  scopedSnapshots.set(state, scoped)
  return scoped
}

/** Wrap the framework hook while preserving its selector/equality contract. */
export function createScopedUseSessions(
  useSessions: SnapshotSelectorHook<MemorySessionListState>,
): SnapshotSelectorHook<MemorySessionListState> {
  return <Selected,>(
    selector: (state: MemorySessionListState) => Selected,
    equal?: (left: Selected, right: Selected) => boolean,
  ): Selected => useSessions(state => selector(scopeSubagentTokenUsage(state)), equal)
}

function lineageShadow(official: LineageComponent): LineageComponent {
  return function MemorySubagentHeaderLineage(props: LineageProps): ReactElement {
    return createElement(official, {
      ...props,
      useSessions: createScopedUseSessions(props.useSessions),
    })
  }
}

/** SlotRegistry face used to re-register the official entry's type-erased locale and inject. */
interface ErasedSlots {
  entries(key: string): readonly StoredEntry[]
  subscribe(key: string, listener: () => void): () => void
  register(options: Record<string, unknown>, component: LineageComponent): () => void
}

function officialLineage(entries: readonly StoredEntry[]): StoredEntry | undefined {
  return entries.find(entry => (entry.options.priority ?? 0) === 0
    && entry.locale === SUBAGENT_LOCALE
    && typeof entry.component === 'function'
    && typeof entry.inject === 'function')
}

/**
 * Shadow the released official single-slot entry at a lower priority. The
 * component and action factory are captured from the public slot ledger, so
 * Memory keeps the official UI, styles, locale, and navigation behavior.
 */
export function mountSubagentTokenUsageOverride(ctx: MemoryClientContext): () => void {
  const slots = ctx.slots as unknown as ErasedSlots
  let official: StoredEntry | undefined
  let disposeShadow: (() => void) | undefined
  const reconcile = (): void => {
    const entries = slots.entries(SUBAGENT_LINEAGE_SLOT)
    if (official !== undefined && entries.includes(official)) return
    const disposePreviousShadow = disposeShadow
    disposeShadow = undefined
    official = undefined
    disposePreviousShadow?.()
    official = officialLineage(entries)
    if (official === undefined) return
    disposeShadow = slots.register({
      name: SUBAGENT_LINEAGE_SLOT,
      priority: MEMORY_SHADOW_PRIORITY,
      locale: official.locale,
      inject: official.inject,
      registrant: 'suveng-dsh-plugin-memory/subagent-token-usage',
    }, lineageShadow(official.component as LineageComponent))
  }
  const unsubscribe = slots.subscribe(SUBAGENT_LINEAGE_SLOT, reconcile)
  reconcile()
  return () => {
    unsubscribe()
    disposeShadow?.()
  }
}
