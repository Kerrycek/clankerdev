#!/usr/bin/env bash
set -euo pipefail

release_root="${VPSADMIN_RELEASE_ROOT:-/srv/vpsadmin-release/current}"
api_dir="${release_root}/api"
nix_bin="${NIX_BIN:-/nix/var/nix/profiles/default/bin/nix}"
queue_wait_seconds="${QUEUE_WAIT_SECONDS:-20}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd systemctl
[ -x "$nix_bin" ] || { echo "Missing Nix executable: $nix_bin" >&2; exit 1; }
[ -d "$api_dir" ] || { echo "Missing active API release: $api_dir" >&2; exit 1; }

for service in \
  vpsadmin-api.service \
  vpsadmin-supervisor.service \
  vpsadmin-mailer-nodectld.service \
  vpsadmin-notification-templates.service \
  vpsadmin-password-recovery.service
do
  if ! systemctl is-active --quiet "$service"; then
    echo "Required service is not active: $service" >&2
    exit 1
  fi
done

worker_pid="$(systemctl show vpsadmin-password-recovery.service --property MainPID --value)"
case "$worker_pid" in
  ''|0|*[!0-9]*)
    echo "Password-recovery worker has no valid MainPID" >&2
    exit 1
    ;;
esac

expected_cwd="$(readlink -f "$api_dir")"
actual_cwd="$(readlink -f "/proc/${worker_pid}/cwd")"
if [ "$actual_cwd" != "$expected_cwd" ]; then
  echo "Password-recovery worker uses the wrong release: $actual_cwd" >&2
  echo "Expected: $expected_cwd" >&2
  exit 1
fi

export RACK_ENV=production
cd "$api_dir"
"$nix_bin" \
  --extra-experimental-features nix-command \
  --extra-experimental-features flakes \
  develop "${release_root}#api" \
  -c bundle exec ruby -- "$queue_wait_seconds" <<'RUBY'
require File.expand_path('lib/vpsadmin', Dir.pwd)

required_templates = %w[password_recovery user_password_changed]
templates = MailTemplate.where(name: required_templates).index_by(&:name)
missing_templates = required_templates - templates.keys
abort "Missing notification templates: #{missing_templates.join(', ')}" unless missing_templates.empty?

required_languages = %w[cs en]
templates.each_value do |template|
  installed_languages = template.mail_template_translations
                                .joins(:language)
                                .pluck('languages.code')
  missing_languages = required_languages - installed_languages
  unless missing_languages.empty?
    abort "Notification template #{template.name} is missing languages: #{missing_languages.join(', ')}"
  end
end

enabled = SysConfig.get(:core, :password_recovery_enabled)
abort 'Password recovery is disabled in sys_config' unless enabled

active_mailers = Node.where(role: Node.roles.fetch(:mailer), active: true).count
abort 'No active mailer node is configured' if active_mailers.zero?

wait_seconds = Integer(ARGV.fetch(0), 10)
deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + wait_seconds
loop do
  pending = PasswordRecoverySubmission.pending.count
  processing = PasswordRecoverySubmission.pending.where.not(processing_started_at: nil).count
  exhausted = PasswordRecoverySubmission.pending.where('attempts >= ?', PasswordRecoverySubmission::MAX_ATTEMPTS).count

  if pending.zero?
    puts "Password recovery runtime healthy: templates=2 languages=cs,en mailers=#{active_mailers} pending=0 processing=0 exhausted=0"
    break
  end

  if Process.clock_gettime(Process::CLOCK_MONOTONIC) >= deadline
    abort "Password recovery queue did not drain: pending=#{pending} processing=#{processing} exhausted=#{exhausted}"
  end

  sleep 1
end
RUBY
