import {
  MEMORY_SETTINGS_NAMESPACE,
  MEMORY_SKILLS_SETTINGS_NAMESPACE,
  MEMORY_UI_SETTINGS_NAMESPACE,
  normalizeDisplayMode,
  STARTER_COMPONENT_ROWS,
  type ClientConnectionHandle,
  type Config,
  type InteractionConfig,
  type MemoryDisplayMode,
  type SkillsConfig,
} from "../host/protocol.ts"
import { MemoryComponentRowHost, MemorySettingsHost } from './MemorySettingsHost.tsx'
import { createComponentSettingsDirectory, type MemoryComponentSettingsProps, MEMORY_COMPONENT_SETTINGS_SLOT, MEMORY_COMPONENT_STATUS_SLOT, renderComponentRegion } from './component-ui.tsx'
import { directoryPicker } from './picker.ts'
import { createComponentHosts } from './component-host.ts'
import { installShippedComponentSettings } from './component-settings.tsx'
import { installShippedComponentStatus } from './component-status.tsx'
import { MemoryTurnTail } from './MemoryTurnTail.tsx'
import { SkillTurnTail } from './SkillTurnTail.tsx'
import { isSkillsPage, mountSkillsPanel, SkillsPanelSeat } from './skills-panel.tsx'
import { MemoryPluginActions, MEMORY_PACKAGE_NAME } from './MemoryPluginActions.tsx'
import { MemorySaveAction } from './MemorySaveAction.tsx'
import { MemoryActionSeat } from './action-seat.ts'
import { MemoryComponentListSeat } from './component-list-seat.ts'
import { reopenAfterStarterUpdate } from './starter-update.ts'
import { MemoryChangeSignal } from './change-signal.ts'
import { en, zh, type MemoryKey } from './locales.ts'
import { MemorySettingsScope } from './settings.ts'
import type { MemoryClientContext } from "./dsh-context.ts"
import {
  createMemorySourcePageDirectory,
  MEMORY_SOURCE_PAGE_SLOT,
} from './source-pages.tsx'
import { MemoryBetterSidebarSeat } from './better-sidebar-seat.ts'
import {
  MemorySidebarWorkspaceHost,
  MemoryBuiltinWorkspaceHost,
} from './workspace-mount.tsx'
import { MemoryNativeSidebarSeat } from './native-sidebar-seat.ts'
import { mountMemorySidebarNavigation } from './native-sidebar.tsx'
import { mountBetterSidebarTab } from './better-sidebar.tsx'
import { MemoryWorkspaceController } from './workspace-controller.ts'
import { MEMORY_ANCHOR_EVENT, type MemoryAnchor } from './anchor.ts'
import { mountSubagentTokenUsageOverride } from './subagent-token-usage.tsx'
import { isRecord } from './is-record.ts'

export * from './extension-sdk.ts'

export const inject = ['slots', 'sessions', 'workspaces', 'uiSession', 'connection', 'locale', 'layout']

/** Interaction surfaces: slot name, settings toggle, and the registrations it owns. */
type MemoryNamespace = 'memory'
type InteractionSlot = 'conversation.chat.turnTail' | 'conversation.chat.assistant-actions'
type InteractionRegister = (ctx: MemoryClientContext, namespace: MemoryNamespace, translate: (key: MemoryKey, params?: Record<string, unknown>) => string, settings: MemorySettingsScope<Config>) => () => void

interface InteractionUnit {
  slot: InteractionSlot
  enabled: (value: unknown) => boolean
  register: InteractionRegister
}

