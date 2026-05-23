# vpsAdmin HaveAPI / WebUI discovery report

Generated: 2026-01-20T12:09:08Z
- Parsed Ruby resource files: 76
- Detected resources (HaveAPI::Resource classes): 109
- Detected actions (sum of action classes): 410

## Key observations

- API is organized around **resources** and nested **actions**, with many custom non-CRUD actions (e.g. VPS start/stop/reinstall...).
- Old PHP web UI uses the **HaveAPI JS client** (haveapi-client.js) and maps to these actions, but navigation is admin-centric.
- There are **a lot** of admin-only management flows (cluster, IPAM, users, templates, sysconfig, help boxes, payments backoffice).

## API resource categories (by top-level resource name)

Sorted roughly by total action count (top 20 shown).

### User  (resources: 9, actions: 37)
- `User` — 7 actions — Manage users
- `User::TotpDevice` — 6 actions — route `{user_id}/totp_devices` — Manage TOTP devices
- `User::PublicKey` — 5 actions — route `{user_id}/public_keys` — Manage public keys
- `User::WebauthnCredential` — 4 actions — route `{user_id}/webauthn_credentials` — Manage WebAuthn credentials
- `User::ClusterResource` — 3 actions — route `{user_id}/cluster_resources` — Manage user's cluster resources
- `User::EnvironmentConfig` — 3 actions — route `{user_id}/environment_configs` — User settings per environment
- `User::KnownDevice` — 3 actions — route `{user_id}/known_devices` — Manage known login devices
- `User::MailRoleRecipient` — 3 actions — route `{user_id}/mail_role_recipients` — Manage user mail recipients
- `User::MailTemplateRecipient` — 3 actions — route `{user_id}/mail_template_recipients` — Manage user mail recipients

### VPS  (resources: 7, actions: 36)
- `VPS` — 16 actions — Manage VPS
- `VPS::Mount` — 5 actions — route `{vps_id}/mounts` — Manage mounts
- `VPS::Feature` — 4 actions — route `{vps_id}/features` — Toggle VPS features
- `VPS::MaintenanceWindow` — 4 actions — route `{vps_id}/maintenance_windows` — Manage VPS maintenance windows
- `VPS::ConsoleToken` — 3 actions — route `{vps_id}/console_token` — Remote console tokens
- `VPS::SshHostKey` — 2 actions — route `{vps_id}/ssh_host_keys` — View VPS SSH host keys
- `VPS::Status` — 2 actions — route `{vps_id}/statuses` — View VPS statuses in time

### Dataset  (resources: 4, actions: 19)
- `Dataset` — 8 actions — Manage datasets
- `Dataset::Snapshot` — 5 actions — route `{dataset_id}/snapshots` — Manage dataset snapshots
- `Dataset::Plan` — 4 actions — route `{dataset_id}/plans` — Manage dataset plans
- `Dataset::PropertyHistory` — 2 actions — route `{dataset_id}/property_history` — View property history

### MailTemplate  (resources: 3, actions: 14)
- `MailTemplate` — 5 actions — Manage mail templates
- `MailTemplate::Translation` — 5 actions — route `{mail_template_id}/translations` — Manage mail templates
- `MailTemplate::Recipient` — 4 actions — route `{mail_template_id}/recipients` — Manage mail recipients

### Outage  (resources: 3, actions: 14)
- `Outage` — 5 actions — Report and browse outages
- `Outage::Handler` — 5 actions — route `{outage_id}/handlers` — Outage handlers
- `Outage::Entity` — 4 actions — route `{outage_id}/entities` — Outage entities

### ClusterResourcePackage  (resources: 2, actions: 10)
- `ClusterResourcePackage` — 5 actions — Manage cluster resource packages
- `ClusterResourcePackage::Item` — 5 actions — route `{cluster_resource_package_id}/items` — Manage cluster resource package contents

### Export  (resources: 2, actions: 10)
- `Export` — 5 actions — Manage NFS exports
- `Export::Host` — 5 actions — route `{export_id}/hosts` — Manage allowed hosts

### Mailbox  (resources: 2, actions: 10)
- `Mailbox` — 5 actions — Manage mailboxes
- `Mailbox::Handler` — 5 actions — route `{mailbox_id}/handler` — Manage mailbox handlers

### UserNamespaceMap  (resources: 2, actions: 10)
- `UserNamespaceMap` — 5 actions — Browse user namespace maps
- `UserNamespaceMap::Entry` — 5 actions — route `{user_namespace_map_id}/entries` — Browse user namespace map entries

### MigrationPlan  (resources: 2, actions: 9)
- `MigrationPlan` — 6 actions — View migration plans
- `MigrationPlan::VpsMigration` — 3 actions — route `{migration_plan_id}/vps_migrations` — VPS migrations

### Node  (resources: 2, actions: 9)
- `Node` — 7 actions — Manage nodes
- `Node::Status` — 2 actions — route `{node_id}/statuses` — View node statuses in time

