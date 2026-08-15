/**
 * Process layer: re-invoking the dsh CLI that launched this host, spawning
 * `dsh plugin` commands with timeouts and live progress, and provisioning
 * pnpm. This is the only module that starts child processes.
 *
 * Installs run through node:child_process, not ctx.shell: the shell service is
 * the agent's sandboxed executor and denies writes to the profile directory.
 */

import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { logEvent } from './log.ts'
import { pluginArgsFor } from './pnpm-compat.ts'
import { profileDir } from './profile.ts'

const INSTALL_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Windows npm/corepack/pnpm are `.cmd` shims. Node's `spawn` without a shell
 * cannot start them (ENOENT / EINVAL). Same pattern as dsh's `plugin` forwarder.
 */
export const winCmdShim = process.platform === 'win32'

/**
 * Argv re-invoking the CLI that launched this host process, so installs work
 * whether dsh runs from a global bin, a local install, or repo source
 * (`node --import tsx/esm .../bin.ts`). Falls back to a PATH `dsh`.
 */
export function dshArgv(): { file: string; args: string[]; cwd: string | undefined; viaShell: boolean } {
  const entry = process.argv[1]
  if (entry !== undefined && /[\\/](?:bin\.(?:js|ts)|dsh)$/.test(entry)) {
    // Absolute paths are required: source launches (`pnpm dsh`) pass a
    // relative entry, which the child resolves against its OWN cwd and dies
    // with MODULE_NOT_FOUND (#13). cwd near the entry keeps execArgv imports
    // (tsx/esm) resolvable on source launches.
    const abs = resolve(entry)
    return { file: process.execPath, args: [...process.execArgv, abs], cwd: dirname(abs), viaShell: false }
  }
  // Bare `dsh` is a .cmd shim on Windows that only a shell can start (#13).
  return { file: 'dsh', args: [], cwd: undefined, viaShell: winCmdShim }
}

/** Outcome of one spawned plugin command. */
export interface InstallResult {
  exitCode: number | null
  timedOut: boolean
  stdout: string
  stderr: string
}

/** The shape every orchestration function takes to run plugin commands (injectable in tests). */
export type PluginRunner = (profile: string, pluginArgs: string[]) => Promise<InstallResult>

/**
 * Kill a spawned child and, on Windows, its whole process tree — `kill()`
 * there only terminates the wrapper, leaving pnpm children running.
 * (Contributed in #7 by @mraing.)
 */
export function killChild(child: ChildProcess): void {
  if (process.platform === 'win32' && child.pid !== undefined) {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
      return
    } catch { /* fall through */ }
  }
  child.kill('SIGKILL')
}

/** Whether `pnpm` resolves on PATH; success is cached, absence is re-probed. */
let pnpmReady = false

/** Probe `pnpm --version` on PATH. */
export function probePnpm(): Promise<boolean> {
  if (pnpmReady) return Promise.resolve(true)
  return new Promise((resolvePromise) => {
    const child = spawn('pnpm', ['--version'], { stdio: 'ignore', shell: winCmdShim })
    child.on('error', () => resolvePromise(false))
    child.on('close', (code) => {
      pnpmReady = code === 0
      resolvePromise(pnpmReady)
    })
  })
}

function runQuiet(file: string, args: string[], timeoutMs: number): Promise<{ code: number | null; output: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn(file, args, {
      env: { ...process.env, CI: 'true' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: winCmdShim,
    })
    let output = ''
    const timer = setTimeout(() => killChild(child), timeoutMs)
    const collect = (chunk: Buffer): void => { output = (output + chunk.toString()).slice(-8 * 1024) }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    child.on('error', (error) => { clearTimeout(timer); resolvePromise({ code: 127, output: error.message }) })
    child.on('close', (code) => { clearTimeout(timer); resolvePromise({ code, output }) })
  })
}

/**
 * Provision pnpm without user involvement: corepack (ships with Node) first,
 * a global npm install as fallback.
 * @returns true when `pnpm --version` succeeds afterwards.
 */
export async function provisionPnpm(): Promise<boolean> {
  const corepack = await runQuiet('corepack', ['enable', 'pnpm'], 60 * 1000)
  logEvent(corepack.code === 0 ? 'info' : 'warn', 'setup-pnpm', `corepack enable: exit=${String(corepack.code)} ${corepack.output.slice(-200)}`)
  if (await probePnpm()) return true
  const npm = await runQuiet('npm', ['install', '-g', 'pnpm'], 3 * 60 * 1000)
  logEvent(npm.code === 0 ? 'info' : 'error', 'setup-pnpm', `npm -g: exit=${String(npm.code)} ${npm.output.slice(-200)}`)
  return probePnpm()
}

/** Live progress of the running plugin command, for the status route. */
export interface InstallProgress {
  active: boolean
  target: string
  startedAt: number
  lastLine: string
}

/** Singleton progress state; the status route reads it, runDshPlugin writes it. */
export const progress: InstallProgress = { active: false, target: '', startedAt: 0, lastLine: '' }

/** Identifies this host process; the client scopes its pending-restart flags to it. */
export const BOOT_ID = `${String(process.pid)}-${String(Date.now())}`

function trackProgress(chunk: string): void {
  const lines = chunk.split('\n').map(l => l.trim()).filter(l => l !== '')
  if (lines.length > 0) progress.lastLine = lines[lines.length - 1].slice(0, 200)
}

/**
 * Central allowlist for every spawn target, regardless of which route built
 * it (defense in depth on top of per-route validation — the win32 bare-dsh
 * fallback runs through a shell). Suggested in #16 by @anupamme.
 */
const TARGET_RE = /^[A-Za-z0-9@:./_#+-]+$/

/** Run one `dsh plugin --profile <p> …` command with timeout and progress tracking. */
export function runDshPlugin(profile: string, pluginArgs: string[]): Promise<InstallResult> {
  const { file, args, cwd, viaShell } = dshArgv()
  pluginArgs = pluginArgsFor(profileDir(profile), pluginArgs)
  const target = pluginArgs[pluginArgs.length - 1] ?? ''
  if (!TARGET_RE.test(target)) {
    logEvent('error', 'install', `unsafe plugin target rejected: ${JSON.stringify(target)}`)
    return Promise.resolve({ exitCode: 1, timedOut: false, stdout: '', stderr: `unsafe plugin target rejected: ${JSON.stringify(target)}` })
  }
  progress.active = true
  progress.target = target
  progress.startedAt = Date.now()
  progress.lastLine = ''
  return new Promise((resolvePromise) => {
    const child = spawn(file, [...args, 'plugin', '--profile', profile, ...pluginArgs], {
      cwd,
      // pnpm v10 blocks forever on a silent interactive prompt without a TTY
      // (observed on re-add over a pinned git spec); CI mode forces it to act
      // or fail instead of asking.
      env: { ...process.env, CI: 'true' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: viaShell,
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      killChild(child)
    }, INSTALL_TIMEOUT_MS)
    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      stdout = (stdout + text).slice(-256 * 1024)
      trackProgress(text)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      stderr = (stderr + text).slice(-64 * 1024)
      trackProgress(text)
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      progress.active = false
      resolvePromise({ exitCode: 127, timedOut: false, stdout, stderr: `${stderr}\n${error.message}` })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      progress.active = false
      resolvePromise({ exitCode: code, timedOut, stdout, stderr })
    })
  })
}
