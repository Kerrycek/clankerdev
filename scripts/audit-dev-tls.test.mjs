import assert from 'node:assert/strict'
import test from 'node:test'

import { evaluateTlsPeer, parseAuditArgs } from './audit-dev-tls.mjs'

const validFrom = 'Sep 1 00:00:00 2026 GMT'
const validTo = 'Oct 1 00:00:00 2026 GMT'
const now = new Date('2026-09-19T00:00:00Z')

test('TLS audit arguments default to the exact dev origin host', () => {
  assert.deepEqual(parseAuditArgs([]), {
    host: 'dev.crucio.cz',
    port: 443,
    timeoutMs: 15_000,
    json: false,
  })
  assert.deepEqual(parseAuditArgs(['--host', 'example.test', '--port', '8443', '--timeout-ms', '500', '--json']), {
    host: 'example.test',
    port: 8443,
    timeoutMs: 500,
    json: true,
  })
  assert.throws(() => parseAuditArgs(['--port', '0']), /between 1 and 65535/)
  assert.throws(() => parseAuditArgs(['--timeout-ms', '99']), /between 100 and 120000/)
  assert.throws(() => parseAuditArgs(['--unknown']), /Unknown argument/)
})

test('TLS audit passes only a trusted, matching and currently valid peer', () => {
  const report = evaluateTlsPeer({
    host: 'dev.crucio.cz',
    authorized: true,
    matchingName: 'dev.crucio.cz',
    validFrom,
    validTo,
    now,
  })

  assert.equal(report.ok, true)
  assert.deepEqual(report.reasons, [])
  assert.equal(report.hostname.matches, true)
  assert.equal(report.trust.authorized, true)
  assert.equal(report.validity.currentlyValid, true)
})

test('TLS audit blocks the current dev-style hostname mismatch even when dates are valid', () => {
  const report = evaluateTlsPeer({
    host: 'dev.crucio.cz',
    authorized: false,
    authorizationError: 'ERR_TLS_CERT_ALTNAME_INVALID',
    matchingName: null,
    validFrom,
    validTo,
    now,
  })

  assert.equal(report.ok, false)
  assert.equal(report.hostname.matches, false)
  assert.deepEqual(report.reasons, [
    'certificate SAN/CN does not cover dev.crucio.cz',
    'TLS verifier rejected the certificate: ERR_TLS_CERT_ALTNAME_INVALID',
  ])
})

test('TLS audit independently blocks an untrusted chain and an expired certificate', () => {
  const report = evaluateTlsPeer({
    host: 'dev.crucio.cz',
    authorized: false,
    authorizationError: 'DEPTH_ZERO_SELF_SIGNED_CERT',
    matchingName: 'dev.crucio.cz',
    validFrom: 'Aug 1 00:00:00 2025 GMT',
    validTo: 'Aug 1 00:00:00 2026 GMT',
    now,
  })

  assert.equal(report.ok, false)
  assert.equal(report.hostname.matches, true)
  assert.equal(report.validity.currentlyValid, false)
  assert.deepEqual(report.reasons, [
    'TLS verifier rejected the certificate: DEPTH_ZERO_SELF_SIGNED_CERT',
    'certificate is outside its validity window',
  ])
})

test('TLS audit rejects malformed certificate validity timestamps', () => {
  const report = evaluateTlsPeer({
    host: 'dev.crucio.cz',
    authorized: true,
    matchingName: 'dev.crucio.cz',
    validFrom: 'not-a-date',
    validTo,
    now,
  })

  assert.equal(report.ok, false)
  assert.equal(report.validity.currentlyValid, false)
  assert.deepEqual(report.reasons, ['certificate validity timestamps are invalid'])
})
