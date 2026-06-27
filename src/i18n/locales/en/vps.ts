// VPS locale barrel
import { enVps_list } from './vps/list';
import { enVps_create } from './vps/create';
import { enVps_layout } from './vps/layout';
import { enVps_header } from './vps/header';
import { enVps_power } from './vps/power';
import { enVps_tabs } from './vps/tabs';
import { enVps_actions } from './vps/actions';
import { enVps_lifecycle } from './vps/lifecycle';
import { enVps_config } from './vps/config';
import { enVps_access } from './vps/access';
import { enVps_console } from './vps/console';
import { enVps_overview } from './vps/overview';
import { enVps_network } from './vps/network';
import { enVps_storage } from './vps/storage';
import { enVps_features } from './vps/features';
import { enVps_maintenance } from './vps/maintenance';

export const enVps = {
  ...enVps_list,
  ...enVps_create,
  ...enVps_layout,
  ...enVps_header,
  ...enVps_power,
  ...enVps_tabs,
  ...enVps_actions,
  ...enVps_lifecycle,
  ...enVps_config,
  ...enVps_access,
  ...enVps_console,
  ...enVps_overview,
  ...enVps_network,
  ...enVps_storage,
  ...enVps_features,
  ...enVps_maintenance,
} as const;
