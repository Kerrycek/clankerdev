// Common locale barrel
import { enCommon_core } from './common/core';
import { enCommon_confirm } from './common/confirm';
import { enCommon_chart } from './common/chart';
import { enCommon_list } from './common/list';
import { enCommon_pagination } from './common/pagination';
import { enCommon_nav } from './common/nav';
import { enCommon_app } from './common/app';
import { enCommon_dashboard } from './common/dashboard';
import { enCommon_palette } from './common/palette';
import { enCommon_user_menu } from './common/user_menu';
import { enCommon_sync } from './common/sync';
import { enCommon_stale } from './common/stale';
import { enCommon_scope } from './common/scope';
import { enCommon_object_kind } from './common/object_kind';
import { enCommon_settings } from './common/settings';
import { enCommon_state } from './common/state';
import { enCommon_error } from './common/error';
import { enCommon_not_found } from './common/not_found';
import { enCommon_empty } from './common/empty';
import { enCommon_toast } from './common/toast';
import { enCommon_modal } from './common/modal';
import { enCommon_help_boxes } from './common/help_boxes';
import { enCommon_filters } from './common/filters';
import { enCommon_admin } from './common/admin';
import { enCommon_audit } from './common/audit';
import { enCommon_dataset } from './common/dataset';
import { enCommon_mailer } from './common/mailer';
import { enCommon_transactions } from './common/transactions';
import { enCommon_userns } from './common/userns';

export const enCommon = {
  ...enCommon_core,
  ...enCommon_confirm,
  ...enCommon_chart,
  ...enCommon_list,
  ...enCommon_pagination,
  ...enCommon_nav,
  ...enCommon_app,
  ...enCommon_dashboard,
  ...enCommon_palette,
  ...enCommon_user_menu,
  ...enCommon_sync,
  ...enCommon_stale,
  ...enCommon_scope,
  ...enCommon_object_kind,
  ...enCommon_settings,
  ...enCommon_state,
  ...enCommon_error,
  ...enCommon_not_found,
  ...enCommon_empty,
  ...enCommon_toast,
  ...enCommon_modal,
  ...enCommon_help_boxes,
  ...enCommon_filters,
  ...enCommon_admin,
  ...enCommon_audit,
  ...enCommon_dataset,
  ...enCommon_mailer,
  ...enCommon_transactions,
  ...enCommon_userns,
} as const;
