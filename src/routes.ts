/**
 * HTTP routes bridging the browser market UI to the host. This layer only
 * parses requests, calls the service modules, and serializes responses —
 * process spawning lives in dsh-cli.ts, filesystem reads in profile.ts,
 * orchestration in install.ts / themes.ts / updates.ts.
 *
 * Security: the install route executes a shell command, so it accepts only
 * same-origin POSTs and only sources present in the curated registry.
 */

import { readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadRegistry } from './registry.ts'
import {
  cleanHotDir, hotMount, hotUnmount, listHotMounts,
  mountClientOnlyDeps, readDisabledThemes,
} from './hot.ts'
import { exportLogs, logEvent } from './log.ts'
import { BOOT_ID, probePnpm, progress, provisionPnpm, runDshPlugin } from './dsh-cli.ts'
import { profileDir, readInstalled, readInstalledVersion, readLockCommits } from './profile.ts'
import { installTargetFor } from './sources.ts'
import { isStaleUpdate, retargetCollections, validateAddedPlugins, withHoistRecovery } from './install.ts'
import { checkUpdates, invalidateUpdates } from './updates.ts'
import { createThemeManager, type LoaderEntry } from './themes.ts'
import { readJsonBody, sameOrigin, sendJson } from './http.ts'

export type { LoaderEntry } from './themes.ts'
export type { UpdateStatus } from './updates.ts'

export interface WebServerService {
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>
  }): () => void
}

export interface MarketHost {
  webServer: WebServerService
  loader: { entries(): Iterable<LoaderEntry> }
  plugin(plugin: unknown, config: unknown): { await(): Promise<unknown>; dispose(): Promise<unknown> | void }
  on?(event: string, callback: (fiber: { entry?: { options?: { name?: string } } }) => void): () => void
  logger?: { info?(message: string): void; warn(message: string): void }
}

export interface MarketConfig {
  /** Profile the market installs into; matches the profile serving this UI. */
  profile: string
}

