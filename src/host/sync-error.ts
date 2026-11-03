import type { MemorySyncFailureReason } from './protocol.ts'

/**
 * A sync failure the settings page can name in its own language. The message
 * stays the Host's own words for logs and for anything the page cannot name.
 */
export class MemorySyncError extends Error {
  constructor(readonly reason: MemorySyncFailureReason, message: string) {
    super(message)
    this.name = 'MemorySyncError'
  }
}
