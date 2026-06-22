import type { NavigateFunction } from 'react-router-dom';

import type { Node } from '../../../lib/api/nodes';
import type { User } from '../../../lib/api/users';
import { parseNumericToken } from '../../../lib/smartFilter';
import type { SmartFilterSuggestion } from '../../../components/ui/SmartFilterInput';

import type { VpsListStateFilter, VpsListTranslator } from './vpsListSemantics';

export const stateFilterValues: VpsListStateFilter[] = ['running', 'stopped', 'busy', 'failed'];

export function stateFilterLabelKey(value: VpsListStateFilter): string {
  return `vps.list.filter.state.${value}`;
}

interface BuildVpsListSmartSuggestionsArgs {
  needle: string;
  basePath: string;
  mode: 'app' | 'admin';
  t: VpsListTranslator;
  navigate: NavigateFunction;
  users: User[];
  nodes: Node[];
  setHelpOpen: (open: boolean) => void;
  setSmart: (value: string) => void;
  setSmartErrors: (errors: string[]) => void;
  setSearch: (value: string) => void;
  setUserId: (value: string) => void;
  setNodeId: (value: string) => void;
  setLocationId: (value: string) => void;
  setUserNamespaceMapId: (value: string) => void;
  setStateFilter: (value: VpsListStateFilter) => void;
  applySmartText: (value: string) => void;
}

function clearSmart(args: Pick<BuildVpsListSmartSuggestionsArgs, 'setSmart' | 'setSmartErrors'>) {
  args.setSmart('');
  args.setSmartErrors([]);
}

export function buildVpsListSmartSuggestions(args: BuildVpsListSmartSuggestionsArgs): SmartFilterSuggestion[] {
  const { needle, basePath, mode, t, navigate } = args;
  if (!needle) return [];

  if (needle === '?') {
    return [
      {
        id: 'help',
        primary: t('filters.help.title'),
        secondary: t('filters.help.suggestion.secondary'),
        onPick: () => args.setHelpOpen(true),
        testId: 'vps.smart_filter.suggest.help',
      },
    ];
  }

  const suggestions: SmartFilterSuggestion[] = [];
  const numeric = parseNumericToken(needle);

  if (numeric !== null) {
    const id = String(numeric);
    suggestions.push({
      id: 'open',
      primary: t('filters.smart.suggest.open_vps', { id }),
      secondary: t('filters.smart.suggest.open_vps.secondary'),
      onPick: () => {
        clearSmart(args);
        navigate(`${basePath}/vps/${id}`);
      },
      testId: 'vps.smart_filter.suggest.open',
    });
    suggestions.push({
      id: 'hostname',
      primary: t('filters.smart.suggest.hostname', { value: id }),
      secondary: t('filters.smart.suggest.hostname.secondary'),
      onPick: () => {
        args.setSearch(id);
        clearSmart(args);
      },
      testId: 'vps.smart_filter.suggest.hostname',
    });

    if (mode === 'admin') {
      suggestions.push({
        id: 'user',
        primary: t('filters.smart.suggest.user_id', { id }),
        secondary: t('filters.smart.suggest.user_id.secondary'),
        onPick: () => {
          args.setUserId(id);
          clearSmart(args);
        },
        testId: 'vps.smart_filter.suggest.user',
      });
      suggestions.push({
        id: 'node',
        primary: t('filters.smart.suggest.node_id', { id }),
        secondary: t('filters.smart.suggest.node_id.secondary'),
        onPick: () => {
          args.setNodeId(id);
          clearSmart(args);
        },
        testId: 'vps.smart_filter.suggest.node',
      });
      suggestions.push({
        id: 'location',
        primary: t('vps.list.smart.suggest.location_id', { id }),
        secondary: t('vps.list.smart.suggest.location_id.secondary'),
        onPick: () => {
          args.setLocationId(id);
          clearSmart(args);
        },
        testId: 'vps.smart_filter.suggest.location',
      });
      suggestions.push({
        id: 'map',
        primary: t('filters.smart.suggest.map_id', { id }),
        secondary: t('filters.smart.suggest.map_id.secondary'),
        onPick: () => {
          args.setUserNamespaceMapId(id);
          clearSmart(args);
        },
        testId: 'vps.smart_filter.suggest.map',
      });
    }

    return suggestions;
  }

  if (needle.includes(':')) {
    suggestions.push({
      id: 'apply',
      primary: t('filters.smart.suggest.apply.primary'),
      secondary: t('filters.smart.suggest.apply.secondary'),
      onPick: () => args.applySmartText(needle),
      testId: 'vps.smart_filter.suggest.apply',
    });
    return suggestions;
  }

  const low = needle.toLowerCase();
  for (const value of stateFilterValues) {
    const label = t(stateFilterLabelKey(value));
    if (!value.startsWith(low) && !label.toLowerCase().startsWith(low)) continue;
    suggestions.push({
      id: `state.${value}`,
      primary: t('vps.list.smart.suggest.state', { state: label }),
      secondary: t('vps.list.smart.suggest.state.secondary'),
      onPick: () => {
        args.setStateFilter(value);
        clearSmart(args);
      },
      testId: `vps.smart_filter.suggest.state.${value}`,
    });
  }

  suggestions.push({
    id: 'hostname',
    primary: t('vps.list.smart.suggest.hostname_or_ip', { value: needle }),
    secondary: t('vps.list.smart.suggest.hostname_or_ip.secondary'),
    onPick: () => {
      args.setSearch(needle);
      clearSmart(args);
    },
    testId: 'vps.smart_filter.suggest.hostname',
  });

  if (mode === 'admin') {
    for (const user of args.users.slice(0, 5)) {
      suggestions.push({
        id: `user.${user.id}`,
        primary: t('filters.smart.suggest.user_login', { login: user.login }),
        secondary: `#${user.id}`,
        onPick: () => {
          args.setUserId(String(user.id));
          clearSmart(args);
        },
        testId: `vps.smart_filter.suggest.user.${user.id}`,
      });
    }

    for (const node of args.nodes
      .filter((item) => String(item.domain_name ?? item.name ?? '').toLowerCase().includes(low))
      .slice(0, 4)) {
      suggestions.push({
        id: `node.${node.id}`,
        primary: t('filters.smart.suggest.node_name', {
          name: String(node.domain_name ?? node.name ?? node.id),
        }),
        secondary: `#${node.id}`,
        onPick: () => {
          args.setNodeId(String(node.id));
          clearSmart(args);
        },
        testId: `vps.smart_filter.suggest.node.${node.id}`,
      });
    }
  }

  return suggestions;
}
