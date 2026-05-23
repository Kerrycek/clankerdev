import React, { createContext, useContext } from 'react';

import { type TransactionChain } from '../../../lib/api/transactions';
import type { DnsZone } from '../../../lib/api/dns';
import type { ObjectRef } from '../../../lib/objectRef';

export interface DnsZoneContextValue {
  zone: DnsZone;
  refetch: () => void;

  zoneRef: ObjectRef;
  busyLocalLock: boolean;

  chains: TransactionChain[];
  chainsLoading: boolean;
  chainsError: unknown | null;
  busyTransaction: boolean;
  /** True when chain refresh has been failing long enough that lock state is degraded. */
  chainsStale: boolean;
  activeChainIds: number[];
  concernClasses: string[];
  refetchChains: () => void;
}

const DnsZoneContext = createContext<DnsZoneContextValue | null>(null);

export function DnsZoneContextProvider(props: { value: DnsZoneContextValue; children: React.ReactNode }) {
  return <DnsZoneContext.Provider value={props.value}>{props.children}</DnsZoneContext.Provider>;
}

export function useDnsZoneContext(): DnsZoneContextValue {
  const ctx = useContext(DnsZoneContext);
  if (!ctx) throw new Error('useDnsZoneContext must be used within DnsZoneContextProvider');
  return ctx;
}
