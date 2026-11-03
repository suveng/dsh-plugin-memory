import { toolContributions } from './fixtures/tool-contributions.ts'
import { describe, expect, it } from 'vitest'
import type { HostContextShape, ToolDefinition } from '../src/host/dsh.ts'
import { MemorySubagentCoordinator } from '../src/host/subagent.ts'
import { registerTools } from '../src/host/tools.ts'

/** The cards DSH shows of a tool call and its result in the conversation. */
interface ToolCards {
  presentCall?(args: unknown): unknown
  presentResult?(args: unknown, value: unknown): unknown
}

describe('memory tool cards', () => {
  it('shows every memory tool call and result with the card it always had, in registration order', () => {
    const tools: ToolDefinition[] = []
    const register = (tool: ToolDefinition) => { tools.push(tool); return () => {} }
    registerTools({ tools: { register } } as unknown as HostContextShape, {} as never, new MemorySubagentCoordinator({} as never, {} as never), toolContributions())
    const args = { routeId: 'documents/search', offerId: 'runtime/mutate', query: 'release gates', id: 'm1', title: 'Release design', action: 'add', target: 'memory' }
    const cards = tools.map(tool => [tool.name, (tool as ToolCards).presentCall?.(args), (tool as ToolCards).presentResult?.(args, {})])
    expect(cards).toEqual([
      ['memory_view_route', { card: 'generic', title: 'Query composable memory', kind: 'search', rawInput: 'documents/search' }, { card: 'generic', title: 'Composable memory evidence ready' }],
      ['memory_view_action', { card: 'generic', title: 'Apply composable memory action', kind: 'edit', rawInput: 'runtime/mutate' }, { card: 'generic', title: 'Composable memory receipt ready' }],
      ['memory_memory_bodies', { card: 'generic', title: 'Inspect Memory Memory Spaces', kind: 'search' }, { card: 'generic', title: 'Memory Memory Spaces ready' }],
      ['memory_recall', { card: 'generic', title: 'Recall Memory memory', kind: 'search', rawInput: 'release gates' }, { card: 'generic', title: 'Memory recall complete' }],
      ['memory_related', { card: 'generic', title: 'Traverse Memory graph', kind: 'search', rawInput: 'm1' }, { card: 'generic', title: 'Memory graph traversal complete' }],
      ['memory_status', { card: 'generic', title: 'Check Memory status', kind: 'other' }, { card: 'generic', title: 'Memory status checked' }],
      ['memory_document_search', { card: 'generic', title: 'Search Memory Documents', kind: 'search', rawInput: 'release gates' }, { card: 'generic', title: 'Memory Documents ready' }],
      ['memory_document_create', { card: 'generic', title: 'Create Memory Document', kind: 'edit', rawInput: 'Release design' }, { card: 'generic', title: 'Memory Document created' }],
      ['memory_document_manage', { card: 'generic', title: 'add Memory Document', kind: 'edit', rawInput: 'Release design' }, { card: 'generic', title: 'Memory Document processed' }],
      ['memory_runtime_memory', { card: 'generic', title: 'add runtime memory memory', kind: 'edit' }, { card: 'generic', title: 'Runtime memory updated' }],
      ['memory_remember', { card: 'generic', title: 'Write Memory memory', kind: 'edit' }, { card: 'generic', title: 'Memory memory processed' }],
      ['memory_link', { card: 'generic', title: 'Link Memory insights', kind: 'edit' }, { card: 'generic', title: 'Memory insights linked' }],
      ['memory_forget', { card: 'generic', title: 'Forget Memory insight', kind: 'edit', rawInput: 'm1' }, { card: 'generic', title: 'Memory insight forgotten' }],
      ['memory_memory_body_create', { card: 'generic', title: 'Create Memory Space', kind: 'edit' }, { card: 'generic', title: 'Memory Space created' }],
      ['memory_memory_body_update', { card: 'generic', title: 'Update Memory Memory Space', kind: 'edit' }, { card: 'generic', title: 'Memory Memory Space updated' }],
      ['memory_memory_body_merge', { card: 'generic', title: 'Merge Memory Memory Spaces', kind: 'edit' }, { card: 'generic', title: 'Memory Memory Spaces merged' }],
    ])
  })
})
