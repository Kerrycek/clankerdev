import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const deployScriptUrl = new URL(
  '../deploy/dev.crucio.cz/deploy-dev-crucio-clankerdev.sh',
  import.meta.url,
);
const serviceUnitUrl = new URL(
  '../deploy/dev.crucio.cz/webui-next-bff.service',
  import.meta.url,
);

const deployScript = fs.readFileSync(deployScriptUrl, 'utf8');
const serviceUnit = fs.readFileSync(serviceUnitUrl, 'utf8');
const deployWrapper = fs.readFileSync(
  new URL('../deploy/dev.crucio.cz/deploy-dev.sh', import.meta.url),
  'utf8',
);

test('dev wrapper executes the helper from the checkout it just updated', () => {
  assert.match(
    deployWrapper,
    /"\$repo\/deploy\/dev\.crucio\.cz\/deploy-dev-crucio-clankerdev\.sh" "\$repo"/,
  );
  assert.doesNotMatch(deployWrapper, /\/usr\/local\/bin\/deploy-dev-crucio-clankerdev/);
});

test('dev deploy builds frontend and BFF dependencies only in an immutable staged checkout', () => {
  assert.match(deployScript, /git clone --quiet --no-hardlinks --no-checkout "\$canonical_src" "\$release_stage"/);
  assert.match(deployScript, /build_frontend "\$release_stage"/);
  assert.match(deployScript, /install_staged_bff_dependencies "\$release_stage"/);
  assert.match(deployScript, /mv "\$release_stage" "\$release_dir"/);
  assert.match(deployScript, /rsync -a --delete "\$release_dir\/dist\/" "\$dst\/"/);
  assert.doesNotMatch(deployScript, /npm --prefix "\$release_dir\/bff" ci/);
});

test('dev deploy uses a guarded atomic current link below the fixed release root', () => {
  assert.match(deployScript, /release_root="\/srv\/clankerdev-release"/);
  assert.match(deployScript, /assert_release_target "\$target" "Release switch target"/);
  assert.match(deployScript, /node "\$release_link_script" switch/);
  assert.match(deployScript, /previous_current_target="\$\(readlink -f "\$release_current"\)"/);
});

test('dev deploy serializes staging and publication with a nonblocking root-owned lock', () => {
  assert.match(deployScript, /deploy_lock_file="\/run\/lock\/clankerdev-dev-deploy\.lock"/);
  assert.match(deployScript, /flock -n 9/);
  assert.match(deployScript, /Dev deploy lock must be root-owned/);
  assert.match(deployScript, /test_lock_dir="\$test_root\/dev-deploy\.lock"/);
  assert.match(deployScript, /exit "\$lock_status"/);
});

test('all post-publish failures enter the explicit idempotent rollback path', () => {
  assert.match(deployScript, /rollback_in_progress=0/);
  assert.match(deployScript, /Rollback re-entry suppressed/);
  assert.match(deployScript, /run_or_abort "BFF restart failed after release switch" restart_bff/);
  assert.match(deployScript, /abort_deploy 73 "injected runtime provenance validation failure"/);
  assert.match(deployScript, /run_or_abort "active frontend\/BFF provenance mismatch" verify_provenance/);
  assert.match(deployScript, /run_or_abort "public authentication smoke verification failed" smoke_auth_endpoints/);
  assert.match(deployScript, /nginx -t \|\| return/);
  assert.doesNotMatch(
    deployScript.slice(deployScript.indexOf("trap 'handle_unexpected_error")),
    /\n\s*exit 1\s*\n/,
  );
});

test('rollback restores release link and files before restarting and validating health', () => {
  const rollbackStart = deployScript.indexOf('rollback_deploy()');
  const rollback = deployScript.slice(rollbackStart, deployScript.indexOf('abort_deploy()', rollbackStart));
  const linkIndex = rollback.indexOf('restore previous release link');
  const unitIndex = rollback.indexOf('restore BFF unit');
  const frontendIndex = rollback.indexOf('restore frontend contents');
  const nginxIndex = rollback.indexOf('restore nginx config');
  const restartIndex = rollback.indexOf('restart previous BFF');
  const healthIndex = rollback.indexOf('validate restored health');
  for (const value of [linkIndex, unitIndex, frontendIndex, nginxIndex, restartIndex, healthIndex]) {
    assert.notEqual(value, -1);
  }
  assert(linkIndex < restartIndex);
  assert(unitIndex < restartIndex);
  assert(frontendIndex < restartIndex);
  assert(nginxIndex < restartIndex);
  assert(restartIndex < healthIndex);
});

test('dev deploy verifies source, frontend, release and live runtime provenance', () => {
  assert.match(deployScript, /--source-repo "\$canonical_src"/);
  assert.match(deployScript, /--build-info "\$build_info"/);
  assert.match(deployScript, /--release-repo "\$release"/);
  assert.match(deployScript, /published frontend provenance mismatch/);
  assert.match(deployScript, /active frontend\/BFF provenance mismatch/);
});

test('tracked BFF unit resolves through the immutable release current link', () => {
  assert.match(serviceUnit, /^WorkingDirectory=\/srv\/clankerdev-release\/current\/bff$/m);
  assert.match(serviceUnit, /^ExecStart=\/usr\/bin\/node \/srv\/clankerdev-release\/current\/bff\/server\.js$/m);
  assert.doesNotMatch(serviceUnit, /clankerdev-deploy\/repo\/bff/);
});
