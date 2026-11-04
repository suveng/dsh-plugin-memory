import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as runtimePlugin from 'suveng-dsh-plugin-memory-source-runtime'
import * as documentsPlugin from 'suveng-dsh-plugin-memory-source-documents'
import * as spacesPlugin from 'suveng-dsh-plugin-memory-source-memory-spaces'
import * as strategyPlugin from 'suveng-dsh-plugin-memory-strategy-default-three-tier'
import native from 'suveng-dsh-plugin-memory-provider-native'
import holographic from 'suveng-dsh-plugin-memory-provider-holographic'
import { Context, type Plugin } from '@deepseek-ai/cordis'
import type { MemorySpaceView, MemorySpaceCatalog } from 'suveng-dsh-plugin-memory-source-memory-spaces/contracts'
import type { MemorySpaceProviderEntry } from 'suveng-dsh-plugin-memory-source-memory-spaces/provider-sdk'
import { resolveConfig, type Config } from '../../src/host/config.ts'
import { createRuntimeGraph, LiveMemoryRuntime } from '../../src/host/runtime.ts'
import type { HostWorkspaceRegistry, HostAgentsService } from '../../src/host/dsh.ts'
import { provideMemoryRuntime } from '../../src/core/runtime.ts'
import type { MemoryGitHubAuth } from '../../src/host/github-auth.ts'

/** Compose real, public Cordis modules. No Source controller or Host business binding. */
export async function compositionFixture(options: Config = {}, host: {
  workspaceRegistry?: HostWorkspaceRegistry; agents?: Pick<HostAgentsService, 'get'>; providers?: MemorySpaceProviderEntry[]
  entryPrefix?: string; githubAuth?: MemoryGitHubAuth; documentsLimitBytes?: number
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'memory-composition-'))
  const workspace = join(root, 'workspace')
  mkdirSync(workspace)
  const dataDir = join(root, 'data')
  const config = resolveConfig({ storageScope: 'custom', runtimeUserScope: 'storage', dataDir, cliPath: '/fake/memory', ...options })
  // Host-internal tests own a Core engine; independent plugins use the public
  // MemoryCompositionRunner instead. Neither needs an SDK escape hatch.
  const context = new Context()
  const extensions = provideMemoryRuntime(context)
  const entries = new WeakMap<object, string>()
  context.provide('loader', { locate: (fiber: object) => entries.get(fiber) })
  async function mount<C>(plugin: Plugin.Object<C>, entry: { instanceId: string; config?: C }) {
    const bound: Plugin.Object<C | undefined> = { ...plugin, apply(ctx: Context, config: C | undefined) {
      entries.set(ctx.fiber, entry.instanceId)
      return plugin.apply(ctx, config as C)
    } }
    const fiber = context.plugin(bound, entry.config)
    try { await fiber.await() }
    catch (error) { await fiber.dispose(); throw error }
    return () => fiber.dispose()
  }
  const entryId = (id: string) => (host.entryPrefix ? host.entryPrefix + ':' : '') + id
  const releases = [
    await mount(runtimePlugin, { instanceId: entryId('memory-source-runtime') }),
    await mount(documentsPlugin, { instanceId: entryId('memory-source-documents'), ...(host.documentsLimitBytes === undefined ? {} : { config: { limitBytes: host.documentsLimitBytes } }) }),
    await mount({ inject: ['memoryMemory'], async apply(ctx: Context) {
      await spacesPlugin.installMemorySpaces(ctx, [
        { instanceId: native.id, module: native, config: undefined },
        { instanceId: holographic.id, module: holographic, config: undefined },
        ...(host.providers ?? []),
      ])
    } }, { instanceId: entryId('memory-source-memory-spaces') }),
    await mount(strategyPlugin, { instanceId: entryId('memory-strategy-default-three-tier') }),
  ]
  const graph = createRuntimeGraph(config, workspace, extensions)
  const workspaceRegistry = host.workspaceRegistry ?? {
    list: () => [{ id: 'workspace', title: 'Fixture', path: workspace }],
    get: (id: string) => id === 'workspace' ? { id, title: 'Fixture', path: workspace } : undefined,
  }
  const live = new LiveMemoryRuntime(graph, workspaceRegistry, host.agents, extensions)
  // A Host that mounts a credentials store hands the graph its sign-in seam; one
  // that mounts none leaves the channel reporting the login as unavailable.
  if (host.githubAuth !== undefined) live.useGitHubAuth(host.githubAuth)
  async function memorySpace() {
    const source = graph.source('memory-spaces')
    await source.mutate('provider-service-update', {
      providerId: 'holographic', settings: { dataPath: join(config.dataDir ?? dataDir, 'fixture-facts.json') }, enabled: true,
    })
    const catalog = await source.read<MemorySpaceCatalog>('body-directory')
    const body = catalog.items.find(item => item.provider.id === 'holographic')
    if (body === undefined) throw new Error('Fixture Provider did not discover its namespace')
    return body
  }
  async function dispose() {
    live.dispose()
    await context.fiber.dispose()
    rmSync(root, { recursive: true, force: true })
  }
  return { root, workspace, config, mount, extensions, graph, live, releases, memorySpace, dispose }
}
