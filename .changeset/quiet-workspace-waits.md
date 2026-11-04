---
"suveng-dsh-plugin-memory": patch
---

Let a workspace-scoped Host wait for its first workspace

With storageScope set to workspace or workspaces, a Host mounted before any
workspace was known resolved an empty workspace root against the filesystem
root, so saving the setting failed with ENOENT mkdir '/.suveng-dsh-plugin-memory/runtime' and
the plugin either failed to mount or fell back to a root it should not use.

An empty root now raises the named no-workspace error instead of resolving to
'/.suveng-dsh-plugin-memory'. The Host keeps its configuration without building a graph until a
request names a workspace, then serves that workspace's .suveng-dsh-plugin-memory directory;
global and custom scopes are unchanged.

Switching the scope on a running Host follows the same rule: instead of
keeping the previous graph and reporting the new setting as live, the Host
stops serving the old root and opens the workspace a conversation or the Web
workbench names next.
