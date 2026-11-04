// Browser-only public helpers behind suveng-dsh-plugin-memory/client. No Source registration,
// default workbench, Host Context, or raw transport is part of this module.
export {
  installMemorySourceUI, memorySourcePageEntryId, MEMORY_SOURCE_PAGE_SLOT,
  MEMORY_SOURCE_CONFIGURATION_MUTATE, MEMORY_SOURCE_CONFIGURATION_READ,
  type MemorySourcePageComponent, type MemorySourcePageDefinition,
  type MemorySourcePageProps, type MemorySourceUIContribution, type MemorySourceUIContext, type MemorySourcePageNavigation,
} from './source-pages.tsx'
export type { MemorySourceManagementClient, MemorySourcePageInstance } from './source-contracts.ts'
// The directory a page may offer as a per-run model choice, as its management
// client answers it; the pages read it and nothing else here drives it.
export type { TaskAgentModelCatalog, TaskAgentModelCatalogGroup, TaskAgentModelCatalogModel } from 'suveng-dsh-plugin-memory/contracts'
export {
  installMemoryComponentUI, MEMORY_COMPONENT_FALLBACK_PRIORITY, MEMORY_COMPONENT_SETTINGS_SLOT, MEMORY_COMPONENT_STATUS_SLOT,
  type MemoryComponentConfigurationSnapshot, type MemoryComponentHost,
  type MemoryComponentSettingsComponent, type MemoryComponentSettingsProps, type MemoryComponentStatusComponent, type MemoryComponentStatusProps,
  type MemoryComponentUIContext, type MemoryComponentUIContribution,
} from './component-ui.tsx'
// What Memory Spaces' own settings are drawn with, the controls and styles suveng-dsh-plugin-memory drew them with.
export { memorySettingsStyles, ToggleRow } from './settings-controls.tsx'
export { PanelActions, useLive, useStaged, WriteFailure } from './settings-panel.tsx'
export { Callout, Reveal } from './feedback.tsx'
export { GlobalLocationSetting } from './GlobalLocationSetting.tsx'
export * from './page-kit.tsx'
export * from './page-controls.tsx'
export * from './page-client.tsx'
export { MemoryDialog, type MemoryDialogProps } from './MemoryDialog.tsx'
export { MemoryLogo } from './MemoryLogo.tsx'
export { useRequestVersion } from './use-request-version.ts'
export { appearanceClass } from './view-styles.ts'
export { translateEn, translateZh, type MemoryKey, type MemoryTranslate } from './locales.ts'
export { IconChevronLeftOutline14 } from './ui-icons.ts'
