#!/usr/bin/env node
import assert from 'node:assert/strict'
import { trustedRestartRequest } from '../lib/routes.js'

function request(remoteAddress, origin = 'http://127.0.0.1:3080', host = '127.0.0.1:3080') {
  return { socket: { remoteAddress }, headers: { origin, host } }
}

assert.equal(trustedRestartRequest(request('127.0.0.1')), true)
assert.equal(trustedRestartRequest(request('::1', 'http://localhost:3080', 'localhost:3080')), true)
assert.equal(trustedRestartRequest(request('::ffff:127.0.0.1')), true)
assert.equal(trustedRestartRequest(request('192.168.1.2')), false)
assert.equal(trustedRestartRequest(request('127.0.0.1', 'http://evil.example', '127.0.0.1:3080')), false)
assert.equal(trustedRestartRequest(request('127.0.0.1', 'file://127.0.0.1:3080', '127.0.0.1:3080')), false)
assert.equal(trustedRestartRequest({
  ...request('127.0.0.1'),
  headers: { ...request('127.0.0.1').headers, 'x-forwarded-for': '127.0.0.1' },
}), false)

console.log('restart smoke ok: same-origin loopback only')
