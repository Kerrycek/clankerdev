export type HelpBoxScope = 'public' | 'user' | 'admin';

export interface HelpBoxContext {
  page: string;
  action: string;
}

function isNumericSegment(value: string | undefined): boolean {
  return Boolean(value && /^\d+$/.test(value));
}

function baseContext(page: string, action: string): HelpBoxContext {
  return { page, action };
}

export function buildHelpBoxesManageUrl(ctx: HelpBoxContext): string {
  const sp = new URLSearchParams();
  sp.set('page', ctx.page);
  sp.set('action', ctx.action);
  return `/admin/content/help-boxes?${sp.toString()}`;
}

export function resolveHelpBoxContext(pathname: string, scope: HelpBoxScope): HelpBoxContext | null {
  const clean = String(pathname || '/').replace(/\/+/g, '/');

  if (scope === 'public') {
    if (clean === '/') return baseContext('public', 'index');
    if (clean === '/outages') return baseContext('outages', 'list');
    if (/^\/outages\/\d+$/.test(clean)) return baseContext('outages', 'detail');
    if (clean === '/news') return baseContext('news', 'list');
    if (/^\/requests\/registrations\/\d+\/[^/]+$/.test(clean)) return baseContext('requests', 'registration_correction');
    return null;
  }

  const prefix = scope === 'admin' ? '/admin' : '/app';
  if (!clean.startsWith(prefix)) return null;

  const rel = clean.slice(prefix.length);
  const parts = rel.split('/').filter(Boolean);

  if (parts.length === 0) return baseContext('dashboard', scope === 'admin' ? 'admin_index' : 'index');

  const [p0, p1, p2, p3] = parts;

  switch (p0) {
    case 'vps':
      if (!p1) return baseContext('vps', 'list');
      if (!isNumericSegment(p1)) return null;
      return baseContext('vps', p2 ?? 'overview');

    case 'datasets':
      if (!p1) return baseContext('datasets', 'list');
      if (!isNumericSegment(p1)) return null;
      return baseContext('datasets', p2 ?? 'overview');

    case 'nas':
      return baseContext('datasets', 'nas');

    case 'exports':
      return baseContext('exports', p1 ? 'detail' : 'list');

    case 'dns':
      if (!p1) return baseContext('dns', 'zones');
      if (p1 === 'zones' && isNumericSegment(p2)) {
        return baseContext('dns', p3 ?? 'records');
      }
      return null;

    case 'transactions':
      if (!p1) return baseContext('transactions', 'chains');
      if (p1 === 'items') return baseContext('transactions', p2 ? 'item_detail' : 'items');
      return baseContext('transactions', 'chain_detail');

    case 'action-states':
      return baseContext('transactions', p1 ? 'action_state_detail' : 'action_states');

    case 'monitoring':
      return baseContext('monitoring', p1 ? 'detail' : 'list');

    case 'incidents':
      if (scope === 'admin' && p1 === 'new') return baseContext('incidents', 'create');
      return baseContext('incidents', p1 ? (scope === 'admin' ? 'admin_detail' : 'detail') : (scope === 'admin' ? 'admin_list' : 'list'));

    case 'oom-reports':
      if (p1 === 'rules') return baseContext('oom_reports', 'rules');
      if (!p1) return baseContext('oom_reports', 'list');
      return baseContext('oom_reports', p2 ?? 'overview');

    case 'payments':
      if (scope === 'admin') {
        if (p1 === 'incoming') return baseContext('payments', p2 ? 'incoming_detail' : 'incoming');
      }
      return baseContext('payments', 'overview');

    case 'requests':
      if (!p1) return baseContext('requests', scope === 'admin' ? 'admin_list' : 'list');
      if (scope === 'admin') return baseContext('requests', p2 ? `admin_${p1}_detail` : 'admin_list');
      return baseContext('requests', p2 ? `${p1}_detail` : 'list');

    case 'profile':
      if (p1 === 'user-namespaces') {
        if (!p2) return baseContext('user_namespaces', 'index');
        if (p2 === 'namespaces') return baseContext('user_namespaces', p3 ? 'namespace_detail' : 'namespaces');
        if (p2 === 'maps') return baseContext('user_namespaces', p3 ? 'map_detail' : 'maps');
        return baseContext('user_namespaces', p2);
      }
      return baseContext('profile', p1 ?? 'overview');

    case 'users':
      if (!p1) return baseContext('users', 'list');
      if (!isNumericSegment(p1)) return null;
      return baseContext('users', p2 ?? 'overview');

    case 'user-namespaces':
      if (!p1) return baseContext('user_namespaces', 'index');
      if (p1 === 'namespaces') return baseContext('user_namespaces', p2 ? 'namespace_detail' : 'namespaces');
      if (p1 === 'maps') return baseContext('user_namespaces', p2 ? 'map_detail' : 'maps');
      return baseContext('user_namespaces', p1);


    case 'ip-addresses':
      return baseContext('networking', p1 ? 'ip_address_detail' : 'ip_addresses');

    case 'networking':
      if (p1 === 'ip-addresses') return baseContext('networking', p2 ? 'ip_address_detail' : 'ip_addresses');
      if (p1 === 'host-ip-addresses') return baseContext('networking', 'host_ip_addresses');
      if (p1 === 'ip-address-assignments') return baseContext('networking', 'ip_assignments');
      if (p1 === 'live') return baseContext('networking', 'live');
      if (p1 === 'traffic-users') return baseContext('networking', 'traffic_users');
      return baseContext('networking', p1 ?? 'ip_addresses');

    case 'mailer':
      if (p1 === 'templates') {
        if (p3 === 'translations') return baseContext('mailer', 'template_translation');
        return baseContext('mailer', p2 ? 'template_detail' : 'templates');
      }
      if (p1 === 'log') return baseContext('mailer', p2 ? 'log_detail' : 'log');
      if (p1 === 'mailboxes') return baseContext('mailer', p2 ? 'mailbox_detail' : 'mailboxes');
      if (p1 === 'recipients') return baseContext('mailer', 'recipients');
      return baseContext('mailer', p1 ?? 'templates');

    case 'content':
      return baseContext('content', p1 ?? 'news');

    case 'cluster':
      if (p1 === 'networks') return baseContext('cluster', p2 ? 'network_detail' : 'networks');
      if (p1 === 'resource-packages') return baseContext('cluster', p2 ? 'resource_package_detail' : 'resource_packages');
      return baseContext('cluster', p1 ?? 'summary');

    case 'audit':
      return baseContext('audit', p1 ? 'detail' : 'list');

    case 'nodes':
      return baseContext('nodes', p1 ? 'detail' : 'list');

    case 'migration-plans':
      return baseContext('migration_plans', p1 ? 'detail' : 'list');

    case 'admin-info':
      return baseContext('admin_info', 'overview');

    case 'design-sandbox':
      return baseContext('design_sandbox', 'index');

    default:
      return null;
  }
}
