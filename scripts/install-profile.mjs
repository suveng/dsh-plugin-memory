#!/usr/bin/env node
/**
 * Link this checkout into a DSH profile.
 *
 * This repository is a self-maintained fork whose packages are renamed to the
 * `dsh-plugin-memory-*` convention, so they are not on npm. A profile install
 * therefore has to resolve every workspace package from this checkout:
 *
 *   1. `pnpm -r build` (the profile loads `lib/`, not `src/`)
 *   2. every package is added to the profile as a `link:` dependency
 *   3. `overrides:` in the profile's `pnpm-workspace.yaml` redirects the
 *      sub-package ranges the root package declares to the same links, so pnpm
 *      never asks the registry for `dsh-plugin-memory-*`
 *   4. the root package is appended to `dsh.profile.bundles`
 *
 * Usage:
 *   node scripts/install-profile.mjs [--profile web] [--repo <path>] [--dry-run] [--skip-build]
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
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

const linked = new Map([[rootPackage.name, `link:${repo}`]])
for (const plugin of plugins) linked.set(plugin.pkg.name, `link:${plugin.dir}`)

if (!dryRun && !flag('--skip-build')) {
  console.log('install-profile: building workspaces')
  const build = spawnSync('pnpm', ['-r', 'build'], { cwd: repo, stdio: 'inherit' })
  if (build.status !== 0) process.exit(build.status ?? 1)
}

// 1. profile dependencies + bundles
const profilePackagePath = join(profileDir, 'package.json')
const profilePackage = readJson(profilePackagePath)
profilePackage.dependencies ??= {}
for (const [name, spec] of linked) profilePackage.dependencies[name] = spec

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
    const name = line.trim().split(':')[0]
    if (linked.has(name)) continue
  }
  kept.push(line)
}
const overrides = [...linked].map(([name, spec]) => `  ${name}: ${spec}`)
const workspaceOut = `${kept.join('\n').replace(/\s*$/, '')}\noverrides:\n${overrides.join('\n')}\n`

if (dryRun) {
  console.log('install-profile: would link')
  for (const [name, spec] of linked) console.log(`  ${name} -> ${spec}`)
  console.log(`install-profile: would write ${profilePackagePath} and ${workspacePath}`)
  process.exit(0)
}

writeJson(profilePackagePath, profilePackage)
writeFileSync(workspacePath, workspaceOut)
console.log(`install-profile: linked ${linked.size} packages into ${profileDir}`)

const install = spawnSync('pnpm', ['install', '--no-frozen-lockfile'], { cwd: profileDir, stdio: 'inherit' })
if (install.status !== 0) process.exit(install.status ?? 1)

console.log(`install-profile: done.
Next:
  1. make sure ${join(profileDir, 'cordis.patch.yml')} targets the new Entry ids
     (- id: memory / name: dsh-plugin-memory, memory-strategy-* rows)
  2. move legacy data: ~/.mnemon -> ~/.dsh-plugin-memory (the plugin also reads the old path)
  3. restart the host`)
