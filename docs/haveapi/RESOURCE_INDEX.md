# HaveAPI resource index (generated)

This index is generated from the discovery artefacts and is intended as a quick navigation aid.

Sources:
- `docs/discovery/haveapi_resources_actions_v2.json`
- HaveAPI Ruby sources under `vpsadmin/api/` and `vpsadmin/plugins/`

## Resources

### `ApiServer`

- Full const: `VpsAdmin::API::Resources::ApiServer`
- Source: `api/lib/vpsadmin/api/resources/api_server.rb`:2
- Actions (1): `UnlockTransactionSigningKey`

### `Cluster`

- Full const: `VpsAdmin::API::Resources::Cluster`
- Source: `api/lib/vpsadmin/api/resources/cluster.rb`:1
- Actions (5): `FullStats`, `GenerateMigrationKeys`, `PublicStats`, `Search`, `Show`

### `ClusterResource`

- Full const: `VpsAdmin::API::Resources::ClusterResource`
- Source: `api/lib/vpsadmin/api/resources/cluster_resource.rb`:2
- Actions (4): `Create`, `Index`, `Show`, `Update`

### `ClusterResourcePackage`

- Full const: `VpsAdmin::API::Resources::ClusterResourcePackage`
- Source: `api/lib/vpsadmin/api/resources/cluster_resource_package.rb`:2
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `ClusterResourcePackage::Item`

- Full const: `VpsAdmin::API::Resources::ClusterResourcePackage::Item`
- Source: `api/lib/vpsadmin/api/resources/cluster_resource_package.rb`:139
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `Component`

- Full const: `VpsAdmin::API::Resources::Component`
- Source: `api/lib/vpsadmin/api/resources/component.rb`:2
- Actions (2): `Index`, `Show`

### `Dataset`

- Full const: `VpsAdmin::API::Resources::Dataset`
- Source: `api/lib/vpsadmin/api/resources/dataset.rb`:2
- Actions (8): `Create`, `Delete`, `FindByName`, `Index`, `Inherit`, `Migrate`, `Show`, `Update`

### `Dataset::Plan`

- Full const: `VpsAdmin::API::Resources::Dataset::Plan`
- Source: `api/lib/vpsadmin/api/resources/dataset.rb`:677
- Actions (4): `Create`, `Delete`, `Index`, `Show`

### `Dataset::PropertyHistory`

- Full const: `VpsAdmin::API::Resources::Dataset::PropertyHistory`
- Source: `api/lib/vpsadmin/api/resources/dataset.rb`:795
- Actions (2): `Index`, `Show`

### `Dataset::Snapshot`

- Full const: `VpsAdmin::API::Resources::Dataset::Snapshot`
- Source: `api/lib/vpsadmin/api/resources/dataset.rb`:456
- Actions (5): `Create`, `Delete`, `Index`, `Rollback`, `Show`

### `DatasetExpansion`

- Full const: `VpsAdmin::API::Resources::DatasetExpansion`
- Source: `api/lib/vpsadmin/api/resources/dataset_expansion.rb`:2
- Actions (5): `Create`, `Index`, `RegisterExpanded`, `Show`, `Update`

### `DatasetExpansion::History`

- Full const: `VpsAdmin::API::Resources::DatasetExpansion::History`
- Source: `api/lib/vpsadmin/api/resources/dataset_expansion.rb`:203
- Actions (3): `Create`, `Index`, `Show`

### `DatasetPlan`

- Full const: `VpsAdmin::API::Resources::DatasetPlan`
- Source: `api/lib/vpsadmin/api/resources/dataset_plan.rb`:1
- Actions (2): `Index`, `Show`

### `Debug`

- Full const: `VpsAdmin::API::Resources::Debug`
- Source: `api/lib/vpsadmin/api/resources/debug.rb`:4
- Actions (3): `ArrayTop`, `HashTop`, `ListObjectCounts`

### `DefaultObjectClusterResource`

- Full const: `VpsAdmin::API::Resources::DefaultObjectClusterResource`
- Source: `api/lib/vpsadmin/api/resources/default_object_cluster_resource.rb`:2
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `DnsRecord`

- Full const: `VpsAdmin::API::Resources::DnsRecord`
- Source: `api/lib/vpsadmin/api/resources/dns_record.rb`:2
- Actions (6): `Create`, `Delete`, `DynamicUpdate`, `Index`, `Show`, `Update`

