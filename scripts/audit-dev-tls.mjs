#!/usr/bin/env node
import { isIP } from 'node:net'
import path from 'node:path'
import process from 'node:process'
import tls from 'node:tls'
import { X509Certificate } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const DEFAULT_HOST = 'dev.crucio.cz'
const DEFAULT_PORT = 443
const DEFAULT_TIMEOUT_MS = 15_000

function usage() {
  return `Usage: node scripts/audit-dev-tls.mjs [options]

Perform a read-only TLS handshake and require a trusted, currently valid
certificate whose SAN/CN covers the requested host. No HTTP request, cookie or
authorization header is sent.

Options:
  --host <hostname>          TLS host and SNI name (default: ${DEFAULT_HOST})
  --port <port>              TLS port (default: ${DEFAULT_PORT})
  --timeout-ms <milliseconds> handshake timeout (default: ${DEFAULT_TIMEOUT_MS})
  --json                     emit the machine-readable report
  --help                     show this help
`
}

export function parseAuditArgs(argv) {
  const options = {
    host: DEFAULT_HOST,
    port: DEFAULT_PORT,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    json: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help') return { help: true }
    if (argument === '--json') options.json = true
    else if (argument === '--host') options.host = argv[++index]
    else if (argument === '--port') options.port = Number(argv[++index])
    else if (argument === '--timeout-ms') options.timeoutMs = Number(argv[++index])
    else throw new Error(`Unknown argument: ${argument}`)
  }

  if (typeof options.host !== 'string' || options.host.length === 0 || options.host.length > 253) {
    throw new Error('--host must be a non-empty DNS name or IP address')
  }
  if (!Number.isSafeInteger(options.port) || options.port < 1 || options.port > 65_535) {
    throw new Error('--port must be an integer between 1 and 65535')
  }
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 100 || options.timeoutMs > 120_000) {
    throw new Error('--timeout-ms must be an integer between 100 and 120000')
  }

  return options
}

export function evaluateTlsPeer({
  host,
  authorized,
  authorizationError = null,
  matchingName = null,
  validFrom,
  validTo,
  now = new Date(),
}) {
  const validFromMs = Date.parse(validFrom)
  const validToMs = Date.parse(validTo)
  const nowMs = now instanceof Date ? now.getTime() : Number.NaN
  const validityReadable = [validFromMs, validToMs, nowMs].every(Number.isFinite)
  const currentlyValid = validityReadable && nowMs >= validFromMs && nowMs <= validToMs
  const hostnameMatches = typeof matchingName === 'string' && matchingName.length > 0
  const reasons = []

  if (!hostnameMatches) reasons.push(`certificate SAN/CN does not cover ${host}`)
  if (authorized !== true) {
    reasons.push(`TLS verifier rejected the certificate: ${authorizationError || 'unknown verification error'}`)
  }
  if (!validityReadable) reasons.push('certificate validity timestamps are invalid')
  else if (!currentlyValid) reasons.push('certificate is outside its validity window')

  return {
    ok: reasons.length === 0,
    hostname: {
      expected: host,
      matches: hostnameMatches,
      matchingName,
    },
    trust: {
      authorized: authorized === true,
      authorizationError,
    },
    validity: {
      validFrom: validityReadable ? new Date(validFromMs).toISOString() : validFrom,
      validTo: validityReadable ? new Date(validToMs).toISOString() : validTo,
      currentlyValid,
    },
    reasons,
  }
}

function certificateMatch(x509, host) {
  return isIP(host) ? x509.checkIP(host) : x509.checkHost(host)
}

export function auditTlsCertificate({
  host = DEFAULT_HOST,
  port = DEFAULT_PORT,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  now = new Date(),
} = {}) {
  return new Promise((resolve, reject) => {
    let socket
    let settled = false

    const finish = (error, report) => {
      if (settled) return
      settled = true
      socket?.destroy()
      if (error) reject(error)
      else resolve(report)
    }

    try {
      socket = tls.connect({
        host,
        port,
        servername: isIP(host) ? undefined : host,
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
      })
    } catch (error) {
      finish(error)
      return
    }

    socket.setTimeout(timeoutMs, () => finish(new Error('TLS handshake timed out')))
    socket.once('error', (error) => finish(error))
    socket.once('secureConnect', () => {
      try {
        const peer = socket.getPeerCertificate(false)
        if (!peer || !Buffer.isBuffer(peer.raw) || peer.raw.length === 0) {
          throw new Error('TLS peer did not expose a leaf certificate')
        }

        const x509 = new X509Certificate(peer.raw)
        const evaluation = evaluateTlsPeer({
          host,
          authorized: socket.authorized,
          authorizationError: socket.authorizationError || null,
          matchingName: certificateMatch(x509, host) || null,
          validFrom: x509.validFrom,
          validTo: x509.validTo,
          now,
        })

        finish(null, {
          ...evaluation,
          target: { host, port },
          certificate: {
            subject: x509.subject,
            issuer: x509.issuer,
            subjectAltName: x509.subjectAltName || null,
            serialNumber: x509.serialNumber,
            fingerprint256: x509.fingerprint256,
            selfSigned: x509.checkIssued(x509) && x509.verify(x509.publicKey),
          },
        })
      } catch (error) {
        finish(error)
      }
    })
  })
}

function printSummary(report) {
  console.log(report.ok ? 'TLS certificate audit: PASS' : 'TLS certificate audit: FAIL')
  console.log(`Target: ${report.target.host}:${report.target.port}`)
  console.log(`Subject: ${report.certificate.subject}`)
  console.log(`Issuer: ${report.certificate.issuer}`)
  console.log(`SAN: ${report.certificate.subjectAltName || '(none)'}`)
  console.log(`SHA-256 fingerprint: ${report.certificate.fingerprint256}`)
  console.log(`Valid: ${report.validity.validFrom} to ${report.validity.validTo}`)
  console.log(`Hostname match: ${report.hostname.matches ? 'yes' : 'no'}`)
  console.log(`TLS authorized: ${report.trust.authorized ? 'yes' : 'no'}`)
  if (report.trust.authorizationError) console.log(`TLS authorization error: ${report.trust.authorizationError}`)

  if (report.reasons.length > 0) {
    console.log('\nBlocking certificate findings:')
    for (const reason of report.reasons) console.log(`- ${reason}`)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const options = parseAuditArgs(process.argv.slice(2))
    if (options.help) {
      process.stdout.write(usage())
      process.exit(0)
    }

    const report = await auditTlsCertificate(options)
    if (options.json) console.log(JSON.stringify(report, null, 2))
    else printSummary(report)
    process.exitCode = report.ok ? 0 : 1
  } catch (error) {
    console.error(`TLS certificate audit failed: ${error?.message ?? String(error)}`)
    process.exitCode = 2
  }
}