const INTERACTION_UNITS: Record<'turnBar' | 'saveAction', InteractionUnit> = {
  turnBar: {
    slot: 'conversation.chat.turnTail',
    enabled: (value: unknown): boolean => enabledOf(value, 'turnBar'),
    register(ctx: MemoryClientContext, namespace: MemoryNamespace, translate: (key: MemoryKey, params?: Record<string, unknown>) => string): () => void {
      return ctx.slots.register({
        name: 'conversation.chat.turnTail',
        id: 'dsh-plugin-memory/turn-tail',
        locale: namespace,
        inject: (sessionId: unknown): { sessionId?: string; connection: ClientConnectionHandle; localeRuntime: MemoryClientContext['locale']; t: (key: MemoryKey, params?: Record<string, unknown>) => string } => ({
          ...(typeof sessionId === 'string' && sessionId !== '' ? { sessionId } : {}),
          connection: ctx.connection,
          localeRuntime: ctx.locale,
          t: translate as (key: MemoryKey, params?: Record<string, unknown>) => string,
        }),
      }, MemoryTurnTail)
    },
  },
  saveAction: {
    slot: 'conversation.chat.assistant-actions',
    enabled: (value: unknown): boolean => enabledOf(value, 'saveAction'),
    register(ctx: MemoryClientContext, namespace: MemoryNamespace, translate: (key: MemoryKey, params?: Record<string, unknown>) => string, settings: MemorySettingsScope<Config>): () => void {
      return ctx.slots.register({
        name: 'conversation.chat.assistant-actions',
        id: 'memory-save',
        order: 90,
        locale: namespace,
        inject: (sessionId: unknown): { sessionId?: string; connection: ClientConnectionHandle; settingsScope: MemorySettingsScope<Config>; localeRuntime: MemoryClientContext['locale']; t: (key: MemoryKey, params?: Record<string, unknown>) => string } => ({
          ...(typeof sessionId === 'string' && sessionId !== '' ? { sessionId } : {}),
          connection: ctx.connection,
          settingsScope: settings,
          localeRuntime: ctx.locale,
          t: translate as (key: MemoryKey, params?: Record<string, unknown>) => string,
        }),
      }, MemorySaveAction)
    },
  },
}

type InteractionUnitKey = keyof typeof INTERACTION_UNITS

/** Ready snapshots default each interaction on; loading has no value and mounts nothing. */
function enabledOf(value: unknown, key: 'turnBar' | 'saveAction'): boolean {
  return isRecord(value) && value[key] !== false
}

/**
 * What one surface offers or tells another: the configuration page under
 * Plugins, the workspace in its placement, and changes the workspace cannot
 * see by itself: components switched through DSH's plugin manager, and memory
 * a sync, a merge, an import or an applied plan on the configuration page wrote.
 */
interface MemorySeats {
  configuration: MemoryActionSeat
  workspace: MemoryActionSeat
  components: MemoryChangeSignal
  componentList: MemoryComponentListSeat
  /** 技能管理's settings, and whether it has a sidebar entry of its own. */
  skills: { scope: MemorySettingsScope<SkillsConfig>; panel: SkillsPanelSeat }
}

/** Whether an anchor opens 技能管理 in its own entry rather than in the Memory System. */
function skillsApart(event: Event, seats: MemorySeats): boolean {
  const page = (event as CustomEvent<MemoryAnchor>).detail?.page
  return page !== undefined && isSkillsPage(page) && seats.skills.panel.getSnapshot()
}

/** The DSH describe revision of one Host entry, as `ctx.configForms` reports it. */
interface HostSettingsRevision {
  getSnapshot(): { revision: number | undefined }
  subscribe(listener: () => void): () => void
}

/**
 * Re-read Memory settings when DSH reports a newer revision of the `memory`
 * entry, such as a profile edit or another page's save. Pages without a Host
 * settings mirror (remote pages) never report one and keep their own reads.
 */
function followHostSettings(form: HostSettingsRevision, scopes: ReadonlyArray<MemorySettingsScope<Config> | MemorySettingsScope<InteractionConfig> | MemorySettingsScope<SkillsConfig>>): () => void {
  let seen = form.getSnapshot().revision
  return form.subscribe(() => {
    const revision = form.getSnapshot().revision
    if (revision === undefined || revision === seen) return
    seen = revision
    for (const scope of scopes) if (scope.getSnapshot().revision !== revision) void scope.refresh()
  })
}

