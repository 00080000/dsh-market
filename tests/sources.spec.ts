/**
 * Registry-source parsing and install-target derivation — the security
 * boundary between curated registry URLs and what gets passed to pnpm.
 */

import { describe, expect, it } from 'vitest'
import { installTargetFor, parseSourceUrl, repoOf } from '../src/sources.ts'

describe('parseSourceUrl', () => {
  it('parses a plain github repo url, with or without trailing slash', () => {
    expect(parseSourceUrl('https://github.com/owner/repo')).toEqual({ repo: 'owner/repo', subpath: null })
    expect(parseSourceUrl('https://github.com/owner/repo/')).toEqual({ repo: 'owner/repo', subpath: null })
  })

  it('parses monorepo /tree/<branch>/<subpath> links (curated-list convention)', () => {
    expect(parseSourceUrl('https://github.com/o/r/tree/main/packages/theme-x'))
      .toEqual({ repo: 'o/r', subpath: 'packages/theme-x' })
  })

  it('rejects non-github and malformed urls', () => {
    expect(parseSourceUrl('https://evil.com/owner/repo')).toBeNull()
    expect(parseSourceUrl('https://github.com/onlyowner')).toBeNull()
    expect(parseSourceUrl('https://github.com/o/r/tree/main/../../etc')).toBeNull()
  })

  it('rejects subpaths with characters outside the allowlist', () => {
    expect(parseSourceUrl('https://github.com/o/r/tree/main/pkg%20name')).toBeNull()
    expect(parseSourceUrl('https://github.com/o/r/tree/main/pkg;rm')).toBeNull()
  })

  it('repoOf extracts owner/repo or null', () => {
    expect(repoOf('https://github.com/o/r/tree/main/sub')).toBe('o/r')
    expect(repoOf('nonsense')).toBeNull()
  })
})

describe('installTargetFor', () => {
  it('prefers the curated npm name over a github download', () => {
    expect(installTargetFor({ url: 'https://github.com/o/r', npm: 'dsh-loop' })).toBe('dsh-loop')
    expect(installTargetFor({ url: 'https://github.com/o/r', npm: '@scope/pkg' })).toBe('@scope/pkg')
  })

  it('rejects npm names that are not plain package names', () => {
    expect(installTargetFor({ url: 'https://github.com/o/r', npm: 'evil;rm -rf' })).toBe('github:o/r')
  })

  it('targets the subpath via the #path: selector for monorepo links', () => {
    expect(installTargetFor({ url: 'https://github.com/o/r/tree/main/packages/x' }))
      .toBe('github:o/r#path:/packages/x')
  })

  it('falls back to the github repo and refuses unsupported urls', () => {
    expect(installTargetFor({ url: 'https://github.com/o/r' })).toBe('github:o/r')
    expect(installTargetFor({ url: 'https://gitlab.com/o/r' })).toBeNull()
  })
})
