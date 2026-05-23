// Ops locale barrel
import { csOps_action } from './ops/action';
import { csOps_action_state } from './ops/action_state';
import { csOps_action_states } from './ops/action_states';
import { csOps_audit } from './ops/audit';
import { csOps_incidents } from './ops/incidents';
import { csOps_monitoring } from './ops/monitoring';
import { csOps_oom } from './ops/oom';
import { csOps_outage } from './ops/outage';
import { csOps_tasks } from './ops/tasks';
import { csOps_transactions } from './ops/transactions';

export const csOps = {
  ...csOps_action,
  ...csOps_action_state,
  ...csOps_action_states,
  ...csOps_audit,
  ...csOps_incidents,
  ...csOps_monitoring,
  ...csOps_oom,
  ...csOps_outage,
  ...csOps_tasks,
  ...csOps_transactions,
} as const;
