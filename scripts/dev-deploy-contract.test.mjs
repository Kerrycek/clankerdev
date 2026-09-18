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

test('dev deploy installs the tracked BFF unit before restarting it', () => {
  const installIndex = deployScript.indexOf('install -m 0644 "$bff_unit_src" "$bff_unit_dst"');
  const reloadIndex = deployScript.indexOf('systemctl daemon-reload', installIndex);
  const restartIndex = deployScript.indexOf('systemctl restart webui-next-bff.service', reloadIndex);

  assert.notEqual(installIndex, -1, 'tracked BFF unit must be installed');
  assert(installIndex < reloadIndex, 'unit must be installed before daemon-reload');
  assert(reloadIndex < restartIndex, 'daemon-reload must happen before restart');
});

test('dev deploy refuses a source checkout that the tracked BFF unit would not use', () => {
  assert.match(deployScript, /expected_src="\/srv\/clankerdev-deploy\/repo"/);
  assert.match(deployScript, /canonical_src=.*readlink -f/);
  assert.match(deployScript, /Refusing BFF\/frontend source mismatch/);
});

test('dev deploy fails when the active BFF working directory differs from the build checkout', () => {
  assert.match(
    deployScript,
    /systemctl show webui-next-bff\.service --property=WorkingDirectory --value/,
  );
  assert.match(deployScript, /active_bff_workdir.*expected_bff_workdir/s);
  assert.match(deployScript, /BFF source mismatch/);
  assert.match(deployScript, /active_bff_process_cwd.*expected_bff_workdir/s);
  assert.match(deployScript, /BFF process source mismatch/);
  assert.match(deployScript, /active_bff_exec.*canonical_src\/bff\/server\.js/s);
});

test('dev deploy validates and can roll back the BFF unit', () => {
  assert.match(deployScript, /systemd-analyze verify "\$bff_unit_src"/);
  assert.match(deployScript, /rollback_bff_unit\(\)/);
  assert.match(deployScript, /restoring the previous systemd unit/);
  assert.match(deployScript, /trap rollback_bff_unit ERR/);
});

test('tracked BFF unit runs code from the canonical dev deploy checkout', () => {
  assert.match(serviceUnit, /^WorkingDirectory=\/srv\/clankerdev-deploy\/repo\/bff$/m);
  assert.match(serviceUnit, /^ExecStart=\/usr\/bin\/node \/srv\/clankerdev-deploy\/repo\/bff\/server\.js$/m);
  assert.doesNotMatch(serviceUnit, /clankerdev-release/);
});
