/**
 * HTTP routes bridging the browser market UI to the host: registry fallback,
 * installed-plugin listing, and the install executor.
 *
 * Security: the install route executes a shell command, so it accepts only
 * same-origin POSTs and only sources present in the curated registry.
 */

import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadRegistry } from './registry.ts'

export interface WebServerService {
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>
  }): () => void
}

export interface MarketHost {
  webServer: WebServerService
  logger?: { warn(message: string): void }
}

export interface MarketConfig {
  /** Profile the market installs into; matches the profile serving this UI. */
  profile: string
}

const PROFILE_RE = /^[A-Za-z0-9_-]+$/
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const INSTALL_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Argv re-invoking the CLI that launched this host process, so installs work
 * whether dsh runs from a global bin, a local install, or repo source
 * (`node --import tsx/esm .../bin.ts`). Falls back to a PATH `dsh`.
 *
 * Installs run through node:child_process, not ctx.shell: the shell service is
 * the agent's sandboxed executor and denies writes to the profile directory.
 */
function dshArgv(): { file: string; args: string[]; cwd: string | undefined } {
  const entry = process.argv[1]
  if (entry !== undefined && /[\\/](?:bin\.(?:js|ts)|dsh)$/.test(entry)) {
    // cwd near the entry keeps execArgv imports (tsx/esm) resolvable on source launches.
    return { file: process.execPath, args: [...process.execArgv, entry], cwd: dirname(entry) }
  }
  return { file: 'dsh', args: [], cwd: undefined }
}

interface InstallResult {
  exitCode: number | null
  timedOut: boolean
  stdout: string
  stderr: string
}

function runDshPlugin(profile: string, pluginArgs: string[]): Promise<InstallResult> {
  const { file, args, cwd } = dshArgv()
  return new Promise((resolvePromise) => {
    execFile(
      file,
      [...args, 'plugin', '--profile', profile, ...pluginArgs],
      {
        cwd,
        timeout: INSTALL_TIMEOUT_MS,
        maxBuffer: 1024 * 1024,
        killSignal: 'SIGKILL',
        // pnpm v10 blocks forever on a silent interactive prompt without a
        // TTY (observed on re-add over a pinned git spec); CI mode forces it
        // to act or fail instead of asking.
        env: { ...process.env, CI: 'true' },
      },
      (error, stdout, stderr) => {
        const failed = error as (NodeJS.ErrnoException & { code?: number | string; killed?: boolean }) | null
        resolvePromise({
          exitCode: failed === null ? 0 : typeof failed.code === 'number' ? failed.code : 1,
          timedOut: failed?.killed === true,
          stdout: String(stdout),
          stderr: String(stderr),
        })
      },
    )
  })
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

function sameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin
  const host = request.headers.host
  if (origin === undefined || host === undefined) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 4096) throw new Error('request body too large')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

function profileDir(profile: string): string {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'profiles', profile)
}

/** Community dependencies of the profile (official in-box scope filtered out). */
function readInstalled(profile: string): Record<string, string> {
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

/** GitHub `owner/repo` for a registry URL, or null when it is not a GitHub repo URL. */
function repoOf(url: string): string | null {
  const m = /^https:\/\/github\.com\/([^/]+\/[^/]+?)\/?$/.exec(url)
  if (m === null || !REPO_RE.test(m[1])) return null
  return m[1]
}

/** Pinned commit per `owner/repo` from the profile lockfile's codeload tarball URLs. */
function readLockCommits(profile: string): Map<string, string> {
  const commits = new Map<string, string>()
  try {
    const lock = readFileSync(join(profileDir(profile), 'pnpm-lock.yaml'), 'utf8')
    for (const m of lock.matchAll(/codeload\.github\.com\/([^/\s]+\/[^/\s]+)\/tar\.gz\/([0-9a-f]{40})/g)) {
      commits.set(m[1].toLowerCase(), m[2])
    }
  } catch { /* no lockfile — no git installs to report */ }
  return commits
}

function readInstalledVersion(profile: string, name: string): string | null {
  try {
    const manifest = JSON.parse(
      readFileSync(join(profileDir(profile), 'node_modules', name, 'package.json'), 'utf8'),
    ) as { version?: string }
    return manifest.version ?? null
  } catch {
    return null
  }
}

export interface UpdateStatus {
  kind: 'github' | 'npm' | 'linked'
  version: string | null
  current: string | null
  latest: string | null
  updateAvailable: boolean
}

const UPDATES_TTL_MS = 30 * 60 * 1000
let updatesCache: { at: number; data: Record<string, UpdateStatus> } | null = null

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'dsh-market' },
    signal: AbortSignal.timeout(4000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as unknown
}

