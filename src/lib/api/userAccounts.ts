import { haveApiCall } from './haveapi';

export interface UserAccount {
  /** User ID (user_account_id in the API routes) */
  id: number;
  monthly_payment?: number;
  paid_until?: string | null;
  [k: string]: unknown;
}

export async function fetchUserAccount(userId: number) {
  return haveApiCall<UserAccount>({
    method: 'GET',
    path: `/user_accounts/${userId}`,
  });
}

export async function updateUserAccount(
  userId: number,
  opts: { monthly_payment?: number; paid_until?: string | null }
) {
  const params: Record<string, unknown> = {};
  if (opts.monthly_payment !== undefined) params['monthly_payment'] = opts.monthly_payment;
  if (opts.paid_until !== undefined) params['paid_until'] = opts.paid_until;

  return haveApiCall<UserAccount>({
    method: 'PUT',
    path: `/user_accounts/${userId}`,
    namespace: 'user_account',
    params,
  });
}
