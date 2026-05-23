import { expectArray, haveApiCall } from './haveapi';

export interface UserMailRoleRecipient {
  /** Role identifier (e.g. "account", "admin") */
  id: string;
  label?: string;
  description?: string;
  to?: string | null;
  [k: string]: unknown;
}

export interface UserMailTemplateRecipient {
  /** Mail template name (acts as id in the API) */
  id: string;
  label?: string;
  description?: string;
  to?: string | null;
  enabled?: boolean;
  /** Comma-separated role identifiers used by the template (e.g. "account,admin") */
  roles?: string;
  [k: string]: unknown;
}

export async function fetchUserMailRoleRecipients(userId: number) {
  const res = await haveApiCall<UserMailRoleRecipient[]>({
    method: 'GET',
    path: `/users/${userId}/mail_role_recipients`,
  });

  return { ...res, data: expectArray<UserMailRoleRecipient>(res.data, 'users/mail_role_recipients#index') };
}

export async function updateUserMailRoleRecipient(userId: number, role: string, payload: { to?: string }) {
  return haveApiCall<UserMailRoleRecipient>({
    method: 'PUT',
    path: `/users/${userId}/mail_role_recipients/${encodeURIComponent(role)}`,
    namespace: 'mail_role_recipient',
    params: payload,
  });
}

export async function fetchUserMailTemplateRecipients(userId: number) {
  const res = await haveApiCall<UserMailTemplateRecipient[]>({
    method: 'GET',
    path: `/users/${userId}/mail_template_recipients`,
  });

  return { ...res, data: expectArray<UserMailTemplateRecipient>(res.data, 'users/mail_template_recipients#index') };
}

export async function updateUserMailTemplateRecipient(
  userId: number,
  templateName: string,
  payload: { to?: string; enabled?: boolean }
) {
  return haveApiCall<UserMailTemplateRecipient>({
    method: 'PUT',
    path: `/users/${userId}/mail_template_recipients/${encodeURIComponent(templateName)}`,
    namespace: 'mail_template_recipient',
    params: payload,
  });
}
