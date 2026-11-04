import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MEMORY_SPACE_ID_PATTERN, MEMORY_ACTIVE_STORE_FILE, type JsonValue } from './contracts.ts'
import type { ResolvedMemorySpacesConfig as ResolvedConfig } from './config.ts'
import { ProcessError, runProcess, type ProcessFailureReason, type ProcessOptions, type ProcessRunner } from './providers/process.ts'
import { withMemoryStorageLock } from 'suveng-dsh-plugin-memory/extension-sdk'
import { findMemoryCommand, isMemoryExecutable, resolveMemoryInvocation } from './native-cli.ts'

/** Why a CLI call failed where callers act on the cause; a call that ran and exited non-zero carries none. */
export type MemoryCliFailure = ProcessFailureReason | 'no-database'

export class MemoryCliError extends Error {
  constructor(message: string, readonly reason?: MemoryCliFailure) {
    super(message)
    this.name = 'MemoryCliError'
  }
}

export interface MemoryRunOptions {
  signal?: AbortSignal
  globalFlags?: boolean
  store?: string
  /** Output cap for this call. Whole-store reads raise it; everything else keeps the 2 MiB default. */
  maxOutputBytes?: number
  /** Time limit for this call instead of the configured one, for work that grows with a Store. */
  timeoutMs?: number
  /**
   * Database file the call needs, checked once the call holds the storage lock: Memory creates
   * the Store it opens, so a space removed while the call waited is not created again (#392).
   */
  database?: string
}

export interface MemoryTextCommand {
  args: readonly string[]
  options?: MemoryRunOptions
}

export interface MemoryRunner {
  readonly command: string
  readonly commandFound: boolean
  runJson(args: readonly string[], options?: MemoryRunOptions): Promise<JsonValue>
  runText(args: readonly string[], options?: MemoryRunOptions): Promise<string>
  /** Run related CLI commands consecutively without allowing queued work between them. */
  runTextBatch(commands: readonly MemoryTextCommand[]): Promise<string[]>
  effectiveDataDir(): string
  /** Read Memory's persisted active-file selection, ignoring config and environment overrides. */
  persistedStore(): string
  effectiveStore(): string
}

const EMBEDDING_ENVIRONMENT_KEYS = new Set(['MNEMON_EMBED_ENDPOINT', 'MNEMON_EMBED_MODEL', 'MNEMON_EMBED_API_KEY', 'MNEMON_EMBED_PROTOCOL'])

/**
 * Explain a CLI call that produced no result. Only a failed launch means the
 * executable is missing or unusable, so only that case carries the install
 * hint; a timeout, a cancellation or an oversized output names its own cause.
 */
function processFailureMessage(error: unknown, args: readonly string[]): string {
  const detail = error instanceof Error ? error.message : String(error)
  const reason = error instanceof ProcessError ? error.reason : 'launch'
  const command = args.find(arg => !arg.startsWith('-'))
  // The cause arrives with whatever name the step that wrote it used; the CLI it names is `mnemon`.
  const cause = detail.replace(/^(?:mnemon|memory) /u, '')
  if (reason === 'output-limit') return `mnemon ${command ?? 'command'} stopped: ${cause}`
  // A timeout names the command that ran out of time, such as an archive's import or a recall (#339).
  if (reason === 'timeout' && command !== undefined) return `mnemon ${command} ${cause}`
  if (reason !== 'launch') return detail
  const hint = process.platform === 'win32'
    ? 'Install the official Mnemon Windows release, ensure mnemon.exe is on PATH or under %LOCALAPPDATA%\\Programs\\mnemon, or set MNEMON_CLI_PATH or memory.cliPath to its absolute path.'
    : 'Install Mnemon and ensure "mnemon" is on PATH, or set MNEMON_CLI_PATH or memory.cliPath.'
  return `${detail}. ${hint}`
}

/** Preserve the Host environment while making saved embedding overrides authoritative. */
function processEnvironment(config: ResolvedConfig): NodeJS.ProcessEnv | undefined {
  if (!config.embedding.enabled) return undefined
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => !EMBEDDING_ENVIRONMENT_KEYS.has(key.toUpperCase())))
  return {
    ...inherited,
    MNEMON_EMBED_ENDPOINT: config.embedding.endpoint,
    MNEMON_EMBED_MODEL: config.embedding.model,
    MNEMON_EMBED_API_KEY: config.embedding.apiKey,
    // 'auto' leaves the protocol to Memory's /v1 auto-detection.
    ...(config.embedding.protocol === 'auto' ? {} : { MNEMON_EMBED_PROTOCOL: config.embedding.protocol }),
  }
}

