import { useQuery } from '@tanstack/react-query';

import { fetchLocations, type Location } from '../../../lib/api/infra';
import { fetchLanguages, type Language } from '../../../lib/api/languages';
import { fetchNodes, type Node } from '../../../lib/api/nodes';
import { fetchOsTemplates, type OsTemplate } from '../../../lib/api/osTemplates';
import type { ResolveUserRequestAction } from '../../../lib/api/requests';
import { requestNodeSupportsTemplate, resourceId } from './RequestReviewModel';
import type { RequestReviewType, ReviewableRequest } from './RequestReviewTypes';

type SelectResource = {
  id: number;
  label?: string;
  name?: string;
  code?: string;
};

function withCurrentResource<T extends SelectResource>(items: T[], current: unknown): SelectResource[] {
  const currentId = resourceId(current);
  if (!currentId || items.some((item) => item.id === currentId)) return items;
  const record = current && typeof current === 'object' ? current as Record<string, unknown> : {};
  const readable = ['label', 'name', 'code']
    .map((key) => record[key])
    .find((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  return [{ ...record, id: currentId, label: readable ?? `#${currentId}` }, ...items];
}

export function useRequestResolveResources(options: {
  resolveOpen: boolean;
  overridesOpen: boolean;
  reqType: RequestReviewType;
  resolveAction: ResolveUserRequestAction;
  approveCreateVps: boolean;
  effectiveLocationId?: number;
  effectiveTemplateId?: number;
  request: ReviewableRequest;
}) {
  const isRegistration = options.reqType === 'registration';
  const showOverrides = options.resolveAction === 'approve' || options.resolveAction === 'request_correction';
  const nodePickerVisible = options.resolveOpen
    && isRegistration
    && options.resolveAction === 'approve'
    && options.approveCreateVps;

  const nodesQ = useQuery({
    queryKey: ['nodes', 'request-resolve', { location: options.effectiveLocationId }],
    enabled: nodePickerVisible,
    queryFn: async () => (await fetchNodes({
      limit: 200,
      state: 'active',
      location: options.effectiveLocationId,
      type: 'node',
      hypervisorType: 'vpsadminos',
    })).data,
  });

  const locationsQ = useQuery({
    queryKey: ['locations', 'requests', 'resolve'],
    enabled: options.resolveOpen && isRegistration && showOverrides && (options.overridesOpen || nodePickerVisible),
    queryFn: async () => (await fetchLocations({ limit: 500 })).data,
    staleTime: 60_000,
  });

  const templatesQ = useQuery({
    queryKey: ['os_templates', 'requests', 'resolve'],
    enabled: options.resolveOpen && isRegistration && showOverrides && (options.overridesOpen || nodePickerVisible),
    queryFn: async () => (await fetchOsTemplates({
      limit: 500,
      enabled: true,
      supported: true,
      hypervisorType: 'vpsadminos',
    })).data,
    staleTime: 60_000,
  });

  const languagesQ = useQuery({
    queryKey: ['languages', 'requests', 'resolve'],
    enabled: options.resolveOpen && options.overridesOpen && isRegistration && showOverrides,
    queryFn: async () => (await fetchLanguages({ limit: 250 })).data,
    staleTime: 60_000,
  });

  const locations = withCurrentResource<Location>(locationsQ.data ?? [], options.request.location);
  const templates = withCurrentResource<OsTemplate>(templatesQ.data ?? [], options.request.os_template);
  const languages = withCurrentResource<Language>(languagesQ.data ?? [], options.request.language);
  const effectiveTemplate = templates.find((template) => template.id === options.effectiveTemplateId);
  const nodes = (nodesQ.data ?? []).filter((node) => requestNodeSupportsTemplate(node, effectiveTemplate));

  return {
    locations,
    templates,
    languages,
    nodes,
    overrideResourcesLoading: locationsQ.isFetching || templatesQ.isFetching || languagesQ.isFetching,
    overrideResourcesError: locationsQ.isError || templatesQ.isError || languagesQ.isError,
    retryOverrideResources: () => {
      void locationsQ.refetch();
      void templatesQ.refetch();
      void languagesQ.refetch();
    },
    nodeResourcesLoading: nodesQ.isFetching || templatesQ.isFetching,
    nodeResourcesError: nodesQ.isError || templatesQ.isError,
    retryNodeResources: () => {
      void nodesQ.refetch();
      void templatesQ.refetch();
    },
  } satisfies {
    locations: SelectResource[];
    templates: SelectResource[];
    languages: SelectResource[];
    nodes: Node[];
    overrideResourcesLoading: boolean;
    overrideResourcesError: boolean;
    retryOverrideResources: () => void;
    nodeResourcesLoading: boolean;
    nodeResourcesError: boolean;
    retryNodeResources: () => void;
  };
}
