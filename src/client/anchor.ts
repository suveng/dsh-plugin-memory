/**
 * Lightweight anchor channel between conversation-scoped Memory surfaces
 * (turnTail bar and assistant actions) and the Memory workspace view.
 *
 * A dispatch asks the Memory view to open a page (optionally with a seed) in
 * the session the dispatch came from. The view may not be mounted when the
 * user clicks — the dispatch is then held per session and consumed the next
 * time that session's Memory workspace mounts, so opening Memory System from
 * the sidebar afterwards still lands on the requested page or write dialog.
 */

/** The canonical workspace owns status; every other page belongs to a Source. */
export type MemoryAnchorPage = 'status' | `${string}/${string}`

export interface MemoryAnchor {
  /** Target workspace page. */
  page: MemoryAnchorPage
  /**
   * Optional context seed the target page opens with: a recall query for
   * Memory Spaces explore, candidate text for remember, a document id for
   * Project Documents, an entry's text for runtime memory.
   */
  seed?: string
  /** Session the dispatch belongs to; omitted dispatches address every session. */
  sessionId?: string
}

export const MEMORY_ANCHOR_EVENT = 'memory:anchor'

const pendingBySession = new Map<string, MemoryAnchor>()

function keyOf(sessionId?: string): string {
  return sessionId === undefined || sessionId === '' ? '*' : sessionId
}

/** Ask the Memory view to open a page; held until a matching view consumes it. */
export function dispatchMemoryAnchor(anchor: MemoryAnchor): void {
  pendingBySession.set(keyOf(anchor.sessionId), anchor)
  window.dispatchEvent(new CustomEvent<MemoryAnchor>(MEMORY_ANCHOR_EVENT, { detail: anchor }))
}

/** Which pages a view opens; a view that shows only some pages leaves the others to theirs. */
export type MemoryAnchorFilter = (page: MemoryAnchorPage) => boolean
const EVERY_PAGE: MemoryAnchorFilter = () => true

/** Take the anchor held for this session (usually at mount time), or null. */
export function consumeMemoryAnchor(sessionId?: string, accepts: MemoryAnchorFilter = EVERY_PAGE): MemoryAnchor | null {
  const key = keyOf(sessionId)
  const anchor = pendingBySession.get(key)
  if (anchor === undefined || !accepts(anchor.page)) return null
  pendingBySession.delete(key)
  return anchor
}

/** Subscribe to anchors addressed to this session; returns an unsubscribe. */
export function subscribeMemoryAnchor(sessionId: string | undefined, onAnchor: (anchor: MemoryAnchor) => void, accepts: MemoryAnchorFilter = EVERY_PAGE): () => void {
  const key = keyOf(sessionId)
  const handler = (event: Event): void => {
    const anchor = (event as CustomEvent<MemoryAnchor>).detail
    if (anchor !== undefined && keyOf(anchor.sessionId) === key && accepts(anchor.page)) {
      // A mounted view consumes the event immediately. Clear only this exact
      // dispatch so a newer anchor cannot be lost if listeners navigate again.
      if (pendingBySession.get(key) === anchor) pendingBySession.delete(key)
      onAnchor(anchor)
    }
  }
  window.addEventListener(MEMORY_ANCHOR_EVENT, handler)
  return () => window.removeEventListener(MEMORY_ANCHOR_EVENT, handler)
}
