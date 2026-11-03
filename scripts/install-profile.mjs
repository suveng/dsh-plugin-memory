#!/usr/bin/env node
/**
 * Install this checkout into a DSH profile.
 *
 * This repository is a self-maintained fork whose packages are renamed to the
 * `dsh-plugin-memory-*` convention, so they are not on npm. A profile install
 * therefore has to resolve every workspace package from this checkout:
 *
 *   1. `pnpm -r build` (the profile loads `lib/`, not `src/`)
 *   2. the root package is packed to a tarball and installed as a `file:`
 *      dependency, so pnpm installs its dependencies like any published package
 *   3. `overrides:` in the profile's `pnpm-workspace.yaml` redirects the
 *      sub-package ranges the root package declares to `link:` paths in this
 *      checkout, so pnpm never asks the registry for `dsh-plugin-memory-*`
 *   4. the root package is appended to `dsh.profile.bundles`
 *
 * Sub-packages must stay *transitive* dependencies of the root tarball: a direct
 * dependency also shows up as its own card on the Settings > Plugins page, which
 * is exactly what the Memory System should not do.
 *
 * Usage:
 *   node scripts/install-profile.mjs [--profile web] [--repo <path>] [--dry-run] [--skip-build]
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const flag = name => args.includes(name)
const option = (name, fallback) => {
  const index = args.indexOf(name)
  return index === -1 ? fallback : args[index + 1]
}

const repo = resolve(option('--repo', join(dirname(fileURLToPath(import.meta.url)), '..')))
const profile = option('--profile', 'web')
const dryRun = flag('--dry-run')
const profileDir = join(homedir(), '.dsh', 'profiles', profile)

if (!existsSync(join(profileDir, 'package.json'))) {
  console.error(`install-profile: no profile at ${profileDir}`)
  process.exit(1)
}

const readJson = path => JSON.parse(readFileSync(path, 'utf8'))
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)

const rootPackage = readJson(join(repo, 'package.json'))
const pluginsDir = join(repo, 'plugins')
const plugins = readdirSync(pluginsDir)
  .filter(name => existsSync(join(pluginsDir, name, 'package.json')))
  .map(name => ({ dir: join(pluginsDir, name), pkg: readJson(join(pluginsDir, name, 'package.json')) }))

const buildDir = join(homedir(), '.local', 'share', 'dsh-plugin-builds')
// Each build gets its own tarball name: pnpm caches a `file:` dependency by
// specifier, so reusing one name makes the install a no-op even after a rebuild.
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)
const tarball = join(buildDir, `${rootPackage.name}-${rootPackage.version}-${stamp}.tgz`)

/** Sub-packages, redirected to this checkout by pnpm overrides. */
const linked = new Map()
for (const plugin of plugins) linked.set(plugin.pkg.name, `link:${plugin.dir}`)

if (!dryRun && !flag('--skip-build')) {
  console.log('install-profile: building workspaces')
  const build = spawnSync('pnpm', ['-r', 'build'], { cwd: repo, stdio: 'inherit' })
  if (build.status !== 0) process.exit(build.status ?? 1)
}

if (!dryRun) {
  console.log('install-profile: packing the root package')
  const pack = spawnSync('pnpm', ['pack', '--pack-destination', buildDir], { cwd: repo, stdio: 'inherit' })
  if (pack.status !== 0) process.exit(pack.status ?? 1)
  // `pnpm pack` names the file after the package version; give it the stamped
  // name so pnpm treats this build as a new `file:` specifier.
  const packed = join(buildDir, `${rootPackage.name}-${rootPackage.version}.tgz`)
  if (!existsSync(packed)) {
    console.error(`install-profile: pnpm pack did not produce ${packed}`)
    process.exit(1)
  }
  renameSync(packed, tarball)
  // Keep the four newest tarballs around; they are only install sources.
  const packs = readdirSync(buildDir)
    .filter(name => name.startsWith(`${rootPackage.name}-${rootPackage.version}-`) && name.endsWith('.tgz'))
    .sort()
    .slice(0, -4)
  for (const name of packs) rmSync(join(buildDir, name), { force: true })
}

