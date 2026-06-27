// VPS locale barrel
import { csVps_list } from './vps/list';
import { csVps_create } from './vps/create';
import { csVps_layout } from './vps/layout';
import { csVps_header } from './vps/header';
import { csVps_power } from './vps/power';
import { csVps_tabs } from './vps/tabs';
import { csVps_actions } from './vps/actions';
import { csVps_lifecycle } from './vps/lifecycle';
import { csVps_config } from './vps/config';
import { csVps_access } from './vps/access';
import { csVps_console } from './vps/console';
import { csVps_overview } from './vps/overview';
import { csVps_network } from './vps/network';
import { csVps_storage } from './vps/storage';
import { csVps_features } from './vps/features';
import { csVps_maintenance } from './vps/maintenance';

export const csVps = {
  ...csVps_list,
  ...csVps_create,
  ...csVps_layout,
  ...csVps_header,
  ...csVps_power,
  ...csVps_tabs,
  ...csVps_actions,
  ...csVps_lifecycle,
  ...csVps_config,
  ...csVps_access,
  ...csVps_console,
  ...csVps_overview,
  ...csVps_network,
  ...csVps_storage,
  ...csVps_features,
  ...csVps_maintenance,
} as const;
