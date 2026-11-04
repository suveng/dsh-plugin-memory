import { descriptor as native } from 'suveng-dsh-plugin-memory-provider-native'
import { descriptor as openviking } from 'suveng-dsh-plugin-memory-provider-openviking'
import { descriptor as holographic } from 'suveng-dsh-plugin-memory-provider-holographic'
import { descriptor as honcho } from 'suveng-dsh-plugin-memory-provider-honcho'
import { descriptor as mem0 } from 'suveng-dsh-plugin-memory-provider-mem0'
import { descriptor as hindsight } from 'suveng-dsh-plugin-memory-provider-hindsight'
import { descriptor as retaindb } from 'suveng-dsh-plugin-memory-provider-retaindb'
import { descriptor as byterover } from 'suveng-dsh-plugin-memory-provider-byterover'
import { descriptor as supermemory } from 'suveng-dsh-plugin-memory-provider-supermemory'

/** Explicit test assembly, never a production built-in Provider registry. */
export const TEST_PROVIDERS = [native, openviking, holographic, honcho, mem0, hindsight, retaindb, byterover, supermemory]
