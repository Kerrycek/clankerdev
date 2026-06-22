// Ops locale barrel
import { enOps_action } from './ops/action';
import { enOps_action_state } from './ops/action_state';
import { enOps_action_states } from './ops/action_states';
import { enOps_audit } from './ops/audit';
import { enOps_incidents } from './ops/incidents';
import { enOps_monitoring } from './ops/monitoring';
import { enOps_oom } from './ops/oom';
import { enOps_outage } from './ops/outage';
import { enOps_operation } from './ops/operation';
import { enOps_tasks } from './ops/tasks';
import { enOps_transactions } from './ops/transactions';

export const enOps = {
  ...enOps_action,
  ...enOps_action_state,
  ...enOps_action_states,
  ...enOps_audit,
  ...enOps_incidents,
  ...enOps_monitoring,
  ...enOps_oom,
  ...enOps_outage,
  ...enOps_operation,
  ...enOps_tasks,
  ...enOps_transactions,
} as const;
