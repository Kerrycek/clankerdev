// VPS locale barrel
import { enVps_core } from './vps/core';
import { enVps_create } from './vps/create';
import { enVps_overview } from './vps/overview';
import { enVps_config } from './vps/config';
import { enVps_access } from './vps/access';
import { enVps_console } from './vps/console';
import { enVps_lifecycle } from './vps/lifecycle';
import { enVps_network } from './vps/network';
import { enVps_storage } from './vps/storage';
import { enVps_features } from './vps/features';
import { enVps_maintenance } from './vps/maintenance';

export const enVps = {
  ...enVps_core,
  ...enVps_create,
  ...enVps_overview,
  ...enVps_config,
  ...enVps_access,
  ...enVps_console,
  ...enVps_lifecycle,
  ...enVps_network,
  ...enVps_storage,
  ...enVps_features,
  ...enVps_maintenance,
} as const;
