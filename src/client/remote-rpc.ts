import {
  MEMORY_ACTIVATION_CHANNEL,
  MEMORY_PACK_CHANNEL,
  MEMORY_READ_CHANNEL,
  MEMORY_REMOTE_ACTIVATION_ENDPOINT,
  MEMORY_REMOTE_CHANNEL,
  MEMORY_REMOTE_PACK_ENDPOINT,
  MEMORY_REMOTE_READ_ENDPOINT,
  MEMORY_REMOTE_REVIEW_ENDPOINT,
  MEMORY_REMOTE_SETTINGS_ENDPOINT,
  MEMORY_REMOTE_SYNC_ENDPOINT,
  MEMORY_REMOTE_VIEW_ENDPOINT,
  MEMORY_REMOTE_VIEW_WRITE_ENDPOINT,
  MEMORY_REMOTE_WRITE_ENDPOINT,
  MEMORY_REVIEW_CHANNEL,
  MEMORY_SETTINGS_CHANNEL,
  MEMORY_SYNC_CHANNEL,
  MEMORY_VIEW_CHANNEL,
  MEMORY_VIEW_WRITE_CHANNEL,
  MEMORY_WRITE_CHANNEL,
  type ClientConnectionHandle,
  type MemoryRpcChannel,
  type MemoryRpcEndpoint,
} from '../host/protocol.ts'

type ClientRpcResult = Awaited<ReturnType<ClientConnectionHandle['rpc']['call']>>

const REMOTE_ENDPOINT = new Map<string, string>([
  [MEMORY_READ_CHANNEL, MEMORY_REMOTE_READ_ENDPOINT],
  [MEMORY_ACTIVATION_CHANNEL, MEMORY_REMOTE_ACTIVATION_ENDPOINT],
  [MEMORY_WRITE_CHANNEL, MEMORY_REMOTE_WRITE_ENDPOINT],
  [MEMORY_PACK_CHANNEL, MEMORY_REMOTE_PACK_ENDPOINT],
  [MEMORY_SYNC_CHANNEL, MEMORY_REMOTE_SYNC_ENDPOINT],
  [MEMORY_REVIEW_CHANNEL, MEMORY_REMOTE_REVIEW_ENDPOINT],
  [MEMORY_SETTINGS_CHANNEL, MEMORY_REMOTE_SETTINGS_ENDPOINT],
  [MEMORY_VIEW_CHANNEL, MEMORY_REMOTE_VIEW_ENDPOINT],
  [MEMORY_VIEW_WRITE_CHANNEL, MEMORY_REMOTE_VIEW_WRITE_ENDPOINT],
])

function isClientRpcResult(value: unknown): value is ClientRpcResult {
  if (typeof value !== 'object' || value === null || !Object.hasOwn(value, 'ok')) return false
  const candidate = value as { ok?: unknown; value?: unknown; error?: unknown }
  if (candidate.ok === true) return Object.hasOwn(candidate, 'value')
  if (candidate.ok !== false || typeof candidate.error !== 'object' || candidate.error === null) return false
  return typeof (candidate.error as { message?: unknown }).message === 'string'
}

function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/**
 * A window the application serves itself, such as DSH Desktop's
 * `dsh-app://app/`, runs beside its Host rather than across a network.
 */
function isApplicationPage(page: Location | undefined): boolean {
  const protocol = page?.protocol
  return typeof protocol === 'string' && protocol !== '' && protocol !== 'http:' && protocol !== 'https:'
}

/**
 * A network page is remote when its hostname or the DSH Connection is not
 * loopback. An application page is local unless DSH declares a transport that
 * does not own the Host, which only a page connected to another machine does.
 */
export function isRemoteConnection(connection: ClientConnectionHandle): boolean {
  const page = globalThis.location
  if (isApplicationPage(page)) {
    const transport = (globalThis as { __DSH_TRANSPORT__?: { ownsHost?: unknown } }).__DSH_TRANSPORT__
    return transport !== undefined && transport !== null && transport.ownsHost !== true
  }
  const hostname = page?.hostname
  const remotePage = typeof hostname === 'string' && hostname !== '' && !isLoopbackHostname(hostname)
  return remotePage || !connection.isLoopback
}

/** Route only paired remote pages through API Gateway; local clients retain legacy channels. */
export async function callMemoryRpc<Channel extends MemoryRpcChannel>(
  connection: ClientConnectionHandle,
  channel: Channel,
  endpoint: MemoryRpcEndpoint<Channel>,
  payload: unknown,
  signal?: AbortSignal,
): Promise<ClientRpcResult> {
  const remoteEndpoint = REMOTE_ENDPOINT.get(channel)
  if (!isRemoteConnection(connection) || remoteEndpoint === undefined) {
    return signal === undefined
      ? connection.rpc.call(channel, endpoint, payload)
      : connection.rpc.call(channel, endpoint, payload, signal)
  }
  const remotePayload = { args: { endpoint, payload } }
  const response = await (signal === undefined
    ? connection.rpc.call(MEMORY_REMOTE_CHANNEL, remoteEndpoint, remotePayload)
    : connection.rpc.call(MEMORY_REMOTE_CHANNEL, remoteEndpoint, remotePayload, signal))
  if (!response.ok) return response
  if (!isClientRpcResult(response.value)) throw new Error('DSH API Gateway returned an invalid Memory response')
  return response.value
}
