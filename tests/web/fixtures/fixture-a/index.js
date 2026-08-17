/**
 * Layer-3 fixture plugin: a plugin that PROVES ITS OWN LIVENESS.
 *
 * The market's `activation[name].state` is an INFERENCE drawn from the
 * profile's bundle list and patch layers — the exact reasoning that was
 * wrong in #103, #135 and #147. A spec that asserts on it therefore checks
 * the market against itself. This route is ground truth instead: it can
 * only answer if cordis really resolved the package, loaded this module,
 * and ran `apply()` inside the running composition.
 */
export const name = 'dshm-e2e-fixture-a'

export function apply(ctx) {
  ctx.inject(['webServer'], (host) => {
    host.webServer.register({
      kind: 'exact',
      path: '/dshm-e2e-fixture-a/ping',
      handler: (request, response) => {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ alive: true, name }))
      },
    })
  })
}
