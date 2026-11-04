import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * The directory this plugin owns, and the one it owned before the rename to
 * `suveng-dsh-plugin-memory`. A profile that already holds data keeps using its old
 * directory until the person moves it, so every root resolves through
 * `resolveDataDir` rather than assuming the new name exists on disk.
 */
export const MEMORY_DATA_DIRECTORY = '.suveng-dsh-plugin-memory'
export const LEGACY_MEMORY_DATA_DIRECTORY = '.mnemon'

/**
 * The directory the pre-rename plugin used for the same parent, or `undefined`
 * when `directory` is not one this plugin names (a custom `MNEMON_DATA_DIR`, for
 * instance, has no legacy sibling: nobody guessed that path for the old name).
 */
export function legacyDataDir(directory: string): string | undefined {
  const name = directory.endsWith(MEMORY_DATA_DIRECTORY) ? MEMORY_DATA_DIRECTORY : undefined
  if (name === undefined) return undefined
  const parent = dirname(directory)
  if (parent === directory) return undefined
  return join(parent, LEGACY_MEMORY_DATA_DIRECTORY)
}

/**
 * The directory to read: the new one when it exists, else the legacy one when
 * only that exists, else the new one. A read never moves data, so a store found
 * under the legacy name stays readable and keeps being written where it was.
 */
export function resolveDataDir(
  directory: string,
  legacy: string | undefined = legacyDataDir(directory),
  exists: (path: string) => boolean = existsSync,
): string {
  if (exists(directory)) return directory
  if (legacy !== undefined && exists(legacy)) return legacy
  return directory
}

/** Whether `relativePath` starts with the plugin-owned directory name, old or new. */
export function dataDirPrefixes(): string[] {
  return [MEMORY_DATA_DIRECTORY, LEGACY_MEMORY_DATA_DIRECTORY]
}
