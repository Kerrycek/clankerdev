import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { DefaultObjectClusterResource } from '../../../lib/api/clusterResources';
import type { FormState } from './VpsCreateModel';

const resourceFields = {
  cpu: 'cpu', memory: 'memory', swap: 'swap', diskspace: 'diskspace',
  ipv4: 'ipv4', ipv4_private: 'ipv4Private', ipv6: 'ipv6',
} as const;

export function useVpsCreateResourceDefaults(
  defaults: DefaultObjectClusterResource[] | undefined,
  setForm: Dispatch<SetStateAction<FormState>>,
) {
  // Explicit choices survive delayed responses, refetches and location changes.
  const edited = useRef(new Set<keyof FormState>());
  useEffect(() => {
    if (!defaults) return;
    setForm((current) => {
      const next = { ...current };
      for (const item of defaults) {
        const name = item.cluster_resource?.name;
        if (!name || !Object.hasOwn(resourceFields, name) || typeof item.value !== 'number') continue;
        const field = resourceFields[name as keyof typeof resourceFields];
        if (!edited.current.has(field)) next[field] = String(item.value);
      }
      return next;
    });
  }, [defaults, setForm]);
  return (field: keyof FormState) => { edited.current.add(field); };
}