### DatasetExpansion  (resources: 2, actions: 8)
- `DatasetExpansion` — 5 actions — Browse dataset expansions
- `DatasetExpansion::History` — 3 actions — route `{dataset_expansion_id}/history` — Browse dataset expansion history

### OomReport  (resources: 4, actions: 8)
- `OomReport` — 2 actions — Out-of-memory kill reports
- `OomReport::Stat` — 2 actions — route `{oom_report_id}/stats` — Memory stats
- `OomReport::Task` — 2 actions — route `{oom_report_id}/tasks` — Task list
- `OomReport::Usage` — 2 actions — route `{oom_report_id}/usages` — Memory usage

### HostIpAddress  (resources: 1, actions: 7)
- `HostIpAddress` — 7 actions — Manage interface IP addresses

### IpAddress  (resources: 1, actions: 7)
- `IpAddress` — 7 actions — Manage IP addresses

### UserClusterResourcePackage  (resources: 2, actions: 7)
- `UserClusterResourcePackage` — 5 actions — Manage user cluster resource packages
- `UserClusterResourcePackage::Item` — 2 actions — route `{user_cluster_resource_package_id}/items` — View user cluster resource package contents

### DnsRecord  (resources: 1, actions: 6)
- `DnsRecord` — 6 actions — Manage DNS records

### Environment  (resources: 2, actions: 6)
- `Environment` — 4 actions — Manage environments
- `Environment::DatasetPlan` — 2 actions — route `{environment_id}/dataset_plans` — Manage environment dataset plans

### VpsUserData  (resources: 1, actions: 6)
- `VpsUserData` — 6 actions — Manage VPS user data

### MonitoredEvent  (resources: 2, actions: 6)
- `MonitoredEvent` — 4 actions — Browser monitored events
- `MonitoredEvent::Log` — 2 actions — route `{monitored_event_id}/logs` — Browse monitored event logs

## Top-level resources (all)

This is a quick index for UI coverage tracking.

| Resource | Actions | Route override | Description |
|---|---:|---|---|
| `ApiServer` | 1 |  | Manage the API server itself |
| `Cluster` | 5 |  | Manage cluster |
| `ClusterResource` | 4 |  | Manage environment resources |
| `ClusterResourcePackage` | 5 |  | Manage cluster resource packages |
| `Component` | 2 |  | Browse vpsAdmin components |
| `Dataset` | 8 |  | Manage datasets |
| `DatasetExpansion` | 5 |  | Browse dataset expansions |
| `DatasetPlan` | 2 |  | See dataset plans |
| `Debug` | 3 |  | Internal debug actions |
| `DefaultObjectClusterResource` | 5 |  | Manage default cluster resources values for objects |
| `DnsRecord` | 6 |  | Manage DNS records |
| `DnsRecordLog` | 2 |  | Browse DNS record logs |
| `DnsResolver` | 5 |  | Manage DNS resolvers |
| `DnsServer` | 5 |  | Manage authoritative DNS servers |
| `DnsServerZone` | 4 |  | Manage authoritative DNS zones on servers |
| `DnsTsigKey` | 4 |  | Manage DNS TSIG key transfers |
| `DnsZone` | 5 |  | Manage DNS zones |
| `DnsZoneTransfer` | 4 |  | Manage DNS zone transfers |
| `DnssecRecord` | 2 |  | View DNSSEC DNSKEY/DS records |
| `Environment` | 4 |  | Manage environments |
| `Export` | 5 |  | Manage NFS exports |
| `ExportOutage` | 2 |  | Browse exports affected by outages |
| `HelpBox` | 5 |  | Browse and manage help boxes |
| `HostIpAddress` | 7 |  | Manage interface IP addresses |
| `IncidentReport` | 3 |  | Manage incident reports |
| `IncomingPayment` | 3 |  | Browse incoming payments |
| `IpAddress` | 7 |  | Manage IP addresses |
| `IpAddressAssignment` | 2 |  | Browse IP address assignments |
| `Language` | 2 |  | Available languages |
| `Location` | 4 |  | Manage locations |
| `LocationNetwork` | 5 |  | Manage location networks |
| `MailLog` | 2 |  | Browse sent mails |
| `MailRecipient` | 5 |  | Manage mail recipients |
| `MailTemplate` | 5 |  | Manage mail templates |
| `Mailbox` | 5 |  | Manage mailboxes |
| `MetricsAccessToken` | 4 |  | Manage /metrics endpoint access tokens |
| `MigrationPlan` | 6 |  | View migration plans |
| `MonitoredEvent` | 4 |  | Browser monitored events |
| `Network` | 5 |  | Manage networks |
| `NetworkInterface` | 3 |  | Manage VPS network interfaces |
| `NetworkInterfaceAccounting` | 2 |  | Network interface accounting |
| `NetworkInterfaceMonitor` | 2 |  | View current network interface traffic |
| `NewsLog` | 5 |  | Browse and manage news |
| `Node` | 7 |  | Manage nodes |
| `Oauth2Client` | 5 |  | Manage OAuth2 clients |
| `ObjectHistory` | 2 |  | Browse object's history |
| `OomReport` | 2 |  | Out-of-memory kill reports |
| `OomReportRule` | 5 |  | Manage VPS OOM report rules |
| `OsFamily` | 5 |  | Manage OS families |
| `OsTemplate` | 5 |  | Manage OS templates |
| `Outage` | 5 |  | Report and browse outages |
| `OutageUpdate` | 3 |  | Browse outage updates |
| `PaymentStats` | 1 |  | View payment statistics |
| `Pool` | 3 |  | Manage storage pools |
| `SnapshotDownload` | 4 |  | Manage download links of dataset snapshots |
| `SystemConfig` | 3 |  | Query and set system configuration |
| `Transaction` | 2 |  | Access transactions linked in a chain |
| `TransactionChain` | 2 |  | Access transaction chains |
| `User` | 7 |  | Manage users |
| `UserAccount` | 3 |  | Manage user's payment settings |
| `UserClusterResourcePackage` | 5 |  | Manage user cluster resource packages |
| `UserNamespace` | 2 |  | Browse user namespaces |
| `UserNamespaceMap` | 5 |  | Browse user namespace maps |
| `UserOutage` | 2 |  | Browse users affected by outages |
| `UserPayment` | 3 |  | Manage user's payment settings |
| `UserRequest` | 0 |  |  |
| `UserSession` | 5 |  | Browse user sessions |
| `VPS` | 16 |  | Manage VPS |
| `VpsOutage` | 2 |  | Browse VPSes affected by outages |
| `VpsUserData` | 6 |  | Manage VPS user data |
| `Webauthn` | 0 | webauthn |  |

