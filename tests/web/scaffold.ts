/**
 * Web e2e scaffold (harness convention): boot a REAL dsh web composition in
 * a throwaway DSH_HOME with the packed market installed, and hand the
 * caller a base url + console tripwire. Playwright is used as a library by
 * the specs; this file owns only the host side.
 *
 * The dsh CLI is resolved from DSHM_E2E_DSH (a full command line, e.g.
 * "node --import tsx/esm /path/to/deepseek-harness/apps/cli/src/bin.ts")
 * or a bare `dsh` on PATH. Without either, specs skip.
 */

import { execSync, spawn, spawnSync } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Page } from 'playwright'
import { packFixture, startFixtureRegistry } from './registry.ts'
import type { FixtureRegistry } from './registry.ts'

const REPO_ROOT = resolve(new URL('../..', import.meta.url).pathname)

/** Working directory for dsh invocations — source launches need their repo
 * root so `--import tsx/esm` resolves; a global dsh doesn't care. */
const DSH_CWD = process.env.DSHM_E2E_DSH_CWD ?? REPO_ROOT

/** The dsh launch command, or null when no dsh is reachable (specs skip). */
export function dshCommand(): string | null {
  const explicit = process.env.DSHM_E2E_DSH
  if (explicit !== undefined && explicit !== '') return explicit
  const probe = spawnSync('dsh', ['--version'], { shell: true, stdio: 'ignore', timeout: 30_000 })
  return probe.status === 0 ? 'dsh' : null
}

/**
 * Whether the e2e specs can run — and, where they are supposed to be
 * ENFORCING something, whether their absence is an error.
 *
 * Skipping is right on a contributor's machine that has no dsh. It is a trap
 * in CI: this lane installs the CLI itself, so if that step ever breaks (a
 * pinned prerelease unpublished, a registry hiccup) every spec would skip and
 * the job would still go green — reporting "e2e passed" for a run that
 * asserted nothing. CI sets DSHM_E2E_REQUIRED=1 to make that loud.
 */
export function dshAvailable(): boolean {
  if (dshCommand() !== null) return true
  if (process.env.DSHM_E2E_REQUIRED === '1') {
    throw new Error(
      'DSHM_E2E_REQUIRED=1 but no dsh CLI is reachable — the e2e lane would have skipped every spec and passed green',
    )
  }
  return false
}

export interface WebScaffold {
  baseUrl: string
  home: string
  close(): Promise<void>
}

export interface ScaffoldOptions {
  /**
   * Fixture directories under `tests/web/fixtures` to publish to a local
   * npm registry and list in a curated catalog the market is pointed at.
   * With this set the specs can drive the REAL install route end to end.
   */
  fixtures?: string[]
}

function run(command: string, env: NodeJS.ProcessEnv, cwd: string = REPO_ROOT): void {
  execSync(command, { env, stdio: 'pipe', timeout: 300_000, cwd })
}

/**
 * Pack the working tree and boot `dsh --profile web` on a free port inside
 * a temp DSH_HOME with the market installed from the tarball.
 */
export async function launchMarketScaffold(options: ScaffoldOptions = {}): Promise<WebScaffold> {
  const command = dshCommand()
  if (command === null) throw new Error('no dsh available — set DSHM_E2E_DSH')
  const home = mkdtempSync(join(tmpdir(), 'dshm-e2e-home-'))
  let env: NodeJS.ProcessEnv = { ...process.env, DSH_HOME: home, CI: 'true' }

  // prepack builds lib/ + client and runs the preflight guard. The market's
  // own install resolves from the real npm registry — it has dependencies.
  run('npm pack --pack-destination ' + JSON.stringify(home), env)
  const tarball = join(home, readdirSync(home).find(name => name.endsWith('.tgz'))!)
  run(`${command} plugin --profile web add ${JSON.stringify(tarball)}`, env, DSH_CWD)

  // Only now redirect pnpm at the fixture registry, so the fixtures the
  // specs install go through real resolution without touching the network.
  let registry: FixtureRegistry | null = null
  if (options.fixtures !== undefined && options.fixtures.length > 0) {
    registry = await startFixtureRegistry(options.fixtures.map(dir => packFixture(dir, home)))
    writeFileSync(
      join(home, 'profiles', 'web', '.npmrc'),
      // minimum-release-age=0: a fixture "published" seconds ago would
      // otherwise trip pnpm 11's fresh-release hold (#39).
      `registry=${registry.npmUrl}\nminimum-release-age=0\n`,
    )
    // npm_config_registry OUTRANKS .npmrc, and `npm run test:web` puts the
    // caller's registry there — so the file alone silently sends pnpm to the
    // public registry, where a fixture does not exist. Set both.
    env = { ...env, DSHM_REGISTRY_URL: registry.catalogUrl, npm_config_registry: registry.npmUrl }
  }

  const port = 3200 + Math.floor(Math.random() * 500)
  const child: ChildProcess = spawn(`${command} --profile web --port ${String(port)}`, {
    shell: true,
    cwd: DSH_CWD,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  })
  let output = ''
  child.stdout?.on('data', (chunk: Buffer) => { output = (output + chunk.toString()).slice(-8192) })
  child.stderr?.on('data', (chunk: Buffer) => { output = (output + chunk.toString()).slice(-8192) })

  const baseUrl = `http://127.0.0.1:${String(port)}`
  const deadline = Date.now() + 120_000
  for (;;) {
    if (child.exitCode !== null) throw new Error(`dsh exited ${String(child.exitCode)}:\n${output.slice(-2000)}`)
    try {
      const res = await fetch(`${baseUrl}/dsh-market/status`, { signal: AbortSignal.timeout(2000) })
      if (res.ok) break
    } catch { /* not up yet */ }
    if (Date.now() > deadline) throw new Error(`dsh boot timeout:\n${output.slice(-2000)}`)
    await new Promise(resolvePromise => setTimeout(resolvePromise, 1000))
  }

  return {
    baseUrl,
    home,
    close: async () => {
      await registry?.close()
      if (child.pid !== undefined) {
        try { process.kill(-child.pid, 'SIGTERM') } catch { child.kill('SIGTERM') }
      }
      await new Promise(resolvePromise => setTimeout(resolvePromise, 1500))
      if (child.pid !== undefined) {
        try { process.kill(-child.pid, 'SIGKILL') } catch { /* already gone */ }
      }
      rmSync(home, { recursive: true, force: true })
    },
  }
}

/** Fail the spec on any console error — the harness console-tripwire pattern. */
export function watchConsole(page: Page): { errors(): string[] } {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => { errors.push(String(error)) })
  return { errors: () => [...errors] }
}
