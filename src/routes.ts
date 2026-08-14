/**
 * HTTP routes bridging the browser market UI to the host: registry fallback,
 * installed-plugin listing, and the install executor.
 *
 * Security: the install route executes a shell command, so it accepts only
 * same-origin POSTs and only sources present in the curated registry.
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadRegistry } from './registry.ts'

export interface WebServerService {
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>
  }): () => void
}

export interface ShellService {
  resolve(request: {
    command: string
    timeoutMs?: number
    stdoutMaxBytes?: number
  }): unknown
  run(spec: unknown): Promise<{
    exitCode: number | null
    timedOut: boolean
    aborted: boolean
    stdout?: string
    stderr?: string
  }>
}

export interface MarketHost {
  webServer: WebServerService
  shell: ShellService
  logger?: { warn(message: string): void }
}

export interface MarketConfig {
  /** Profile the market installs into; matches the profile serving this UI. */
  profile: string
}

const PROFILE_RE = /^[A-Za-z0-9_-]+$/
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const INSTALL_TIMEOUT_MS = 5 * 60 * 1000

function quoted(path: string): string {
  return path.includes(' ') ? `"${path}"` : path
}

/**
 * Shell prefix re-invoking the CLI that launched this host process, so installs
 * work whether dsh runs from a global bin, a local install, or repo source
 * (`node --import tsx/esm .../bin.ts`). Falls back to a PATH `dsh`.
 */
function dshCommand(): string {
  const entry = process.argv[1]
  if (entry !== undefined && /[\\/](?:bin\.(?:js|ts)|dsh)$/.test(entry)) {
    return [quoted(process.execPath), ...process.execArgv.map(quoted), quoted(entry)].join(' ')
  }
  return 'dsh'
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
            const command = `${dshCommand()} plugin --profile ${config.profile} add github:${repo}`
            const result = await host.shell.run(host.shell.resolve({
              command,
              timeoutMs: INSTALL_TIMEOUT_MS,
              stdoutMaxBytes: 256 * 1024,
            }))
            const ok = result.exitCode === 0 && !result.timedOut && !result.aborted
            sendJson(response, ok ? 200 : 502, {
              ok,
              command,
              exitCode: result.exitCode,
              timedOut: result.timedOut,
              stdout: result.stdout ?? '',
              stderr: result.stderr ?? '',
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