### `DnsRecordLog`

- Full const: `VpsAdmin::API::Resources::DnsRecordLog`
- Source: `api/lib/vpsadmin/api/resources/dns_record_log.rb`:2
- Actions (2): `Index`, `Show`

### `DnsResolver`

- Full const: `VpsAdmin::API::Resources::DnsResolver`
- Source: `api/lib/vpsadmin/api/resources/dns_resolver.rb`:1
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `DnsServer`

- Full const: `VpsAdmin::API::Resources::DnsServer`
- Source: `api/lib/vpsadmin/api/resources/dns_server.rb`:2
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `DnsServerZone`

- Full const: `VpsAdmin::API::Resources::DnsServerZone`
- Source: `api/lib/vpsadmin/api/resources/dns_server_zone.rb`:2
- Actions (4): `Create`, `Delete`, `Index`, `Show`

### `DnsTsigKey`

- Full const: `VpsAdmin::API::Resources::DnsTsigKey`
- Source: `api/lib/vpsadmin/api/resources/dns_tsig_key.rb`:2
- Actions (4): `Create`, `Delete`, `Index`, `Show`

### `DnsZone`

- Full const: `VpsAdmin::API::Resources::DnsZone`
- Source: `api/lib/vpsadmin/api/resources/dns_zone.rb`:2
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `DnsZoneTransfer`

- Full const: `VpsAdmin::API::Resources::DnsZoneTransfer`
- Source: `api/lib/vpsadmin/api/resources/dns_zone_transfer.rb`:2
- Actions (4): `Create`, `Delete`, `Index`, `Show`

### `DnssecRecord`

- Full const: `VpsAdmin::API::Resources::DnssecRecord`
- Source: `api/lib/vpsadmin/api/resources/dnssec_record.rb`:2
- Actions (2): `Index`, `Show`

### `Environment`

- Full const: `VpsAdmin::API::Resources::Environment`
- Source: `api/lib/vpsadmin/api/resources/environment.rb`:1
- Actions (4): `Create`, `Index`, `Show`, `Update`

### `Environment::DatasetPlan`

- Full const: `VpsAdmin::API::Resources::Environment::DatasetPlan`
- Source: `api/lib/vpsadmin/api/resources/environment.rb`:221
- Actions (2): `Index`, `Show`

### `Export`

- Full const: `VpsAdmin::API::Resources::Export`
- Source: `api/lib/vpsadmin/api/resources/export.rb`:1
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `Export::Host`

- Full const: `VpsAdmin::API::Resources::Export::Host`
- Source: `api/lib/vpsadmin/api/resources/export.rb`:227
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `ExportOutage`

- Full const: `VpsAdmin::API::Resources::ExportOutage`
- Source: `plugins/outage_reports/api/resources/export_outage.rb`:2
- Actions (2): `Index`, `Show`

### `HelpBox`

- Full const: `VpsAdmin::API::Resources::HelpBox`
- Source: `plugins/webui/api/resources/help_box.rb`:2
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `HostIpAddress`

- Full const: `VpsAdmin::API::Resources::HostIpAddress`
- Source: `api/lib/vpsadmin/api/resources/host_ip_address.rb`:2
- Actions (7): `Assign`, `Create`, `Delete`, `Free`, `Index`, `Show`, `Update`

### `IncidentReport`

- Full const: `VpsAdmin::API::Resources::IncidentReport`
- Source: `api/lib/vpsadmin/api/resources/incident_report.rb`:2
- Actions (3): `Create`, `Index`, `Show`

### `IncomingPayment`

- Full const: `VpsAdmin::API::Resources::IncomingPayment`
- Source: `plugins/payments/api/resources/incoming_payment.rb`:2
- Actions (3): `Index`, `Show`, `Update`

### `IpAddress`

- Full const: `VpsAdmin::API::Resources::IpAddress`
- Source: `api/lib/vpsadmin/api/resources/ip_address.rb`:1
- Actions (7): `Assign`, `AssignWithHostAddress`, `Create`, `Free`, `Index`, `Show`, `Update`

### `IpAddressAssignment`

- Full const: `VpsAdmin::API::Resources::IpAddressAssignment`
- Source: `api/lib/vpsadmin/api/resources/ip_address_assignment.rb`:2
- Actions (2): `Index`, `Show`

