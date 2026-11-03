/**
 * Memory-owned projection for provider usage after a subagent descriptor.
 *
 * Fork-backed subagents inherit the parent's durable event prefix. DSH's
 * generic `tokenUsage` projection intentionally totals that complete log, so
 * it cannot also represent the cost of the child shown in the subagent
 * catalog. This independent projection keeps the generic metric untouched
 * and resets at every durable descriptor.
 */
import { z } from 'zod'
import type { HostContextShape, HostSessionEvent } from "./dsh.ts"

export interface MemoryTokenUsageProjection {
  uncachedInputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export interface MemorySubagentTokenUsageState {
  descriptorSeen: boolean
  totals: MemoryTokenUsageProjection
  last: {
    turn: number
    step: number
    buckets: MemoryTokenUsageProjection
  } | null
}

type UsageSample = NonNullable<MemorySubagentTokenUsageState['last']>

interface ProjectionEvent {
  type: string
  data: unknown
}

interface ProjectionRegistry {
  register(definition: typeof memorySubagentTokenUsageProjectionDefinition): unknown
}

type ProjectionContext = HostContextShape & { sessionProjections?: ProjectionRegistry }

const tokenCountSchema = z.number().int().nonnegative()

const tokenUsageSchema: z.ZodType<MemoryTokenUsageProjection> = z.object({
  uncachedInputTokens: tokenCountSchema,
  outputTokens: tokenCountSchema,
  cacheReadTokens: tokenCountSchema,
  cacheWriteTokens: tokenCountSchema,
}).strict()

const tokenUsageStateSchema: z.ZodType<MemorySubagentTokenUsageState> = z.object({
  descriptorSeen: z.boolean(),
  totals: tokenUsageSchema,
  last: z.object({
    turn: tokenCountSchema,
    step: tokenCountSchema,
    buckets: tokenUsageSchema,
  }).strict().nullable(),
}).strict()

const tokenUsageWire = {
  viewSchema: tokenUsageSchema.nullable(),
  view: (state: MemorySubagentTokenUsageState): MemoryTokenUsageProjection | null =>
    state.descriptorSeen ? state.totals : null,
}

const emptyTokenUsage = (): MemoryTokenUsageProjection => ({
  uncachedInputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
})

function nonnegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined
}

function usageBuckets(value: unknown): MemoryTokenUsageProjection | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const usage = value as Record<string, unknown>
  const inputTokens = nonnegativeInteger(usage.inputTokens)
  const outputTokens = nonnegativeInteger(usage.outputTokens)
  const cacheReadTokens = usage.cacheReadTokens === undefined
    ? 0
    : nonnegativeInteger(usage.cacheReadTokens)
  const cacheWriteTokens = usage.cacheWriteTokens === undefined
    ? 0
    : nonnegativeInteger(usage.cacheWriteTokens)
  if (inputTokens === undefined || outputTokens === undefined
    || cacheReadTokens === undefined || cacheWriteTokens === undefined) return undefined
  return {
    uncachedInputTokens: inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
  }
}

function usageSample(event: ProjectionEvent): UsageSample | undefined {
  if (typeof event.data !== 'object' || event.data === null || Array.isArray(event.data)) return undefined
  const data = event.data as Record<string, unknown>
  const turn = nonnegativeInteger(data.turn)
  const step = nonnegativeInteger(data.step)
  if (turn === undefined || step === undefined) return undefined
  let rawUsage: unknown
  if (event.type === 'assistant/chunk') {
    const chunk = data.chunk
    if (typeof chunk !== 'object' || chunk === null || Array.isArray(chunk)) return undefined
    const record = chunk as Record<string, unknown>
    if (record.type !== 'usage') return undefined
    rawUsage = record.usage
  } else if (event.type === 'assistant/message') {
    rawUsage = data.usage
  } else {
    return undefined
  }
  const buckets = usageBuckets(rawUsage)
  return buckets === undefined ? undefined : { turn, step, buckets }
}

function equalTokenUsage(left: MemoryTokenUsageProjection, right: MemoryTokenUsageProjection): boolean {
  return left.uncachedInputTokens === right.uncachedInputTokens
    && left.outputTokens === right.outputTokens
    && left.cacheReadTokens === right.cacheReadTokens
    && left.cacheWriteTokens === right.cacheWriteTokens
}

function replaceTokenUsage(
  totals: MemoryTokenUsageProjection,
  previous: MemoryTokenUsageProjection | undefined,
  next: MemoryTokenUsageProjection,
): MemoryTokenUsageProjection {
  return {
    uncachedInputTokens: totals.uncachedInputTokens - (previous?.uncachedInputTokens ?? 0) + next.uncachedInputTokens,
    outputTokens: totals.outputTokens - (previous?.outputTokens ?? 0) + next.outputTokens,
    cacheReadTokens: totals.cacheReadTokens - (previous?.cacheReadTokens ?? 0) + next.cacheReadTokens,
    cacheWriteTokens: totals.cacheWriteTokens - (previous?.cacheWriteTokens ?? 0) + next.cacheWriteTokens,
  }
}

/** Wire key consumed only by Memory's subagent-catalog token-usage projection. */
export const MEMORY_SUBAGENT_TOKEN_USAGE_KEY = 'memorySubagentTokenUsage'

/**
 * Fold provider usage after the latest subagent descriptor. A fork may carry
 * an ancestor descriptor as part of its seed, so every descriptor resets the
 * fold and the child's own descriptor becomes the final authoritative origin.
 */
export const memorySubagentTokenUsageProjectionDefinition = {
  key: MEMORY_SUBAGENT_TOKEN_USAGE_KEY,
  stateVersion: 1,
  stateSchema: tokenUsageStateSchema,
  init: (): MemorySubagentTokenUsageState => ({
    descriptorSeen: false,
    totals: emptyTokenUsage(),
    last: null,
  }),
  apply: (state: MemorySubagentTokenUsageState, event: ProjectionEvent): MemorySubagentTokenUsageState => {
    if (event.type === 'subagent/descriptor') {
      return { descriptorSeen: true, totals: emptyTokenUsage(), last: null }
    }
    if (!state.descriptorSeen) return state
    const sample = usageSample(event)
    if (sample === undefined) return state
    const previous = state.last !== null
      && state.last.turn === sample.turn
      && state.last.step === sample.step
      ? state.last.buckets
      : undefined
    if (previous !== undefined && equalTokenUsage(previous, sample.buckets)) return state
    return {
      descriptorSeen: true,
      totals: replaceTokenUsage(state.totals, previous, sample.buckets),
      last: sample,
    }
  },
  wire: tokenUsageWire,
} as const

/** Register lazily when the optional DSH projection service is present. */
export function registerMemorySubagentTokenUsageProjection(ctx: HostContextShape): void {
  ctx.inject(['sessionProjections'], (rawContext) => {
    const projectionContext = rawContext as ProjectionContext
    projectionContext.sessionProjections?.register(memorySubagentTokenUsageProjectionDefinition)
  })
}
