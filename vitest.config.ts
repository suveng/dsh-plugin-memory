import { configDefaults, defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { clientCssPlugin } from './tsdown.config.ts'

export default defineConfig({
  // Compile the real class maps; JSDOM does not implement the browser CSS layout engine.
  plugins: [{ ...clientCssPlugin(false), enforce: 'pre' } as never],
  resolve: {
    alias: Object.entries({
      'suveng-dsh-plugin-memory/client': fileURLToPath(new URL('./src/client/extension-sdk.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-source-runtime/client': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-source-runtime/src/client.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-source-documents/client': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-source-documents/src/client.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-source-memory-spaces/client': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-source-memory-spaces/src/client.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-source-memory-spaces/testing': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-source-memory-spaces/src/testing.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-source-memory-spaces/native-cli': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-source-memory-spaces/src/native-cli.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-source-memory-spaces/space-identity': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-source-memory-spaces/src/space-identity.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-source-memory-spaces/provider-sdk': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-source-memory-spaces/src/provider-sdk.ts', import.meta.url)),
      'suveng-dsh-plugin-memory/extension-sdk': fileURLToPath(new URL('./src/sdk/index.ts', import.meta.url)),
      'suveng-dsh-plugin-memory/contracts': fileURLToPath(new URL('./src/core/contracts/index.ts', import.meta.url)),
      'suveng-dsh-plugin-memory/testing': fileURLToPath(new URL('./src/sdk/testing.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-source-runtime/contracts': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-source-runtime/src/contracts.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-source-documents/contracts': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-source-documents/src/contracts.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-source-memory-spaces/contracts': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-source-memory-spaces/src/contracts.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-source-runtime': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-source-runtime/src/index.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-source-documents': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-source-documents/src/index.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-source-skills/client': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-source-skills/src/client.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-source-skills/contracts': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-source-skills/src/contracts.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-source-skills': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-source-skills/src/index.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-source-memory-spaces': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-source-memory-spaces/src/index.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-strategy-default-three-tier/extension-sdk': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-strategy-default-three-tier/src/extension-sdk.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-strategy-scoped': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-strategy-scoped/src/index.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-strategy-light-context': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-strategy-light-context/src/index.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-strategy-auto-capture': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-strategy-auto-capture/src/index.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-strategy-default-three-tier': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-strategy-default-three-tier/src/index.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-strategy-general': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-strategy-general/src/index.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-provider-native': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-provider-native/src/index.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-provider-openviking': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-provider-openviking/src/index.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-provider-honcho': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-provider-honcho/src/index.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-provider-mem0': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-provider-mem0/src/index.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-provider-hindsight': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-provider-hindsight/src/index.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-provider-holographic': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-provider-holographic/src/index.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-provider-retaindb': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-provider-retaindb/src/index.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-provider-byterover': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-provider-byterover/src/index.ts', import.meta.url)),
      'suveng-dsh-plugin-memory-provider-supermemory': fileURLToPath(new URL('./plugins/suveng-dsh-plugin-memory-provider-supermemory/src/index.ts', import.meta.url)),
    }).map(([name, replacement]) => ({ find: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), replacement })),
    // Keep UI packages on Memory's React instance just as the browser bundle does.
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: 'node',
    // These tests must execute outside the workspace, against packed artifacts.
    exclude: [...configDefaults.exclude, 'scripts/fixtures/**'],
    coverage: { enabled: false },
    server: {
      deps: {
        inline: ['@deepseek-ai/dsh-client-ui-primitives'],
      },
    },
  },
})