### `Language`

- Full const: `VpsAdmin::API::Resources::Language`
- Source: `api/lib/vpsadmin/api/resources/language.rb`:2
- Actions (2): `Index`, `Show`

### `Location`

- Full const: `VpsAdmin::API::Resources::Location`
- Source: `api/lib/vpsadmin/api/resources/location.rb`:1
- Actions (4): `Create`, `Index`, `Show`, `Update`

### `LocationNetwork`

- Full const: `VpsAdmin::API::Resources::LocationNetwork`
- Source: `api/lib/vpsadmin/api/resources/location_network.rb`:2
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `MailLog`

- Full const: `VpsAdmin::API::Resources::MailLog`
- Source: `api/lib/vpsadmin/api/resources/mail_log.rb`:2
- Actions (2): `Index`, `Show`

### `MailRecipient`

- Full const: `VpsAdmin::API::Resources::MailRecipient`
- Source: `api/lib/vpsadmin/api/resources/mail_recipient.rb`:2
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `MailTemplate`

- Full const: `VpsAdmin::API::Resources::MailTemplate`
- Source: `api/lib/vpsadmin/api/resources/mail_template.rb`:2
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `MailTemplate::Recipient`

- Full const: `VpsAdmin::API::Resources::MailTemplate::Recipient`
- Source: `api/lib/vpsadmin/api/resources/mail_template.rb`:131
- Actions (4): `Create`, `Delete`, `Index`, `Show`

### `MailTemplate::Translation`

- Full const: `VpsAdmin::API::Resources::MailTemplate::Translation`
- Source: `api/lib/vpsadmin/api/resources/mail_template.rb`:242
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `Mailbox`

- Full const: `VpsAdmin::API::Resources::Mailbox`
- Source: `api/lib/vpsadmin/api/resources/mailbox.rb`:2
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `Mailbox::Handler`

- Full const: `VpsAdmin::API::Resources::Mailbox::Handler`
- Source: `api/lib/vpsadmin/api/resources/mailbox.rb`:125
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `MetricsAccessToken`

- Full const: `VpsAdmin::API::Resources::MetricsAccessToken`
- Source: `api/lib/vpsadmin/api/resources/metrics_access_token.rb`:2
- Actions (4): `Create`, `Delete`, `Index`, `Show`

### `MigrationPlan`

- Full const: `VpsAdmin::API::Resources::MigrationPlan`
- Source: `api/lib/vpsadmin/api/resources/migration_plan.rb`:2
- Actions (6): `Cancel`, `Create`, `Delete`, `Index`, `Show`, `Start`

### `MigrationPlan::VpsMigration`

- Full const: `VpsAdmin::API::Resources::MigrationPlan::VpsMigration`
- Source: `api/lib/vpsadmin/api/resources/migration_plan.rb`:162
- Actions (3): `Create`, `Index`, `Show`

### `MonitoredEvent`

- Full const: `VpsAdmin::API::Resources::MonitoredEvent`
- Source: `plugins/monitoring/api/resources/monitored_event.rb`:2
- Actions (4): `Acknowledge`, `Ignore`, `Index`, `Show`

### `MonitoredEvent::Log`

- Full const: `VpsAdmin::API::Resources::MonitoredEvent::Log`
- Source: `plugins/monitoring/api/resources/monitored_event.rb`:187
- Actions (2): `Index`, `Show`

### `Network`

- Full const: `VpsAdmin::API::Resources::Network`
- Source: `api/lib/vpsadmin/api/resources/network.rb`:2
- Actions (5): `AddAddresses`, `Create`, `Index`, `Show`, `Update`

### `NetworkInterface`

- Full const: `VpsAdmin::API::Resources::NetworkInterface`
- Source: `api/lib/vpsadmin/api/resources/network_interface.rb`:2
- Actions (3): `Index`, `Show`, `Update`

### `NetworkInterfaceAccounting`

- Full const: `VpsAdmin::API::Resources::NetworkInterfaceAccounting`
- Source: `api/lib/vpsadmin/api/resources/network_interface_accounting.rb`:2
- Actions (2): `Index`, `UserTop`

### `NetworkInterfaceMonitor`

