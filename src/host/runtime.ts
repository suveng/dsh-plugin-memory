import { isDefaultSourceInstance, isWorkspaceStorageScope, type MemorySyncAutoBackup } from './protocol.ts'
import { resolve } from 'node:path'
import type { ResolvedConfig } from './config.ts'
import type { HostAgent, HostAgentsService, HostWorkspace, HostWorkspaceRegistry } from './dsh.ts'
import { MemoryPackManager } from './pack.ts'
import { MemoryReviewLedger } from './review-ledger.ts'
import { MemoryGitSync } from './git-sync.ts'
import type { MemoryGitHubAuth } from './github-auth.ts'
import { StorageScopeInspector } from './storage-scope.ts'
import { createStorageRoot, NO_WORKSPACE_MESSAGE } from './storage-root.ts'
import { canonicalWorkspacePath } from '../sdk/workspace-storage.ts'
import { SourceSession } from './source-session.ts'
import { MemoryRuntime } from '../core/runtime.ts'
import type { MemoryGenerationHost } from '../core/generation.ts'
import { ComposableMemoryTurnManager } from '../core/turns.ts'
import { MEMORY_CAPABILITIES, type MemoryOperationScope } from '../core/contracts/index.ts'
import { allowsParticipation } from './access.ts'
import { mainStrategyTypeId } from './main-strategy.ts'
import type { CompileMemoryGenerationOptions } from '../core/composition.ts'
import { MemoryExecutions } from './memory-executions.ts'

export interface MemoryRuntimeGraph {
  readonly config: ResolvedConfig
  readonly directory: string
  readonly storage: StorageScopeInspector
  readonly packs: MemoryPackManager
  readonly sync: MemoryGitSync
  /** Review proposals for merged memory. Never synced, never Packed. */
  readonly reviews: MemoryReviewLedger
  readonly memoryComposition: MemoryGenerationHost
  readonly composableTurns: ComposableMemoryTurnManager
  source(typeId: string, scope?: MemoryOperationScope): SourceSession
  retire(): void
  dispose(): void
}

export interface MemoryAgentRuntimeSource {
  readonly config: ResolvedConfig
  readonly executions: MemoryExecutions
  forAgent(agent: HostAgent): MemoryRuntimeGraph
  bindAgentRuntime(agentId: string, graph: MemoryRuntimeGraph): () => void
  /** Synchronous notification after a committed live configuration swap. */
  onChanged?(listener: () => void): () => void
}

export function agentScope(agent: HostAgent, config: ResolvedConfig): MemoryOperationScope {
  const workspaceId = agent.session.header?.cwd?.trim()
  return { storage: config.storageScope, ...(workspaceId ? { workspaceId: resolve(workspaceId) } : {}), sessionId: agent.id, agentId: agent.id }
}

/** Shared by production graphs and read-only View previews. */
export function memoryGenerationOptions(config: ResolvedConfig, workspaceRoot: string | undefined): CompileMemoryGenerationOptions {
  const directory = createStorageRoot(config, workspaceRoot).effectiveDataDir()
  const userDirectory = config.runtimeUserScope === 'global' ? createStorageRoot({ storageScope: 'global' }).effectiveDataDir() : directory
  return {
    strategyTypeId: mainStrategyTypeId(config),
    // A main Strategy switched off in the DSH Plugins page must not leave the
    // Host without a View while exactly one other Strategy remains.
    strategyFallback: 'sole-strategy',
    sourceTimeoutMs: config.timeoutMs,
    sourceCapabilities: installed => MEMORY_CAPABILITIES.filter(capability =>
      (config.writeEnabled || !['write', 'archive', 'link', 'forget', 'maintain', 'import'].includes(capability))
      && allowsParticipation(config, installed.definition.manifest.typeId, capability, 'automatic')),
    sourceConfiguration: installed => {
      const type = installed.definition.manifest.typeId
      if (!isDefaultSourceInstance(installed.instanceKey, type)) return {}
      if (type === 'runtime') return { dataDir: directory, userDataDir: userDirectory, memoryLimitBytes: config.runtimeMemory.memoryLimitBytes, userLimitBytes: config.runtimeMemory.userLimitBytes }
      if (type === 'documents') return { dataDir: directory }
      if (type === 'skills') return { dataDir: directory }
      if (type === 'memory-spaces') return JSON.parse(JSON.stringify({
        dataDir: directory, cliPath: config.cliPath, store: config.store, timeoutMs: config.timeoutMs,
        defaultRecallLimit: config.defaultRecallLimit, writeEnabled: config.writeEnabled,
        embedding: config.embedding, recallQuality: config.recallQuality, persistenceStrategy: config.persistenceStrategy,
      }))
      return {}
    },
  }
}

