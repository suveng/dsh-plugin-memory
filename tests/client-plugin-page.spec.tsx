// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PluginPackageRef, PluginsSubject } from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type { StandardSourceBinding } from '@deepseek-ai/dsh-client-ui-slots'

const RUNTIME = 'dsh-plugin-memory-source-runtime'

vi.mock('../src/client/MemorySettingsCard.tsx', () => ({
  // The card's composition board shows a component's gear and page from what it is given.
  MemorySettingsCard: ({ language, componentSettings }: { language?: string; componentSettings?: { has(name: string): boolean; render(entry: unknown, page: unknown): ReactNode } }) => (
    <section aria-label="configuration" data-language={language}>
      {componentSettings?.has(RUNTIME) === true
        ? componentSettings.render({ packageName: RUNTIME }, { enabled: true, label: 'Runtime Memory', writable: true, language: language ?? 'en' })
        : <p>No component settings</p>}
    </section>
  ),
}))

import { MemoryActionSeat } from '../src/client/action-seat.ts'
import { MemoryComponentListSeat } from '../src/client/component-list-seat.ts'
import { MemoryPluginActions } from '../src/client/MemoryPluginActions.tsx'
import { MemorySettingsHost } from '../src/client/MemorySettingsHost.tsx'
import { translateEn } from '../src/client/locales.ts'
import type { Config } from '../src/host/protocol.ts'
import { settingsScope } from './helpers/settings-scope.ts'

afterEach(cleanup)

function store<T>(value: T) {
  return { getSnapshot: () => value, subscribe: () => () => {} }
}

const pkg: PluginPackageRef = { name: 'dsh-plugin-memory', installed: true, availability: 'profile', official: false, enabled: true, rows: [{ rowId: 'memory', moduleName: 'dsh-plugin-memory', enabled: true }] }
const bundle = (overrides: Partial<PluginPackageRef> = {}): PluginsSubject => ({ kind: 'bundle', pkg: { ...pkg, ...overrides } })

