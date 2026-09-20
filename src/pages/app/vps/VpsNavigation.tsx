import React, { useMemo } from 'react';

import { useI18n } from '../../../app/i18n';
import { Select } from '../../../components/ui/Select';
import { TabsNav } from '../../../components/ui/TabsNav';

export function VpsTabsNav(props: { basePath: string; vpsId: number; contextSearch?: string }) {
  const { t } = useI18n();
  const contextSearch = props.contextSearch ?? '';
  const items = useMemo(() => [
    { label: t('vps.tabs.overview'), to: `${props.basePath}/vps/${props.vpsId}${contextSearch}`, end: true },
    { label: t('vps.tabs.access'), to: `${props.basePath}/vps/${props.vpsId}/access${contextSearch}`, end: true },
    { label: t('vps.tabs.network'), to: `${props.basePath}/vps/${props.vpsId}/network${contextSearch}`, end: true },
    { label: t('vps.tabs.storage'), to: `${props.basePath}/vps/${props.vpsId}/storage${contextSearch}`, end: true },
    { label: t('vps.tabs.maintenance'), to: `${props.basePath}/vps/${props.vpsId}/maintenance${contextSearch}`, end: true },
    { label: t('vps.tabs.history'), to: `${props.basePath}/vps/${props.vpsId}/history${contextSearch}`, end: true },
    { label: t('vps.tabs.console'), to: `${props.basePath}/vps/${props.vpsId}/console${contextSearch}`, end: true },
  ], [contextSearch, props.basePath, props.vpsId, t]);

  return <TabsNav items={items} />;
}

export function VpsActionsMenu(props: {
  basePath: string;
  vpsId: number;
  canMutateVps: boolean;
  passwordAllowed: boolean;
  showTasks: boolean;
  showSupportActions: boolean;
  showAdminActions: boolean;
  ownerUserId?: number;
  contextSearch?: string;
  onSelect: (value: string) => void;
}) {
  const { t } = useI18n();
  const vpsPath = `${props.basePath}/vps/${props.vpsId}`;
  const contextSearch = props.contextSearch ?? '';
  const contextualVpsPath = (suffix = '') => `${vpsPath}${suffix}${contextSearch}`;

  return (
    <Select
      value=""
      ariaLabel={t('vps.actions.menu.label')}
      testId="vps.actions.menu"
      className="w-full sm:!w-48"
      onChange={(event) => props.onSelect(event.target.value)}
    >
      <option value="">{t('vps.actions.more.placeholder')}</option>
      {props.canMutateVps ? (
        <optgroup label={t('vps.actions.more.group.daily')}>
          <option value="action:root_password" disabled={!props.passwordAllowed}>{t('vps.power.root_password.button')}</option>
          {props.showTasks ? <option value="tasks">{t('common.open_tasks')}</option> : null}
        </optgroup>
      ) : null}
      <optgroup label={t('vps.actions.more.group.sections')}>
        <option value={contextualVpsPath('/access')}>{t('vps.tabs.access')}</option>
        <option value={contextualVpsPath('/config')}>{t('vps.tabs.config')}</option>
        <option value={contextualVpsPath('/network')}>{t('vps.tabs.network')}</option>
        <option value={contextualVpsPath('/storage')}>{t('vps.tabs.storage')}</option>
        <option value={contextualVpsPath('/features')}>{t('vps.tabs.features')}</option>
        <option value={contextualVpsPath('/maintenance')}>{t('vps.tabs.maintenance')}</option>
        <option value={contextualVpsPath('/history')}>{t('vps.tabs.history')}</option>
        <option value={`${props.basePath}/transactions?class_name=Vps&row_id=${props.vpsId}`}>{t('vps.overview.admin_actions.transaction_log')}</option>
      </optgroup>
      {props.canMutateVps ? (
        <optgroup label={t('vps.actions.more.group.lifecycle')}>
          <option value={contextualVpsPath('/lifecycle/reinstall')}>{t('action.vps.reinstall.label')}</option>
          <option value={contextualVpsPath('/lifecycle/clone')}>{t('action.vps.clone.label')}</option>
          <option value={contextualVpsPath('/lifecycle/swap')}>{t('action.vps.swap.label')}</option>
          <option value={contextualVpsPath('/lifecycle/template')}>{t('action.vps.template.label')}</option>
          <option value={contextualVpsPath('/lifecycle/boot')}>{t('action.vps.boot.label')}</option>
          <option value={contextualVpsPath('/lifecycle/delete')}>{t('action.vps.delete.label')}</option>
        </optgroup>
      ) : null}
      {props.showSupportActions ? (
        <optgroup label={t('vps.actions.more.group.support')}>
          <option value={`${props.basePath}/oom-reports?vps=${props.vpsId}`}>
            {t('vps.overview.admin_actions.oom_reports')}
          </option>
          <option value={`${props.basePath}/incidents?vps=${props.vpsId}`}>
            {t('vps.overview.admin_actions.incidents')}
          </option>
          <option value={`${props.basePath}/outages?vps=${props.vpsId}`}>
            {t('vps.overview.admin_actions.outages')}
          </option>
        </optgroup>
      ) : null}
      {props.showAdminActions ? (
        <optgroup label={t('vps.actions.more.group.admin')}>
          <option value={`${props.basePath}/oom-reports/rules/${props.vpsId}`}>
            {t('vps.overview.admin_actions.oom_rules')}
          </option>
          <option value={`${props.basePath}/incidents/new?vps=${props.vpsId}`}>
            {t('vps.overview.admin_actions.report_incident')}
          </option>
          {props.ownerUserId ? (
            <option value={`${props.basePath}/users/${props.ownerUserId}/user-data`}>
              {t('vps.overview.admin_actions.user_data')}
            </option>
          ) : null}
          <option value={`${props.basePath}/user-namespaces`}>
            {t('vps.overview.admin_actions.user_namespaces')}
          </option>
          <option value={contextualVpsPath('/lifecycle/lifetime')}>{t('action.vps.lifecycle.label')}</option>
          <option value={contextualVpsPath('/lifecycle/replace')}>{t('action.vps.replace.label')}</option>
          <option value={contextualVpsPath('/lifecycle/migrate')}>{t('action.vps.migrate.label')}</option>
        </optgroup>
      ) : null}
    </Select>
  );
}
