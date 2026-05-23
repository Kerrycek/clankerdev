import { useEffect, useState } from 'react';

/**
 * React hook that reports whether the document is currently visible.
 *
 * We use this to slow down polling when the tab is backgrounded.
 */
export function useDocumentVisibility(): boolean {
  const [visible, setVisible] = useState(() => {
    if (typeof document === 'undefined') return true;
    return document.visibilityState !== 'hidden';
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const onChange = () => {
      setVisible(document.visibilityState !== 'hidden');
    };

    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  return visible;
}