/** One default-product scope over the single Composable Runtime. */
export function createRuntimeGraph(config: ResolvedConfig, workspaceRoot: string | undefined, extensions: MemoryRuntime): MemoryRuntimeGraph {
  const root = createStorageRoot(config, workspaceRoot)
  const directory = root.effectiveDataDir()
  const attachment = extensions.attachGeneration(memoryGenerationOptions(config, workspaceRoot))
  const evaluation = attachment.host.inspect().evaluation
  if (evaluation.state === 'rejected') {
    void attachment.dispose()
    throw new Error(evaluation.diagnostics.map(value => value.message).join('; '))
  }
  const composableTurns = new ComposableMemoryTurnManager(attachment.host)
  const packs = new MemoryPackManager(root, config, () => {}, () => new Date())
  let disposed = false
  return {
    config, directory, storage: new StorageScopeInspector(root, config), packs, sync: new MemoryGitSync(root, config, packs),
    reviews: new MemoryReviewLedger(root),
    memoryComposition: attachment.host, composableTurns,
    source: (type, scope = { storage: config.storageScope, ...(workspaceRoot === undefined ? {} : { workspaceId: workspaceRoot }) }) => new SourceSession(attachment.host, composableTurns, type, scope),
    retire: () => attachment.release(),
    dispose: () => {
      if (disposed) return
      disposed = true
      composableTurns.dispose()
      void attachment.dispose()
    },
  }
}

/**
 * When the Host asks a data directory's Providers again for namespaces they gained (#373): a
 * little after a runtime starts serving it, then, while a try cannot reach the Source, after
 * `retryDelayMs`, `attempts` tries in all. Tests shorten these.
 */
export const PROVIDER_REDISCOVERY_TIMING = { delayMs: 10_000, retryDelayMs: 30_000, attempts: 3 }

/** Data directories whose Provider namespaces this process has asked for again, or is asking now. */
const rediscoveredDirectories = new Set<string>()

/** An answer asking again cannot change: no Memory Spaces Source, or one older than this request. */
function finalRediscoveryAnswer(error: unknown): boolean {
  return /unsupported Memory Spaces management mutation operation|is not installed/u.test(error instanceof Error ? error.message : String(error))
}

/** Resolve every property access against one generation, binding methods to it. */
function liveProxy<T extends object>(resolve: () => T): T {
  return new Proxy({} as T, {
    get(_placeholder, property) {
      const target = resolve()
      const value = Reflect.get(target, property, target) as unknown
      return typeof value === 'function' ? value.bind(target) : value
    },
    has(_placeholder, property) {
      return property in resolve()
    },
    ownKeys() {
      return Reflect.ownKeys(resolve())
    },
    getOwnPropertyDescriptor(_placeholder, property) {
      const descriptor = Reflect.getOwnPropertyDescriptor(resolve(), property)
      return descriptor === undefined ? undefined : { ...descriptor, configurable: true }
    },
  })
}

/**
 * Stable faces handed to DSH registrations. `swap` is synchronous and contains
 * no user code, so all faces move to the same prevalidated generation in one
 * JavaScript turn. A method obtained before the swap stays bound to its old
 * generation until that invocation settles.
 */
