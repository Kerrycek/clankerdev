// Compatibility aggregator: dictionary is split by domain-specific locale modules.
import { csCommon } from './locales/cs/common';
import { csAuth } from './locales/cs/auth';
import { csProfile } from './locales/cs/profile';
import { csVps } from './locales/cs/vps';
import { csStorage } from './locales/cs/storage';
import { csDns } from './locales/cs/dns';
import { csOps } from './locales/cs/ops';
import { csRequests } from './locales/cs/requests';
import { csPublic } from './locales/cs/public';
import { csMailer } from './locales/cs/mailer';
import { csAdminCluster } from './locales/cs/adminCluster';
import { csAdmin } from './locales/cs/admin';
import { csSystem } from './locales/cs/system';

export const cs = {
  ...csCommon,
  ...csAuth,
  ...csProfile,
  ...csVps,
  ...csStorage,
  ...csDns,
  ...csOps,
  ...csRequests,
  ...csPublic,
  ...csMailer,
  ...csAdminCluster,
  ...csAdmin,
  ...csSystem,
} as const;
