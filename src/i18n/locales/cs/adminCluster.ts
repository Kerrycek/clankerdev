// Admin cluster locale barrel
import { csAdminCluster_dns_resolvers } from './adminCluster/dns_resolvers';
import { csAdminCluster_dns_servers } from './adminCluster/dns_servers';
import { csAdminCluster_dns_tsig } from './adminCluster/dns_tsig';
import { csAdminCluster_environments } from './adminCluster/environments';
import { csAdminCluster_locations } from './adminCluster/locations';
import { csAdminCluster_network_detail } from './adminCluster/network_detail';
import { csAdminCluster_networks } from './adminCluster/networks';
import { csAdminCluster_os_templates } from './adminCluster/os_templates';
import { csAdminCluster_resource_package_detail } from './adminCluster/resource_package_detail';
import { csAdminCluster_resource_packages } from './adminCluster/resource_packages';
import { csAdminCluster_subtitle } from './adminCluster/subtitle';
import { csAdminCluster_summary } from './adminCluster/summary';
import { csAdminCluster_system_config } from './adminCluster/system_config';
import { csAdminCluster_tab } from './adminCluster/tab';
import { csAdminCluster_title } from './adminCluster/title';

export const csAdminCluster = {
  ...csAdminCluster_dns_resolvers,
  ...csAdminCluster_dns_servers,
  ...csAdminCluster_dns_tsig,
  ...csAdminCluster_environments,
  ...csAdminCluster_locations,
  ...csAdminCluster_network_detail,
  ...csAdminCluster_networks,
  ...csAdminCluster_os_templates,
  ...csAdminCluster_resource_package_detail,
  ...csAdminCluster_resource_packages,
  ...csAdminCluster_subtitle,
  ...csAdminCluster_summary,
  ...csAdminCluster_system_config,
  ...csAdminCluster_tab,
  ...csAdminCluster_title,
} as const;
