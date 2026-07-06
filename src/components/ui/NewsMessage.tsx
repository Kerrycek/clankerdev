import { useMemo } from 'react';

import { sanitizeNewsHtml } from '../../lib/sanitizeHtml';
import { clsx } from './clsx';

export function NewsMessage(props: { html: string; className?: string; testId?: string }) {
  const sanitized = useMemo(() => sanitizeNewsHtml(props.html), [props.html]);

  return (
    <div
      data-testid={props.testId}
      className={clsx(
        'prose-news whitespace-pre-wrap text-sm leading-relaxed',
        '[&_a]:font-medium [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-accent-2',
        '[&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_code]:rounded [&_code]:bg-surface-3 [&_code]:px-1',
        props.className,
      )}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
