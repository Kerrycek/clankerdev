import React from 'react';

import { useI18n } from '../../../app/i18n';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { SmartInputHelp } from '../../../components/ui/SmartInputHelp';
import { UserLookupInput } from '../../../components/ui/UserLookupInput';

export function IncomingPaymentsFiltersHelp(props: {
  helpOpen: boolean;
  advancedOpen: boolean;
  filtersActive: boolean;
  userId: string;
  setUserId: (value: string) => void;
  setSmart: (value: string) => void;
  smartInputRef: React.RefObject<HTMLInputElement | null>;
  setHelpOpen: (open: boolean) => void;
  setAdvancedOpen: (open: boolean) => void;
  clearFilters: () => void;
}) {
  const { t } = useI18n();

  return (
    <>
      <SmartInputHelp
        open={props.helpOpen}
        onClose={() => props.setHelpOpen(false)}
        title={t('filters.help.title')}
        intro={t('payments.incoming.smart_help.intro')}
        examples={[
          { label: t('filters.help.examples.help'), value: '?' },
          { label: t('payments.incoming.smart_help.examples.search'), value: 'alice' },
          { label: t('payments.incoming.smart_help.examples.state'), value: 'state:unmatched' },
          { label: t('payments.incoming.smart_help.examples.open_id'), value: '#300' },
          { label: t('payments.incoming.smart_help.examples.vs'), value: 'vs:123456' },
        ]}
        topKeys={[
          { key: 'q', description: t('payments.incoming.smart_help.keys.q'), example: 'q:alice' },
          { key: 'state', description: t('payments.incoming.smart_help.keys.state'), example: 'state:unmatched' },
          { key: 'user', description: t('payments.incoming.smart_help.keys.user'), example: 'user:123' },
          { key: 'id', description: t('payments.incoming.smart_help.keys.id'), example: 'id:300' },
        ]}
        moreKeys={[
          { key: 'vs', description: t('payments.incoming.smart_help.keys.vs'), example: 'vs:123456' },
          { key: 'tx', description: t('payments.incoming.smart_help.keys.tx'), example: 'tx:ABC123' },
          { key: 'account', description: t('payments.incoming.smart_help.keys.account'), example: 'account:ČSOB' },
          { key: 'ident', description: t('payments.incoming.smart_help.keys.ident'), example: 'ident:john' },
          { key: 'msg', description: t('payments.incoming.smart_help.keys.msg'), example: 'msg:"order 42"' },
        ]}
        inference={[
          t('payments.incoming.smart_help.inference.enter_applies'),
          t('payments.incoming.smart_help.inference.number_searches'),
          t('payments.incoming.smart_help.inference.hash_opens'),
          t('payments.incoming.smart_help.inference.key_value'),
        ]}
        onInsertKey={(key) => {
          props.setHelpOpen(false);
          props.setSmart(`${key}:`);
          window.requestAnimationFrame(() => props.smartInputRef.current?.focus());
        }}
        actions={[
          {
            label: t('filters.help.open_advanced'),
            onClick: () => {
              props.setHelpOpen(false);
              props.setAdvancedOpen(true);
            },
          },
        ]}
        testId="admin.payments.incoming.smart_filter.help"
        keyRowTestIdPrefix="admin.payments.incoming.smart_filter.help.key"
      />

      <Drawer
        open={props.advancedOpen}
        onClose={() => props.setAdvancedOpen(false)}
        title={t('filters.advanced.title')}
        width="lg"
        testId="admin.payments.incoming.advanced_filters"
        footer={
          <div className="flex items-center justify-end gap-2">
            {props.filtersActive ? (
              <Button variant="secondary" size="sm" onClick={props.clearFilters}>
                {t('common.clear_filters')}
              </Button>
            ) : null}
            <Button variant="primary" size="sm" onClick={() => props.setAdvancedOpen(false)}>
              {t('common.close')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium">{t('common.user')}</div>
            <div className="mt-1">
              <UserLookupInput
                value={props.userId}
                onChange={props.setUserId}
                placeholder={t('payments.incoming.assign.user_placeholder')}
                testId="admin.payments.incoming.filter.user.lookup"
                loadingLabel={t('common.loading')}
                noResultsLabel={t('palette.empty.no_results')}
              />
            </div>
            <div className="mt-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted">
              {t('payments.incoming.smart_help.drawer_hint')}
            </div>
          </div>
        </div>
      </Drawer>
    </>
  );
}
