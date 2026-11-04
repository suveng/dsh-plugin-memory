import { randomUUID } from 'node:crypto'
import type { MessageSourceMap } from '@deepseek-ai/dsh-llm'
import type { HostUserMessage } from './dsh.ts'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'suveng-dsh-plugin-memory': {
      kind: 'suveng-dsh-plugin-memory'
      form: 'recall' | 'instructions'
    }
  }
}

export const MEMORY_PLUGIN_SOURCE = 'suveng-dsh-plugin-memory'

/** A user-role message this plugin adds to a step, marked with its own source. */
export function createPluginMessage(text: string, form: 'recall' | 'instructions'): HostUserMessage {
  return structuredClone({
    id: randomUUID(),
    role: 'user' as const,
    content: [{ type: 'text' as const, text }],
    source: {
      kind: MEMORY_PLUGIN_SOURCE,
      form,
    } satisfies MessageSourceMap['suveng-dsh-plugin-memory'],
  })
}
