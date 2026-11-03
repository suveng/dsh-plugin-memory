import { Context } from '@deepseek-ai/cordis'
import { Config as PlainConfig, InteractionConfig, resolveConfig, resolveInteractionConfig, SkillsConfig, type Config as MemoryConfig, type ResolvedConfig } from './config.ts'
import { MemoryAutoBackupScheduler } from './auto-backup.ts'
import { registerCommands } from './commands.ts'
import type { HostContextShape, HostCredentialsService, HostWorkspaceRegistry } from './dsh.ts'
import { githubGrantFromRecord, MEMORY_SYNC_GITHUB_CREDENTIAL_KEY, MemoryGitHubAuth, type MemoryGitHubCredentialPort } from './github-auth.ts'
import { registerGuidance } from './guidance.ts'
import { createRuntimeGraph, LiveMemoryRuntime, type MemoryRuntimeGraph } from './runtime.ts'
import { NO_WORKSPACE_MESSAGE } from './storage-root.ts'
import { MemoryLifecycle, taskRoute } from './lifecycle.ts'
import { SkillEvolution } from './skill-evolution.ts'
import { DEFAULT_SKILLS_CONFIG, type ResolvedSkillsConfig } from './protocol.ts'
import { skillsSourceFor } from './skill-source.ts'
import { registerRpc } from './rpc.ts'
import { hasNativeDirectoryPicker } from './directory-picker.ts'
import { migrateLegacyDisplayMode, registerSettingsRpc } from './settings.ts'
import { MemorySubagentCoordinator } from './subagent.ts'
import { registerTools } from './tools.ts'
import { registerMemorySubagentTokenUsageProjection } from './subagent-token-usage.ts'
import { provideMemoryRuntime, MemoryRuntime } from '../core/runtime.ts'
import { MemoryPluginManagement } from './plugin-management.ts'
import { registerViewRpc } from './view-rpc.ts'
import { MemoryPluginInstallation } from './plugin-installation.ts'
import { MemoryRemoteService } from './remote-rpc.ts'
import { plainHostConfig, type LiveHostConfig } from './live-config.ts'
import { ProfileMemorySettings } from './settings-service.ts'
import { dshPluginCommand, VersionUpdateManager, type DshBundleInstaller } from './version-updates.ts'

export const name = 'dsh-plugin-memory'
export const provide = ['memoryMemory']
export const inject = ['tools', 'settings', 'commands', 'agents', 'subagents']
export { LiveConfig as Config } from './live-config.ts'
export type { MemoryConfig }

/** Resolve the optional Web workspace service at call time, not plugin-mount time. */
function optionalWorkspaceRegistry(ctx: HostContextShape): HostWorkspaceRegistry {
  const current = (): HostWorkspaceRegistry | undefined => ctx.get('workspaceRegistry') as HostWorkspaceRegistry | undefined
  return {
    get: id => current()?.get(id),
    list: () => current()?.list() ?? [],
  }
}

/**
 * The one credentials record this plugin keeps, as DSH's store addresses it:
 * `<scope>/<id>`. Presence of the record is the whole fact, and every write
 * goes through `modifyRecord` so a replacement happens under the store's lock.
 */
function credentialPort(service: () => HostCredentialsService | undefined): MemoryGitHubCredentialPort {
  return {
    available: () => service() !== undefined,
    describe: async () => {
      const store = service()
      if (store === undefined) return { configured: false, writable: false }
      const info = await store.describeRecord(MEMORY_SYNC_GITHUB_CREDENTIAL_KEY)
      return { configured: info.configured, writable: info.writable }
    },
    read: async () => githubGrantFromRecord(await service()?.readRecord(MEMORY_SYNC_GITHUB_CREDENTIAL_KEY)),
    write: async grant => {
      const store = service()
      if (store === undefined) throw new Error('this DSH Host provides no credentials store, so GitHub sign-in is unavailable')
      await store.modifyRecord(MEMORY_SYNC_GITHUB_CREDENTIAL_KEY, async () => ({ kind: 'grant', payload: grant }))
    },
    clear: async () => {
      const store = service()
      if (store === undefined) return
      // An absent record is already the signed-out state; deleting one twice is not a failure.
      if (await store.readRecord(MEMORY_SYNC_GITHUB_CREDENTIAL_KEY) === undefined) return
      await store.deleteRecord(MEMORY_SYNC_GITHUB_CREDENTIAL_KEY)
    },
  }
}

/**
 * GitHub sign-in lives beside the sync channel, not inside it: one instance
 * spans every runtime generation, so a grant stored from the settings page is
 * the same one an Agent's workspace graph resolves. The credentials service is
 * read at call time, because a Headless profile may mount none at all.
 */
