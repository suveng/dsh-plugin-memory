import { STARTER_COMPONENT_ROWS } from '../host/protocol.ts'
import type { MemoryPluginEntryView } from '../host/view-protocol.ts'
import type { MemoryTranslate } from './locales.ts'

/** Packages the suveng-dsh-plugin-memory Starter installs; any other component came from an installed extension. */
const SHIPPED_PACKAGES: ReadonlySet<string> = new Set(STARTER_COMPONENT_ROWS.map(row => row.packageName))

/** Shipped components still taking shape: their row and page say so, and they may change more than the rest. */
const EXPERIMENTAL_PACKAGES: ReadonlySet<string> = new Set(['suveng-dsh-plugin-memory-source-skills'])

/** Whether a component is marked experimental. */
export function isExperimental(entry: Pick<MemoryPluginEntryView, 'packageName'>): boolean {
  return EXPERIMENTAL_PACKAGES.has(entry.packageName)
}

/** Whether a component ships with suveng-dsh-plugin-memory rather than an installed extension. */
export function isShipped(entry: MemoryPluginEntryView): boolean {
  return SHIPPED_PACKAGES.has(entry.packageName)
}

/**
 * A component's name and description in the page's language, from its own
 * declaration: shipped and installed components are named the same way.
 */
export function componentCopy(entry: MemoryPluginEntryView, language: string): { label: string; hint: string } {
  const zh = language.toLowerCase().startsWith('zh')
  return { label: zh ? entry.label['zh-CN'] : entry.label.en, hint: zh ? entry.description['zh-CN'] : entry.description.en }
}

/** Quoted names joined in the page's language. */
export function nameList(names: readonly string[], t: MemoryTranslate): string {
  return names.map(name => t('config.quoted', { name })).join(t('config.listSeparator'))
}
