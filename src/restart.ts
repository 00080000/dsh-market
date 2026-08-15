/**
 * Self-restart: relaunch the exact DSH invocation that booted this host so
 * pending (non-hot) plugin changes take effect without the user leaving the
 * UI. Contributed in #14 by @ysyyhhh; ported onto the layered architecture.
 *
 * Safety model: the endpoint accepts only direct same-origin loopback
 * requests (no forwarding headers), refuses while a plugin operation runs,
 * and deployments under a supervisor (systemd/launchd/pm2) can disable the
 * whole feature with `allowRestart: false` — the supervisor owns restarts.
 */

import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IncomingMessage } from 'node:http'
import { dshArgv } from './dsh-cli.ts'

/** Self-restart is enabled by default and disabled only by an explicit false. */
export function restartAllowed(config: { allowRestart?: boolean }): boolean {
  return config.allowRestart !== false
}

/** Whether a process-control request came from this Web host on loopback. */
export function trustedRestartRequest(request: Pick<IncomingMessage, 'headers' | 'socket'>): boolean {
  const address = request.socket.remoteAddress
  if (address !== '127.0.0.1' && address !== '::1' && address !== '::ffff:127.0.0.1') return false
  // Any forwarding trace means the loopback peer is a proxy, not the user.
  if (request.headers.forwarded !== undefined
    || request.headers['x-forwarded-for'] !== undefined
    || request.headers['x-real-ip'] !== undefined) return false
  const origin = request.headers.origin
  const host = request.headers.host
  if (origin === undefined || host === undefined) return false
  try {
    const parsed = new URL(origin)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.host === host
  } catch {
    return false
  }
}

/** The exact boot invocation the detached restart helper replays. */
export function restartLaunch(): { file: string; args: string[]; cwd: string; viaShell: boolean } {
  const launch = dshArgv()
  return {
    ...launch,
    args: [...launch.args, ...process.argv.slice(2)],
    cwd: launch.cwd ?? process.cwd(),
  }
}

/** What scheduleRestart reports back to the caller for logging/response. */
export interface RestartResult {
  pid: number
  helperPid: number | undefined
  logOut: string
  logErr: string
}

/**
 * Relaunch this exact DSH entry after a short detached handoff, then stop
 * this process. The helper outlives us (detached + unref), waits for our
 * port to free up, and logs the replacement's output under tmpdir.
 */
export function scheduleRestart(): RestartResult {
  const launch = restartLaunch()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const logOut = join(tmpdir(), `dsh-market-restart-${stamp}.out.log`)
  const logErr = join(tmpdir(), `dsh-market-restart-${stamp}.err.log`)
  const helperCode = [
    "const { spawn } = require('node:child_process')",
    "const fs = require('node:fs')",
    `const file = ${JSON.stringify(launch.file)}`,
    `const args = ${JSON.stringify(launch.args)}`,
    `const cwd = ${JSON.stringify(launch.cwd)}`,
    `const viaShell = ${JSON.stringify(launch.viaShell)}`,
    `const logOut = ${JSON.stringify(logOut)}`,
    `const logErr = ${JSON.stringify(logErr)}`,
    'setTimeout(() => {',
    '  try {',
    '    const out = fs.openSync(logOut, "a")',
    '    const err = fs.openSync(logErr, "a")',
    '    const child = spawn(file, args, { cwd, detached: true, stdio: ["ignore", out, err], env: process.env, shell: viaShell })',
    '    child.unref()',
    '  } catch {}',
    '}, 1500)',
  ].join('\n')
  const helper = spawn(process.execPath, ['-e', helperCode], {
    detached: true,
    stdio: 'ignore',
    env: process.env,
  })
  helper.unref()
  setTimeout(() => process.kill(process.pid, 'SIGTERM'), 500)
  return { pid: process.pid, helperPid: helper.pid, logOut, logErr }
}
