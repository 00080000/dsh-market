/**
 * Install orchestration with a recording fake runner over real profile
 * fixtures: collection retargeting, the fake-success guard, and update
 * staleness detection (#22's silent no-op).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { InstallResult } from '../src/dsh-cli.ts'
import { isStaleUpdate, retargetCollections, validateAddedPlugins } from '../src/install.ts'
import { profileDir } from '../src/profile.ts'

let home: string
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'dshm-home-'))
  process.env.DSH_HOME = home
})
afterEach(() => {
  delete process.env.DSH_HOME
  rmSync(home, { recursive: true, force: true })
})

const ok: InstallResult = { exitCode: 0, timedOut: false, stdout: '', stderr: '' }

function recordingRunner(result: InstallResult = ok): { calls: string[][]; run: (profile: string, args: string[]) => Promise<InstallResult> } {
  const calls: string[][] = []
  return {
    calls,
    run: (profile, args) => {
      calls.push(args)
      return Promise.resolve(result)
    },
  }
}

function writeProfile(dependencies: Record<string, string>): string {
  const dir = profileDir('web')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies }))
  return dir
}

function writePkg(dir: string, name: string, manifest: unknown, artifacts: string[] = []): void {
  const root = join(dir, 'node_modules', name)
  mkdirSync(root, { recursive: true })
  writeFileSync(join(root, 'package.json'), JSON.stringify(manifest))
  for (const rel of artifacts) {
    mkdirSync(join(root, rel, '..'), { recursive: true })
    writeFileSync(join(root, rel), '')
  }
}

describe('retargetCollections', () => {
  it('leaves npm installs alone', async () => {
    writeProfile({ 'dsh-loop': '^1.0.0' })
    const { calls, run } = recordingRunner()
    expect(await retargetCollections(run, 'web', new Set(), 'dsh-loop')).toBe(true)
    expect(calls).toEqual([])
  })

  it('re-adds each contained plugin of a collection checkout via #path: (#18)', async () => {
    const dir = writeProfile({ collection: 'github:o/r' })
    // Root manifest without a dsh surface = collection; two real plugins inside.
    writePkg(dir, 'collection', { name: 'collection', private: true })
    mkdirSync(join(dir, 'node_modules', 'collection', 'theme-a'), { recursive: true })
    writeFileSync(join(dir, 'node_modules', 'collection', 'theme-a', 'package.json'), '{"dsh":{}}')
    mkdirSync(join(dir, 'node_modules', 'collection', 'packages', 'theme-b'), { recursive: true })
    writeFileSync(join(dir, 'node_modules', 'collection', 'packages', 'theme-b', 'package.json'), '{"dsh":{}}')
    const { calls, run } = recordingRunner()
    expect(await retargetCollections(run, 'web', new Set(), 'github:o/r')).toBe(true)
    expect(calls[0]).toEqual(['remove', 'collection'])
    expect(calls.slice(1).map(c => c[1]).sort()).toEqual([
      'github:o/r#path:/packages/theme-b',
      'github:o/r#path:/theme-a',
    ])
  })

  it('fails when a collection contains no plugins at all', async () => {
    const dir = writeProfile({ junk: 'github:o/r' })
    writePkg(dir, 'junk', { name: 'junk', private: true })
    const { run } = recordingRunner()
    expect(await retargetCollections(run, 'web', new Set(), 'github:o/r')).toBe(false)
  })

  it('never touches packages that were installed before', async () => {
    const dir = writeProfile({ existing: 'github:o/old' })
    writePkg(dir, 'existing', { name: 'existing', private: true })
    const { calls, run } = recordingRunner()
    expect(await retargetCollections(run, 'web', new Set(['existing']), 'github:o/r')).toBe(true)
    expect(calls).toEqual([])
  })
})

describe('validateAddedPlugins', () => {
  it('keeps valid plugins and removes broken pieces on the spot (#18)', async () => {
    const dir = writeProfile({ good: '^1.0.0', broken: 'github:o/broken' })
    writePkg(dir, 'good', { dsh: {}, main: 'lib/index.js' }, ['lib/index.js'])
    // Source-only checkout: dsh manifest present but the built artifact is not.
    writePkg(dir, 'broken', { dsh: {}, main: 'lib/index.js' })
    const { calls, run } = recordingRunner()
    const { keep, removedBroken } = await validateAddedPlugins(run, 'web', new Set())
    expect(keep).toEqual(['good'])
    expect(removedBroken).toEqual(['broken'])
    expect(calls).toEqual([['remove', 'broken']])
  })

  it('flags a placeholder package with no dsh surface (#21: the 0.0.1 squat install)', async () => {
    const dir = writeProfile({ dshmarket: '^0.0.1' })
    writePkg(dir, 'dshmarket', { name: 'dshmarket', version: '0.0.1', main: 'index.js' }, ['index.js'])
    const { run } = recordingRunner()
    const { keep, removedBroken } = await validateAddedPlugins(run, 'web', new Set())
    expect(keep).toEqual([])
    expect(removedBroken).toEqual(['dshmarket'])
  })
})

describe('isStaleUpdate (#22: clean exit, nothing changed)', () => {
  it('detects an npm update that silently kept the old version', () => {
    expect(isStaleUpdate({ isGit: false, beforeVersion: '1.0.3', afterVersion: '1.0.3', beforeCommit: null, afterCommit: null })).toBe(true)
    expect(isStaleUpdate({ isGit: false, beforeVersion: '1.0.3', afterVersion: '1.2.2', beforeCommit: null, afterCommit: null })).toBe(false)
  })

  it('detects a git update pinned to the same commit', () => {
    expect(isStaleUpdate({ isGit: true, beforeVersion: null, afterVersion: null, beforeCommit: 'aaa', afterCommit: 'aaa' })).toBe(true)
    expect(isStaleUpdate({ isGit: true, beforeVersion: null, afterVersion: null, beforeCommit: 'aaa', afterCommit: 'bbb' })).toBe(false)
  })

  it('never flags a first install (no before state)', () => {
    expect(isStaleUpdate({ isGit: false, beforeVersion: null, afterVersion: '1.0.0', beforeCommit: null, afterCommit: null })).toBe(false)
    expect(isStaleUpdate({ isGit: true, beforeVersion: null, afterVersion: null, beforeCommit: null, afterCommit: 'aaa' })).toBe(false)
  })
})