export class LiveMemoryRuntime implements MemoryAgentRuntimeSource {
  readonly executions = new MemoryExecutions(this)
  private current: MemoryRuntimeGraph | undefined
  /**
   * The configuration resolve() would build the missing first graph with, so
   * the stable faces can still name the configured scope while one is missing.
   */
  private pendingConfig: ResolvedConfig | undefined
  private readonly workspaceGraphs = new Map<string, MemoryRuntimeGraph>()
  private readonly agentGraphs = new Map<string, { token: symbol; graph: MemoryRuntimeGraph }>()
  private readonly retiredGraphs = new Set<MemoryRuntimeGraph>()
  /** The start-up rediscovery each graph has waiting or running, to stop when the graph goes. */
  private readonly rediscoveries = new Map<MemoryRuntimeGraph, () => void>()
  private githubAuth: MemoryGitHubAuth | undefined
  private autoBackupView: (() => MemorySyncAutoBackup | undefined) | undefined
  private closed = false
  private readonly changeListeners = new Set<() => void>()

  readonly config: ResolvedConfig
  readonly storage: StorageScopeInspector
  readonly packs: MemoryPackManager
  readonly sync: MemoryGitSync
  readonly reviews: MemoryReviewLedger

  /**
   * A workspace-scoped Host starts before any conversation has supplied a
   * workspace, so it hands over the first graph only when one resolves. Until
   * then the stable faces read the configured scope and raise the same error a
   * conversation-scoped read would: nothing may fall back to the user-wide root.
   */
  constructor(private initial: MemoryRuntimeGraph | undefined, private readonly workspaceRegistry: HostWorkspaceRegistry | undefined, private readonly agents: Pick<HostAgentsService, 'get'> | undefined, private readonly extensions: MemoryRuntime, pendingConfig?: ResolvedConfig) {
    this.pendingConfig = initial === undefined ? pendingConfig : undefined
    this.config = liveProxy(() => this.current?.config ?? this.pendingConfig ?? this.requireGraph().config)
    this.storage = liveProxy(() => this.requireGraph().storage)
    this.packs = liveProxy(() => this.requireGraph().packs)
    this.sync = liveProxy(() => this.requireGraph().sync)
    this.reviews = liveProxy(() => this.requireGraph().reviews)
    this.current = initial
    if (initial !== undefined) this.rediscoverProviders(initial)
  }

  /**
   * Share one GitHub sign-in with every generation this runtime builds. The
   * settings page and an Agent's workspace graph then resolve the same grant,
   * and a later generation cannot silently lose the login.
   */
  useGitHubAuth(auth: MemoryGitHubAuth | undefined): void {
    this.githubAuth = auth
    if (this.current !== undefined) this.applyGitHubAuth(this.current)
  }

  private applyGitHubAuth(graph: MemoryRuntimeGraph): void {
    if (this.githubAuth !== undefined) graph.sync.useGitHubAuth(this.githubAuth)
  }

  /**
   * Let the settings page read the background cadence without owning the timer.
   * The timer belongs to the plugin root, one instance for the whole Host, so
   * it is shared with every generation the same way the GitHub grant is.
   */
  useAutoBackup(view: (() => MemorySyncAutoBackup | undefined) | undefined): void {
    this.autoBackupView = view
    if (view !== undefined && this.current !== undefined) this.current.sync.useAutoBackup(view)
  }

  private applyAutoBackup(graph: MemoryRuntimeGraph): void {
    if (this.autoBackupView !== undefined) graph.sync.useAutoBackup(this.autoBackupView)
  }

  onChanged(listener: () => void): () => void {
    this.changeListeners.add(listener)
    return () => { this.changeListeners.delete(listener) }
  }

