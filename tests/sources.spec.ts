/**
 * Registry-source parsing and install-target derivation — the security
 * boundary between curated registry URLs and what gets passed to pnpm.
 */

import { describe, expect, it } from 'vitest'
import { installTargetFor, parseSourceUrl, repoOf } from '../src/sources.ts'

describe('parseSourceUrl', () => {
  it('accepts github repo urls, plain or with a /tree/<branch>/<subpath> suffix', () => {
    expect(parseSourceUrl('https://github.com/owner/repo')).toEqual({ repo: 'owner/repo', subpath: null })
    expect(parseSourceUrl('https://github.com/owner/repo/')).toEqual({ repo: 'owner/repo', subpath: null })
    expect(parseSourceUrl('https://github.com/o/r/tree/main/packages/theme-x'))
      .toEqual({ repo: 'o/r', subpath: 'packages/theme-x' })
    expect(repoOf('https://github.com/o/r/tree/main/sub')).toBe('o/r')
  })

  it('rejects foreign hosts, malformed urls, traversal, and charset violations', () => {
    expect(parseSourceUrl('https://evil.com/owner/repo')).toBeNull()
    expect(parseSourceUrl('https://github.com/onlyowner')).toBeNull()
    expect(parseSourceUrl('https://github.com/o/r/tree/main/../../etc')).toBeNull()
    expect(parseSourceUrl('https://github.com/o/r/tree/main/pkg%20name')).toBeNull()
    expect(parseSourceUrl('https://github.com/o/r/tree/main/pkg;rm')).toBeNull()
    expect(repoOf('nonsense')).toBeNull()
  })
})

describe('installTargetFor', () => {
  it('prefers curated npm, targets subpaths via #path:, falls back to github, refuses the rest', () => {
    expect(installTargetFor({ url: 'https://github.com/o/r', npm: 'dsh-loop' })).toBe('dsh-loop')
    expect(installTargetFor({ url: 'https://github.com/o/r', npm: '@scope/pkg' })).toBe('@scope/pkg')
    // A malformed npm name never reaches pnpm — fall back to the repo.
    expect(installTargetFor({ url: 'https://github.com/o/r', npm: 'evil;rm -rf' })).toBe('github:o/r')
    expect(installTargetFor({ url: 'https://github.com/o/r/tree/main/packages/x' }))
      .toBe('github:o/r#path:/packages/x')
    expect(installTargetFor({ url: 'https://github.com/o/r' })).toBe('github:o/r')
    expect(installTargetFor({ url: 'https://gitlab.com/o/r' })).toBeNull()
  })
})