- Full const: `VpsAdmin::API::Resources::NetworkInterfaceMonitor`
- Source: `api/lib/vpsadmin/api/resources/network_interface_monitor.rb`:2
- Actions (2): `Index`, `Show`

### `NewsLog`

- Full const: `VpsAdmin::API::Resources::NewsLog`
- Source: `plugins/newslog/api/resources/news_log.rb`:2
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `Node`

- Full const: `VpsAdmin::API::Resources::Node`
- Source: `api/lib/vpsadmin/api/resources/node.rb`:1
- Actions (7): `Create`, `Evacuate`, `Index`, `OverviewList`, `PublicStatus`, `Show`, `Update`

### `Node::Status`

- Full const: `VpsAdmin::API::Resources::Node::Status`
- Source: `api/lib/vpsadmin/api/resources/node.rb`:438
- Actions (2): `Index`, `Show`

### `Oauth2Client`

- Full const: `VpsAdmin::API::Resources::Oauth2Client`
- Source: `api/lib/vpsadmin/api/resources/oauth2_client.rb`:2
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `ObjectHistory`

- Full const: `VpsAdmin::API::Resources::ObjectHistory`
- Source: `api/lib/vpsadmin/api/resources/object_history.rb`:2
- Actions (2): `Index`, `Show`

### `OomReport`

- Full const: `VpsAdmin::API::Resources::OomReport`
- Source: `api/lib/vpsadmin/api/resources/oom_report.rb`:2
- Actions (2): `Index`, `Show`

### `OomReport::Stat`

- Full const: `VpsAdmin::API::Resources::OomReport::Stat`
- Source: `api/lib/vpsadmin/api/resources/oom_report.rb`:180
- Actions (2): `Index`, `Show`

### `OomReport::Task`

- Full const: `VpsAdmin::API::Resources::OomReport::Task`
- Source: `api/lib/vpsadmin/api/resources/oom_report.rb`:245
- Actions (2): `Index`, `Show`

### `OomReport::Usage`

- Full const: `VpsAdmin::API::Resources::OomReport::Usage`
- Source: `api/lib/vpsadmin/api/resources/oom_report.rb`:113
- Actions (2): `Index`, `Show`

### `OomReportRule`

- Full const: `VpsAdmin::API::Resources::OomReportRule`
- Source: `api/lib/vpsadmin/api/resources/oom_report_rule.rb`:2
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `OsFamily`

- Full const: `VpsAdmin::API::Resources::OsFamily`
- Source: `api/lib/vpsadmin/api/resources/os_family.rb`:2
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `OsTemplate`

- Full const: `VpsAdmin::API::Resources::OsTemplate`
- Source: `api/lib/vpsadmin/api/resources/os_template.rb`:1
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `Outage`

- Full const: `VpsAdmin::API::Resources::Outage`
- Source: `plugins/outage_reports/api/resources/outage.rb`:2
- Actions (5): `Create`, `Index`, `RebuildAffectedVps`, `Show`, `Update`

### `Outage::Entity`

- Full const: `VpsAdmin::API::Resources::Outage::Entity`
- Source: `plugins/outage_reports/api/resources/outage.rb`:309
- Actions (4): `Create`, `Delete`, `Index`, `Show`

### `Outage::Handler`

- Full const: `VpsAdmin::API::Resources::Outage::Handler`
- Source: `plugins/outage_reports/api/resources/outage.rb`:419
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `OutageUpdate`

- Full const: `VpsAdmin::API::Resources::OutageUpdate`
- Source: `plugins/outage_reports/api/resources/outage_update.rb`:4
- Actions (3): `Create`, `Index`, `Show`

### `PaymentStats`

- Full const: `VpsAdmin::API::Resources::PaymentStats`
- Source: `plugins/payments/api/resources/payment_stats.rb`:2
- Actions (1): `EstimateIncome`

### `Pool`

- Full const: `VpsAdmin::API::Resources::Pool`
- Source: `api/lib/vpsadmin/api/resources/pool.rb`:2
- Actions (3): `Create`, `Index`, `Show`

### `SnapshotDownload`

- Full const: `VpsAdmin::API::Resources::SnapshotDownload`
- Source: `api/lib/vpsadmin/api/resources/snapshot_download.rb`:2
- Actions (4): `Create`, `Delete`, `Index`, `Show`

### `SystemConfig`

