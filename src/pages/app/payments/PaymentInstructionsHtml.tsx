import { useMemo } from 'react';

import { useI18n } from '../../../app/i18n';
import { clsx } from '../../../components/ui/clsx';
import { sanitizePaymentInstructionsHtml } from './PaymentsModel';

export function PaymentInstructionsHtml(props: { html: string; className?: string; testId?: string }) {
  const { lang } = useI18n();
  const sanitized = useMemo(() => sanitizePaymentInstructionsHtml(props.html, lang), [props.html, lang]);

  return (
    <div
      data-testid={props.testId}
      className={clsx(
        'payment-instructions text-sm leading-relaxed text-strong [overflow-wrap:anywhere]',
        '[&_a]:font-medium [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-accent-2',
        '[&_h1]:mb-3 [&_h1]:mt-0 [&_h1]:text-xl [&_h1]:font-semibold',
        '[&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold',
        '[&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold',
        '[&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:text-sm [&_h4]:font-semibold',
        '[&_p]:my-3 [&_ul]:my-3 [&_ol]:my-3 [&_li]:my-1',
        '[&_table]:my-3 [&_table]:w-full [&_table]:max-w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-lg [&_table]:text-sm',
        '[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top',
        '[&_th]:border [&_th]:border-border [&_th]:bg-surface-2 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold',
        '[&_tr:nth-child(even)_td]:bg-surface-2/60',
        '[&_img]:h-auto [&_img]:max-w-36 [&_img]:rounded-md [&_img]:bg-white [&_img]:p-1',
        '[&_code]:rounded [&_code]:bg-surface-3 [&_code]:px-1',
        props.className,
      )}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
