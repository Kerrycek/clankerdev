import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';

import { buildTransactionChainActiveFilterChips } from './transactionChainSmartFilter';

const noop = () => undefined;

function labelsFor(mode: 'app' | 'admin') {
  const chips = buildTransactionChainActiveFilterChips({
    t: (key) => key,
    mode,
    smartErrors: [],
    queryTrim: '',
    errorsOnly: false,
    state: '',
    userIdNum: 7,
    userSessionNum: 42,
    clearSmartErrors: noop,
    clearQuery: noop,
    clearErrorsOnly: noop,
    clearState: noop,
    clearClassName: noop,
    clearRowId: noop,
    clearUserId: noop,
    clearUserSessionId: noop,
  });

  return chips.flatMap((chip) =>
    isValidElement<{ label: string }>(chip) ? [chip.props.label] : []
  );
}

describe('transaction chain active filter chips', () => {
  it('shows a session filter in My view without exposing the admin-only user filter', () => {
    expect(labelsFor('app')).toEqual(['session:42']);
  });

  it('keeps both owner and session filters visible to admins', () => {
    expect(labelsFor('admin')).toEqual(['user:7', 'session:42']);
  });
});
