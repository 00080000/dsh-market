/**
 * The pnpm compatibility layer's decision logic. The -w cases encode issue
 * #20: the flag is required at pnpm-9 workspace roots but is a HARD ERROR
 * (every pnpm major) in a profile without pnpm-workspace.yaml — so the
 * injection must depend on the profile's actual shape.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { classifyPnpmFailure, pluginArgsFor } from '../src/pnpm-compat.ts'

describe('pluginArgsFor', () => {
  let dir: string
  afterEach(() => { if (dir !== undefined) rmSync(dir, { recursive: true, force: true }) })

  function profileFixture(workspace: boolean): string {
    dir = mkdtempSync(join(tmpdir(), 'dshm-profile-'))
    writeFileSync(join(dir, 'package.json'), '{"name":"p","private":true}')
    if (workspace) writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - .\n')
    return dir
  }

  it('injects -w for add at a workspace-root profile (pnpm 9 refuses without it, #20 bug 1)', () => {
    expect(pluginArgsFor(profileFixture(true), ['add', 'dshmarket'])).toEqual(['add', '-w', 'dshmarket'])
  })

  it('injects -w for remove at a workspace-root profile', () => {
    expect(pluginArgsFor(profileFixture(true), ['remove', 'dshmarket'])).toEqual(['remove', '-w', 'dshmarket'])
  })

  it('does NOT inject -w when the profile has no pnpm-workspace.yaml — every pnpm major hard-errors on it (#20)', () => {
    expect(pluginArgsFor(profileFixture(false), ['add', 'dshmarket'])).toEqual(['add', 'dshmarket'])
  })

  it('does NOT inject -w for remove outside a workspace either', () => {
    expect(pluginArgsFor(profileFixture(false), ['remove', 'dshmarket'])).toEqual(['remove', 'dshmarket'])
  })

  it('leaves non-mutating subcommands untouched', () => {
    expect(pluginArgsFor(profileFixture(true), ['install'])).toEqual(['install'])
  })
})

describe('classifyPnpmFailure', () => {
  it('recognizes the pnpm-major hoist-pattern drift as recoverable (#20 bug 2)', () => {
    const failure = classifyPnpmFailure('ERR_PNPM_PUBLIC_HOIST_PATTERN_DIFF  This modules directory was created using a different public-hoist-pattern value. Run "pnpm install" to recreate the modules directory.')
    expect(failure?.code).toBe('hoist-pattern-diff')
    expect(failure?.recoverable).toBe(true)
  })

  it('recognizes the workspace-root refusal (#20 bug 1)', () => {
    const failure = classifyPnpmFailure('ERR_PNPM_ADDING_TO_ROOT  Running this command will add the dependency to the workspace root')
    expect(failure?.code).toBe('adding-to-root')
    expect(failure?.recoverable).toBe(false)
  })

  it('recognizes -w outside a workspace', () => {
    const failure = classifyPnpmFailure('[ERROR] --workspace-root may only be used inside a workspace')
    expect(failure?.code).toBe('not-a-workspace')
  })

  it('recognizes a missing pnpm', () => {
    expect(classifyPnpmFailure('dsh: pnpm not found on PATH — install pnpm to manage profile plugins')?.code).toBe('pnpm-missing')
  })

  it('returns null for unrecognized output (raw text is then surfaced as-is)', () => {
    expect(classifyPnpmFailure('some other failure')).toBeNull()
  })
})