/** Per-plugin update checks; a failed check reports no update rather than failing the listing. */
async function checkUpdates(profile: string): Promise<Record<string, UpdateStatus>> {
  if (updatesCache && Date.now() - updatesCache.at < UPDATES_TTL_MS) return updatesCache.data
  const installed = readInstalled(profile)
  const lockCommits = readLockCommits(profile)
  const result: Record<string, UpdateStatus> = {}
  await Promise.all(Object.entries(installed).map(async ([name, spec]) => {
    const version = readInstalledVersion(profile, name)
    if (spec.startsWith('link:') || spec.startsWith('file:')) {
      result[name] = { kind: 'linked', version, current: null, latest: null, updateAvailable: false }
      return
    }
    const gh = /^(?:github:)?([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:#.*)?$/.exec(spec)
    try {
      if (spec.startsWith('github:') && gh !== null) {
        const current = lockCommits.get(gh[1].toLowerCase()) ?? null
        const head = (await fetchJson(`https://api.github.com/repos/${gh[1]}/commits/HEAD`)) as { sha?: string }
        const latest = typeof head.sha === 'string' ? head.sha : null
        result[name] = {
          kind: 'github', version, current, latest,
          updateAvailable: current !== null && latest !== null && current !== latest,
        }
      } else {
        const meta = (await fetchJson(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`)) as { version?: string }
        const latest = typeof meta.version === 'string' ? meta.version : null
        result[name] = {
          kind: 'npm', version, current: version, latest,
          updateAvailable: version !== null && latest !== null && version !== latest,
        }
      }
    } catch {
      result[name] = { kind: spec.startsWith('github:') ? 'github' : 'npm', version, current: null, latest: null, updateAvailable: false }
    }
  }))
  updatesCache = { at: Date.now(), data: result }
  return result
}

/**
 * Register the market's HTTP routes.
 * @param host - Acquired webServer + shell services.
 * @param config - Validated market configuration.
 * @returns Disposer removing every registered route.
 */
export function mountMarketRoutes(host: MarketHost, config: MarketConfig): () => void {
  if (!PROFILE_RE.test(config.profile)) {
    throw new Error(`dsh-market: invalid profile name: ${config.profile}`)
  }
  let installing = false

  const disposers = [
    host.webServer.register({
      kind: 'exact',
      path: '/dsh-market/registry',
      handler: async (request, response) => {
        if (request.method !== 'GET') {
          response.writeHead(405, { allow: 'GET' })
          response.end()
          return
        }
        try {
          const { registry, source } = await loadRegistry()
          sendJson(response, 200, { source, registry })
        } catch (error) {
          sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    }),

    host.webServer.register({
      kind: 'exact',
      path: '/dsh-market/installed',
      handler: (request, response) => {
        if (request.method !== 'GET') {
          response.writeHead(405, { allow: 'GET' })
          response.end()
          return
        }
        sendJson(response, 200, { profile: config.profile, installed: readInstalled(config.profile) })
      },
    }),

    host.webServer.register({
      kind: 'exact',
      path: '/dsh-market/updates',
      handler: async (request, response) => {
        if (request.method !== 'GET') {
          response.writeHead(405, { allow: 'GET' })
          response.end()
          return
        }
        try {
          sendJson(response, 200, { updates: await checkUpdates(config.profile) })
        } catch (error) {
          sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    }),

    host.webServer.register({
      kind: 'exact',
      path: '/dsh-market/update',
      handler: async (request, response) => {
        if (request.method !== 'POST') {
          response.writeHead(405, { allow: 'POST' })
          response.end()
          return
        }
        if (!sameOrigin(request)) {
          sendJson(response, 403, { error: 'untrusted origin' })
          return
        }
        if (installing) {
          sendJson(response, 409, { error: 'another install is already running' })
          return
        }
        try {
          const body = (await readJsonBody(request)) as { name?: unknown }
          const name = typeof body.name === 'string' ? body.name : ''
          const spec = readInstalled(config.profile)[name]
          if (spec === undefined) {
            sendJson(response, 400, { error: 'plugin is not installed' })
            return
          }
          if (spec.startsWith('link:') || spec.startsWith('file:')) {
            sendJson(response, 400, { error: 'locally linked plugins update from their checkout' })
            return
          }
          // Re-running add re-resolves the source: git HEAD for github specs,
          // dist-tag latest for registry installs.
          const target = spec.startsWith('github:') ? spec.replace(/#.*$/, '') : `${name}@latest`
          installing = true
          try {
            const result = await runDshPlugin(config.profile, ['add', target])
            const ok = result.exitCode === 0 && !result.timedOut
            if (ok) updatesCache = null
            sendJson(response, ok ? 200 : 502, {
              ok,
              exitCode: result.exitCode,
              timedOut: result.timedOut,
              stdout: result.stdout,
              stderr: result.stderr,
              installed: readInstalled(config.profile),
            })
          } finally {
            installing = false
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          host.logger?.warn(`[dsh-market] update failed: ${message}`)
          sendJson(response, 500, { error: message })
        }
      },
    }),

    host.webServer.register({
      kind: 'exact',
      path: '/dsh-market/install',
      handler: async (request, response) => {
        if (request.method !== 'POST') {
          response.writeHead(405, { allow: 'POST' })
          response.end()
          return
        }
        if (!sameOrigin(request)) {
          sendJson(response, 403, { error: 'untrusted origin' })
          return
        }
        if (installing) {
          sendJson(response, 409, { error: 'another install is already running' })
          return
        }
        try {
          const body = (await readJsonBody(request)) as { url?: unknown }
          const url = typeof body.url === 'string' ? body.url : ''
          const { registry } = await loadRegistry()
          const entry = registry.plugins.find(p => p.url.toLowerCase() === url.toLowerCase())
          if (entry === undefined) {
            sendJson(response, 400, { error: 'plugin is not in the curated registry' })
            return
          }
          const repo = repoOf(entry.url)
          if (repo === null) {
            sendJson(response, 400, { error: 'unsupported source url' })
            return
          }
          installing = true
          try {
            const result = await runDshPlugin(config.profile, ['add', `github:${repo}`])
            const ok = result.exitCode === 0 && !result.timedOut
            if (ok) updatesCache = null
            sendJson(response, ok ? 200 : 502, {
              ok,
              exitCode: result.exitCode,
              timedOut: result.timedOut,
              stdout: result.stdout,
              stderr: result.stderr,
              installed: readInstalled(config.profile),
            })
          } finally {
            installing = false
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          host.logger?.warn(`[dsh-market] install failed: ${message}`)
          sendJson(response, 500, { error: message })
        }
      },
    }),
  ]

  return () => {
    for (const dispose of disposers) dispose()
  }
}
