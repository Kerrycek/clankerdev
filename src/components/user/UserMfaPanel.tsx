import React from 'react';

import { type User } from '../../lib/api/users';

import { UserKnownDevicesPanel } from './UserKnownDevicesPanel';
import { UserMfaMasterPanel } from './UserMfaMasterPanel';
import { UserMfaRecoveryCard } from './UserMfaRecoveryCard';
import { UserTotpDevicesPanel } from './UserTotpDevicesPanel';
import { UserWebauthnCredentialsPanel } from './UserWebauthnCredentialsPanel';

export function UserMfaPanel(props: {
  userId: number;
  user?: User;
  allowTotpCreate: boolean;
  allowWebauthnRegistration: boolean;
  testIdPrefix: string;
}) {
  return (
    <div className="space-y-4" data-testid={`${props.testIdPrefix}.panel`}>
      <UserMfaMasterPanel userId={props.userId} user={props.user} testIdPrefix={props.testIdPrefix} />

      <UserMfaRecoveryCard userId={props.userId} user={props.user} testIdPrefix={props.testIdPrefix} />

      <UserTotpDevicesPanel userId={props.userId} allowCreate={props.allowTotpCreate} testIdPrefix={props.testIdPrefix} />

      <UserWebauthnCredentialsPanel
        userId={props.userId}
        allowRegistration={props.allowWebauthnRegistration}
        testIdPrefix={props.testIdPrefix}
      />

      <UserKnownDevicesPanel userId={props.userId} testIdPrefix={props.testIdPrefix} />
    </div>
  );
}