function mountSidebarMemoryView(ctx: MemoryClientContext, settings: MemorySettingsScope<Config>, namespace: MemoryNamespace, translate: (key: MemoryKey, params?: Record<string, unknown>) => string, seats: MemorySeats): () => void {
  const controller = new MemoryWorkspaceController()
  let launcher: ReturnType<typeof mountMemorySidebarNavigation> | undefined
  const navigation = {
    open: () => { if (launcher === undefined) controller.open(); else launcher.open() },
    close: () => { if (launcher === undefined) controller.close(); else launcher.close() },
  }
  const sourcePageDirectory = createMemorySourcePageDirectory(ctx)
  const betterSidebarSeat = new MemoryBetterSidebarSeat()
  const nativeSidebarSeat = new MemoryNativeSidebarSeat()
  const slotName = 'shell.overlay'
  const disposeView = ctx.slots.inject(slotName, () => ctx.slots.register({
    name: slotName,
    id: 'memory',
    order: 30,
    label: () => translate('tab.label'),
    locale: namespace,
    children: {
      [MEMORY_SOURCE_PAGE_SLOT]: { kind: 'list', scope: 'root' },
      [MEMORY_COMPONENT_STATUS_SLOT]: { kind: 'keyed', scope: 'root' },
    },
    inject: () => ({
      connection: ctx.connection,
      settingsScope: settings,
      sessions: ctx.sessions,
      workspaces: ctx.workspaces,
      currentSession: ctx.uiSession.adapter.current,
      localeRuntime: ctx.locale,
      sourcePageDirectory,
      navigation,
      controller,
      betterSidebarSeat,
      nativeSidebarSeat,
      configuration: seats.configuration,
      componentChanges: seats.components,
      skillsScope: seats.skills.scope,
      skillsPanel: seats.skills.panel,
      t: translate,
    }),
  }, MemorySidebarWorkspaceHost))
  let disposeBetterSidebar: (() => void) | undefined
  let withdrawWorkspace: (() => void) | undefined
  let listening = false
  let disposed = false
  const openMemoryView = (event?: Event): void => { if (event === undefined || !skillsApart(event, seats)) navigation.open() }
  const dispose = (): void => {
    if (disposed) return
    disposed = true
    withdrawWorkspace?.()
    try {
      launcher?.dispose()
    } finally {
      if (listening) window.removeEventListener(MEMORY_ANCHOR_EVENT, openMemoryView)
      try {
        disposeBetterSidebar?.()
      } finally {
        disposeView()
      }
    }
  }
  try {
    disposeBetterSidebar = mountBetterSidebarTab(ctx, translate, betterSidebarSeat)
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      window.addEventListener(MEMORY_ANCHOR_EVENT, openMemoryView)
      listening = true
      launcher = mountMemorySidebarNavigation(ctx, translate, controller, nativeSidebarSeat)
    }
    withdrawWorkspace = seats.workspace.provide(() => openMemoryView())
    return dispose
  } catch (error) {
    dispose()
    throw error
  }
}

