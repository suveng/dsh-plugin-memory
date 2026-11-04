import type { Context } from '@deepseek-ai/cordis'
import { prepareStarterResolution } from './starter-resolution.ts'

export const name = 'suveng-dsh-plugin-memory-starter'
export const provide = ['memoryStarterReady']

/**
 * The separate readiness Entry of 0.5.18 and 0.5.19, kept for compositions that
 * still insert it; the Starter's own group (`suveng-dsh-plugin-memory/bundle`) now prepares itself.
 */
export async function apply(ctx: Context): Promise<void> {
  await prepareStarterResolution(ctx)
  ctx.provide('memoryStarterReady', true)
}
