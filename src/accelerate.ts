/**
 * Routing a GitHub install through a region's proxy.
 *
 * pnpm does not fetch `github:owner/repo` with `git clone`; it resolves the
 * shortcut and downloads a tarball from codeload.github.com. That rules out
 * the usual `git config insteadOf` trick — there is no git command to
 * redirect — and leaves rewriting the target as the only lever.
 *
 * Two properties have to survive the rewrite, and both were found the hard
 * way rather than assumed:
 *
 * - **The commit has to be pinned.** The profile reads each plugin's
 *   installed commit back out of the lockfile by matching a codeload URL
 *   ending in a 40-character SHA (src/profile.ts). A `HEAD` tarball installs
 *   perfectly and then reports no version forever. So this resolves the SHA
 *   first, and a rewrite that cannot get one does not happen.
 * - **Build-script approval has to keep matching.** `gitAllowBuildsKey`
 *   (src/sources.ts) derives its key from the repo, and now recognizes the
 *   proxied form too — a plugin does not become a different plugin because
 *   its bytes arrived by another route.
 *
 * Subpath entries are left alone. A `#path:` selector picks one directory
 * out of a repo, and a tarball URL has nowhere to say that; those installs
 * stay on the direct route rather than quietly installing the wrong thing.
 *
 * Every failure falls back to the original target. Acceleration is an
 * optimisation, and an optimisation that can fail an install is a bug.
 */

import { logEvent } from './log.ts'
import { marketFetch } from './net.ts'
import { routesFor, type Region } from './regions.ts'
import { codeloadTarball } from './sources.ts'

/** A bare repo shortcut: the only target shape a tarball URL can express. */
const BARE_GITHUB_RE = /^github:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/

/** A full commit SHA. Anything shorter would not satisfy the lockfile reader. */
const SHA_RE = /^[0-9a-f]{40}$/

/**
 * How long to wait for the SHA before giving up and installing directly.
 *
 * Short on purpose: this is spent BEFORE the download starts, and the whole
 * point is to save time. A proxy that cannot answer in a few seconds is not
 * going to serve a tarball quickly either.
 */
const RESOLVE_TIMEOUT_MS = 6000

/**
 * The default branch's current commit, through the region's proxy.
 * @returns the SHA, or null when it cannot be determined.
 */
async function headCommit(repo: string, proxy: string, signal: AbortSignal): Promise<string | null> {
  try {
    const res = await marketFetch(`${proxy}/https://api.github.com/repos/${repo}/commits/HEAD`, {
      signal,
      headers: { accept: 'application/vnd.github.sha', 'user-agent': 'dsh-market' },
    })
    if (!res.ok) return null
    // `Accept: application/vnd.github.sha` asks GitHub for the bare SHA as
    // text, which is a few bytes instead of a full commit document. A proxy
    // that drops the header hands back JSON instead, so both are read.
    const body = (await res.text()).trim()
    if (SHA_RE.test(body)) return body
    const parsed = JSON.parse(body) as { sha?: unknown }
    return typeof parsed.sha === 'string' && SHA_RE.test(parsed.sha) ? parsed.sha : null
  } catch {
    return null
  }
}

/**
 * The install target to actually hand pnpm, given the region in force.
 *
 * @param target - what `installTargetFor` produced.
 * @param region - the download region.
 * @param env - environment, for the proxy override.
 * @returns a proxied commit-pinned tarball URL when every condition holds,
 *   otherwise `target` unchanged.
 */
export async function acceleratedTarget(
  target: string,
  region: Region,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const proxy = routesFor(region, env).githubProxy
  if (proxy === null) return target
  const bare = BARE_GITHUB_RE.exec(target)
  if (bare === null) return target
  const repo = bare[1]!
  const controller = new AbortController()
  const timer = setTimeout(() => { controller.abort() }, RESOLVE_TIMEOUT_MS)
  try {
    const sha = await headCommit(repo, proxy, controller.signal)
    if (sha === null) {
      logEvent('info', 'region', `${repo}: could not resolve a commit through the mirror; installing directly`)
      return target
    }
    return codeloadTarball(repo, sha, proxy)
  } finally {
    clearTimeout(timer)
  }
}
