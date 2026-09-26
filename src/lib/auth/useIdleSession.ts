import { useEffect, useRef, useState } from 'react';
import { startIdleSession } from './idleSession';

export function useIdleSession(seconds: number | null, identity: string | undefined,
  sessionKey: string | undefined, onExpire: () => void): number | undefined {
  const [deadline, setDeadline] = useState<number>();
  const expire = useRef(onExpire);
  expire.current = onExpire;
  useEffect(() => {
    setDeadline(undefined);
    if (!identity || seconds === null || seconds <= 0) return;
    return startIdleSession({ seconds, sessionKey, onDeadline: setDeadline, onExpire: () => expire.current() });
  }, [seconds, identity, sessionKey]);
  return deadline;
}
