import React, { Suspense } from 'react';

import { LoadingState } from '../components/ui/LoadingState';

type LazyableComponent = React.ComponentType<any>;

export function lazyRoute(
  loader: () => Promise<any>,
  exportName: string,
  fallbackTestId?: string
): LazyableComponent {
  const LazyComponent = React.lazy(async () => {
    const mod = await loader();
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
