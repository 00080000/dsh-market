/**
 * Profile filesystem reads — everything the market learns from a dsh
 * profile directory (manifest, lockfile, installed package trees). Pure
 * functions of the directory contents; no processes, no network.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Resolve a profile name to its directory under DSH_HOME (default ~/.dsh). */
export function profileDir(profile: string): string {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'profiles', profile)
}

/** Community dependencies of the profile (official in-box scope filtered out). */
export function readInstalled(profile: string): Record<string, string> {
  try {
    const manifest = JSON.parse(readFileSync(join(profileDir(profile), 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
    }
    const installed: Record<string, string> = {}
    for (const [name, spec] of Object.entries(manifest.dependencies ?? {})) {
      if (!name.startsWith('@deepseek-ai/')) installed[name] = spec
    }
    return installed
  } catch {
    return {}
  }
}

/** The version actually present in the profile's node_modules, or null. */
export function readInstalledVersion(profile: string, name: string): string | null {
  try {
    const manifest = JSON.parse(
      readFileSync(join(profileDir(profile), 'node_modules', name, 'package.json'), 'utf8'),
    ) as { version?: string }
    return manifest.version ?? null
  } catch {
    return null
  }
}

/** Pinned commit per `owner/repo` from the profile lockfile's codeload tarball URLs. */
export function readLockCommits(profile: string): Map<string, string> {
  const commits = new Map<string, string>()
  try {
    const lock = readFileSync(join(profileDir(profile), 'pnpm-lock.yaml'), 'utf8')
    for (const m of lock.matchAll(/codeload\.github\.com\/([^/\s]+\/[^/\s]+)\/tar\.gz\/([0-9a-f]{40})/g)) {
      commits.set(m[1].toLowerCase(), m[2])
    }
  } catch { /* no lockfile — no git installs to report */ }
  return commits
}

/** True when the installed package's manifest declares a dsh plugin surface. */
export function hasDshManifest(dir: string): boolean {
  try {
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { dsh?: unknown }
    return manifest.dsh !== undefined
  } catch {
    return false
  }
}

/**
 * True when the package's declared entry artifact actually exists — github
 * source checkouts of build-required plugins ship no lib/, and promoting one
 * into the bundle layer bricks the next boot (ERR_MODULE_NOT_FOUND kills the
 * whole profile, #18).
 */
export function entryArtifactExists(dir: string): boolean {
  try {
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      main?: string
      exports?: Record<string, unknown> | string
    }
    const candidates: string[] = []
    if (typeof manifest.main === 'string') candidates.push(manifest.main)
    const rootExport = typeof manifest.exports === 'string'
      ? manifest.exports
      : (manifest.exports as Record<string, unknown> | undefined)?.['.']
    if (typeof rootExport === 'string') candidates.push(rootExport)
    else if (rootExport !== null && typeof rootExport === 'object') {
      for (const value of Object.values(rootExport)) if (typeof value === 'string') candidates.push(value)
    }
    if (candidates.length === 0) candidates.push('index.js')
    return candidates.some(rel => existsSync(join(dir, rel)))
  } catch {
    return false
  }
}

/** Plugin subdirectories (depth 2) of a collection checkout, as relative paths. */
export function pluginSubdirs(root: string): string[] {
  const found: string[] = []
  let level1: string[] = []
  try {
    level1 = readdirSync(root, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory() && /^[A-Za-z0-9_.-]+$/.test(dirent.name) && dirent.name !== 'node_modules')
      .map(dirent => dirent.name)
  } catch {
    return found
  }
  for (const sub of level1) {
    if (hasDshManifest(join(root, sub))) {
      found.push(sub)
      continue
    }
    try {
      for (const inner of readdirSync(join(root, sub), { withFileTypes: true })) {
        if (!inner.isDirectory() || !/^[A-Za-z0-9_.-]+$/.test(inner.name) || inner.name === 'node_modules') continue
        if (hasDshManifest(join(root, sub, inner.name))) found.push(`${sub}/${inner.name}`)
      }
    } catch { /* unreadable level — skip */ }
    if (found.length >= 8) break
  }
  return found.slice(0, 8)
}
