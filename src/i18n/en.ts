// Compatibility aggregator: dictionary is split by domain-specific locale modules.
import { enCommon } from './locales/en/common';
import { enAuth } from './locales/en/auth';
import { enProfile } from './locales/en/profile';
import { enVps } from './locales/en/vps';
import { enStorage } from './locales/en/storage';
import { enDns } from './locales/en/dns';
import { enOps } from './locales/en/ops';
import { enRequests } from './locales/en/requests';
import { enPublic } from './locales/en/public';
import { enMailer } from './locales/en/mailer';
import { enAdminCluster } from './locales/en/adminCluster';
import { enAdmin } from './locales/en/admin';
import { enSystem } from './locales/en/system';

export const en = {
  ...enCommon,
  ...enAuth,
  ...enProfile,
  ...enVps,
  ...enStorage,
  ...enDns,
  ...enOps,
  ...enRequests,
  ...enPublic,
  ...enMailer,
  ...enAdminCluster,
  ...enAdmin,
  ...enSystem,
} as const;
