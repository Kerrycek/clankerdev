import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const deployDir = path.join(root, 'deploy/dev.crucio.cz')
const installerPath = path.join(deployDir, 'install-password-recovery-runtime.sh')
const checkerPath = path.join(deployDir, 'check-password-recovery-runtime.sh')
const templateUnitPath = path.join(deployDir, 'vpsadmin-notification-templates.service')
const workerUnitPath = path.join(deployDir, 'vpsadmin-password-recovery.service')

const installer = readFileSync(installerPath, 'utf8')
const checker = readFileSync(checkerPath, 'utf8')
const templateUnit = readFileSync(templateUnitPath, 'utf8')
const workerUnit = readFileSync(workerUnitPath, 'utf8')

test('installer defaults to a non-mutating dry run', () => {
  const output = execFileSync('bash', [installerPath], { encoding: 'utf8' })

  assert.match(output, /No files, services or database rows were changed/)
  assert.match(output, /--apply --confirm-mail-delivery/)
  assert.doesNotMatch(output, /Password-recovery runtime installed and verified/)
})

test('installer gates queue consumption and orders templates before the worker', () => {
  assert.match(installer, /Apply mode requires --confirm-mail-delivery/)
  assert.match(installer, /systemctl restart "\$template_unit"[\s\S]*systemctl restart "\$worker_unit"/)
  assert.match(installer, /vpsadmin-mailer-nodectld\.service/)
  assert.match(installer, /flock -n 9/)
  assert.match(installer, /trap rollback ERR/)
  assert.match(installer, /mktemp -d \/tmp\/vpsadmin-password-recovery-install\.XXXXXX/)
})

test('notification templates are installed idempotently from the active release', () => {
  assert.match(templateUnit, /WorkingDirectory=\/srv\/vpsadmin-release\/current\/api/)
  assert.match(templateUnit, /vpsadmin:notification_templates:install_defaults/)
  assert.match(templateUnit, /RemainAfterExit=yes/)
  assert.doesNotMatch(templateUnit, /(?:DATABASE_URL|PASSWORD|SECRET|TOKEN)=/i)
})

test('worker cannot start before the API and template installer', () => {
  assert.match(workerUnit, /Requires=vpsadmin-api\.service vpsadmin-notification-templates\.service/)
  assert.match(workerUnit, /After=vpsadmin-api\.service vpsadmin-notification-templates\.service/)
  assert.match(workerUnit, /bundle exec bin\/vpsadmin-password-recovery/)
  assert.match(workerUnit, /Restart=on-failure/)
})

test('health check verifies release identity, prerequisites and aggregate queue state', () => {
  assert.match(checker, /\/proc\/\$\{worker_pid\}\/cwd/)
  assert.match(checker, /password_recovery user_password_changed/)
  assert.match(checker, /required_languages = %w\[cs en\]/)
  assert.match(checker, /PasswordRecoverySubmission\.pending\.count/)
  assert.match(checker, /No active mailer node is configured/)
  assert.doesNotMatch(checker, /\.identifier\b|recipient_email|email_token|reset_url/)
})
