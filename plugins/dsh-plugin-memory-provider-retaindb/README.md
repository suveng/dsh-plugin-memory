# dsh-plugin-memory-provider-retaindb

An adapter for RetainDB project/user-scoped memory.

Requires a reachable endpoint, credentials and explicit project/user scope.

## Use

The default `dsh-plugin-memory` Starter already installs this package. Enable and configure the service on the `dsh-plugin-memory` page under **Plugins**, then inspect its synchronized Memory Spaces.

For a custom composition, install this package alongside `dsh-plugin-memory-source-memory-spaces` and include it in that Source's `config.providers`:

```yaml
providers:
  - use: dsh-plugin-memory-provider-retaindb
    instanceId: retaindb
```

This is a **Memory Spaces child module**, not a top-level Source or a complete Strategy. It registers through `dsh-plugin-memory-source-memory-spaces/provider-sdk`; each parent Source owns its child Fibers, connection settings and lifetime. Credentials stay on the Host.

[Provider setup and capability matrix](https://github.com/suveng/dsh-plugin-memory/blob/main/docs/en/guides/memory-providers.md) · [中文指南](https://github.com/suveng/dsh-plugin-memory/blob/main/docs/zh-CN/guides/memory-providers.md)

## Develop independently

From a source checkout with the declared dependencies installed, run `pnpm verify`. Tests, build and public exports belong to this package, without importing another package's controllers or repository configuration. Use the Source's public `/testing` fixtures for child registration and driver conformance; live service tests require a separately authorized environment.

[Plugin author guide](https://github.com/suveng/dsh-plugin-memory/blob/main/docs/en/development/extensions.md)
