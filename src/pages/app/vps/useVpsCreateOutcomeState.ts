import { useEffect, useRef, useState } from 'react';

import {
  readLatestVpsCreateOutcomeMarker,
  vpsCreateOutcomeEntryPrefix,
  type VpsCreateOutcomeMarker,
} from '../../../lib/vpsCreateOutcomeGuard';

export function useVpsCreateOutcomeState(userId: number | undefined, pageSessionId: string) {
  const outcomeUserIdRef = useRef(userId);
  const [storedMarker, setStoredMarker] = useState<VpsCreateOutcomeMarker | null>(
    () => readLatestVpsCreateOutcomeMarker(userId)
  );
  const [reviewedOutcomeId, setReviewedOutcomeId] = useState<string | null>(null);
  const [outcomeReviewPending, setOutcomeReviewPending] = useState(false);
  const [outcomeReviewError, setOutcomeReviewError] = useState<string | null>(null);
  const [outcomeCandidateVpsId, setOutcomeCandidateVpsId] = useState<number | null>(null);
  const userScopedMarker = outcomeUserIdRef.current === userId ? storedMarker : null;
  const marker = userScopedMarker?.phase === 'accepted' && userScopedMarker.pageSessionId !== pageSessionId
    ? null
    : userScopedMarker;

  useEffect(() => {
    outcomeUserIdRef.current = userId;
    setStoredMarker(readLatestVpsCreateOutcomeMarker(userId));
    setReviewedOutcomeId(null);
    setOutcomeReviewPending(false);
    setOutcomeReviewError(null);
    setOutcomeCandidateVpsId(null);
  }, [userId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const entryPrefix = vpsCreateOutcomeEntryPrefix(userId);
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage || !event.key?.startsWith(entryPrefix)) return;
      const nextMarker = readLatestVpsCreateOutcomeMarker(userId);
      setStoredMarker(nextMarker);
      setReviewedOutcomeId((current) => current === nextMarker?.id ? current : null);
      setOutcomeCandidateVpsId(null);
      setOutcomeReviewError(null);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [userId]);

  return {
    marker,
    setMarker: setStoredMarker,
    reviewedOutcomeId,
    setReviewedOutcomeId,
    outcomeReviewPending,
    setOutcomeReviewPending,
    outcomeReviewError,
    setOutcomeReviewError,
    outcomeCandidateVpsId,
    setOutcomeCandidateVpsId,
  };
}
