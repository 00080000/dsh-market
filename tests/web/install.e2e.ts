/**
 * Layer 3 — the REAL install chain: install route → registry check → pnpm
 * resolution → post-install validation → patch layer → cordis hot mount.
 *
 * Every layer-1 spec drives this chain against a hand-written FakeDsh, so it
 * can only prove the code agrees with our MODEL of pnpm and cordis. The bugs
 * that actually shipped (#103, #122, #135, #147) were all places where that
 * model was wrong, which is why none of them could be caught there. Here
 * pnpm, cordis and the patch layer are the real ones; only the fixtures are
 * ours, and they are served from a local npm registry so nothing has to be
 * published and nothing touches the network.
 *
 * Every fixture PROVES ITS OWN LIVENESS: each registers an HTTP route from
 * inside `apply()`, which can only answer if cordis genuinely resolved the
 * package, loaded the module and ran it. The market's own activation verdict
 * is an inference and is asserted AGAINST that, never trusted as it.
 *
 * No browser: the UI journey is covered by market.e2e.ts. What is
 * unprotected — and what this spec exists for — is the host-side chain.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { dshAvailable, launchMarketScaffold } from './scaffold.ts'
import type { WebScaffold } from './scaffold.ts'

const HAS_DSH = dshAvailable()
const A = 'dshm-e2e-fixture-a'
const B = 'dshm-e2e-fixture-b'
const CLASH = 'dshm-e2e-fixture-clash'
const CROSS = 'dshm-e2e-fixture-cross'
const CARRIER = 'dshm-e2e-fixture-carrier'

interface InstalledState {
  installed: Record<string, string>
  activation: Record<string, { state: string }>
  bundles: string[]
  patchDisabled: string[]
}

describe.skipIf(!HAS_DSH).sequential('web e2e: the real install chain', () => {
  let scaffold: WebScaffold
  let base: string

  beforeAll(async () => {
    scaffold = await launchMarketScaffold({ fixtures: ['fixture-a', 'fixture-b', 'fixture-clash', 'fixture-cross', 'fixture-carrier'] })
    base = scaffold.baseUrl
  }, 600_000)

  afterAll(async () => { await scaffold?.close() })

  /** The install route is same-origin only, like the browser's own POST. */
  const post = async (path: string, body: unknown): Promise<Response> =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify(body),
    })

  const state = async (): Promise<InstalledState> =>
    (await fetch(`${base}/dsh-market/installed`)).json() as never

  /**
   * Ground truth. The fixture writes this marker from inside its webServer
   * injection and removes it on dispose, so it tracks the plugin's real
   * lifetime in the composition — up AND down.
   *
   * It deliberately is not an HTTP route: a route registered by a plugin
   * outlives that plugin's disposal, so a probe built on one reports a
   * disabled plugin as still alive (measured — it is how the first version
   * of this spec lied).
   */
  const reallyLive = (name: string): boolean => existsSync(join(scaffold.home, `e2e-${name}.alive`))

  /** Wait out post-install work (validation, patch write, hot mount). */
  const settle = async (): Promise<void> => {
    for (let attempt = 0; attempt < 90; attempt++) {
      const status = (await (await fetch(`${base}/dsh-market/status`)).json()) as { busy?: boolean; active?: boolean }
      if (status.busy !== true && status.active !== true) return
      await new Promise(done => setTimeout(done, 2000))
    }
    throw new Error('install never settled')
  }

  /** Install through the market's own route and report the outcome. */
  const install = async (name: string): Promise<{ status: number; body: string }> => {
    const response = await post('/dsh-market/install', { url: `https://github.com/dshm-e2e/${name}` })
    const body = await response.text()
    await settle()
    return { status: response.status, body }
  }

  it('starts from a clean profile with none of the fixtures live', async () => {
    const current = await state()
    expect(Object.keys(current.installed)).not.toContain(A)
    // Ground truth agrees they are absent, so no later pass can be a leftover.
    expect(reallyLive(A)).toBe(false)
    expect(reallyLive(B)).toBe(false)
  })

  it('installs through the route and cordis really mounts it', async () => {
    const { status, body } = await install(A)
    // Report the body, not just the code: a bare "expected 502 to be 200"
    // says nothing about which link of the chain broke.
    expect(`${String(status)} ${body.slice(0, 1200)}`).toMatch(/^200 /)
    expect((JSON.parse(body) as { ok?: boolean }).ok).toBe(true)

    // THE assertion: live in the running composition, mounted hot without a
    // restart. Nothing about this can pass on inference alone.
    expect(reallyLive(A)).toBe(true)
  }, 600_000)

  it('the market\'s own verdict matches that reality (#135)', async () => {
    const current = await state()
    expect(Object.keys(current.installed)).toContain(A)
    expect(current.bundles).toContain(A)
    // #103/#135/#147 were all cases where this inference drifted from what
    // cordis actually did. Pin the two together.
    expect(current.activation[A]?.state).toBe('live')
  })

  it('refuses an install that would duplicate a loader entry id (#122)', async () => {
    // Two entries under one id make cordis refuse the NEXT boot — the market
    // has to catch it now, while the profile is still startable.
    const { status } = await install(CLASH)
    expect(status).not.toBe(200)

    const current = await state()
    expect(Object.keys(current.installed)).not.toContain(CLASH)
    // The rejection must not have taken the incumbent down with it.
    expect(reallyLive(A)).toBe(true)
  }, 600_000)

  it('refuses a source that is not in the curated registry', async () => {
    const response = await post('/dsh-market/install', { url: 'https://github.com/attacker/not-listed' })
    expect(response.status).toBe(400)
  })

  it('installs a second plugin without disturbing the first', async () => {
    const { status } = await install(B)
    expect(status).toBe(200)
    expect(reallyLive(B)).toBe(true)
    expect(reallyLive(A)).toBe(true)
  }, 600_000)

  it('a patch with config rows activates on restart, as the market says', async () => {
    const { status } = await install(CROSS)
    expect(status).toBe(200)
    // The market declines to hot-mount this shape and says so. Take it at
    // its word — then check the word was true.
    expect((await state()).activation[CROSS]?.state).toBe('restart')
    expect(reallyLive(CROSS)).toBe(false)

    await scaffold.restart()
    // Booting is itself the assertion: a profile the install logic corrupted
    // would not come up, and the bundle layer now has to load this entry.
    expect(reallyLive(CROSS)).toBe(true)
    expect(reallyLive(A)).toBe(true)
    expect(reallyLive(B)).toBe(true)

    // ...and the market has to AGREE once the restart it asked for happened
    // (#156). Saying "restart to activate" about a plugin that is already
    // running sends users hunting for a failure that is not there.
    expect((await state()).activation[CROSS]?.state).toBe('live')
  }, 600_000)

  it('a carrier bundle reads as live once its restart happened (#156)', async () => {
    // It ships no plugin of its own: its patch inserts an entry named after
    // ANOTHER package, with config — the shape of @tt-a1i/archify-dsh, which
    // mounts @deepseek-ai/dsh-skill-filesystem. Nothing in the live loader
    // inventory is ever called by the carrier's own name.
    const { status } = await install(CARRIER)
    expect(status).toBe(200)
    expect((await state()).activation[CARRIER]?.state).toBe('restart')

    await scaffold.restart()
    // The profile came up, so the carrier's row IS in the running tree.
    // Still reporting "restart to activate" sends users hunting for a
    // failure that already resolved — the whole of #156.
    expect((await state()).activation[CARRIER]?.state).toBe('live')
    expect(reallyLive(B)).toBe(true)
  }, 600_000)

  it('disabling a plugin touches only the rows it owns (#147)', async () => {
    // CROSS's patch REFERENCES B's entry id to tweak its config. Disabling
    // CROSS must not take B with it — the regression that shipped as 1.11.0
    // treated every id in a package's patch as its own.
    const response = await post('/dsh-market/toggle', { name: CROSS, enabled: false })
    expect(response.status).toBe(200)
    await settle()
    await scaffold.restart()

    // BOTH halves matter. Without the first, a run where disabling silently
    // did nothing would pass; without the second, #147 goes unnoticed.
    expect(reallyLive(CROSS)).toBe(false)
    expect(reallyLive(B)).toBe(true)
    expect(reallyLive(A)).toBe(true)

    expect((await state()).patchDisabled).toContain(CROSS)
  }, 600_000)

  it('re-enabling brings it back without disturbing the neighbours', async () => {
    const response = await post('/dsh-market/toggle', { name: CROSS, enabled: true })
    expect(response.status).toBe(200)
    await settle()
    await scaffold.restart()
    expect(reallyLive(CROSS)).toBe(true)
    expect(reallyLive(B)).toBe(true)
  }, 600_000)

  it('uninstalls cleanly — dependency and bundle registration both gone', async () => {
    const response = await post('/dsh-market/uninstall', { name: A })
    expect(response.status).toBe(200)
    await settle()
    const current = await state()
    expect(Object.keys(current.installed)).not.toContain(A)
    expect(current.bundles).not.toContain(A)
    // The other fixture is untouched by its neighbour's removal.
    expect(reallyLive(B)).toBe(true)
  }, 600_000)
})
