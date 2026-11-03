import type { MemoryProviderDescriptor } from 'dsh-plugin-memory-source-memory-spaces/provider-sdk'

export const descriptor: MemoryProviderDescriptor = {
  "id": "memory-native",
  "label": "Mnemon Native",
  "icon": {
    "kind": "brand",
    "value": "memory"
  },
  "kind": "local",
  "workspaceBinding": "automatic",
  "summary": "Official local-first memory with exact writes, typed graph relations, and soft deletion.",
  "summaryI18nKey": "overview.providerSummary.memory-native",
  "origin": "native",
  "capabilities": {
    "search": true,
    "browse": true,
    "graph": true,
    "entities": true,
    "related": true,
    "remember": true,
    "link": true,
    "forget": true,
    "writeMode": "exact",
    "deletionMode": "soft"
  },
  "fields": []
}
