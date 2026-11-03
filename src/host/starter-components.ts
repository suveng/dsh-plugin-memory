// The memory components the dsh-plugin-memory Starter ships, named once for the
// Host, the browser client and the repository scripts. Keep this file plain
// data with erasable types only and no imports: the scripts load it as is,
// with Node's own TypeScript support, without a build step.

/**
 * The component rows the Starter's bundle patch (cordis.patch.yml) declares,
 * in its order: each row's id and the package it names. DSH lists them under
 * the bundle's page. Tests keep this list equal to that patch and to the
 * versions package.json pins.
 */
export const STARTER_COMPONENT_ROWS: ReadonlyArray<{ rowId: string; packageName: string }> = [
  { rowId: 'memory-source-runtime', packageName: 'dsh-plugin-memory-source-runtime' },
  { rowId: 'memory-source-documents', packageName: 'dsh-plugin-memory-source-documents' },
  { rowId: 'memory-source-memory-spaces', packageName: 'dsh-plugin-memory-source-memory-spaces' },
  { rowId: 'memory-source-skills', packageName: 'dsh-plugin-memory-source-skills' },
  { rowId: 'memory-strategy-default-three-tier', packageName: 'dsh-plugin-memory-strategy-default-three-tier' },
  { rowId: 'memory-strategy-general', packageName: 'dsh-plugin-memory-strategy-general' },
  { rowId: 'memory-strategy-auto-capture', packageName: 'dsh-plugin-memory-strategy-auto-capture' },
  { rowId: 'memory-strategy-light-context', packageName: 'dsh-plugin-memory-strategy-light-context' },
  { rowId: 'memory-strategy-scoped', packageName: 'dsh-plugin-memory-strategy-scoped' },
]

/** The three enhancements the Starter ships switched off, in the order the Host suggests them for installation. */
export const STARTER_ENHANCEMENT_PACKAGES: readonly string[] = [
  'dsh-plugin-memory-strategy-scoped', 'dsh-plugin-memory-strategy-light-context', 'dsh-plugin-memory-strategy-auto-capture',
]

/**
 * The shipped packages that carry a bundle patch of their own, so that one
 * installed alone registers its row itself: the enhancements and the General
 * strategy. Under the Starter its rows own them, so a profile that also linked
 * them as separate bundles would declare those ids twice. A literal, not a
 * spread of the list above, so that a bundle that does not use it drops it.
 */
export const STARTER_SELF_REGISTERING_PACKAGES: readonly string[] = [
  'dsh-plugin-memory-strategy-scoped', 'dsh-plugin-memory-strategy-light-context', 'dsh-plugin-memory-strategy-auto-capture', 'dsh-plugin-memory-strategy-general',
]