function optionalGitHubAuth(ctx: HostContextShape): MemoryGitHubAuth {
  const current = (): HostCredentialsService | undefined => (ctx.get('credentials') ?? ctx.credentials) as HostCredentialsService | undefined
  return new MemoryGitHubAuth(credentialPort(current))
}

/**
 * A workspace-scoped root is resolved from a conversation's workspace, and
 * mounting or saving a setting can happen before this Host has seen one. Only
 * that one failure is deferred: the scope stays configured, and the Host
 * keeps serving the graph it already has until a workspace exists.
 */
function createGraphAwaitingWorkspace(config: ResolvedConfig, extensions: MemoryRuntime): MemoryRuntimeGraph | undefined {
  try {
    return createRuntimeGraph(config, undefined, extensions)
  } catch (error) {
    if ((config.storageScope === 'workspace' || config.storageScope === 'workspaces')
      && error instanceof Error && error.message === NO_WORKSPACE_MESSAGE) return undefined
    throw error
  }
}

/** DSH owns assembly; this Host only wires scope, phases and user preferences. */
export function apply(rawContext: unknown, rawConfig: MemoryConfig | LiveHostConfig = {}): void {
  const ctx = rawContext as unknown as HostContextShape
  const config = plainHostConfig(rawConfig)
  const hostSettings = new ProfileMemorySettings(ctx, rawConfig)
  registerMemorySubagentTokenUsageProjection(ctx)
  const extensions = provideMemoryRuntime(ctx)
  const memoryPlugins = new MemoryPluginManagement(ctx, extensions, hostSettings)
  const pluginInstallation = new MemoryPluginInstallation(ctx)
  const effectiveConfig = (value: MemoryConfig) => memoryPlugins.resolveConfig(resolveConfig(value), value.memoryView ?? { entries: {} })
  const settings = hostSettings.register<MemoryConfig>('memory', PlainConfig, {
    base: config,
    applies: 'live',
    // Profile writes commit asynchronously. Check that the candidate composes
    // now, then build from the committed live references on volatile-update.
    validate: value => createGraphAwaitingWorkspace(effectiveConfig(value), extensions)?.dispose(),
  })
  const startupConfig = effectiveConfig(settings.get())
  const startup = createGraphAwaitingWorkspace(startupConfig, extensions)
  const runtime = new LiveMemoryRuntime(startup, optionalWorkspaceRegistry(ctx), ctx.agents, extensions, startupConfig)
  runtime.useGitHubAuth(optionalGitHubAuth(ctx))
  // The automatic Git backup is one timer for the whole Host, not one per
  // graph: a settings write builds and disposes a throwaway graph to validate
  // itself, and a timer owned by a graph would be armed and dropped again on
  // every keystroke in the settings form.
  const autoBackup = new MemoryAutoBackupScheduler(runtime)
  runtime.useAutoBackup(() => autoBackup.snapshot())
  // A Host still waiting for its first workspace has the configured scope already: reading the
  // full resolved config would need the graph that workspace will build.
  const resolved = startup?.config ?? effectiveConfig(settings.get())
  ctx.effect(() => hostSettings.onUpdated((namespace, value) => {
    if (namespace === memoryPlugins.settingsNamespace) {
      const config = effectiveConfig(settings.get())
      const graph = createGraphAwaitingWorkspace(config, extensions)
      if (graph !== undefined) runtime.swap(graph)
      else runtime.defer(config)
      return
    }
    if (namespace !== 'memory') return
    const config = effectiveConfig(value as MemoryConfig)
    // Saving a workspace-scoped setting before any conversation names a workspace keeps the
    // Host waiting for one instead of serving the user-wide graph under that scope.
    const graph = createGraphAwaitingWorkspace(config, extensions)
    if (graph !== undefined) runtime.swap(graph)
    else runtime.defer(config)
  }), 'dsh-plugin-memory: live runtime settings')
  ctx.effect(() => memoryPlugins.start(), 'dsh-plugin-memory: plugin graph settings')
  hostSettings.register('memory-ui', InteractionConfig, {
    base: resolveInteractionConfig(resolved.conversationInteraction),
    applies: 'live',
  })
  // 技能管理's settings: read at every turn and review, so a change applies at once.
  const skillSettings = hostSettings.register<ResolvedSkillsConfig>('memory-skills', SkillsConfig, {
    base: { ...DEFAULT_SKILLS_CONFIG },
    applies: 'live',
  })
  ctx.effect(() => {
    let disposed = false
    const migrate = (): void => {
      if (disposed) return
      void migrateLegacyDisplayMode(hostSettings).catch(error => {
        console.warn('dsh-plugin-memory: could not persist the builtin displayMode migration', error)
      })
    }
    const unsubscribe = ctx.on('settings/document-updated', ((namespace: string) => {
      if (namespace === 'memory') migrate()
    }) as never)
    migrate()
    return () => { disposed = true; unsubscribe() }
  }, 'dsh-plugin-memory: canonical displayMode migration')
  ctx.effect(() => {
    let disposed = false
    const loader = ctx.get('loader') as { await?(): Promise<unknown> } | undefined
    void Promise.resolve(loader?.await?.()).then(async () => {
      if (disposed) return
      const catalog = await memoryPlugins.catalog()
      if (disposed) return
      await hostSettings.importLegacy(catalog.entries.filter(entry => entry.roles.includes('source')).map(entry => entry.entryId))
    }).catch(error => { console.warn('dsh-plugin-memory: could not recover retained legacy settings', error) })
    return () => { disposed = true }
  }, 'dsh-plugin-memory: retained settings migration')
  const coordinator: MemorySubagentCoordinator = new MemorySubagentCoordinator(ctx.subagents, runtime, ctx, () => {
    const taskAgentModel = runtime.config.taskAgentModel
    if (taskAgentModel.mode !== 'fixed') return undefined
    const provider = taskAgentModel.provider?.trim()
    const model = taskAgentModel.model?.trim()
    if (provider === undefined || provider === '' || model === undefined || model === '') return undefined
    return { provider, model }
  }, () => runtime.config.runtimeMemory.maintenanceMaxTokens,
  (scope, signal, operation) => lifecycle.runRuntimeMaintenanceTask(scope, signal, operation))
  const lifecycle = new MemoryLifecycle(ctx, coordinator, runtime.config, runtime)
  const skills = new SkillEvolution({
    settings: () => skillSettings.get(),
    source: agent => skillsSourceFor(runtime, agent),
    runTask: (workspaceRoot, signal, operation, route) => lifecycle.runSkillTask(workspaceRoot, signal, operation, route),
    skillTask: (parent, label, prompt, schema, persona, signal) => coordinator.skillTask(parent, label, prompt, schema, persona, signal, taskRoute(parent)),
  })
  lifecycle.useSkillEvolution(skills)
  // Registered before the lifecycle root so teardown runs the other way round:
  // the timer stops first, and only then does the runtime it reads go away.
  ctx.effect(() => {
    const stop = autoBackup.start()
    return () => { stop() }
  }, 'dsh-plugin-memory: automatic Git backup')
  ctx.effect(() => {
    const stop = lifecycle.start()
    return async () => {
      stop()
      skills.dispose()
      await coordinator.dispose()
      runtime.dispose()
    }
  }, 'dsh-plugin-memory.lifecycle-root()')
  ctx.effect(() => {
    const loader = ctx.get('loader') as { await?(): Promise<unknown> } | undefined
    return registerTools(ctx, runtime, coordinator, extensions, loader?.await?.())
  }, 'dsh-plugin-memory: Source tool lifecycle')
  registerCommands(ctx.commands, runtime, coordinator)
  registerGuidance(ctx, resolved)
  ctx.inject(['connection', 'webServer'], (webContext) => {
    // `inject` guarantees the service at runtime; retain the defensive guard
    // because HostContextShape also models profiles where it is absent.
    // Connection's RPC getter keeps its provider's injection scope. Carry
    // the explicitly injected server on our own Context so late registration
    // works without changing or restarting the shared Connection plugin.
    const connection = Context.is(webContext)
      ? webContext.extend({ webServer: webContext.get('webServer') }).connection
      : webContext.connection
    if (connection === undefined) return
    // The Starter updates through DSH's own plugin manager and profile, so a packaged
    // app's bundled pnpm serves it where no pnpm is on PATH.
    const versions = new VersionUpdateManager({
      memoryCliPath: () => runtime.config.cliPath,
      bundleInstaller: () => ctx.get('pluginManager') as DshBundleInstaller | undefined,
      runningProfile: () => {
        const profile = ctx.get('profileContext') as { dir?: unknown; packageManager?: unknown } | undefined
        return typeof profile?.dir === 'string' ? { dir: profile.dir, packageManager: profile.packageManager !== undefined } : undefined
      },
      pluginCommand: () => dshPluginCommand(ctx.get('profileContext')),
    })
    const rpc = registerRpc(connection, runtime, lifecycle, versions, () => autoBackup.refresh(), () => hasNativeDirectoryPicker(ctx))
    const settings = registerSettingsRpc(connection, hostSettings)
    const view = registerViewRpc(connection, runtime, extensions, memoryPlugins, lifecycle, pluginInstallation)
    if (Context.is(webContext)) {
      new MemoryRemoteService(webContext, {
        ...rpc,
        settings,
        view: view.read,
        viewWrite: view.write,
        management: resolved.remoteAccess === 'trusted-host',
      })
    }
  })
}