  swap(next: MemoryRuntimeGraph): void {
    if (this.closed) {
      next.dispose()
      throw new Error('Memory runtime is disposed')
    }
    const previous = this.current
    this.current = next
    this.applyGitHubAuth(next)
    this.applyAutoBackup(next)
    this.rediscoverProviders(next)
    // The graph a workspace-scoped Host started with is not retired when it arrives.
    if (previous !== undefined) this.retireGraph(previous)
    for (const graph of this.workspaceGraphs.values()) this.retireGraph(graph)
    this.workspaceGraphs.clear()
    for (const listener of this.changeListeners) listener()
  }

  snapshot(): MemoryRuntimeGraph {
    this.assertOpen()
    return this.requireGraph()
  }

  /**
   * A setting now asks for a root no conversation has named yet: stop serving
   * the previous one instead of answering from a directory the chosen scope no
   * longer means. The next request that names a workspace opens its graph.
   */
  defer(config: ResolvedConfig): void {
    if (this.closed) return
    const previous = this.current
    this.current = undefined
    this.pendingConfig = config
    if (previous !== undefined) this.retireGraph(previous)
    for (const graph of this.workspaceGraphs.values()) this.retireGraph(graph)
    this.workspaceGraphs.clear()
    for (const listener of this.changeListeners) listener()
  }

  /** The graph that serves this Host, or the reason no workspace has produced one yet. */
  private requireGraph(): MemoryRuntimeGraph {
    this.assertOpen()
    if (this.current === undefined) throw new Error(NO_WORKSPACE_MESSAGE)
    return this.current
  }

  bindAgentRuntime(agentId: string, graph: MemoryRuntimeGraph): () => void {
    this.assertOpen()
    const id = agentId.trim()
    if (id === '') throw new Error('Memory runtime binding requires an Agent id')
    if (this.agentGraphs.has(id)) throw new Error(`Memory runtime is already pinned for Agent ${id}`)
    const token = Symbol(id)
    this.agentGraphs.set(id, { token, graph })
    return () => {
      if (this.agentGraphs.get(id)?.token !== token) return
      this.agentGraphs.delete(id)
      this.collectRetired(graph)
    }
  }

  dispose(): void {
    if (this.closed) return
    this.executions.dispose()
    this.changeListeners.clear()
    this.closed = true
    const graphs = new Set<MemoryRuntimeGraph>([
      ...(this.current === undefined ? [] : [this.current]),
      ...this.workspaceGraphs.values(),
      ...[...this.agentGraphs.values()].map(binding => binding.graph),
      ...this.retiredGraphs,
    ])
    this.agentGraphs.clear()
    this.workspaceGraphs.clear()
    this.retiredGraphs.clear()
    for (const stop of this.rediscoveries.values()) stop()
    this.rediscoveries.clear()
    for (const graph of graphs) graph.dispose()
  }

  /** Resolve the runtime that must serve one Agent execution. */
  forAgent(agent: HostAgent): MemoryRuntimeGraph {
    this.assertOpen()
    const pinned = this.agentGraphs.get(agent.id)
    if (pinned !== undefined) return pinned.graph
    const parentSession = agent.session.header?.origin === 'subagent' ? agent.session.header.parentSession?.trim() : undefined
    const inherited = parentSession === undefined || parentSession === '' ? undefined : this.agentGraphs.get(parentSession)
    if (inherited !== undefined) return inherited.graph
    const cwd = agent.session.header?.cwd?.trim()
    // A Host waiting for its first workspace is already configured for that
    // scope, so the conversation's own cwd is the workspace it was waiting for.
    if (this.current === undefined) {
      if (cwd === undefined || cwd === '') throw new Error(NO_WORKSPACE_MESSAGE)
      return this.openWorkspaceGraph(cwd)
    }
    const graph = this.current
    if (!isWorkspaceStorageScope(graph.config.storageScope)) return graph
    if (cwd === undefined || cwd === '') throw new Error(NO_WORKSPACE_MESSAGE)
    return this.forWorkspacePath(cwd)
  }

