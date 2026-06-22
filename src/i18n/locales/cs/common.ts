// Common locale barrel
import { csCommon_base } from './common/base';
import { csCommon_dashboard } from './common/dashboard';
import { csCommon_navigation } from './common/navigation';
import { csCommon_palette } from './common/palette';
import { csCommon_filters } from './common/filters';
import { csCommon_feedback } from './common/feedback';
import { csCommon_cross_domain } from './common/cross_domain';

export const csCommon = {
  ...csCommon_base,
  ...csCommon_dashboard,
  ...csCommon_navigation,
  ...csCommon_palette,
  ...csCommon_filters,
  ...csCommon_feedback,
  ...csCommon_cross_domain,
} as const;
