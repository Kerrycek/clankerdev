import { expectArray, haveApiCall } from './haveapi';

export interface ResourceRef {
  id: number;
  label?: string;
  login?: string;
  name?: string;
  [k: string]: unknown;
}

export type IncomingPaymentState = 'queued' | 'unmatched' | 'processed' | 'ignored' | string;

export interface IncomingPayment {
  id: number;
  transaction_id?: string;
  state?: IncomingPaymentState;
  date?: string;
  amount?: number;
  currency?: string;
  src_amount?: number;
  src_currency?: string;
  account_name?: string;
  user_ident?: string;
  user?: ResourceRef;
  user_paid_until?: string | null;
  user_message?: string;
  vs?: string;
  ks?: string;
  ss?: string;
  transaction_type?: string;
  comment?: string;
  created_at?: string;
  [k: string]: unknown;
}

export async function fetchIncomingPayments(opts?: { limit?: number; fromId?: number; state?: string; q?: string; userId?: number }) {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;
  if (opts?.state) params['state'] = opts.state;
  if (opts?.q) params['q'] = opts.q;
  if (opts?.userId !== undefined) params['user'] = opts.userId;

  const res = await haveApiCall<IncomingPayment[]>({
    method: 'GET',
    path: '/incoming_payments',
    namespace: 'incoming_payment',
    params,
  });

  return { ...res, data: expectArray<IncomingPayment>(res.data, 'incoming_payments#index') };
}

export async function fetchIncomingPayment(paymentId: number) {
  return haveApiCall<IncomingPayment>({
    method: 'GET',
    path: `/incoming_payments/${paymentId}`,
  });
}

export async function updateIncomingPaymentState(paymentId: number, state: IncomingPaymentState) {
  return haveApiCall<IncomingPayment>({
    method: 'PUT',
    path: `/incoming_payments/${paymentId}`,
    namespace: 'incoming_payment',
    params: { state },
  });
}

export interface UserPayment {
  id: number;
  incoming_payment?: ResourceRef;
  user?: ResourceRef;
  amount?: number;
  accounted_by?: ResourceRef;
  from_date?: string;
  to_date?: string;
  created_at?: string;
  [k: string]: unknown;
}

export type CreateUserPaymentInput =
  | {
      /** Target user ID */
      user: number;
      /** Attach this incoming payment */
      incoming_payment: number;
    }
  | {
      /** Target user ID */
      user: number;
      /** Manual payment amount (default currency) */
      amount: number;
    };

/**
 * Create an accepted user payment.
 *
 * Modes:
 * - from incoming payment: { user, incoming_payment }
 * - manual: { user, amount }
 */
export async function createUserPayment(opts: CreateUserPaymentInput) {
  const params: Record<string, unknown> = {
    user: opts.user,
  };

  if ('incoming_payment' in opts) params['incoming_payment'] = opts.incoming_payment;
  if ('amount' in opts) params['amount'] = opts.amount;

  return haveApiCall<UserPayment>({
    method: 'POST',
    path: '/user_payments',
    namespace: 'user_payment',
    params,
  });
}

export async function fetchUserPayments(opts?: { limit?: number; fromId?: number; userId?: number; accountedById?: number }) {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;
  if (opts?.userId !== undefined) params['user'] = opts.userId;
  if (opts?.accountedById !== undefined) params['accounted_by'] = opts.accountedById;

  const res = await haveApiCall<UserPayment[]>({
    method: 'GET',
    path: '/user_payments',
    namespace: 'user_payment',
    params,
  });

  return { ...res, data: expectArray<UserPayment>(res.data, 'user_payments#index') };
}

export async function fetchPaymentInstructions(userId: number) {
  const res = await haveApiCall<string | { instructions?: string }>({
    method: 'GET',
    path: `/users/${userId}/get_payment_instructions`,
  });

  if (typeof res.data === 'string') {
    return { ...res, data: { instructions: res.data } };
  }

  return { ...res, data: { instructions: String(res.data?.instructions ?? '') } };
}
