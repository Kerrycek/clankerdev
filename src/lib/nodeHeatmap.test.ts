import { describe, expect, it } from 'vitest';
import { nodeHeatmapUrl } from './nodeHeatmap';

const node = { fqdn: 'node1.prg.example', type: 'node', maintenance_lock: 'no' };
describe('legacy node heatmap links', () => {
  it('keeps configured subpaths and the actual FQDN', () => {
    expect(nodeHeatmapUrl('https://charts.example/heat///?old=1#old', node))
      .toBe('https://charts.example/heat/node1.prg.example/');
    expect(nodeHeatmapUrl('https://charts.example', { ...node, type: 'storage' }))
      .toBe('https://charts.example/node1.prg.example/');
  });
  it.each(['lock', 'master_lock', undefined])('does not offer nodes with lock %s', (maintenance_lock) => {
    expect(nodeHeatmapUrl('https://charts.example', { ...node, maintenance_lock })).toBeNull();
  });
  it.each(['mailer', 'dns_server', undefined])('does not offer node type %s', (type) => {
    expect(nodeHeatmapUrl('https://charts.example', { ...node, type })).toBeNull();
  });
  it.each(['', undefined, 'javascript:alert(1)', 'http://charts.example', 'https://user:secret@charts.example', '/charts'])('rejects unsafe or missing base %s', (base) => {
    expect(nodeHeatmapUrl(base, node)).toBeNull();
  });
  it.each(['../other', 'x/y', 'x?y', 'x#y', 'x..y', '', undefined])('rejects unsafe or missing FQDN %s', (fqdn) => {
    expect(nodeHeatmapUrl('https://charts.example', { ...node, fqdn })).toBeNull();
  });
});
