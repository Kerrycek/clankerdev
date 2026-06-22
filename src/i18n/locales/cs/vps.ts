// VPS locale barrel
import { csVps_core } from './vps/core';
import { csVps_create } from './vps/create';
import { csVps_overview } from './vps/overview';
import { csVps_config } from './vps/config';
import { csVps_access } from './vps/access';
import { csVps_console } from './vps/console';
import { csVps_lifecycle } from './vps/lifecycle';
import { csVps_network } from './vps/network';
import { csVps_storage } from './vps/storage';
import { csVps_features } from './vps/features';
import { csVps_maintenance } from './vps/maintenance';

export const csVps = {
  ...csVps_core,
  ...csVps_create,
  ...csVps_overview,
  ...csVps_config,
  ...csVps_access,
  ...csVps_console,
  ...csVps_lifecycle,
  ...csVps_network,
  ...csVps_storage,
  ...csVps_features,
  ...csVps_maintenance,
} as const;
