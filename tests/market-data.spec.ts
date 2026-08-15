/**
 * Client-side installed-state matching (#15): one identity algorithm shared
 * by the discover badge, the installed tab, and the theme tab. Scenarios
 * contributed by @yanshuai2002's matching spec. Each case is built so only
 * ONE identity path can produce the match — a broken path cannot hide
 * behind a working fallback.
 */

import { describe, expect, it } from 'vitest'
import { entryForDep, isInstalled, matchInstalledName } from '../src/client/market-data.ts'
import type { RegistryPlugin } from '../src/client/market-data.ts'

function plugin(partial: Partial<RegistryPlugin>): RegistryPlugin {
  return { name: 'x', owner: 'o', url: 'https://github.com/o/x', category: 'tool', ...partial }
}

describe('matchInstalledName / isInstalled', () => {
  it('matches through each identity path exclusively; never by prefix', () => {
    // NAME path (scoped, registry npm field unset; url points elsewhere).
    expect(matchInstalledName(
      plugin({ name: '@scope/plug', url: 'https://github.com/other/elsewhere' }),
      { '@scope/plug': '^1.0.0' },
    )).toBe('@scope/plug')

    // NAME path, case-normalized (no repo/npm fallback available).
    expect(matchInstalledName(
      plugin({ name: 'Dsh-Loop', url: 'https://github.com/other/elsewhere' }),
      { 'dsh-loop': '^1.0.0' },
    )).toBe('dsh-loop')

    // REPO path, case-normalized (key and name share nothing; URL vs github: spec).
    expect(matchInstalledName(
      plugin({ name: 'entry-name', url: 'https://github.com/VLLN/Dsh-Navbar' }),
      { 'some-key': 'github:vlln/dsh-navbar#main' },
    )).toBe('some-key')

    // REPO path reached from a scoped dependency KEY (@owner/name → owner/name).
    expect(matchInstalledName(
      plugin({ name: 'pretty-name', url: 'https://github.com/scope/plug' }),
      { '@scope/plug': '^1.0.0' },
    )).toBe('@scope/plug')

    // REPO path extracted from a monorepo /tree/ url.
    expect(matchInstalledName(
      plugin({ name: 'theme-x', url: 'https://github.com/o/collection/tree/main/packages/theme-x' }),
      { 'installed-key': 'github:o/collection#path:/packages/theme-x' },
    )).toBe('installed-key')

    // Identities are exact — a mere name prefix must NOT match.
    expect(isInstalled(
      plugin({ name: 'dsh-loop', url: 'https://github.com/o/dsh-loop' }),
      { 'dsh-loop-extended': '^1.0.0' },
    )).toBe(false)
  })
})

describe('entryForDep', () => {
  it('resolves an installed dependency back to its registry entry (npm and github-spec paths)', () => {
    const plugins = [
      plugin({ name: 'a', url: 'https://github.com/o/a' }),
      plugin({ name: 'b', url: 'https://github.com/o/b', npm: 'b-npm' }),
    ]
    expect(entryForDep(plugins, 'b-npm', '^1.0.0')?.name).toBe('b')
    expect(entryForDep(plugins, 'anything', 'github:o/a#main')?.name).toBe('a')
    expect(entryForDep(plugins, 'unknown', '^1.0.0')).toBeUndefined()
  })
})
