/**
 * Layer 3 — the REAL install chain: install route → registry check → pnpm
 * resolution → post-install validation → patch layer → cordis hot mount.
 *
 * Every layer-1 spec drives this chain against a hand-written FakeDsh, so it
 * can only prove the code agrees with our MODEL of pnpm and cordis. The bugs
 * that actually shipped (#103, #122, #135, #147) were all places where that
 * model was wrong, which is why none of them could be caught there. Here
 * pnpm, cordis and the patch layer are the real ones; only the fixture being
 * installed is ours, and it is served from a local npm registry so nothing
 * has to be published and nothing touches the network.
 *
 * No browser: the market's UI journey is covered by market.e2e.ts. What is
 * unprotected — and what this spec exists for — is the host-side chain.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { dshAvailable, launchMarketScaffold } from './scaffold.ts'
import type { WebScaffold } from './scaffold.ts'

const HAS_DSH = dshAvailable()
const FIXTURE = 'dshm-e2e-fixture-a'

describe.skipIf(!HAS_DSH).sequential('web e2e: the real install chain', () => {
  let scaffold: WebScaffold
  let base: string

  beforeAll(async () => {
    scaffold = await launchMarketScaffold({ fixtures: ['fixture-a'] })
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

  const installed = async (): Promise<{
    installed: Record<string, string>
    activation: Record<string, { state: string }>
    bundles: string[]
  }> => (await fetch(`${base}/dsh-market/installed`)).json() as never

  /**
   * Ground truth. The fixture serves this route from inside `apply()`, so it
   * answers only if cordis really resolved the package, loaded the module
   * and ran it — unlike the market's own verdict, which is an inference.
   */
  const fixtureIsReallyLive = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${base}/${FIXTURE}/ping`, { signal: AbortSignal.timeout(5000) })
      if (!response.ok) return false
      return ((await response.json()) as { alive?: boolean }).alive === true
    } catch {
      return false
    }
  }

  /** Wait out the post-install work (validation, patch write, hot mount). */
  const settle = async (): Promise<void> => {
    for (let attempt = 0; attempt < 90; attempt++) {
      const status = (await (await fetch(`${base}/dsh-market/status`)).json()) as { busy?: boolean; active?: boolean }
      if (status.busy !== true && status.active !== true) return
      await new Promise(done => setTimeout(done, 2000))
    }
    throw new Error('install never settled')
  }

  it('the fixture catalog is what the market offers', async () => {
    const state = await installed()
    expect(Object.keys(state.installed)).not.toContain(FIXTURE)
    // Ground truth agrees it is absent — so a later pass cannot be a leftover.
    expect(await fixtureIsReallyLive()).toBe(false)
  })

  it('installs through the route and cordis really mounts it', async () => {
    const response = await post('/dsh-market/install', { url: `https://github.com/dshm-e2e/${FIXTURE}` })
    // Report the body, not just the code: a bare "expected 502 to be 200"
    // says nothing about which link of the chain broke.
    const body = await response.text()
    expect(`${String(response.status)} ${body.slice(0, 1200)}`).toMatch(/^200 /)
    expect((JSON.parse(body) as { ok?: boolean }).ok).toBe(true)
    await settle()

    // THE assertion: the plugin is live in the running composition, mounted
    // hot without a restart. Nothing about this can pass on inference alone.
    expect(await fixtureIsReallyLive()).toBe(true)
  }, 600_000)

  it('the market\'s own verdict matches that reality (#135)', async () => {
    const state = await installed()
    expect(Object.keys(state.installed)).toContain(FIXTURE)
    expect(state.bundles).toContain(FIXTURE)
    // The market infers activation from the profile's bundle list and patch
    // layers. #103/#135/#147 were all cases where that inference drifted
    // from what cordis actually did; pin them together.
    expect(state.activation[FIXTURE]?.state).toBe('live')
  })

  it('refuses a source that is not in the curated registry', async () => {
    const response = await post('/dsh-market/install', { url: 'https://github.com/attacker/not-listed' })
    expect(response.status).toBe(400)
  })

  it('uninstalls cleanly — dependency and bundle registration both gone', async () => {
    const response = await post('/dsh-market/uninstall', { name: FIXTURE })
    expect(response.status).toBe(200)
    await settle()
    const state = await installed()
    expect(Object.keys(state.installed)).not.toContain(FIXTURE)
    expect(state.bundles).not.toContain(FIXTURE)
  }, 600_000)
})