/** DSH supplies the owning session; Source pages retain the same render contract. */
function mountBuiltinMemoryView(ctx: MemoryClientContext, settings: MemorySettingsScope<Config>, namespace: MemoryNamespace, translate: (key: MemoryKey, params?: Record<string, unknown>) => string, seats: MemorySeats): () => void {
  const sourcePageDirectory = createMemorySourcePageDirectory(ctx)
  const disposeView = ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'memory',
    order: 30,
    label: () => translate('tab.label'),
    locale: namespace,
    children: {
      [MEMORY_SOURCE_PAGE_SLOT]: { kind: 'list', scope: 'root' },
      [MEMORY_COMPONENT_STATUS_SLOT]: { kind: 'keyed', scope: 'root' },
    },
    inject: sessionId => ({
      connection: ctx.connection,
      settingsScope: settings,
      sessionId,
      localeRuntime: ctx.locale,
      sourcePageDirectory,
      configuration: seats.configuration,
      componentChanges: seats.components,
      skillsScope: seats.skills.scope,
      skillsPanel: seats.skills.panel,
      t: translate,
    }),
  }, MemoryBuiltinWorkspaceHost))
  if (typeof window === 'undefined' || typeof document === 'undefined') return disposeView
  const selectMemoryTab = (): boolean => {
    const label = translate('tab.label').trim()
    const eligible = (candidate: HTMLElement): boolean => !candidate.hasAttribute('disabled')
      && candidate.getAttribute('aria-disabled') !== 'true' && candidate.closest('[hidden], [aria-hidden="true"]') === null
    const conversations = [...document.querySelectorAll<HTMLElement>('[data-slot="main.conversation"]')].filter(eligible)
    if (conversations.length !== 1) return false
    const tabs = [...conversations[0]!.querySelectorAll<HTMLElement>('[role="tab"]')]
      .filter(candidate => candidate.textContent?.trim() === label && eligible(candidate))
    // Split panes can expose identically labelled tabs without a public
    // session marker. Keep the anchor pending instead of choosing a pane.
    if (tabs.length !== 1) return false
    tabs[0]!.click()
    return true
  }
  const openView = (event: Event): void => {
    if (skillsApart(event, seats)) return
    const sessionId = (event as CustomEvent<MemoryAnchor>).detail?.sessionId
    const mainSessionId = ctx.uiSession.adapter.current.getSnapshot().key
    if (mainSessionId === undefined || (sessionId !== undefined && sessionId !== mainSessionId)) return
    selectMemoryTab()
  }
  window.addEventListener(MEMORY_ANCHOR_EVENT, openView)
  // Another main panel, such as Plugins, first returns to the conversation,
  // whose tabs render a frame or more later.
  let frame: number | undefined
  const openFromPanel = (): void => {
    ctx.layout.selectPanel(null)
    let attempts = 0
    const attempt = (): void => {
      frame = undefined
      if (selectMemoryTab() || (attempts += 1) >= 30) return
      frame = requestAnimationFrame(attempt)
    }
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = requestAnimationFrame(attempt)
  }
  // Builtin lives in a conversation's tabs, which exist once the current
  // conversation is a listed session rather than an unsent draft.
  const current = ctx.uiSession.adapter.current
  const sessions = ctx.sessions.list
  let withdrawWorkspace: (() => void) | undefined
  const followSession = (): void => {
    const key = current.getSnapshot().key
    const open = key !== undefined && Object.hasOwn(sessions.getSnapshot().byId, key)
    if (open && withdrawWorkspace === undefined) withdrawWorkspace = seats.workspace.provide(openFromPanel)
    else if (!open && withdrawWorkspace !== undefined) { withdrawWorkspace(); withdrawWorkspace = undefined }
  }
  const unsubscribeSession = current.subscribe(followSession)
  const unsubscribeSessions = sessions.subscribe(followSession)
  followSession()
  return () => {
    unsubscribeSession()
    unsubscribeSessions()
    withdrawWorkspace?.()
    if (frame !== undefined) cancelAnimationFrame(frame)
    window.removeEventListener(MEMORY_ANCHOR_EVENT, openView)
    disposeView()
  }
}

