import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryCompositionRunner } from 'dsh-plugin-memory/testing'
import * as spaces from 'dsh-plugin-memory-source-memory-spaces'
import * as runtime from 'dsh-plugin-memory-source-runtime'
import * as documents from 'dsh-plugin-memory-source-documents'
import * as strategy from 'dsh-plugin-memory-strategy-default-three-tier'
import * as autoCapture from 'dsh-plugin-memory-strategy-auto-capture'
import * as lightContext from 'dsh-plugin-memory-strategy-light-context'
import * as scoped from 'dsh-plugin-memory-strategy-scoped'
import native from 'dsh-plugin-memory-provider-native'
import { Context } from '@deepseek-ai/cordis'
import { compositionFixture } from './fixtures/composition.ts'
const fixtures: Awaited<ReturnType<typeof compositionFixture>>[] = []
afterEach(async () => { for (const value of fixtures.splice(0)) await value.dispose() })

describe('explicit default Starter', () => {
  it('mounts real Cordis Entries, recomposes remaining Sources, and keeps old leases after unload', async () => {
    const value = await compositionFixture()
    fixtures.push(value)
    const { extensions, graph, releases } = value
    expect(extensions.contributionSnapshot()).toMatchObject({
      revision: 4,
      sources: [
        { instanceKey: 'source:memory-source-runtime' },
        { instanceKey: 'source:memory-source-documents' },
        { instanceKey: 'source:memory-source-memory-spaces', effectiveDigest: expect.stringMatching(/^providers:/u) },
      ],
      strategies: [{ instanceKey: 'strategy:memory-strategy-default-three-tier' }],
    })
    const lease = graph.memoryComposition.acquire()
    try {
      await releases[0]!()
      expect(graph.memoryComposition.inspect().evaluation).toMatchObject({
        state: 'ready',
        sourceInstanceKeys: ['source:memory-source-documents', 'source:memory-source-memory-spaces'],
      })
      expect(graph.memoryComposition.inspect().drainingGenerationIds).toContain(lease.id)
    } finally { lease.release() }
    expect(graph.memoryComposition.inspect().drainingGenerationIds).toEqual([])
  })
  it('keeps stable Starter Entries inside the legacy core lifecycle gate', () => {
    expect([runtime.name, documents.name, spaces.name, strategy.name]).toEqual([
      'dsh-plugin-memory-source-runtime', 'dsh-plugin-memory-source-documents', 'dsh-plugin-memory-source-memory-spaces', 'dsh-plugin-memory-strategy-default-three-tier',
    ])
    const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
    // The group prepares its own dependency resolution, so no separate readiness Entry can hold it back.
    expect(patch).toMatch(/- insert:\n(?:    #.*\n)*    - id: memory-bundle\n      name: dsh-plugin-memory\/bundle\n      group: true\n      disabled: !!js/u)
    expect(patch).not.toContain('memory-starter')
    expect(patch).not.toContain('inject:')
    expect(patch).toContain("[...loader.entries()].find(entry => entry.options.id === 'memory')")
    expect(patch).toContain('entry.evaluate(entry.options.disabled.__jsExpr)')
    expect(patch).toMatch(/        - id: memory\n          # Core\/Host/u)
    for (const name of [runtime.name, documents.name, spaces.name, strategy.name]) {
      expect(patch).toMatch(new RegExp(`        - id: ${name.slice('dsh-plugin-'.length)}\\n          name: ${name}`, 'u'))
    }
    for (const name of [autoCapture.name, lightContext.name, scoped.name]) {
      expect(patch).toMatch(new RegExp(`        - id: ${name.slice('dsh-plugin-'.length)}\\n          name: ${name}\\n          disabled: true`, 'u'))
    }
    expect(patch).not.toContain('dsh-plugin-memory/source-')
    expect(patch).not.toContain('bundledContributions')
  })
  it('allows a Source to mount only its explicitly selected private children', async () => {
    const runner = new MemoryCompositionRunner()
    try {
      const applyProvider = vi.fn(native.apply)
      await runner.mount({ inject: ['memoryMemory'], async apply(ctx: Context) {
        const result = await spaces.installMemorySpaces(ctx, [{ instanceId: 'work-native', module: { ...native, apply: applyProvider }, config: undefined }])
        expect(result).toBeUndefined()
      } }, { instanceId: 'memory-spaces/custom:team' })
      expect(applyProvider).toHaveBeenCalledOnce()
      expect(runner.context.get('memoryProvider', false)).toBeUndefined()
      expect(runner.inspect().evaluation.sourceInstanceKeys).toEqual(['source:memory-spaces/custom:team'])
      await expect(spaces.apply(new Context(), { providers: ['not-installed'] })).rejects.toThrow('DSH Loader')
      await expect(runner.mount(spaces, { instanceId: 'duplicate', config: {
        providers: ['dsh-plugin-memory-provider-native', 'dsh-plugin-memory-provider-native'],
      } })).rejects.toThrow('duplicate Memory Space Provider child')
    } finally { await runner.dispose() }
  })
})
