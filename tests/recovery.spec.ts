/**
 * #20 bug 2: a modules directory built by one pnpm major fails mutation
 * under another (ERR_PNPM_PUBLIC_HOIST_PATTERN_DIFF); pnpm's own remedy is
 * "run pnpm install to recreate the modules directory". The market must do
 * that automatically — one `install` in the profile, then retry the original
 * command once — instead of surfacing a wall of text to a novice user.
 */

import { describe, expect, it } from 'vitest'
import type { InstallResult } from '../src/dsh-cli.ts'
import { withHoistRecovery } from '../src/install.ts'

const HOIST_DIFF: InstallResult = {
  exitCode: 1, timedOut: false, stdout: '',
  stderr: 'ERR_PNPM_PUBLIC_HOIST_PATTERN_DIFF  This modules directory was created using a different public-hoist-pattern value. Run "pnpm install" to recreate the modules directory.',
}
const OK: InstallResult = { exitCode: 0, timedOut: false, stdout: '', stderr: '' }
const OTHER_FAIL: InstallResult = { exitCode: 1, timedOut: false, stdout: '', stderr: 'ELIFECYCLE build failed' }

function scriptedRunner(script: InstallResult[]): { calls: string[][]; run: (profile: string, args: string[]) => Promise<InstallResult> } {
  const calls: string[][] = []
  return {
    calls,
    run: (profile, args) => {
      calls.push(args)
      return Promise.resolve(script[calls.length - 1] ?? OK)
    },
  }
}

describe('withHoistRecovery', () => {
  it('passes clean results straight through', async () => {
    const { calls, run } = scriptedRunner([OK])
    const result = await withHoistRecovery(run, 'web', ['add', 'dsh-loop'])
    expect(result.exitCode).toBe(0)
    expect(calls).toEqual([['add', 'dsh-loop']])
  })

  it('recovers from hoist-pattern drift: rebuild modules dir, retry once, succeed', async () => {
    const { calls, run } = scriptedRunner([HOIST_DIFF, OK, OK])
    const result = await withHoistRecovery(run, 'web', ['add', 'dsh-loop'])
    expect(result.exitCode).toBe(0)
    expect(calls).toEqual([
      ['add', 'dsh-loop'],
      ['install', '--no-frozen-lockfile'],
      ['add', 'dsh-loop'],
    ])
  })

  it('does not retry when the rebuild itself fails', async () => {
    const FAILED_REBUILD: InstallResult = { exitCode: 1, timedOut: false, stdout: '', stderr: 'install failed' }
    const { calls, run } = scriptedRunner([HOIST_DIFF, FAILED_REBUILD])
    const result = await withHoistRecovery(run, 'web', ['add', 'dsh-loop'])
    expect(result.exitCode).not.toBe(0)
    expect(calls).toEqual([
      ['add', 'dsh-loop'],
      ['install', '--no-frozen-lockfile'],
    ])
  })

  it('gives up after one recovery attempt (no retry loops)', async () => {
    const { calls, run } = scriptedRunner([HOIST_DIFF, OK, HOIST_DIFF])
    const result = await withHoistRecovery(run, 'web', ['add', 'dsh-loop'])
    expect(result.exitCode).not.toBe(0)
    expect(calls.length).toBe(3)
  })

  it('does not attempt recovery for unrelated failures', async () => {
    const { calls, run } = scriptedRunner([OTHER_FAIL])
    const result = await withHoistRecovery(run, 'web', ['add', 'dsh-loop'])
    expect(result.exitCode).toBe(1)
    expect(calls).toEqual([['add', 'dsh-loop']])
  })

  it('appends the bilingual classification to the stderr surfaced to the UI (#20 bug 3)', async () => {
    const { run } = scriptedRunner([HOIST_DIFF, OK, HOIST_DIFF])
    const result = await withHoistRecovery(run, 'web', ['add', 'dsh-loop'])
    expect(result.stderr).toMatch(/重建|rebuilt/)
  })
})
