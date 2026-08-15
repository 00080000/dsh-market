/**
 * Profile filesystem reads against real fixture directories (DSH_HOME is
 * pointed at a tmpdir per test file).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  entryArtifactExists, hasDshManifest, pluginSubdirs, profileDir,
  readInstalled, readInstalledVersion, readLockCommits,
} from '../src/profile.ts'

let home: string
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'dshm-home-'))
  process.env.DSH_HOME = home
})
afterEach(() => {
  delete process.env.DSH_HOME
  rmSync(home, { recursive: true, force: true })
})

function writeProfile(manifest: unknown): string {
  const dir = profileDir('web')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest))
  return dir
}

describe('readInstalled', () => {
  it('lists community dependencies and filters the official scope', () => {
    writeProfile({ dependencies: { 'dsh-loop': '^1.0.0', '@deepseek-ai/dsh-base': 'latest', dshmarket: '^1.2.2' } })
    expect(readInstalled('web')).toEqual({ 'dsh-loop': '^1.0.0', dshmarket: '^1.2.2' })
  })

  it('returns empty for a missing or unreadable profile', () => {
    expect(readInstalled('web')).toEqual({})
  })
})

describe('readInstalledVersion', () => {
  it('reads the version actually present in node_modules', () => {
    const dir = writeProfile({ dependencies: {} })
    mkdirSync(join(dir, 'node_modules', 'dsh-loop'), { recursive: true })
    writeFileSync(join(dir, 'node_modules', 'dsh-loop', 'package.json'), '{"version":"1.0.3"}')
    expect(readInstalledVersion('web', 'dsh-loop')).toBe('1.0.3')
    expect(readInstalledVersion('web', 'missing')).toBeNull()
  })
})

describe('readLockCommits', () => {
  it('extracts pinned commits from codeload tarball URLs, keyed lowercase', () => {
    const dir = writeProfile({})
    writeFileSync(join(dir, 'pnpm-lock.yaml'), [
      'packages:',
      '  https://codeload.github.com/Owner/Repo/tar.gz/0123456789abcdef0123456789abcdef01234567:',
      '  https://codeload.github.com/a/b/tar.gz/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:',
    ].join('\n'))
    const commits = readLockCommits('web')
    expect(commits.get('owner/repo')).toBe('0123456789abcdef0123456789abcdef01234567')
    expect(commits.get('a/b')).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
  })

  it('is empty without a lockfile', () => {
    writeProfile({})
    expect(readLockCommits('web').size).toBe(0)
  })
})

describe('hasDshManifest / entryArtifactExists', () => {
  let pkg: string
  beforeEach(() => {
    pkg = join(profileDir('web'), 'node_modules', 'x')
    mkdirSync(pkg, { recursive: true })
  })

  it('detects the dsh manifest surface', () => {
    writeFileSync(join(pkg, 'package.json'), '{"dsh":{"client":{}}}')
    expect(hasDshManifest(pkg)).toBe(true)
    writeFileSync(join(pkg, 'package.json'), '{"name":"x"}')
    expect(hasDshManifest(pkg)).toBe(false)
  })

  it('accepts a package whose main artifact exists', () => {
    writeFileSync(join(pkg, 'package.json'), '{"main":"lib/index.js"}')
    mkdirSync(join(pkg, 'lib'), { recursive: true })
    writeFileSync(join(pkg, 'lib', 'index.js'), '')
    expect(entryArtifactExists(pkg)).toBe(true)
  })

  it('rejects a source-only checkout whose declared artifact is missing (#18 boot brick)', () => {
    writeFileSync(join(pkg, 'package.json'), '{"main":"lib/index.js"}')
    expect(entryArtifactExists(pkg)).toBe(false)
  })

  it('walks conditional exports objects', () => {
    writeFileSync(join(pkg, 'package.json'), '{"exports":{".":{"import":"dist/a.mjs"}}}')
    mkdirSync(join(pkg, 'dist'), { recursive: true })
    writeFileSync(join(pkg, 'dist', 'a.mjs'), '')
    expect(entryArtifactExists(pkg)).toBe(true)
  })

  it('falls back to index.js when nothing is declared', () => {
    writeFileSync(join(pkg, 'package.json'), '{"name":"x"}')
    expect(entryArtifactExists(pkg)).toBe(false)
    writeFileSync(join(pkg, 'index.js'), '')
    expect(entryArtifactExists(pkg)).toBe(true)
  })
})

describe('pluginSubdirs', () => {
  it('finds dsh plugins at depth 1 and 2, skipping node_modules', () => {
    const root = join(profileDir('web'), 'node_modules', 'collection')
    mkdirSync(join(root, 'plugin-a'), { recursive: true })
    writeFileSync(join(root, 'plugin-a', 'package.json'), '{"dsh":{}}')
    mkdirSync(join(root, 'packages', 'plugin-b'), { recursive: true })
    writeFileSync(join(root, 'packages', 'plugin-b', 'package.json'), '{"dsh":{}}')
    mkdirSync(join(root, 'node_modules', 'evil'), { recursive: true })
    writeFileSync(join(root, 'node_modules', 'evil', 'package.json'), '{"dsh":{}}')
    mkdirSync(join(root, 'docs'), { recursive: true })
    expect(pluginSubdirs(root).sort()).toEqual(['packages/plugin-b', 'plugin-a'])
  })

  it('returns empty for an unreadable root', () => {
    expect(pluginSubdirs(join(home, 'nope'))).toEqual([])
  })
})
