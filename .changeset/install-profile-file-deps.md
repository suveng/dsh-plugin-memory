---
"suveng-dsh-plugin-memory": patch
---

Install the sub-packages through `file:` dependencies instead of `link:` overrides.
pnpm 12 records `link:` overrides for the dependencies of a tarball-installed package
in the lockfile but never materializes them, so the profile ended up without any of
them and the host logged `ERR_MODULE_NOT_FOUND` for eight packages. The installer now
repacks the tarball with `file:` paths, and sweeps macOS AppleDouble `._*` sidecars,
which made dsh reject the package with `locale/._en.json must use a language id as its
filename`.