describe('dsh-plugin-memory page under DSH Plugins', () => {
  it('renders the configuration only for the page view the Plugins page asks for', () => {
    const props = {
      scope: settingsScope<Config>({ status: 'ready', value: {}, writable: true, mode: 'host' }),
      currentSession: store<StandardSourceBinding>({ key: undefined, hooks: {}, keyedHooks: {}, props: {} }),
      sessions: { list: store({ byId: {} }) } as never,
      workspaces: { list: store({ items: [] }) } as never,
      localeRuntime: { ...store({ active: 'en', locales: [], revision: 0 }) } as never,
      t: translateEn,
    }
    const { rerender } = render(<MemorySettingsHost {...props} view="summary" />)
    expect(screen.queryByRole('region', { name: 'configuration' })).toBeNull()
    rerender(<MemorySettingsHost {...props} view="page" />)
    expect(screen.getByRole('region', { name: 'configuration' }).dataset.language).toBe('en')
  })

  it('renders the settings components contributed, also where the page is drawn outside DSH\'s slot renderer', () => {
    const props = {
      scope: settingsScope<Config>({ status: 'ready', value: {}, writable: true, mode: 'host' }),
      currentSession: store<StandardSourceBinding>({ key: undefined, hooks: {}, keyedHooks: {}, props: {} }),
      sessions: { list: store({ byId: {} }) } as never,
      workspaces: { list: store({ items: [] }) } as never,
      localeRuntime: { ...store({ active: 'en', locales: [], revision: 0 }) } as never,
      componentSettingsDirectory: store<ReadonlySet<string>>(new Set([RUNTIME])),
      t: translateEn,
    }
    const renderContributed = vi.fn((packageName: string) => <p>{packageName} contributed</p>)
    const renderSlot = vi.fn((_slot: string, _owner: unknown, options: { entryKey: string }) => <p>{options.entryKey} through DSH</p>)

    // DSH's Plugins page renders the entry itself and passes its renderSlot.
    const { rerender } = render(<MemorySettingsHost {...props} view="page" renderSlot={renderSlot as never} renderContributed={renderContributed} />)
    expect(screen.getByText(`${RUNTIME} through DSH`)).toBeTruthy()
    expect(renderContributed).not.toHaveBeenCalled()

    // Issue #340: a shell that draws the page itself passes no renderSlot.
    rerender(<MemorySettingsHost {...props} view="page" renderContributed={renderContributed} />)
    expect(screen.getByText(`${RUNTIME} contributed`)).toBeTruthy()
    expect(renderContributed).toHaveBeenCalledWith(RUNTIME, expect.objectContaining({ component: { packageName: RUNTIME, label: 'Runtime Memory', enabled: true }, writable: true, language: 'en' }))

    // Without either, the page has no way to show them.
    rerender(<MemorySettingsHost {...props} view="page" />)
    expect(screen.getByText('No component settings')).toBeTruthy()
  })

  it('offers the memory workspace from the dsh-plugin-memory page only while a placement can show it', () => {
    const workspace = new MemoryActionSeat()
    const { rerender } = render(<MemoryPluginActions subject={bundle()} workspace={workspace} t={translateEn} />)
    expect(screen.queryByRole('button')).toBeNull()

    const open = vi.fn()
    let withdraw = (): void => {}
    act(() => { withdraw = workspace.provide(open) })
    fireEvent.click(screen.getByRole('button', { name: 'Open Memory System' }))
    expect(open).toHaveBeenCalledOnce()

    for (const subject of [
      bundle({ enabled: false }),
      bundle({ name: 'dsh-plugin-memory-strategy-general' }),
      { kind: 'row', pkg, row: pkg.rows[0]! },
      { kind: 'item', id: 'web-search' },
    ] satisfies PluginsSubject[]) {
      rerender(<MemoryPluginActions subject={subject} workspace={workspace} t={translateEn} />)
      expect(screen.queryByRole('button')).toBeNull()
    }

    rerender(<MemoryPluginActions subject={bundle()} workspace={workspace} t={translateEn} />)
    act(() => withdraw())
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('reports whether DSH lists the Starter\'s grouping row below the configuration', () => {
    const workspace = new MemoryActionSeat()
    const componentList = new MemoryComponentListSeat()
    const listener = vi.fn()
    componentList.subscribe(listener)
    const groupRows = [{ rowId: 'memory-bundle', moduleName: 'dsh-plugin-memory/bundle', enabled: false }, ...pkg.rows]
    const grouped = bundle({ rows: groupRows })
    // DSH 0.2.0 lists the grouping row, always off; DSH 0.2.1 lists only the components.
    const { rerender, unmount } = render(<MemoryPluginActions subject={grouped} workspace={workspace} componentList={componentList} t={translateEn} />)
    expect(componentList.getSnapshot()).toBe(true)
    rerender(<MemoryPluginActions subject={bundle()} workspace={workspace} componentList={componentList} t={translateEn} />)
    expect(componentList.getSnapshot()).toBe(false)
    // A disabled bundle still lists its rows; another page reports nothing.
    rerender(<MemoryPluginActions subject={bundle({ rows: groupRows, enabled: false })} workspace={workspace} componentList={componentList} t={translateEn} />)
    expect(componentList.getSnapshot()).toBe(true)
    rerender(<MemoryPluginActions subject={{ kind: 'item', id: 'web-search' }} workspace={workspace} componentList={componentList} t={translateEn} />)
    expect(componentList.getSnapshot()).toBeUndefined()
    rerender(<MemoryPluginActions subject={grouped} workspace={workspace} componentList={componentList} t={translateEn} />)
    unmount()
    expect(componentList.getSnapshot()).toBeUndefined()
    expect(listener.mock.calls.length).toBeGreaterThan(0)
  })

  it('keeps the newest component list report when an older page withdraws late', () => {
    const seat = new MemoryComponentListSeat()
    const listener = vi.fn()
    seat.subscribe(listener)
    const older = seat.report(true)
    const newer = seat.report(false)
    older()
    expect(seat.getSnapshot()).toBe(false)
    newer()
    expect(seat.getSnapshot()).toBeUndefined()
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('keeps the newest offer when an older owner withdraws late', () => {
    const seat = new MemoryActionSeat()
    const listener = vi.fn()
    seat.subscribe(listener)
    const first = vi.fn()
    const second = vi.fn()
    const withdrawFirst = seat.provide(first)
    const withdrawSecond = seat.provide(second)
    withdrawFirst()
    expect(seat.getSnapshot()).toBe(second)
    withdrawSecond()
    expect(seat.getSnapshot()).toBeUndefined()
    expect(listener).toHaveBeenCalledTimes(3)
  })
})