- Full const: `VpsAdmin::API::Resources::SystemConfig`
- Source: `api/lib/vpsadmin/api/resources/system_config.rb`:2
- Actions (3): `Index`, `Show`, `Update`

### `Transaction`

- Full const: `VpsAdmin::API::Resources::Transaction`
- Source: `api/lib/vpsadmin/api/resources/transaction.rb`:2
- Actions (2): `Index`, `Show`

### `TransactionChain`

- Full const: `VpsAdmin::API::Resources::TransactionChain`
- Source: `api/lib/vpsadmin/api/resources/transaction_chain.rb`:1
- Actions (2): `Index`, `Show`

### `User`

- Full const: `VpsAdmin::API::Resources::User`
- Source: `api/lib/vpsadmin/api/resources/user.rb`:1
- Actions (8): `Create`, `Current`, `Delete`, `GetPaymentInstructions`, `Index`, `Show`, `Touch`, `Update`

### `User::ClusterResource`

- Full const: `VpsAdmin::API::Resources::User::ClusterResource`
- Source: `api/lib/vpsadmin/api/resources/user.rb`:462
- Actions (3): `Create`, `Index`, `Show`

### `User::EnvironmentConfig`

- Full const: `VpsAdmin::API::Resources::User::EnvironmentConfig`
- Source: `api/lib/vpsadmin/api/resources/user.rb`:350
- Actions (3): `Index`, `Show`, `Update`

### `User::KnownDevice`

- Full const: `VpsAdmin::API::Resources::User::KnownDevice`
- Source: `api/lib/vpsadmin/api/resources/user.rb`:575
- Actions (3): `Delete`, `Index`, `Show`

### `User::MailRoleRecipient`

- Full const: `VpsAdmin::API::Resources::User::MailRoleRecipient`
- Source: `api/lib/vpsadmin/api/resources/user.rb`:1159
- Actions (3): `Index`, `Show`, `Update`

### `User::MailTemplateRecipient`

- Full const: `VpsAdmin::API::Resources::User::MailTemplateRecipient`
- Source: `api/lib/vpsadmin/api/resources/user.rb`:1251
- Actions (3): `Index`, `Show`, `Update`

### `User::PublicKey`

- Full const: `VpsAdmin::API::Resources::User::PublicKey`
- Source: `api/lib/vpsadmin/api/resources/user.rb`:1008
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `User::TotpDevice`

- Full const: `VpsAdmin::API::Resources::User::TotpDevice`
- Source: `api/lib/vpsadmin/api/resources/user.rb`:666
- Actions (6): `Confirm`, `Create`, `Delete`, `Index`, `Show`, `Update`

### `User::WebauthnCredential`

- Full const: `VpsAdmin::API::Resources::User::WebauthnCredential`
- Source: `api/lib/vpsadmin/api/resources/user.rb`:882
- Actions (4): `Delete`, `Index`, `Show`, `Update`

### `UserAccount`

- Full const: `VpsAdmin::API::Resources::UserAccount`
- Source: `plugins/payments/api/resources/user_account.rb`:2
- Actions (3): `Index`, `Show`, `Update`

### `UserClusterResourcePackage`

- Full const: `VpsAdmin::API::Resources::UserClusterResourcePackage`
- Source: `api/lib/vpsadmin/api/resources/user_cluster_resource_package.rb`:1
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `UserClusterResourcePackage::Item`

- Full const: `VpsAdmin::API::Resources::UserClusterResourcePackage::Item`
- Source: `api/lib/vpsadmin/api/resources/user_cluster_resource_package.rb`:163
- Actions (2): `Index`, `Show`

### `UserNamespace`

- Full const: `VpsAdmin::API::Resources::UserNamespace`
- Source: `api/lib/vpsadmin/api/resources/user_namespace.rb`:1
- Actions (2): `Index`, `Show`

### `UserNamespaceMap`

- Full const: `VpsAdmin::API::Resources::UserNamespaceMap`
- Source: `api/lib/vpsadmin/api/resources/user_namespace_map.rb`:1
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `UserNamespaceMap::Entry`

- Full const: `VpsAdmin::API::Resources::UserNamespaceMap::Entry`
- Source: `api/lib/vpsadmin/api/resources/user_namespace_map.rb`:158
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `UserOutage`

- Full const: `VpsAdmin::API::Resources::UserOutage`
- Source: `plugins/outage_reports/api/resources/user_outage.rb`:2
- Actions (2): `Index`, `Show`

