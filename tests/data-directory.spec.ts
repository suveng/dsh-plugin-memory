import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { dataDirPrefixes, LEGACY_MEMORY_DATA_DIRECTORY, legacyDataDir, MEMORY_DATA_DIRECTORY, resolveDataDir } from '../src/host/data-directory.ts'

const roots: string[] = []
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
async function directory() {
  const root = await mkdtemp(join(tmpdir(), 'suveng-dsh-plugin-memory-directory-'))
  roots.push(root)
  return root
}

describe('data directory names', () => {
  it('names the plugin directory and its pre-rename sibling', () => {
    expect(MEMORY_DATA_DIRECTORY).toBe('.suveng-dsh-plugin-memory')
    expect(LEGACY_MEMORY_DATA_DIRECTORY).toBe('.mnemon')
    expect(legacyDataDir(join('/synthetic', 'work', MEMORY_DATA_DIRECTORY))).toBe(join('/synthetic', 'work', LEGACY_MEMORY_DATA_DIRECTORY))
    expect(dataDirPrefixes()).toEqual([MEMORY_DATA_DIRECTORY, LEGACY_MEMORY_DATA_DIRECTORY])
  })

  it('leaves a configured directory that is not this plugin\'s own without a legacy sibling', () => {
    expect(legacyDataDir(join('/synthetic', 'custom-store'))).toBeUndefined()
  })

  it('reads the legacy directory when the new one is absent', async () => {
    const parent = await directory()
    const legacy = join(parent, LEGACY_MEMORY_DATA_DIRECTORY)
    await mkdir(legacy)
    expect(resolveDataDir(join(parent, MEMORY_DATA_DIRECTORY))).toBe(legacy)
  })

  it('new directory wins when both exist', async () => {
    const parent = await directory()
    await mkdir(join(parent, LEGACY_MEMORY_DATA_DIRECTORY))
    await mkdir(join(parent, MEMORY_DATA_DIRECTORY))
    expect(resolveDataDir(join(parent, MEMORY_DATA_DIRECTORY))).toBe(join(parent, MEMORY_DATA_DIRECTORY))
  })

  it('keeps the new directory for a first run that has neither', async () => {
    const parent = await directory()
    expect(resolveDataDir(join(parent, MEMORY_DATA_DIRECTORY))).toBe(join(parent, MEMORY_DATA_DIRECTORY))
  })

  it('accepts an explicit legacy candidate and existence probe', () => {
    const candidate = '/synthetic/elsewhere'
    expect(resolveDataDir('/synthetic/new', candidate, path => path === candidate)).toBe(candidate)
    expect(resolveDataDir('/synthetic/new', candidate, () => false)).toBe('/synthetic/new')
    expect(resolveDataDir('/synthetic/new', undefined, () => false)).toBe('/synthetic/new')
  })
})
