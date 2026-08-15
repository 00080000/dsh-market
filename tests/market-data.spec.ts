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
    const p = plugin({ name: '@scope/plug', url: 'https://github.com/scope/plug' })
    expect(matchInstalledName(p, { '@scope/plug': '^1.0.0' })).toBe('@scope/plug')
  })

  it('matches case-insensitively across registry and manifest', () => {
    const p = plugin({ name: 'Dsh-Navbar', url: 'https://github.com/vlln/dsh-navbar' })
    expect(matchInstalledName(p, { 'dsh-navbar': 'github:vlln/dsh-navbar#main' })).toBe('dsh-navbar')
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
    const p = plugin({ name: 'theme-x', url: 'https://github.com/o/collection/tree/main/packages/theme-x' })
    expect(matchInstalledName(p, { 'theme-x': 'github:o/collection#path:/packages/theme-x' })).toBe('theme-x')
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