### `UserPayment`

- Full const: `VpsAdmin::API::Resources::UserPayment`
- Source: `plugins/payments/api/resources/user_payment.rb`:2
- Actions (3): `Create`, `Index`, `Show`

### `UserRequest`

- Full const: `VpsAdmin::API::Resources::UserRequest`
- Source: `plugins/requests/api/resources/user_request.rb`:2
- Actions (0): (none)

### `UserRequest::Change`

- Full const: `VpsAdmin::API::Resources::UserRequest::Change`
- Source: `plugins/requests/api/resources/change.rb`:3
- Actions (0): (none)

### `UserRequest::Registration`

- Full const: `VpsAdmin::API::Resources::UserRequest::Registration`
- Source: `plugins/requests/api/resources/registration.rb`:3
- Actions (2): `Preview`, `Update`

### `UserSession`

- Full const: `VpsAdmin::API::Resources::UserSession`
- Source: `api/lib/vpsadmin/api/resources/user_session.rb`:2
- Actions (5): `Close`, `Create`, `Index`, `Show`, `Update`

### `VPS`

- Full const: `VpsAdmin::API::Resources::VPS`
- Source: `api/lib/vpsadmin/api/resources/vps.rb`:1
- Actions (16): `Boot`, `Clone`, `Create`, `Delete`, `DeployPublicKey`, `Index`, `Migrate`, `Passwd`, `Reinstall`, `Replace`, `Restart`, `Show`, `Start`, `Stop`, `SwapWith`, `Update`

### `VPS::ConsoleToken`

- Full const: `VpsAdmin::API::Resources::VPS::ConsoleToken`
- Source: `api/lib/vpsadmin/api/resources/vps.rb`:1563
- Actions (3): `Create`, `Delete`, `Show`

### `VPS::Feature`

- Full const: `VpsAdmin::API::Resources::VPS::Feature`
- Source: `api/lib/vpsadmin/api/resources/vps.rb`:1074
- Actions (4): `Index`, `Show`, `Update`, `UpdateAll`

### `VPS::MaintenanceWindow`

- Full const: `VpsAdmin::API::Resources::VPS::MaintenanceWindow`
- Source: `api/lib/vpsadmin/api/resources/vps.rb`:1401
- Actions (4): `Index`, `Show`, `Update`, `UpdateAll`

### `VPS::Mount`

- Full const: `VpsAdmin::API::Resources::VPS::Mount`
- Source: `api/lib/vpsadmin/api/resources/vps.rb`:1215
- Actions (5): `Create`, `Delete`, `Index`, `Show`, `Update`

### `VPS::SshHostKey`

- Full const: `VpsAdmin::API::Resources::VPS::SshHostKey`
- Source: `api/lib/vpsadmin/api/resources/vps.rb`:1634
- Actions (2): `Index`, `Show`

### `VPS::Status`

- Full const: `VpsAdmin::API::Resources::VPS::Status`
- Source: `api/lib/vpsadmin/api/resources/vps.rb`:1697
- Actions (2): `Index`, `Show`

### `VpsOutage`

- Full const: `VpsAdmin::API::Resources::VpsOutage`
- Source: `plugins/outage_reports/api/resources/vps_outage.rb`:2
- Actions (2): `Index`, `Show`

### `VpsUserData`

- Full const: `VpsAdmin::API::Resources::VpsUserData`
- Source: `api/lib/vpsadmin/api/resources/vps_user_data.rb`:2
- Actions (6): `Create`, `Delete`, `Deploy`, `Index`, `Show`, `Update`

### `Webauthn`

- Full const: `VpsAdmin::API::Resources::Webauthn`
- Source: `api/lib/vpsadmin/api/resources/webauthn.rb`:3
- Actions (0): (none)

### `Webauthn::Authentication`

- Full const: `VpsAdmin::API::Resources::Webauthn::Authentication`
- Source: `api/lib/vpsadmin/api/resources/webauthn.rb`:112
- Actions (2): `Begin`, `Finish`

### `Webauthn::Registration`

- Full const: `VpsAdmin::API::Resources::Webauthn::Registration`
- Source: `api/lib/vpsadmin/api/resources/webauthn.rb`:37
- Actions (2): `Begin`, `Finish`

