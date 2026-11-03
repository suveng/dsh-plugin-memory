import type { Context } from '@deepseek-ai/cordis'
import { provideMemoryRuntime } from './runtime.ts'

export const name = 'dsh-plugin-memory-core'
export const provide = ['memoryMemory']
export const inject: string[] = []

/** No built-in Source, Provider, filesystem, settings, tools, or Web dependency. */
export function apply(context: Context): void {
  provideMemoryRuntime(context)
}
