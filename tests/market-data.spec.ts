/**
 * Client-side installed-state matching (#15): one identity algorithm shared
 * by the discover badge, the installed tab, and the theme tab. Scenarios
 * contributed by @yanshuai2002's matching spec.
 */

import { describe, expect, it } from 'vitest'
import { entryForDep, isInstalled, matchInstalledName } from '../src/client/market-data.ts'
import type { RegistryPlugin } from '../src/client/market-data.ts'

function plugin(partial: Partial<RegistryPlugin>): RegistryPlugin {
  return { name: 'x', owner: 'o', url: 'https://github.com/o/x', category: 'tool', ...partial }
}

describe('matchInstalledName / isInstalled', () => {
  it('matches a scoped npm install even when the registry entry has no npm field', () => {
    // The url points at a different repo, so only the scoped NAME comparison
    // (registry name ↔ dependency key) can produce this match.
    const p = plugin({ name: '@scope/plug', url: 'https://github.com/other/elsewhere' })
    expect(matchInstalledName(p, { '@scope/plug': '^1.0.0' })).toBe('@scope/plug')
  })

  it('normalizes case on the REPO identity alone (dependency key differs from the name)', () => {
    // Key and name share nothing, so only the case-normalized repo
    // comparison (URL vs github: spec) can produce this match.
    const p = plugin({ name: 'entry-name', url: 'https://github.com/VLLN/Dsh-Navbar' })
    expect(matchInstalledName(p, { 'some-key': 'github:vlln/dsh-navbar#main' })).toBe('some-key')
  })

  it('derives owner/repo from a scoped dependency KEY (@owner/name ↔ repo identity)', () => {
    // The registry entry has no npm field and a name unlike the key, so only
    // the @scope/name → scope/name derivation can reach the repo identity.
    const p = plugin({ name: 'pretty-name', url: 'https://github.com/scope/plug' })
    expect(matchInstalledName(p, { '@scope/plug': '^1.0.0' })).toBe('@scope/plug')
  })

  it('normalizes case on the NAME identity alone (no repo/npm fallback available)', () => {
    // The url's repo does not match the dependency key, so only the
    // case-normalized name comparison can produce this match.
    const p = plugin({ name: 'Dsh-Loop', url: 'https://github.com/other/elsewhere' })
    expect(matchInstalledName(p, { 'dsh-loop': '^1.0.0' })).toBe('dsh-loop')
  })

  it('matches by github spec repo when the dependency key differs from the registry name', () => {
    const p = plugin({ name: 'pretty-name', url: 'https://github.com/owner/actual-repo' })
    expect(matchInstalledName(p, { '@owner/whatever': 'github:Owner/Actual-Repo#main' })).toBe('@owner/whatever')
  })

  it('does NOT match a mere name prefix', () => {
    const p = plugin({ name: 'dsh-loop', url: 'https://github.com/o/dsh-loop' })
    expect(isInstalled(p, { 'dsh-loop-extended': '^1.0.0' })).toBe(false)
  })

  it('matches monorepo /tree/ urls by their repo', () => {
    // Dependency key differs from the entry name, so the match can only come
    // from the repo extracted out of the /tree/ url.
    const p = plugin({ name: 'theme-x', url: 'https://github.com/o/collection/tree/main/packages/theme-x' })
    expect(matchInstalledName(p, { 'installed-key': 'github:o/collection#path:/packages/theme-x' })).toBe('installed-key')
  })
})

describe('entryForDep', () => {
  it('resolves an installed dependency back to its registry entry', () => {
    const plugins = [
      plugin({ name: 'a', url: 'https://github.com/o/a' }),
      plugin({ name: 'b', url: 'https://github.com/o/b', npm: 'b-npm' }),
    ]
    expect(entryForDep(plugins, 'b-npm', '^1.0.0')?.name).toBe('b')
    expect(entryForDep(plugins, 'anything', 'github:o/a#main')?.name).toBe('a')
    expect(entryForDep(plugins, 'unknown', '^1.0.0')).toBeUndefined()
  })
})
