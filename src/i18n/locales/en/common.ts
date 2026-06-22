// Common locale barrel
import { enCommon_base } from './common/base';
import { enCommon_dashboard } from './common/dashboard';
import { enCommon_navigation } from './common/navigation';
import { enCommon_palette } from './common/palette';
import { enCommon_filters } from './common/filters';
import { enCommon_feedback } from './common/feedback';
import { enCommon_cross_domain } from './common/cross_domain';

export const enCommon = {
  ...enCommon_base,
  ...enCommon_dashboard,
  ...enCommon_navigation,
  ...enCommon_palette,
  ...enCommon_filters,
  ...enCommon_feedback,
  ...enCommon_cross_domain,
} as const;
