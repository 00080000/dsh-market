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
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { logEvent } from './log.ts'
import { pluginArgsFor } from './pnpm-compat.ts'
import { profileDir } from './profile.ts'

// 15 min default (slow networks + git installs), overridable for CI/tests.
// (#6 by @qichuang321.)
/**
 * macOS apps launched from Finder/Dock inherit a minimal PATH without the
 * shell profile — Homebrew/npm/corepack all vanish and every install dies
 * with ENOENT/127 (#32, #38). Append the well-known bin directories so the
 * market's children find their tools regardless of how dsh was started.
 */
function spawnEnv(): NodeJS.ProcessEnv {
  // pnpm v10+ blocks forever on a silent interactive prompt without a TTY;
  // CI mode forces it to act or fail instead of asking.
  if (process.platform === 'win32') return { ...process.env, CI: 'true' }
  const parts = (process.env.PATH ?? '').split(':').filter(part => part !== '')
  for (const bin of ['/opt/homebrew/bin', '/usr/local/bin', join(homedir(), '.local', 'bin')]) {
    if (!parts.includes(bin)) parts.push(bin)
  }
  return { ...process.env, CI: 'true', PATH: parts.join(':') }
}

const INSTALL_TIMEOUT_MS = Number(process.env.DSH_MARKET_INSTALL_TIMEOUT_MS) || 15 * 60 * 1000

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
  /** True when the run ended because the user cancelled it. */
  cancelled: boolean
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

/** The child of the operation currently running, for /dsh-market/cancel. */
let activeChild: ChildProcess | null = null
let cancelRequested = false

/**
 * Kill a child and its whole tree, gracefully where the platform allows:
 * taskkill /T /F on Windows (plain kill() leaves pnpm children running),
 * SIGTERM with a 5s SIGKILL escalation elsewhere so pnpm can clean up.
 * (Cancel flow contributed in #6 by @qichuang321.)
 */
function killTree(child: ChildProcess): void {
  if (process.platform === 'win32' && child.pid !== undefined) {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
      return
    } catch { /* fall through */ }
  }
  // POSIX: the dsh wrapper runs pnpm as a grandchild (spawnSync), which a
  // plain child.kill() leaves running — it keeps our stdio pipes open, so
  // the close event never fires and the market looks stuck "installing".
  // The child is spawned detached as its own process GROUP; kill the group.
  const signalTree = (signal: NodeJS.Signals): void => {
    if (child.pid === undefined) return
    try { process.kill(-child.pid, signal) } catch {
      try { child.kill(signal) } catch { /* already gone */ }
    }
  }
  signalTree('SIGTERM')
  const escalate = setTimeout(() => signalTree('SIGKILL'), 5000)
  escalate.unref?.()
}

/**
 * Cancel the plugin command currently running.
 * @returns true when there was one to cancel.
 */
export function cancelActive(): boolean {
  if (activeChild === null) return false
  cancelRequested = true
  killTree(activeChild)
  return true
}

/** Whether `pnpm` resolves on PATH; success is cached, absence is re-probed. */
let pnpmReady = false

/** Probe `pnpm --version` on PATH. */
export function probePnpm(): Promise<boolean> {
  if (pnpmReady) return Promise.resolve(true)
  return new Promise((resolvePromise) => {
    const child = spawn('pnpm', ['--version'], { stdio: 'ignore', shell: winCmdShim, env: spawnEnv() })
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
      env: spawnEnv(),
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
export async function provisionPnpm(): Promise<{ ok: boolean; hint?: string }> {
  const corepack = await runQuiet('corepack', ['enable', 'pnpm'], 60 * 1000)
  logEvent(corepack.code === 0 ? 'info' : 'warn', 'setup-pnpm', `corepack enable: exit=${String(corepack.code)} ${corepack.output.slice(-200)}`)
  if (await probePnpm()) return { ok: true }
  const npm = await runQuiet('npm', ['install', '-g', 'pnpm'], 3 * 60 * 1000)
  logEvent(npm.code === 0 ? 'info' : 'error', 'setup-pnpm', `npm -g: exit=${String(npm.code)} ${npm.output.slice(-200)}`)
  if (await probePnpm()) return { ok: true }
  // Both provisioning tools missing = Node itself is not on this process's
  // PATH (typical for Finder/Dock launches with nvm/fnm). Pointing the user
  // back at this same button would be a dead end (#32) — say what actually
  // helps.
  const pathIssue = /ENOENT/.test(corepack.output) && /ENOENT/.test(npm.output)
  return {
    ok: false,
    hint: pathIssue
      ? '这台机器的 dsh 进程找不到 Node（从图形界面启动不继承终端 PATH）。请改从终端启动 dsh，或安装 Homebrew 版 pnpm：brew install pnpm / This dsh process cannot find Node (GUI launches skip your shell PATH). Start dsh from a terminal, or install pnpm via Homebrew: brew install pnpm'
      : undefined,
  }
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
    return Promise.resolve({ exitCode: 1, timedOut: false, stdout: '', stderr: `unsafe plugin target rejected: ${JSON.stringify(target)}`, cancelled: false })
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
      env: spawnEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: viaShell,
      // Own process group on POSIX so cancel/timeout can kill the whole
      // tree (dsh wrapper + pnpm grandchild) with one group signal.
      detached: process.platform !== 'win32',
    })
    activeChild = child
    cancelRequested = false
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      killTree(child)
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
      if (activeChild === child) activeChild = null
      resolvePromise({ exitCode: 127, timedOut: false, stdout, stderr: `${stderr}\n${error.message}`, cancelled: false })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      progress.active = false
      if (activeChild === child) activeChild = null
      resolvePromise({ exitCode: code, timedOut, stdout, stderr, cancelled: cancelRequested })
    })
  })
}
