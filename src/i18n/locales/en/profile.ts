// Profile locale barrel
import { enProfile_action } from './profile/action';
import { enProfile_admin } from './profile/admin';
import { enProfile_admin_update } from './profile/admin_update';
import { enProfile_confirm_delete } from './profile/confirm_delete';
import { enProfile_count } from './profile/count';
import { enProfile_delete } from './profile/delete';
import { enProfile_deploy } from './profile/deploy';
import { enProfile_editor } from './profile/editor';
import { enProfile_empty } from './profile/empty';
import { enProfile_entry } from './profile/entry';
import { enProfile_error } from './profile/error';
import { enProfile_field } from './profile/field';
import { enProfile_fields } from './profile/fields';
import { enProfile_filters } from './profile/filters';
import { enProfile_format } from './profile/format';
import { enProfile_help } from './profile/help';
import { enProfile_hint } from './profile/hint';
import { enProfile_keys } from './profile/keys';
import { enProfile_mail } from './profile/mail';
import { enProfile_map } from './profile/map';
import { enProfile_metrics } from './profile/metrics';
import { enProfile_mfa } from './profile/mfa';
import { enProfile_namespace } from './profile/namespace';
import { enProfile_page } from './profile/page';
import { enProfile_panel } from './profile/panel';
import { enProfile_placeholders } from './profile/placeholders';
import { enProfile_prefs } from './profile/prefs';
import { enProfile_resources } from './profile/resources';
import { enProfile_security } from './profile/security';
import { enProfile_sessions } from './profile/sessions';
import { enProfile_smart } from './profile/smart';
import { enProfile_snooze } from './profile/snooze';
import { enProfile_state_log } from './profile/state_log';
import { enProfile_tabs } from './profile/tabs';
import { enProfile_tips } from './profile/tips';
import { enProfile_toast } from './profile/toast';
import { enProfile_user } from './profile/user';
import { enProfile_userns } from './profile/userns';
import { enProfile_validation } from './profile/validation';

export const enProfile = {
  ...enProfile_action,
  ...enProfile_admin,
  ...enProfile_admin_update,
  ...enProfile_confirm_delete,
  ...enProfile_count,
  ...enProfile_delete,
  ...enProfile_deploy,
  ...enProfile_editor,
  ...enProfile_empty,
  ...enProfile_entry,
  ...enProfile_error,
  ...enProfile_field,
  ...enProfile_fields,
  ...enProfile_filters,
  ...enProfile_format,
  ...enProfile_help,
  ...enProfile_hint,
  ...enProfile_keys,
  ...enProfile_mail,
  ...enProfile_map,
  ...enProfile_metrics,
  ...enProfile_mfa,
  ...enProfile_namespace,
  ...enProfile_page,
  ...enProfile_panel,
  ...enProfile_placeholders,
  ...enProfile_prefs,
  ...enProfile_resources,
  ...enProfile_security,
  ...enProfile_sessions,
  ...enProfile_smart,
  ...enProfile_snooze,
  ...enProfile_state_log,
  ...enProfile_tabs,
  ...enProfile_tips,
  ...enProfile_toast,
  ...enProfile_user,
  ...enProfile_userns,
  ...enProfile_validation,
} as const;
