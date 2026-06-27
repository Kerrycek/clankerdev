// Common locale barrel
import { csCommon_core } from './common/core';
import { csCommon_confirm } from './common/confirm';
import { csCommon_chart } from './common/chart';
import { csCommon_list } from './common/list';
import { csCommon_pagination } from './common/pagination';
import { csCommon_nav } from './common/nav';
import { csCommon_app } from './common/app';
import { csCommon_dashboard } from './common/dashboard';
import { csCommon_palette } from './common/palette';
import { csCommon_user_menu } from './common/user_menu';
import { csCommon_sync } from './common/sync';
import { csCommon_stale } from './common/stale';
import { csCommon_scope } from './common/scope';
import { csCommon_object_kind } from './common/object_kind';
import { csCommon_settings } from './common/settings';
import { csCommon_state } from './common/state';
import { csCommon_error } from './common/error';
import { csCommon_not_found } from './common/not_found';
import { csCommon_empty } from './common/empty';
import { csCommon_toast } from './common/toast';
import { csCommon_modal } from './common/modal';
import { csCommon_help_boxes } from './common/help_boxes';
import { csCommon_filters } from './common/filters';
import { csCommon_admin } from './common/admin';
import { csCommon_audit } from './common/audit';
import { csCommon_dataset } from './common/dataset';
import { csCommon_mailer } from './common/mailer';
import { csCommon_transactions } from './common/transactions';
import { csCommon_userns } from './common/userns';

export const csCommon = {
  ...csCommon_core,
  ...csCommon_confirm,
  ...csCommon_chart,
  ...csCommon_list,
  ...csCommon_pagination,
  ...csCommon_nav,
  ...csCommon_app,
  ...csCommon_dashboard,
  ...csCommon_palette,
  ...csCommon_user_menu,
  ...csCommon_sync,
  ...csCommon_stale,
  ...csCommon_scope,
  ...csCommon_object_kind,
  ...csCommon_settings,
  ...csCommon_state,
  ...csCommon_error,
  ...csCommon_not_found,
  ...csCommon_empty,
  ...csCommon_toast,
  ...csCommon_modal,
  ...csCommon_help_boxes,
  ...csCommon_filters,
  ...csCommon_admin,
  ...csCommon_audit,
  ...csCommon_dataset,
  ...csCommon_mailer,
  ...csCommon_transactions,
  ...csCommon_userns,
} as const;
