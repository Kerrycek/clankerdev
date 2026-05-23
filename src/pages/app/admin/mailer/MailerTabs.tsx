import React from 'react';

import { useAppMode } from '../../../../app/appMode';
import { useI18n } from '../../../../app/i18n';

import { TabsNav } from '../../../../components/ui/TabsNav';

/**
 * MailerTabs
 *
 * Local navigation within the Admin → Mailer section.
 * We keep the global sidebar as a single entry ("Mailer") and provide
 * consistent sub-navigation here.
 */
export function MailerTabs(props: { className?: string }) {
  const { basePath } = useAppMode();
  const { t } = useI18n();

  return (
    <TabsNav
      className={props.className}
      items={[
        { to: `${basePath}/mailer/templates`, label: t('mailer.tabs.templates') },
        { to: `${basePath}/mailer/mailboxes`, label: t('mailer.tabs.mailboxes') },
        { to: `${basePath}/mailer/recipients`, label: t('mailer.tabs.recipients') },
        { to: `${basePath}/mailer/log`, label: t('mailer.tabs.log') },
      ]}
    />
  );
}