export function createRunner(config: ResolvedConfig, processRunner: ProcessRunner = runProcess): MemoryRunner {
  // Installation can change while DSH stays running. Status and execution
  // must resolve the same current executable, not a boot-time availability flag.
  const currentCommand = (): string => findMemoryCommand(config) ?? config.cliPath ?? 'memory'
  // Mnemon 0.1.2 runs store migrations while opening the database. Serializing
  // CLI processes prevents parallel status/viz calls during WebUI mount from
  // racing that migration and surfacing a transient SQLITE_BUSY error.

  const globalArgs = (store?: string): string[] => {
    const args = ['--data-dir', effectiveDataDir()]
    if (store !== undefined) args.push('--store', store)
    else if (config.store !== undefined) args.push('--store', config.store)
    return args
  }
  // resolveMemorySpacesConfig always yields a custom scope with an absolute dataDir.
  const effectiveDataDir = (): string => config.dataDir!
  const persistedStore = (): string => {
    const active = join(effectiveDataDir(), MEMORY_ACTIVE_STORE_FILE)
    if (existsSync(active)) {
      try {
        const value = readFileSync(active, 'utf8').trim()
        if (MEMORY_SPACE_ID_PATTERN.test(value)) return value
      } catch {
        // Fall through to Memory's own default.
      }
    }
    return 'default'
  }
  const launch = async (
    args: readonly string[],
    options: MemoryRunOptions = {},
  ): Promise<string> => {
    if (options.signal?.aborted === true) throw new MemoryCliError(`memory command aborted: ${String(options.signal.reason ?? 'cancelled')}`, 'aborted')
    if (options.database !== undefined && !existsSync(options.database)) throw new MemoryCliError(`memory ${args.find(arg => !arg.startsWith('-')) ?? 'command'}: no database at ${options.database}`, 'no-database')
    const argv = options.globalFlags === false ? [...args] : [...globalArgs(options.store), ...args]
    const environment = processEnvironment(config)
    const processOptions: ProcessOptions = {
      timeoutMs: options.timeoutMs ?? config.timeoutMs,
      ...(environment === undefined ? {} : { env: environment }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.maxOutputBytes === undefined ? {} : { maxOutputBytes: options.maxOutputBytes }),
    }
    let result
    try {
      const invocation = resolveMemoryInvocation(currentCommand(), argv, environment)
      result = await processRunner(invocation.command, invocation.args,
        { ...processOptions, ...(invocation.env === undefined ? {} : { env: invocation.env }) })
    } catch (error) {
      throw new MemoryCliError(processFailureMessage(error, args), error instanceof ProcessError ? error.reason : 'launch')
    }
    if (result.exitCode !== 0) {
      const detail = result.stderr.trim() || result.stdout.trim() || 'no output'
      throw new MemoryCliError(`memory ${args.join(' ')} exited ${String(result.exitCode)}: ${detail}`)
    }
    return result.stdout
  }

  const execute = (
    args: readonly string[],
    options: MemoryRunOptions = {},
  ): Promise<string> => {
    return withMemoryStorageLock(effectiveDataDir(), () => launch(args, options))
  }

  return {
    get command() { return currentCommand() },
    get commandFound() {
      const found = findMemoryCommand(config)
      return found !== undefined && isMemoryExecutable(found)
    },
    async runJson(args, options) {
      const stdout = await execute(args, options)
      try {
        return JSON.parse(stdout) as JsonValue
      } catch {
        throw new MemoryCliError(`memory ${args.join(' ')} returned invalid JSON`)
      }
    },
    runText: execute,
    runTextBatch(commands) {
      return withMemoryStorageLock(effectiveDataDir(), async () => {
        const outputs: string[] = []
        for (const command of commands) outputs.push(await launch(command.args, command.options))
        return outputs
      })
    },
    effectiveDataDir() {
      return effectiveDataDir()
    },
    persistedStore() {
      return persistedStore()
    },
    effectiveStore() {
      if (config.store !== undefined) return config.store
      const fromEnvironment = process.env.MNEMON_STORE?.trim()
      if (fromEnvironment !== undefined && fromEnvironment !== '') return fromEnvironment
      return persistedStore()
    },
  }
}
