import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repositoryRoot = new URL('../', import.meta.url)

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function occurrences(source, pattern) {
  return [...source.matchAll(pattern)].length
}

function assertMappedOAuthPolicy(source, variableName, expectedCount = 1) {
  const escapedVariable = escapeRegExp(variableName)
  const mapPattern = new RegExp(
    `map\\s+\\$uri\\s+\\$${escapedVariable}\\s*\\{\\s*default\\s+strict-origin-when-cross-origin;\\s*~\\^/oauth/\\s+no-referrer;\\s*\\}`,
    'g',
  )
  const headerPattern = new RegExp(
    `add_header\\s+Referrer-Policy\\s+\\$${escapedVariable}\\s+always;`,
    'g',
  )

  assert.equal(occurrences(source, mapPattern), expectedCount)
  assert.equal(occurrences(source, headerPattern), expectedCount)

  const oauthLocations = [
    ...source.matchAll(/location\s+\^~\s+\/oauth\/\s*\{([\s\S]*?)\n\s*\}/g),
  ]
  assert.equal(oauthLocations.length, expectedCount)
  for (const [, block] of oauthLocations) {
    assert.match(block, /proxy_hide_header\s+Referrer-Policy;/)
    assert.doesNotMatch(block, /add_header\s+Referrer-Policy/)
  }
}

test('dev and kra nginx configs select no-referrer only for OAuth routes', async () => {
  const [dev, kra] = await Promise.all([
    readFile(new URL('deploy/dev.crucio.cz/nginx-dev.crucio.cz.conf', repositoryRoot), 'utf8'),
    readFile(new URL('deploy/kra.crucio.cz/nginx-kra.crucio.cz.conf', repositoryRoot), 'utf8'),
  ])

  assertMappedOAuthPolicy(dev, 'dev_crucio_referrer_policy')
  assertMappedOAuthPolicy(kra, 'kra_crucio_referrer_policy')
  assert.doesNotMatch(dev, /\$kra_crucio_referrer_policy/)
  assert.doesNotMatch(kra, /\$dev_crucio_referrer_policy/)
})

test('generated HTTP and HTTPS nginx configs retain the scoped OAuth policy', async () => {
  const template = await readFile(
    new URL('deploy/deploy-clankerdev-ubuntu24.sh', repositoryRoot),
    'utf8',
  )
  const normalizedTemplate = template.replaceAll('\\$', '$')

  assertMappedOAuthPolicy(normalizedTemplate, 'clankerdev_referrer_policy', 2)
})
