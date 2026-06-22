import type { Location } from '../../../lib/api/infra';
import type { Vps } from '../../../lib/api/vps';
import {
  buildVpsClonePayload,
  cloneCopiedOptionKeys,
  cloneTargetDescription,
  defaultCloneForm,
  isCloneTargetReady,
  type CloneForm,
} from './VpsCloneModel';

const sourceVps: Pick<Vps, 'id' | 'hostname'> = {
  id: 123,
  hostname: 'prod.example',
};

function form(overrides: Partial<CloneForm> = {}): CloneForm {
  return {
    ...defaultCloneForm(sourceVps, { ownerId: 45, nodeId: 12, locationId: 7 }),
    ...overrides,
  };
}

describe('VPS clone model', () => {
  it('builds the admin clone payload without changing legacy field names', () => {
    expect(
      buildVpsClonePayload(
        form({
          user: '#45',
          node: '12',
          hostname: '  stage.example  ',
          datasetPlans: false,
          resources: false,
          stop: true,
        }),
        { isAdminMode: true }
      )
    ).toEqual({
      user: 45,
      node: 12,
      hostname: 'stage.example',
      subdatasets: true,
      dataset_plans: false,
      resources: false,
      features: true,
      stop: true,
    });
  });

  it('builds the regular-user clone payload with location and derived environment', () => {
    const location: Location = {
      id: 7,
      label: 'Praha',
      environment: { id: 9, label: 'production' },
    };

    expect(
      buildVpsClonePayload(
        form({
          location: '#7',
          hostname: '',
          subdatasets: false,
          features: false,
          stop: false,
        }),
        { isAdminMode: false, location }
      )
    ).toEqual({
      location: 7,
      environment: 9,
      hostname: undefined,
      subdatasets: false,
      dataset_plans: true,
      resources: true,
      features: false,
      stop: false,
    });
  });

  it('tracks clone target readiness separately for admin and regular users', () => {
    expect(isCloneTargetReady(form({ user: '45', node: '' }), true)).toBe(false);
    expect(isCloneTargetReady(form({ user: '45', node: '12' }), true)).toBe(true);
    expect(isCloneTargetReady(form({ location: '' }), false)).toBe(false);
    expect(isCloneTargetReady(form({ location: '7' }), false)).toBe(true);
  });

  it('describes clone targets and copied parts for the review panel', () => {
    const location: Location = {
      id: 7,
      description: 'Brno',
      environment: { id: 22, label: 'playground' },
    };

    expect(cloneTargetDescription(form({ user: '45', node: '12' }), { isAdminMode: true })).toEqual({
      owner: '45',
      node: '12',
    });
    expect(cloneTargetDescription(form({ location: '7' }), { isAdminMode: false, location })).toEqual({
      location: 'Brno',
      environment: '#22',
    });
    expect(cloneCopiedOptionKeys(form({ subdatasets: false, features: false }))).toEqual([
      'vps.lifecycle.clone.option.dataset_plans',
      'vps.lifecycle.clone.option.resources',
    ]);
  });

  it('rejects missing or invalid required clone IDs', () => {
    expect(() => buildVpsClonePayload(form({ user: '', node: '12' }), { isAdminMode: true })).toThrow('required-id');
    expect(() => buildVpsClonePayload(form({ user: '45', node: 'node-12' }), { isAdminMode: true })).toThrow('invalid-id');
    expect(() => buildVpsClonePayload(form({ location: '0' }), { isAdminMode: false })).toThrow('invalid-id');
  });
});
