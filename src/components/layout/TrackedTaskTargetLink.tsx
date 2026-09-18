import React from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useAppMode } from '../../app/appMode';
import type { TrackedActionState } from './ChromeContext';

export function TrackedTaskTargetLink(props: {
  tracked?: TrackedActionState;
  label: string;
  testId: string;
  onNavigate: () => void;
}) {
  const { basePath } = useAppMode();
  const { search } = useLocation();
  const object = props.tracked?.object;
  if (object?.kind !== 'Vps' || !Number.isSafeInteger(object.id) || object.id <= 0) return <>{props.label}</>;

  const memberId = Number(basePath === '/admin' ? new URLSearchParams(search).get('user') : null);
  const memberSearch = Number.isSafeInteger(memberId) && memberId > 0 ? `?user=${memberId}` : '';

  return (
    <Link
      className="font-medium text-accent underline"
      to={`${basePath}/vps/${object.id}${memberSearch}`}
      onClick={props.onNavigate}
      data-testid={props.testId}
    >
      {props.label}
    </Link>
  );
}
