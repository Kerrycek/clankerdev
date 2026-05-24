import React, { Suspense } from 'react';

import { LoadingState } from '../components/ui/LoadingState';

type LazyableComponent = React.ComponentType<any>;

function isChunkLoadError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = `${err.name} ${err.message}`.toLowerCase();
  return (
    msg.includes('dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('not a valid javascript mime type') ||
    msg.includes('loading chunk') ||
    msg.includes('chunkloaderror')
  );
}

export function lazyRoute(
  loader: () => Promise<any>,
  exportName: string,
  fallbackTestId?: string
): LazyableComponent {
  const LazyComponent = React.lazy(async () => {
    let mod: any;
    try {
      mod = await loader();
    } catch (err) {
      if (isChunkLoadError(err)) {
        throw new Error('The application was updated while this tab was open. Reload the page to load the newest version.');
      }
      throw err;
    }

    const resolved = mod?.[exportName];

    if (!resolved) {
      throw new Error(`lazyRoute: export "${exportName}" was not found`);
    }

    return { default: resolved as LazyableComponent };
  });

  const Wrapped: React.FC<any> = (props) => (
    <Suspense fallback={<LoadingState testId={fallbackTestId ?? `route.loading.${exportName}`} />}>
      <LazyComponent {...props} />
    </Suspense>
  );

  Wrapped.displayName = `LazyRoute(${exportName})`;
  return Wrapped;
}
