// Admin cluster locale barrel
import { enAdminCluster_dns_resolvers } from './adminCluster/dns_resolvers';
import { enAdminCluster_dns_servers } from './adminCluster/dns_servers';
import { enAdminCluster_dns_tsig } from './adminCluster/dns_tsig';
import { enAdminCluster_environments } from './adminCluster/environments';
import { enAdminCluster_locations } from './adminCluster/locations';
import { enAdminCluster_network_detail } from './adminCluster/network_detail';
import { enAdminCluster_networks } from './adminCluster/networks';
import { enAdminCluster_os_templates } from './adminCluster/os_templates';
import { enAdminCluster_resource_package_detail } from './adminCluster/resource_package_detail';
import { enAdminCluster_resource_packages } from './adminCluster/resource_packages';
import { enAdminCluster_subtitle } from './adminCluster/subtitle';
import { enAdminCluster_summary } from './adminCluster/summary';
import { enAdminCluster_system_config } from './adminCluster/system_config';
import { enAdminCluster_tab } from './adminCluster/tab';
import { enAdminCluster_title } from './adminCluster/title';

export const enAdminCluster = {
  ...enAdminCluster_dns_resolvers,
  ...enAdminCluster_dns_servers,
  ...enAdminCluster_dns_tsig,
  ...enAdminCluster_environments,
  ...enAdminCluster_locations,
  ...enAdminCluster_network_detail,
  ...enAdminCluster_networks,
  ...enAdminCluster_os_templates,
  ...enAdminCluster_resource_package_detail,
  ...enAdminCluster_resource_packages,
  ...enAdminCluster_subtitle,
  ...enAdminCluster_summary,
  ...enAdminCluster_system_config,
  ...enAdminCluster_tab,
  ...enAdminCluster_title,
} as const;
