/**
 * Rewriting a GitHub install target onto a region's mirror.
 *
 * Every assertion here is about a way the rewrite must NOT happen, because
 * that is where the risk is. A rewrite that loses the commit pin installs
 * fine and then reports no version forever; a rewrite applied to a subpath
 * entry would install the wrong package outright; and a rewrite that can
 * fail an install has turned an optimisation into a bug.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acceleratedTarget } from '../src/accelerate.ts'

const SHA = 'b0e6c57ebeeb4796017864f5cd5c66e6ba0899ec'
const CHINA = { DSHM_GITHUB_PROXY: 'https://gh.test' }

/** Stub the SHA lookup with a given outcome. */
function stubResolve(outcome: 'sha' | 'json' | 'http-error' | 'throw' | 'garbage'): void {
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = String(input)
    // The lookup has to travel the proxy too — resolving the commit against
    // an origin the user cannot reach would defeat the whole exercise.
    expect(url.startsWith('https://gh.test/https://api.github.com/')).toBe(true)
    if (outcome === 'throw') throw new Error('network down')
    if (outcome === 'http-error') return new Response('nope', { status: 502 })
    if (outcome === 'json') return new Response(JSON.stringify({ sha: SHA }), { status: 200 })
    if (outcome === 'garbage') return new Response('<html>proxy error</html>', { status: 200 })
    return new Response(SHA, { status: 200 })
  }))
}

beforeEach(() => { vi.unstubAllGlobals() })
afterEach(() => { vi.unstubAllGlobals() })

describe('acceleratedTarget', () => {
  it('leaves everything alone in a region with no mirror', async () => {
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('should not be called') }))
    await expect(acceleratedTarget('github:o/r', 'global', {})).resolves.toBe('github:o/r')
  })

  it('rewrites a bare repo to a commit-pinned tarball on the mirror', async () => {
    stubResolve('sha')
    await expect(acceleratedTarget('github:o/r', 'china', CHINA)).resolves
      .toBe(`https://gh.test/https://codeload.github.com/o/r/tar.gz/${SHA}`)
  })

  it('reads the SHA whether the proxy passes the bare-text header through or not', async () => {
    // `Accept: application/vnd.github.sha` asks for a few bytes of text. A
    // proxy that drops the header hands back the full commit document
    // instead, and an install must not depend on which one it is talking to.
    stubResolve('json')
    await expect(acceleratedTarget('github:o/r', 'china', CHINA)).resolves.toContain(SHA)
  })

  it('never rewrites a subpath entry', async () => {
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('should not be called') }))
    // A tarball URL has nowhere to say "only this directory". Rewriting one
    // of these would install the whole repo under the subpackage's name.
    await expect(acceleratedTarget('github:o/r#path:/packages/x', 'china', CHINA)).resolves
      .toBe('github:o/r#path:/packages/x')
  })

  it('never rewrites an npm target', async () => {
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('should not be called') }))
    await expect(acceleratedTarget('dsh-loop', 'china', CHINA)).resolves.toBe('dsh-loop')
    await expect(acceleratedTarget('@scope/pkg', 'china', CHINA)).resolves.toBe('@scope/pkg')
  })

  for (const outcome of ['http-error', 'throw', 'garbage'] as const) {
    it(`falls back to the direct target when the lookup ${outcome}s`, async () => {
      // Acceleration is an optimisation. An optimisation that can fail an
      // install is a bug, so every failure path ends at the original spec.
      stubResolve(outcome)
      await expect(acceleratedTarget('github:o/r', 'china', CHINA)).resolves.toBe('github:o/r')
    })
  }

  it('refuses a short or non-hex ref rather than installing an unpinned tarball', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('b0e6c57', { status: 200 })))
    // The lockfile reader matches exactly 40 hex characters. Anything else
    // would install and then report no version for the life of the plugin.
    await expect(acceleratedTarget('github:o/r', 'china', CHINA)).resolves.toBe('github:o/r')
  })
})