// 1. profile dependencies + bundles
const profilePackagePath = join(profileDir, 'package.json')
const profilePackage = readJson(profilePackagePath)
profilePackage.dependencies ??= {}
// Drop direct sub-package dependencies: they are transitive through the root
// tarball, and as direct dependencies each one gets its own plugin-page card.
for (const name of linked.keys()) delete profilePackage.dependencies[name]
profilePackage.dependencies[rootPackage.name] = `file:${tarball}`

const bundleList = profilePackage.dsh?.profile?.bundles
if (Array.isArray(bundleList)) {
  // `dsh plugin install` files every dependency whose package declares a bundle
  // entry into this list. The sub-packages are children of the root bundle, so
  // listing them again duplicates their Entry ids and Settings stops saving.
  const pruned = bundleList.filter(name => name === rootPackage.name || !linked.has(name))
  if (!pruned.includes(rootPackage.name)) pruned.push(rootPackage.name)
  profilePackage.dsh.profile.bundles = pruned
}

// 2. overrides, which pnpm 10+ only reads from pnpm-workspace.yaml
const workspacePath = join(profileDir, 'pnpm-workspace.yaml')
const workspaceText = existsSync(workspacePath) ? readFileSync(workspacePath, 'utf8') : 'packages:\n  - .\n'
const kept = []
let insideOverrides = false
for (const line of workspaceText.split('\n')) {
  if (/^overrides:\s*$/.test(line)) {
    insideOverrides = true
    continue
  }
  if (insideOverrides && /^\S/.test(line)) insideOverrides = false
  if (insideOverrides) {
    const name = line.trim().split(':')[0].replace(/^["']|["']$/g, '')
    // The root package must resolve from its tarball, never from a link override:
    // a linked root does not get its dependencies installed.
    if (name === rootPackage.name || linked.has(name)) continue
  }
  kept.push(line)
}
// A link: value for a managed package outside `overrides:` silently redirects it
// back to this checkout (for example a stray line left in `allowBuilds`), which
// would re-link the root and skip installing its dependencies.
const managed = [rootPackage.name, ...linked.keys()]
const stray = kept.find(line => /^\s+[^\s:#]+:/.test(line) && /\blink:\S+/.test(line)
  && managed.includes(line.trim().split(':')[0].replace(/^["']|["']$/g, '')))
if (stray !== undefined) {
  console.error(`install-profile: ${workspacePath} has a stray link outside overrides:\n  ${stray.trim()}\nRemove it (use \`${stray.trim().split(':')[0]}: true\` under allowBuilds) and rerun.`)
  process.exit(1)
}
const overrides = [...linked].map(([name, spec]) => `  ${name}: ${spec}`)
const workspaceOut = `${kept.join('\n').replace(/\s*$/, '')}\noverrides:\n${overrides.join('\n')}\n`

if (dryRun) {
  console.log(`install-profile: would install ${rootPackage.name} from file:${tarball}`)
  for (const [name, spec] of linked) console.log(`  override ${name} -> ${spec}`)
  console.log(`install-profile: would write ${profilePackagePath} and ${workspacePath}`)
  process.exit(0)
}

writeJson(profilePackagePath, profilePackage)
writeFileSync(workspacePath, workspaceOut)
console.log(`install-profile: installed ${rootPackage.name} (${tarball}) with ${linked.size} linked sub-packages`)

// The root package ships a prebuilt `lib/`, so its install scripts never need to
// run; pnpm 11 fails the whole install on "ignored build scripts" otherwise.
const install = spawnSync('pnpm', ['install', '--no-frozen-lockfile', '--config.dangerouslyAllowAllBuilds=true'], { cwd: profileDir, stdio: 'inherit' })
if (install.status !== 0) process.exit(install.status ?? 1)

console.log(`install-profile: done.
Next:
  1. make sure ${join(profileDir, 'cordis.patch.yml')} targets the new Entry ids
     (- id: memory / name: dsh-plugin-memory, memory-strategy-* rows)
  2. move legacy data: ~/.mnemon -> ~/.dsh-plugin-memory (the plugin also reads the old path)
  3. restart the host`)
