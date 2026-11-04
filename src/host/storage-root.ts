import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import type { ResolvedConfig } from './config.ts'
import { MEMORY_DATA_DIRECTORY, resolveDataDir } from './data-directory.ts'
import { withMemoryStorageLock } from '../sdk/storage-lock.ts'
import { workspaceStorageId } from '../sdk/workspace-storage.ts'

export interface StorageRoot {
  effectiveDataDir(): string
  withExclusive<T>(operation: () => T | Promise<T>): Promise<T>
}

function expandDirectory(value: string): string {
  return resolve(value === '~' ? homedir() : value.startsWith('~/') ? join(homedir(), value.slice(2)) : value)
}

/**
 * A workspace-scoped root needs a real workspace. DSH reports none for a
 * conversation that has not run yet, and for one opened from the list whose
 * Agent is not loaded, as an empty cwd; resolving that would place the data
 * under the filesystem root (its own `/.suveng-dsh-plugin-memory`), which a plugin never owns.
 */
export const NO_WORKSPACE_MESSAGE = 'the current DSH session has no workspace for Memory'

export function requireWorkspaceRoot(workspaceRoot: string | undefined): string {
  const normalized = workspaceRoot?.trim()
  if (normalized === undefined || normalized === '') throw new Error(NO_WORKSPACE_MESSAGE)
  return resolve(normalized)
}

/** Host owns every built-in layout; Sources own the data within the chosen root. */
function storageDirectory(config: Pick<ResolvedConfig, 'storageScope' | 'dataDir'>, workspaceRoot?: string): string {
  const globalRoot = resolveDataDir(expandDirectory(process.env.MNEMON_DATA_DIR?.trim() || `~/${MEMORY_DATA_DIRECTORY}`))
  switch (config.storageScope) {
    case 'global': return globalRoot
    case 'custom': return expandDirectory(config.dataDir!)
    case 'workspace': return resolveDataDir(join(requireWorkspaceRoot(workspaceRoot), MEMORY_DATA_DIRECTORY))
    case 'workspaces': return join(expandDirectory(config.dataDir ?? globalRoot), 'workspaces', workspaceStorageId(requireWorkspaceRoot(workspaceRoot)))
  }
}

/** A stored workspace path, when DSH has one: '' is no workspace, not the filesystem root. */
export function workspaceRootOrUndefined(workspaceRoot: string | undefined): string | undefined {
  const normalized = workspaceRoot?.trim()
  return normalized === undefined || normalized === '' ? undefined : resolve(normalized)
}

export function createStorageRoot(config: Pick<ResolvedConfig, 'storageScope' | 'dataDir'>, workspaceRoot?: string): StorageRoot {
  // Resolve eagerly: a missing workspace fails the caller that asked for a root,
  // instead of a read-only validation build that never reads a directory.
  const directory = storageDirectory(config, workspaceRoot)
  return {
    effectiveDataDir: () => directory,
    withExclusive: operation => withMemoryStorageLock(directory, operation),
  }
}
