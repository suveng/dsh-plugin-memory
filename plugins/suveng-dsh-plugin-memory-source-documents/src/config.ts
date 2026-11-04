import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import z from '@deepseek-ai/schemastery'

export interface Config { dataDir?: string; limitBytes?: number }

export const Config: z<Config> = z.object({ dataDir: z.string(), limitBytes: z.number().step(1).min(1).max(1024 * 1024 * 1024) })


/**
 * A standalone Source's own directory: the one this plugin owns, or the one the
 * pre-rename plugin left for the same instance. No instance key has data under
 * both names, so a store found under the legacy name keeps being read and written.
 */
function defaultSourcesDataDir(instanceKey: string): string {
  const current = join(homedir(), '.suveng-dsh-plugin-memory', 'sources', encodeURIComponent(instanceKey))
  if (existsSync(current)) return current
  const legacy = join(homedir(), '.mnemon', 'sources', encodeURIComponent(instanceKey))
  return existsSync(legacy) ? legacy : current
}


export function documentsSourceConfig(value: Config, instanceKey: string): Required<Config> {
  const config = Config(value)
  const dataDir = config.dataDir ?? defaultSourcesDataDir(instanceKey)
  if (!isAbsolute(dataDir)) throw new Error('Documents Source dataDir must be absolute')
  return { dataDir, limitBytes: config.limitBytes ?? 10 * 1024 * 1024 }
}