/** Mount the memory workspace plus the optional in-conversation interaction surfaces. */
export function apply(rawContext: unknown): void {
  const ctx = rawContext as MemoryClientContext
  const settings = new MemorySettingsScope<Config>(ctx.connection, MEMORY_SETTINGS_NAMESPACE)
  const interactionSettings = new MemorySettingsScope<InteractionConfig>(ctx.connection, MEMORY_UI_SETTINGS_NAMESPACE)
  const skillsSettings = new MemorySettingsScope<SkillsConfig>(ctx.connection, MEMORY_SKILLS_SETTINGS_NAMESPACE)
  const seats: MemorySeats = {
    configuration: new MemoryActionSeat(), workspace: new MemoryActionSeat(), components: new MemoryChangeSignal(), componentList: new MemoryComponentListSeat(),
    skills: { scope: skillsSettings, panel: new SkillsPanelSeat() },
  }
  const namespace: MemoryNamespace = 'memory'
  ctx.effect(() => ctx.locale.register(namespace, { zh, en }), 'dsh-plugin-memory: locale dictionaries')
  const translate = ctx.locale.bind(namespace)
  // The Plugins page provides its navigation while it lives; the memory
  // workspace links to its configuration only then.
  ctx.inject(['pluginNavigation'], inner => {
    inner.effect(() => seats.configuration.provide(() => { inner.pluginNavigation.openBundle(MEMORY_PACKAGE_NAME) }), 'dsh-plugin-memory: configuration entry')
  })
  // DSH's plugin manager announces every component switch it applies, from its
  // Plugins page or Memory's own controls; a reconnect may have missed some.
  // This is the same signal DSH's Plugins page follows.
  ctx.inject(['remote'], inner => {
    inner.effect(() => {
      const remote = inner.remote as unknown as { $on(event: 'plugin-manager/changed', listener: () => void): () => void }
      const disposers = [remote.$on('plugin-manager/changed', seats.components.bump), inner.on('connection/reset', seats.components.bump)]
      return () => { for (const dispose of disposers) dispose() }
    }, 'dsh-plugin-memory: component changes')
  })
  // DSH mirrors the Host settings document on loopback pages; follow its
  // revision of the `memory` entry so edits made elsewhere show up live.
  ctx.inject(['configForms'], inner => {
    inner.effect(() => followHostSettings(inner.configForms.get(MEMORY_SETTINGS_NAMESPACE), [settings, interactionSettings, skillsSettings]), 'dsh-plugin-memory: DSH settings revisions')
  })
  ctx.slots.inject(
    'conversation.session.header.lineage',
    () => mountSubagentTokenUsageOverride(ctx),
  )
  let activeMemoryWorkspace: { mode: MemoryDisplayMode; dispose: () => void } | undefined
  const reconcileMemoryWorkspace = (): void => {
    const snapshot = settings.getSnapshot()
    const mode = snapshot.status === 'loading' || snapshot.value?.tabEnabled === false
      ? undefined
      : normalizeDisplayMode(snapshot.value?.displayMode)
    if (activeMemoryWorkspace?.mode === mode) return
    activeMemoryWorkspace?.dispose()
    activeMemoryWorkspace = mode === undefined ? undefined : {
      mode,
      dispose: mode === 'builtin'
        ? mountBuiltinMemoryView(ctx, settings, namespace, translate, seats)
        : mountSidebarMemoryView(ctx, settings, namespace, translate, seats),
    }
  }
  ctx.effect(() => {
    const unsubscribe = settings.subscribe(reconcileMemoryWorkspace)
    reconcileMemoryWorkspace()
    return () => {
      unsubscribe()
      activeMemoryWorkspace?.dispose()
      activeMemoryWorkspace = undefined
    }
  }, 'dsh-plugin-memory: memory workspace entry')
  // DSH swaps this client in once a Starter update replaces its files, which
  // closed the Memory System the update ran from; reopen it, and Status
  // reopens the version dialog.
  ctx.effect(() => reopenAfterStarterUpdate(seats.workspace), 'dsh-plugin-memory: reopen after a Starter update')
  // DSH edits a plugin's configuration on its own page under Plugins;
  // Settings keeps only the read-only plugin inventory. The whole Memory
  // configuration is the dsh-plugin-memory bundle's page, between its description
  // and its components.
  // Components contribute their own settings to their pages there, keyed by package name.
  const componentSettingsDirectory = createComponentSettingsDirectory(ctx)
  // A shipped component whose settings dsh-plugin-memory used to draw reads its configuration and Host operations through these.
  const componentHost = createComponentHosts({ scope: settings, connection: ctx.connection, componentChanges: seats.components })
  const configurationServices = () => ({
    componentSettingsDirectory,
    componentHost,
    directoryPicker: directoryPicker(ctx),
    scope: settings,
    interactionScope: interactionSettings,
    connection: ctx.connection,
    sessions: ctx.sessions,
    workspaces: ctx.workspaces,
    currentSession: ctx.uiSession.adapter.current,
    localeRuntime: ctx.locale,
    componentChanges: seats.components,
    componentList: seats.componentList,
    t: translate,
  })
  // A child slot has one declaring entry, the configuration below. A page that
  // is not that entry's own render renders what a component registered there
  // as it was registered: DSH's row page for a component, and a shell that
  // draws the configuration outside DSH's slot renderer, which then passes no
  // renderSlot (#340).
  const renderContributed = (packageName: string, owner: MemoryComponentSettingsProps) => renderComponentRegion(ctx, MEMORY_COMPONENT_SETTINGS_SLOT, packageName, owner)
  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config',
    key: MEMORY_PACKAGE_NAME,
    locale: namespace,
    children: {
      [MEMORY_COMPONENT_SETTINGS_SLOT]: { kind: 'keyed', scope: 'root' },
    },
    inject: () => ({ ...configurationServices(), renderContributed }),
  }, MemorySettingsHost))
  // Each component row in DSH's list below opens a page of its own: the
  // component's page, with the settings it contributed, as the board opens it.
  for (const { rowId, packageName } of STARTER_COMPONENT_ROWS) {
    ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
      name: 'plugins.row.config',
      key: `${MEMORY_PACKAGE_NAME}#${rowId}`,
      locale: namespace,
      inject: () => ({ ...configurationServices(), component: packageName, renderContributed }),
    }, MemoryComponentRowHost))
  }
  // The shipped components' own settings and Status cards arrive the way an installed component's do.
  ctx.effect(() => installShippedComponentSettings(ctx, { scope: settings, skillsScope: skillsSettings, connection: ctx.connection, t: translate }), 'dsh-plugin-memory: shipped component settings')
  ctx.effect(() => installShippedComponentStatus(ctx), 'dsh-plugin-memory: shipped component status')
  ctx.slots.inject('plugins.detail.actions', () => ctx.slots.register({
    name: 'plugins.detail.actions',
    id: 'dsh-plugin-memory/open-workspace',
    locale: namespace,
    inject: () => ({ workspace: seats.workspace, componentList: seats.componentList, t: translate }),
  }, MemoryPluginActions))

  // In-conversation interaction surfaces default on and are bound live: each
  // settings change registers or disposes the slot contributions without a
  // reload. Until the snapshot loads, nothing registers (conservative default).
  const active = new Map<InteractionUnitKey, () => void>()
  const reconcile = (): void => {
    const value = interactionSettings.getSnapshot().value
    for (const key of Object.keys(INTERACTION_UNITS) as InteractionUnitKey[]) {
      const unit = INTERACTION_UNITS[key]
      const enabled = unit.enabled(value)
      if (enabled && !active.has(key)) {
        active.set(key, ctx.slots.inject(unit.slot, () => unit.register(ctx, namespace, translate, settings)))
      } else if (!enabled && active.has(key)) {
        active.get(key)!()
        active.delete(key)
      }
    }
  }
  ctx.effect(() => {
    const unsubscribe = interactionSettings.subscribe(reconcile)
    reconcile()
    return () => {
      unsubscribe()
      for (const dispose of [...active.values()].reverse()) dispose()
      active.clear()
    }
  }, 'dsh-plugin-memory: interaction surfaces')

  // 技能管理's own surfaces follow its settings live, as the interaction surfaces do:
  // the turn's skills line (on unless switched off) and its own sidebar entry (off unless switched on).
  let skillTail: (() => void) | undefined
  let skillsPanel: (() => void) | undefined
  const sourcePageDirectory = createMemorySourcePageDirectory(ctx)
  const reconcileSkills = (): void => {
    const snapshot = skillsSettings.getSnapshot()
    const ready = snapshot.status === 'ready'
    const hints = ready && snapshot.value?.hints !== false
    const sidebar = ready && snapshot.value?.sidebar === true
    if (hints && skillTail === undefined) {
      skillTail = ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
        name: 'conversation.chat.turnTail',
        id: 'dsh-plugin-memory/skill-tail',
        order: 100,
        locale: namespace,
        inject: (sessionId: unknown) => ({
          ...(typeof sessionId === 'string' && sessionId !== '' ? { sessionId } : {}),
          connection: ctx.connection,
          componentChanges: seats.components,
          localeRuntime: ctx.locale,
          t: translate as (key: MemoryKey, params?: Record<string, unknown>) => string,
        }),
      }, SkillTurnTail))
    } else if (!hints && skillTail !== undefined) {
      skillTail()
      skillTail = undefined
    }
    if (sidebar && skillsPanel === undefined) {
      skillsPanel = mountSkillsPanel(ctx, {
        connection: ctx.connection, settingsScope: settings, skillsScope: skillsSettings, sessions: ctx.sessions, workspaces: ctx.workspaces,
        currentSession: ctx.uiSession.adapter.current, localeRuntime: ctx.locale, sourcePageDirectory,
        configuration: seats.configuration, componentChanges: seats.components, t: translate,
      }, seats.skills.panel)
    } else if (!sidebar && skillsPanel !== undefined) {
      skillsPanel()
      skillsPanel = undefined
    }
  }
  ctx.effect(() => {
    const unsubscribe = skillsSettings.subscribe(reconcileSkills)
    reconcileSkills()
    return () => {
      unsubscribe()
      skillsPanel?.()
      skillTail?.()
      skillsPanel = undefined
      skillTail = undefined
    }
  }, 'dsh-plugin-memory: skills surfaces')
}
