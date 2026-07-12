// Profile locale barrel
import { csProfile_action } from './profile/action';
import { csProfile_admin } from './profile/admin';
import { csProfile_admin_update } from './profile/admin_update';
import { csProfile_confirm_delete } from './profile/confirm_delete';
import { csProfile_count } from './profile/count';
import { csProfile_delete } from './profile/delete';
import { csProfile_deploy } from './profile/deploy';
import { csProfile_editor } from './profile/editor';
import { csProfile_empty } from './profile/empty';
import { csProfile_entry } from './profile/entry';
import { csProfile_error } from './profile/error';
import { csProfile_field } from './profile/field';
import { csProfile_fields } from './profile/fields';
import { csProfile_filters } from './profile/filters';
import { csProfile_format } from './profile/format';
import { csProfile_help } from './profile/help';
import { csProfile_hint } from './profile/hint';
import { csProfile_keys } from './profile/keys';
import { csProfile_mail } from './profile/mail';
import { csProfile_map } from './profile/map';
import { csProfile_metrics } from './profile/metrics';
import { csProfile_mfa } from './profile/mfa';
import { csProfile_namespace } from './profile/namespace';
import { csProfile_page } from './profile/page';
import { csProfile_panel } from './profile/panel';
import { csProfile_placeholders } from './profile/placeholders';
import { csProfile_prefs } from './profile/prefs';
import { csProfile_resources } from './profile/resources';
import { csProfile_security } from './profile/security';
import { csProfile_sessions } from './profile/sessions';
import { csProfile_smart } from './profile/smart';
import { csProfile_snooze } from './profile/snooze';
import { csProfile_state_log } from './profile/state_log';
import { csProfile_tabs } from './profile/tabs';
import { csProfile_tips } from './profile/tips';
import { csProfile_toast } from './profile/toast';
import { csProfile_user } from './profile/user';
import { csProfile_userns } from './profile/userns';
import { csProfile_validation } from './profile/validation';

export const csProfile = {
  ...csProfile_action,
  ...csProfile_admin,
  ...csProfile_admin_update,
  ...csProfile_confirm_delete,
  ...csProfile_count,
  ...csProfile_delete,
  ...csProfile_deploy,
  ...csProfile_editor,
  ...csProfile_empty,
  ...csProfile_entry,
  ...csProfile_error,
  ...csProfile_field,
  ...csProfile_fields,
  ...csProfile_filters,
  ...csProfile_format,
  ...csProfile_help,
  ...csProfile_hint,
  ...csProfile_keys,
  ...csProfile_mail,
  ...csProfile_map,
  ...csProfile_metrics,
  ...csProfile_mfa,
  ...csProfile_namespace,
  ...csProfile_page,
  ...csProfile_panel,
  ...csProfile_placeholders,
  ...csProfile_prefs,
  ...csProfile_resources,
  ...csProfile_security,
  ...csProfile_sessions,
  ...csProfile_smart,
  ...csProfile_snooze,
  ...csProfile_state_log,
  ...csProfile_tabs,
  ...csProfile_tips,
  ...csProfile_toast,
  ...csProfile_user,
  ...csProfile_userns,
  ...csProfile_validation,
} as const;