  /** Resolve an authorized DSH workspace selected by the Web workbench. */
  forWorkspaceId(workspaceId: string): MemoryRuntimeGraph {
    this.assertOpen()
    const workspace = this.requireWorkspace(workspaceId)
    // A selected workspace is itself what a workspace-scoped Host was waiting for.
    if (this.current === undefined) return this.openWorkspaceGraph(workspace.path)
    const graph = this.current
    return isWorkspaceStorageScope(graph.config.storageScope) ? this.forWorkspacePath(workspace.path) : graph
  }

  /** Resolve a Web request, preferring its explicit inspection workspace. */
  route(request: { workspaceId?: string; sessionId?: string }): {
    graph: MemoryRuntimeGraph
    selectedWorkspace?: HostWorkspace
    effectiveWorkspace?: HostWorkspace
    selectedRoot: string
    effectiveRoot: string
    aligned: boolean
    /** The request names a session whose Agent is loaded, so work can run in that conversation. */
    liveSession: boolean
  } {
    const effectiveAgent = this.agent(request.sessionId)
    // DSH loads a listed session's Agent only when the session runs, so a session opened from the
    // list, or just switched to, may have none yet; DSH's workspace registry still lists it.
    const effectiveWorkspace = effectiveAgent === undefined
      ? this.workspaceForSession(request.sessionId)
      : this.workspaceForPath(effectiveAgent.session.header?.cwd)
    const selectedWorkspace = request.workspaceId === undefined || request.workspaceId.trim() === ''
      ? effectiveWorkspace
      : this.requireWorkspace(request.workspaceId)
    const agentCwd = effectiveAgent?.session.header?.cwd?.trim()
    const serving = this.current ?? (selectedWorkspace !== undefined ? this.openWorkspaceGraph(selectedWorkspace.path)
      : agentCwd !== undefined && agentCwd !== '' ? this.openWorkspaceGraph(agentCwd) : this.requireGraph())
    const effectiveGraph = effectiveAgent !== undefined ? this.forAgent(effectiveAgent)
      : effectiveWorkspace !== undefined && isWorkspaceStorageScope(serving.config.storageScope) ? this.forWorkspacePath(effectiveWorkspace.path) : this.requireGraph()
    const graph = selectedWorkspace === undefined
      ? effectiveGraph
      : isWorkspaceStorageScope(serving.config.storageScope) ? this.forWorkspacePath(selectedWorkspace.path) : serving
    const selectedRoot = resolve(graph.directory)
    const effectiveRoot = resolve(effectiveGraph.directory)
    return {
      graph,
      ...(selectedWorkspace === undefined ? {} : { selectedWorkspace }),
      ...(effectiveWorkspace === undefined ? {} : { effectiveWorkspace }),
      selectedRoot,
      effectiveRoot,
      aligned: selectedRoot === effectiveRoot,
      liveSession: effectiveAgent !== undefined,
    }
  }

  /**
   * Open the graph of a workspace a Host waiting for its first one has been
   * named: the selected workspace supplies the root every face then serves.
   */
  private openWorkspaceGraph(workspaceRoot: string): MemoryRuntimeGraph {
    if (this.pendingConfig === undefined) return this.requireGraph()
    this.current = this.forWorkspacePath(workspaceRoot)
    for (const listener of this.changeListeners) listener()
    return this.current
  }

  private forWorkspacePath(workspaceRoot: string): MemoryRuntimeGraph {
    const config = this.current?.config ?? this.pendingConfig ?? this.requireGraph().config
    const key = config.storageScope === 'workspaces' ? canonicalWorkspacePath(resolve(workspaceRoot)) : resolve(workspaceRoot)
    let graph = this.workspaceGraphs.get(key)
    if (graph === undefined) {
      graph = createRuntimeGraph(config, key, this.extensions)
      this.applyGitHubAuth(graph)
      this.applyAutoBackup(graph)
      this.rediscoverProviders(graph)
      this.workspaceGraphs.set(key, graph)
    }
    return graph
  }