const PROFILE_RE = /^[A-Za-z0-9_-]+$/

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
  // Boot-time wipe: stale hot-mount inputs from a previous session must never
  // survive into a composition where the bundle layer already covers them.
  cleanHotDir(profileDir(config.profile))
  // The user's persisted theme choice; activateTheme mutates and writes it.
  const disabledThemes = readDisabledThemes(profileDir(config.profile))
  const themes = createThemeManager(host, config.profile, disabledThemes)

  // Client-only packages (dsh.client without dsh.bundle) are invisible to the
  // bundle layer in every boot; the market shim-mounts them so their client
  // bundles are actually served.
  void mountClientOnlyDeps(host, profileDir(config.profile)).then(async (mounted) => {
    if (mounted.length > 0) logEvent('info', 'boot', `client-only shims mounted: ${mounted.join(', ')}`)
    // Replay the user's theme choice: bundle-layer themes they switched away
    // from get live-disabled again (bundle trees are in-memory, so the
    // disable never persists on its own).
    for (const name of disabledThemes) {
      if (await themes.setEntryDisabled(name, true)) logEvent('info', 'boot', `theme kept off: ${name}`)
    }
  })

  // Self-healing guard: dsh's own patch overlay can re-update entries during
  // activation and wipe the runtime disabled flag — whenever a fiber comes up
  // for a theme the user switched off, put it back down.
  host.on?.('internal/plugin', (fiber) => {
    const name = fiber.entry?.options?.name
    if (name !== undefined && disabledThemes.has(name)) void themes.setEntryDisabled(name, true)
  })
  let installing = false

  /** Every plugin command goes through the pnpm-drift recovery wrapper (#20). */
  const runPlugin = (profile: string, args: string[]) => withHoistRecovery(runDshPlugin, profile, args)

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
        sendJson(response, 200, {
          profile: config.profile,
          installed: readInstalled(config.profile),
          live: listHotMounts(),
        })
      },
    }),

    host.webServer.register({
      kind: 'exact',
      path: '/dsh-market/use-skin',
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
        try {
          const body = (await readJsonBody(request)) as { name?: unknown }
          const name = typeof body.name === 'string' ? body.name : ''
          const installed = readInstalled(config.profile)
          const themeNames = await themes.installedThemeNames()
          if (installed[name] === undefined || !themeNames.has(name)) {
            sendJson(response, 400, { error: 'not an installed theme' })
            return
          }
          const activated = await themes.activateTheme(name)
          logEvent(activated ? 'info' : 'error', 'use-skin', `${name}: ${activated ? 'active' : 'failed'}`)
          sendJson(response, activated ? 200 : 502, { ok: activated, live: listHotMounts() })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          logEvent('error', 'use-skin', `route error: ${message}`)
          sendJson(response, 500, { error: message })
        }
      },
    }),

    host.webServer.register({
      kind: 'exact',
      path: '/dsh-market/status',
      handler: async (request, response) => {
        if (request.method !== 'GET') {
          response.writeHead(405, { allow: 'GET' })
          response.end()
          return
        }
        sendJson(response, 200, {
          active: progress.active,
          target: progress.target,
          seconds: progress.active ? Math.round((Date.now() - progress.startedAt) / 1000) : 0,
          lastLine: progress.lastLine,
          pnpm: await probePnpm(),
          boot: BOOT_ID,
          installed: readInstalled(config.profile),
        })
      },
    }),

    host.webServer.register({
      kind: 'exact',
      path: '/dsh-market/logs',
      handler: (request, response) => {
        if (request.method !== 'GET') {
          response.writeHead(405, { allow: 'GET' })
          response.end()
          return
        }
        let version = 'unknown'
        try {
          version = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version?: string }).version ?? version
        } catch { /* export still works without the version line */ }
        response.writeHead(200, {
          'cache-control': 'no-store',
          'content-type': 'text/plain; charset=utf-8',
          'content-disposition': 'attachment; filename="dsh-market-log.txt"',
        })
        response.end(exportLogs({
          'dsh-market': version,
          platform: `${process.platform} ${process.arch}`,
          node: process.version,
          profile: config.profile,
        }))
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
          const force = (request.url ?? '').includes('force=1')
          sendJson(response, 200, { updates: await checkUpdates(config.profile, force) })
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
          const isGit = spec.startsWith('github:')
          const target = isGit ? spec.replace(/#.*$/, '') : `${name}@latest`
          const repoKey = isGit ? spec.slice('github:'.length).replace(/#.*$/, '').toLowerCase() : null
          const beforeVersion = readInstalledVersion(config.profile, name)
          const beforeCommit = repoKey !== null ? readLockCommits(config.profile).get(repoKey) ?? null : null
          installing = true
          try {
            const result = await runPlugin(config.profile, ['add', target])
            let ok = result.exitCode === 0 && !result.timedOut
            let stale = false
            if (ok) {
              stale = isStaleUpdate({
                isGit,
                beforeVersion,
                afterVersion: readInstalledVersion(config.profile, name),
                beforeCommit,
                afterCommit: repoKey !== null ? readLockCommits(config.profile).get(repoKey) ?? null : null,
              })
              if (stale) ok = false
            }
            if (ok) invalidateUpdates()
            const staleError = stale
              ? `still v${beforeVersion ?? beforeCommit?.slice(0, 7) ?? '?'} after the update — pnpm 的 minimumReleaseAge 安全策略会暂时拦下发布不久的新版本（静默保留旧版且返回成功）。请稍后再试；着急可调整 profile pnpm-workspace.yaml 的 minimumReleaseAge / pnpm's minimumReleaseAge holds back very fresh releases; retry later or tune it in the profile's pnpm-workspace.yaml`
              : null
            logEvent(ok ? 'info' : 'error', 'update',
              `${name} -> ${target} exit=${String(result.exitCode)}${result.timedOut ? ' TIMEOUT' : ''}${stale ? ' STALE(minimumReleaseAge?)' : ''}${ok ? '' : ` stderr=${result.stderr.slice(-300)}`}`)
            sendJson(response, ok ? 200 : 502, {
              ok,
              error: staleError ?? undefined,
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
          logEvent('error', 'update', `route error: ${message}`)
          sendJson(response, 500, { error: message })
        }
      },
    }),

    host.webServer.register({
      kind: 'exact',
      path: '/dsh-market/setup-pnpm',
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
        try {
          sendJson(response, 200, { ok: await provisionPnpm() })
        } catch (error) {
          sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    }),

    host.webServer.register({
      kind: 'exact',
      path: '/dsh-market/uninstall',
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
          if (name === 'dsh-market' || name === 'dshmarket') {
            sendJson(response, 400, { error: 'the market cannot uninstall itself; use the dsh CLI' })
            return
          }
          if (readInstalled(config.profile)[name] === undefined) {
            sendJson(response, 400, { error: 'plugin is not installed' })
            return
          }
          installing = true
          try {
            const result = await runPlugin(config.profile, ['remove', name])
            const ok = result.exitCode === 0 && !result.timedOut
            let hot = false
            if (ok) {
              invalidateUpdates()
              hot = await hotUnmount(name)
            }
            logEvent(ok ? 'info' : 'error', 'uninstall',
              `${name} exit=${String(result.exitCode)}${ok ? ` live-removed=${String(hot)}` : ` stderr=${result.stderr.slice(-300)}`}`)
            sendJson(response, ok ? 200 : 502, {
              ok,
              hot,
              exitCode: result.exitCode,
              stdout: result.stdout,
              stderr: result.stderr,
              installed: readInstalled(config.profile),
            })
          } finally {
            installing = false
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          host.logger?.warn(`[dsh-market] uninstall failed: ${message}`)
          logEvent('error', 'uninstall', `route error: ${message}`)
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
            logEvent('warn', 'install-rejected', `not in curated registry: ${url.slice(0, 120)}`)
            sendJson(response, 400, { error: 'plugin is not in the curated registry' })
            return
          }
          const target = installTargetFor(entry)
          if (target === null) {
            sendJson(response, 400, { error: 'unsupported source url' })
            return
          }
          installing = true
          try {
            const before = new Set(Object.keys(readInstalled(config.profile)))
            const result = await runPlugin(config.profile, ['add', target])
            let ok = result.exitCode === 0 && !result.timedOut
            if (ok) invalidateUpdates()
            if (ok) {
              // Collection repos (e.g. skin monorepos) install as a junk
              // fileset with no root package.json; retarget to the real
              // plugin subdirectories via pnpm's #path: selector.
              ok = await retargetCollections(runPlugin, config.profile, before, target)
            }
            // Fake-success guard (#18): a clean exit that added nothing
            // installable must not read as success. Runs even when
            // retargeting partially failed — a broken piece that slipped in
            // must never survive to brick the next boot.
            let notAPlugin = false
            let removedBroken: string[] = []
            if (result.exitCode === 0 && !result.timedOut) {
              const validated = await validateAddedPlugins(runPlugin, config.profile, before)
              removedBroken = validated.removedBroken
              if (removedBroken.length > 0) {
                logEvent('warn', 'install', `${target}: removed uninstallable pieces (no dsh manifest or missing build artifacts): ${removedBroken.join(', ')}`)
              }
              if (validated.keep.length === 0) {
                ok = false
                notAPlugin = true
                logEvent('error', 'install', `${target}: nothing installable survived validation`)
              } else {
                // Partial success across a collection still counts as success.
                ok = true
              }
            }
            const installed = readInstalled(config.profile)
            let hot = false
            if (ok) {
              const added = Object.keys(installed).filter(name => !before.has(name))
              if (added.length > 0) {
                // Theme installs auto-activate (and deactivate the previous
                // theme) so the result is visible right after the refresh.
                hot = true
                for (const name of added) {
                  const live = entry.category === 'theme'
                    ? await themes.activateTheme(name)
                    : await hotMount(host, profileDir(config.profile), name)
                  if (!live) hot = false
                }
              }
            }
            logEvent(ok ? 'info' : 'error', 'install',
              `${target} exit=${String(result.exitCode)}${result.timedOut ? ' TIMEOUT' : ''}${ok ? ` hot=${String(hot)}` : ` stderr=${result.stderr.slice(-300)}`}`)
            sendJson(response, ok ? 200 : 502, {
              ok,
              hot,
              error: notAPlugin ? 'nothing installable: the plugin(s) need a build step (blocked by default, see allowBuilds) or ship no prebuilt artifacts / 没有可安装的内容：插件需要构建授权（allowBuilds，默认拦截）或未附带构建产物，详见导出日志' : undefined,
              exitCode: result.exitCode,
              timedOut: result.timedOut,
              stdout: result.stdout,
              stderr: result.stderr,
              installed,
            })
          } finally {
            installing = false
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          host.logger?.warn(`[dsh-market] install failed: ${message}`)
          logEvent('error', 'install', `route error: ${message}`)
          sendJson(response, 500, { error: message })
        }
      },
    }),
  ]

  return () => {
    for (const dispose of disposers) dispose()
  }
}
