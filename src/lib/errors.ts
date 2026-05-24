import { staticT } from './staticI18n';

/**
 * Convert an unknown value into a reasonably helpful, localized string.
 *
 * Use this for displaying errors coming from fetch/HaveAPI/etc.
 */

const EXACT_ERROR_KEYS: Record<string, string> = {
  'No record selected': 'errors.internal.no_record_selected',
  'No editor': 'errors.internal.no_editor',
  'Storage is unavailable': 'errors.internal.storage_unavailable',
  'Nothing to update': 'errors.internal.nothing_to_update',
};

const ERROR_ITEM_KEYS: Record<string, string> = {
  'id': 'errors.item.id',
  'mailbox id': 'errors.item.mailbox_id',
  'export id': 'errors.item.export_id',
  'template id': 'errors.item.template_id',
  'host id': 'errors.item.host_id',
  'chain id': 'errors.item.chain_id',
  'server': 'errors.item.server',
  'server zone': 'errors.item.server_zone',
  'host ip': 'errors.item.host_ip',
  'transfer': 'errors.item.transfer',
  'resolver': 'errors.item.resolver',
  'network': 'errors.item.network',
  'environment': 'errors.item.environment',
  'location': 'errors.item.location',
  'location network': 'errors.item.location_network',
  'target': 'errors.item.target',
  'record': 'errors.item.record',
  'cluster resource': 'errors.item.cluster_resource',
  'item': 'errors.item.item',
  'item id': 'errors.item.item_id',
  'user': 'errors.item.user',
  'user id': 'errors.item.user_id',
  'package': 'errors.item.package',
  'package id': 'errors.item.package_id',
  'recipient': 'errors.item.recipient',
  'handler': 'errors.item.handler',
  'port': 'errors.item.port',
  'form': 'errors.item.form',
  'prefix': 'errors.item.prefix',
  'value': 'errors.item.value',
  'days': 'errors.item.days',
  'remind-after date': 'errors.item.remind_after_date',
  'payment': 'errors.item.payment',
  'request': 'errors.item.request',
  'config': 'errors.item.config',
  'wizard device': 'errors.item.wizard_device',
  'namespace reference for this map': 'errors.item.namespace_reference_for_map',
  'key': 'errors.item.key',
  'template': 'errors.item.template',
  'ip': 'errors.item.ip_address',
  'dataset': 'errors.item.dataset',
};

function itemLabel(raw: string): string {
  const key = ERROR_ITEM_KEYS[String(raw ?? '').trim().toLowerCase()];
  return key ? staticT(key) : raw;
}

function localizeKnownErrorMessage(raw: string): string | null {
  const message = String(raw ?? '').trim();
  if (!message) return null;

  const exact = EXACT_ERROR_KEYS[message];
  if (exact) return staticT(exact);

  let match = message.match(/^invalid\s+(.+)$/i);
  if (match?.[1]) return staticT('errors.internal.invalid', { item: itemLabel(match[1]) });

  match = message.match(/^missing\s+(.+)$/i);
  if (match?.[1]) return staticT('errors.internal.missing', { item: itemLabel(match[1]) });

  match = message.match(/^no\s+(.+)$/i);
  if (match?.[1]) return staticT('errors.internal.none', { item: itemLabel(match[1]) });

  match = message.match(/^(.+)\s+missing$/i);
  if (match?.[1]) return staticT('errors.internal.missing', { item: itemLabel(match[1]) });

  return null;
}

export function stringifyUnknown(x: unknown): string {
  if (x === null) return staticT('errors.value.null');
  if (x === undefined) return staticT('errors.value.undefined');

  if (typeof x === 'string') return localizeKnownErrorMessage(x) ?? x;
  if (typeof x === 'number' || typeof x === 'boolean' || typeof x === 'bigint') return String(x);

  if (x instanceof Error) {
    const localized = localizeKnownErrorMessage(x.message || '');
    const name = x.name && x.name !== 'Error' ? `${x.name}: ` : '';
    return `${name}${(localized ?? x.message) || staticT('common.unknown_error')}`;
  }

  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

export function formatErrorMessage(x: unknown): string {
  return stringifyUnknown(x);
}