  /**
   * Ask the Providers of one data directory again for namespaces they gained, once per process,
   * a little after a runtime this Host serves starts (#373); a graph built only to validate
   * settings never asks. A read-only runtime asks nothing, and neither does one whose Memory
   * Spaces layer is off or does not maintain itself automatically. A try that cannot reach the
   * Source, before a generation serves for example, is made again a little later; one cut short
   * because its runtime was replaced is left to the runtime that replaced it.
   */
  private rediscoverProviders(graph: MemoryRuntimeGraph): void {
    if (!graph.config.writeEnabled || !allowsParticipation(graph.config, 'memory-spaces', 'maintain', 'automatic')) return
    const directory = resolve(graph.directory)
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let running = false
    const release = () => { if (this.rediscoveries.get(graph) === stop) this.rediscoveries.delete(graph) }
    const schedule = (attempt: number, delayMs: number) => {
      timer = setTimeout(() => void ask(attempt), delayMs)
      timer.unref?.()
    }
    const ask = async (attempt: number) => {
      timer = undefined
      if (rediscoveredDirectories.has(directory)) return release()
      rediscoveredDirectories.add(directory)
      running = true
      let again = false
      try {
        await graph.source('memory-spaces').mutate('provider-rediscover', { trigger: 'startup' }, controller.signal)
      } catch (error) {
        again = !finalRediscoveryAnswer(error)
      } finally {
        running = false
      }
      if (controller.signal.aborted) return
      if (again) {
        rediscoveredDirectories.delete(directory)
        if (attempt < PROVIDER_REDISCOVERY_TIMING.attempts) return schedule(attempt + 1, PROVIDER_REDISCOVERY_TIMING.retryDelayMs)
      }
      release()
    }
    const stop = () => {
      if (timer !== undefined) clearTimeout(timer)
      // A pass cut short is left to the next runtime for this directory, however the Source ends it.
      if (running) rediscoveredDirectories.delete(directory)
      controller.abort(new Error('the Memory runtime was replaced'))
    }
    this.rediscoveries.get(graph)?.()
    this.rediscoveries.set(graph, stop)
    schedule(1, PROVIDER_REDISCOVERY_TIMING.delayMs)
  }

  private retireGraph(graph: MemoryRuntimeGraph): void {
    this.rediscoveries.get(graph)?.()
    this.rediscoveries.delete(graph)
    graph.retire()
    if ([...this.agentGraphs.values()].some(binding => binding.graph === graph)) this.retiredGraphs.add(graph)
    else graph.dispose()
  }

  private collectRetired(graph: MemoryRuntimeGraph): void {
    if (!this.retiredGraphs.has(graph)) return
    if ([...this.agentGraphs.values()].some(binding => binding.graph === graph)) return
    this.retiredGraphs.delete(graph)
    graph.dispose()
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('Memory runtime is disposed')
  }

  private agent(sessionId?: string): HostAgent | undefined {
    const normalized = sessionId?.trim()
    return normalized === undefined || normalized === '' ? undefined : this.agents?.get(normalized)
  }

  private requireWorkspace(workspaceId: string): HostWorkspace {
    const normalized = workspaceId.trim()
    const workspace = normalized === '' ? undefined : this.workspaceRegistry?.get(normalized)
    if (workspace === undefined) throw new Error('selected DSH workspace is unavailable')
    return workspace
  }

  private workspaceForSession(sessionId?: string): HostWorkspace | undefined {
    const normalized = sessionId?.trim()
    if (normalized === undefined || normalized === '') return undefined
    return this.workspaceRegistry?.list().find(workspace => workspace.sessionIds?.includes(normalized) === true)
  }

  private workspaceForPath(path?: string): HostWorkspace | undefined {
    const normalized = path?.trim()
    if (normalized === undefined || normalized === '') return undefined
    const canonical = resolve(normalized)
    return this.workspaceRegistry?.list().find(workspace => resolve(workspace.path) === canonical)
  }
}