## Old PHP web UI pages/actions

Extracted from `webui/pages/page_*.php` by scanning for action case labels.

| Page | Action count | Notable actions (first 12) |
|---|---:|---|
| `page_adminm.php` | 63 | approval_requests, approve, auth_settings, cluster_resources, delete, delete2, delete3, deny, edit, edit_member, edit_mfa, edit_personal, … |
| `page_cluster.php` | 60 | cluster, dns, dns_delete, dns_edit, dns_edit_save, dns_new, dns_new_save, env_edit, env_save, environment, environments, eventlog, … |
| `page_adminvps.php` | 37 | autostart, boot, chown, chown_confirm, custom, delete, delete2, disable_network, enable_network, features, hostaddr_add, hostaddr_del, … |
| `page_dns.php` | 33 | dnssec_records, primary_zone_list, primary_zone_new, primary_zone_new2, ptr_list, record_delete, record_edit, record_edit2, record_log, record_new, record_toggle_ddns, record_toggle_enable, … |
| `page_networking.php` | 22 | assignments, host_ip_addresses, hostaddr_assign, hostaddr_assign2, hostaddr_delete, hostaddr_delete2, hostaddr_new, hostaddr_new2, hostaddr_ptr, hostaddr_ptr2, hostaddr_unassign, hostaddr_unassign2, … |
| `page_dataset.php` | 13 | add_expansion, destroy, edit, edit_expansion, expand_add_space, mount, mount_destroy, mount_edit, mount_toggle, new, plan_add, plan_delete, … |
| `page_backup.php` | 10 | download, download_destroy, download_link, downloads, nas, restore, snapshot, snapshot_create, snapshot_destroy, vps |
| `page_export.php` | 10 | add_host, create, del_host, destroy, disable, edit, edit_host, enable, export_dataset, list |
| `page_outage.php` | 10 | edit_attrs, edit_systems, exports, list, report, set_state, show, update, users, vps |
| `page_userns.php` | 9 | list, map_del, map_edit, map_entries_edit, map_entry_del, map_new, map_show, maps, show |
| `page_jumpto.php` | 6 | Export, IpAddress, Network, TransactionChain, User, Vps |
| `page_oom_reports.php` | 6 | list, rule_delete, rule_edit, rule_list, rule_new, show |
| `page_reminder.php` | 5 | 1w, 2w, date, never, set |
| `page_userdata.php` | 5 | delete, deploy, edit, list, new |
| `page_monitoring.php` | 4 | ack, ignore, list, show |
| `page_redirect.php` | 4 | host_ip_address, ip_address, payment, payset |
| `page_transactions.php` | 4 | done, failed, queued, rollbacking |
| `page_incidents.php` | 3 | list, new, show |
| `page_lifetimes.php` | 2 | changelog, set_state |
| `page_about.php` | 0 |  |
| `page_console.php` | 0 |  |
| `page_history.php` | 0 |  |
| `page_index.php` | 0 |  |
| `page_log.php` | 0 |  |
| `page_login.php` | 0 |  |
| `page_nas.php` | 0 |  |
| `page_node.php` | 0 |  |
