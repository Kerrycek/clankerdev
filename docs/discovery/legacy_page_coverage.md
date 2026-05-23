# Legacy WebUI API coverage map

Generated from PHP code scan (webui/pages, webui/forms, webui/lib).

## webui/forms/backup.forms.php

- Matched API calls: **10** (unique actions: **5**)

- **VpsAdmin::API::Resources::Dataset**: Index
- **VpsAdmin::API::Resources::SnapshotDownload**: Index, Show
- **VpsAdmin::API::Resources::VPS**: Index, Show

## webui/forms/cluster.forms.php

- Matched API calls: **28** (unique actions: **19**)
- Ignored/non-action calls: **4** (ignored_client_method)

- **VpsAdmin::API::Resources::Cluster**: FullStats
- **VpsAdmin::API::Resources::ClusterResourcePackage**: Index, Show
- **VpsAdmin::API::Resources::DnsResolver**: Show
- **VpsAdmin::API::Resources::HelpBox**: Index, Show
- **VpsAdmin::API::Resources::Language**: Index
- **VpsAdmin::API::Resources::Location**: Show
- **VpsAdmin::API::Resources::LocationNetwork**: Index, Show
- **VpsAdmin::API::Resources::Network**: Index, Show
- **VpsAdmin::API::Resources::NewsLog**: Index, Show
- **VpsAdmin::API::Resources::Node**: OverviewList, Show
- **VpsAdmin::API::Resources::OsTemplate**: Show
- **VpsAdmin::API::Resources::SystemConfig**: Index
- **VpsAdmin::API::Resources::User**: Index

## webui/forms/dataset.forms.php

- Matched API calls: **8** (unique actions: **3**)
- Ignored/non-action calls: **7** (ignored_client_method)

- **VpsAdmin::API::Resources::Dataset**: Index, Show
- **VpsAdmin::API::Resources::VPS**: Show

## webui/forms/dns.forms.php

- Matched API calls: **21** (unique actions: **15**)
- Ignored/non-action calls: **8** (ignored_client_method)

- **VpsAdmin::API::Resources::DnsRecord**: Index, Show
- **VpsAdmin::API::Resources::DnsRecordLog**: Index
- **VpsAdmin::API::Resources::DnsResolver**: Index
- **VpsAdmin::API::Resources::DnsServer**: Index
- **VpsAdmin::API::Resources::DnsServerZone**: Index
- **VpsAdmin::API::Resources::DnsTsigKey**: Index, Show
- **VpsAdmin::API::Resources::DnsZone**: Index, Show
- **VpsAdmin::API::Resources::DnsZoneTransfer**: Index
- **VpsAdmin::API::Resources::DnssecRecord**: Index
- **VpsAdmin::API::Resources::HostIpAddress**: Index
- **VpsAdmin::API::Resources::Location**: Index
- **VpsAdmin::API::Resources::Network**: Index

## webui/forms/export.forms.php

- Matched API calls: **8** (unique actions: **5**)
- Ignored/non-action calls: **2** (ignored_client_method)

- **VpsAdmin::API::Resources::Dataset**: Index, Show
- **VpsAdmin::API::Resources::Export**: Index, Show
- **VpsAdmin::API::Resources::IpAddress**: Index

## webui/forms/incidents.forms.php

- Matched API calls: **4** (unique actions: **4**)
- Ignored/non-action calls: **2** (ignored_client_method)

- **VpsAdmin::API::Resources::IncidentReport**: Index, Show
- **VpsAdmin::API::Resources::IpAddressAssignment**: Index
- **VpsAdmin::API::Resources::VPS**: Show

## webui/forms/monitoring.forms.php

- Matched API calls: **4** (unique actions: **2**)
- Ignored/non-action calls: **2** (ignored_client_method)

- **VpsAdmin::API::Resources::MonitoredEvent**: Index, Show

## webui/forms/networking.forms.php

- Matched API calls: **23** (unique actions: **11**)

- **VpsAdmin::API::Resources::Environment**: Index
- **VpsAdmin::API::Resources::HostIpAddress**: Index, Show
- **VpsAdmin::API::Resources::IpAddress**: Index, Show
- **VpsAdmin::API::Resources::IpAddressAssignment**: Index
- **VpsAdmin::API::Resources::Location**: Index
- **VpsAdmin::API::Resources::Network**: Index
- **VpsAdmin::API::Resources::NetworkInterface**: Index, Show
- **VpsAdmin::API::Resources::VPS**: Show

## webui/forms/node.forms.php

- Matched API calls: **2** (unique actions: **2**)

- **VpsAdmin::API::Resources::Node**: Show
- **VpsAdmin::API::Resources::Pool**: Index

## webui/forms/object_history.forms.php

- Matched API calls: **1** (unique actions: **1**)

- **VpsAdmin::API::Resources::ObjectHistory**: Index

## webui/forms/oom_reports.forms.php

- Matched API calls: **6** (unique actions: **5**)
- Ignored/non-action calls: **3** (ignored_client_method)

- **VpsAdmin::API::Resources::OomReport**: Index, Show
- **VpsAdmin::API::Resources::OomReportRule**: Index, Show
- **VpsAdmin::API::Resources::VPS**: Show

## webui/forms/outage.forms.php

- Matched API calls: **39** (unique actions: **12**)
- Ignored/non-action calls: **4** (ignored_client_method)

- **VpsAdmin::API::Resources::Component**: Index
- **VpsAdmin::API::Resources::Environment**: Index
- **VpsAdmin::API::Resources::ExportOutage**: Index
- **VpsAdmin::API::Resources::Language**: Index
- **VpsAdmin::API::Resources::Location**: Index
- **VpsAdmin::API::Resources::Node**: Index
- **VpsAdmin::API::Resources::Outage**: Index, Show
- **VpsAdmin::API::Resources::OutageUpdate**: Index
- **VpsAdmin::API::Resources::User**: Index
- **VpsAdmin::API::Resources::UserOutage**: Index
- **VpsAdmin::API::Resources::VpsOutage**: Index

## webui/forms/userdata.forms.php

- Matched API calls: **3** (unique actions: **3**)
- Ignored/non-action calls: **2** (ignored_client_method)

- **VpsAdmin::API::Resources::VPS**: Index
- **VpsAdmin::API::Resources::VpsUserData**: Index, Show

## webui/forms/userns.forms.php

- Matched API calls: **6** (unique actions: **4**)
- Ignored/non-action calls: **3** (ignored_client_method)

- **VpsAdmin::API::Resources::UserNamespace**: Index, Show
- **VpsAdmin::API::Resources::UserNamespaceMap**: Index, Show

## webui/forms/users.forms.php

- Matched API calls: **23** (unique actions: **14**)
- Ignored/non-action calls: **6** (ignored_client_method)

- **VpsAdmin::API::Resources::ClusterResourcePackage**: Index
- **VpsAdmin::API::Resources::IncomingPayment**: Index, Show
- **VpsAdmin::API::Resources::MetricsAccessToken**: Index, Show
- **VpsAdmin::API::Resources::User**: Show
- **VpsAdmin::API::Resources::User::EnvironmentConfig**: Index, Show
- **VpsAdmin::API::Resources::UserClusterResourcePackage**: Index, Show
- **VpsAdmin::API::Resources::UserPayment**: Index
- **VpsAdmin::API::Resources::UserSession**: Index, Show
- **VpsAdmin::API::Resources::VPS**: Index

## webui/forms/vps.forms.php

- Matched API calls: **45** (unique actions: **19**)
- Ignored/non-action calls: **6** (ignored_client_method)

- **VpsAdmin::API::Resources::DefaultObjectClusterResource**: Index
- **VpsAdmin::API::Resources::Environment**: Index
- **VpsAdmin::API::Resources::HostIpAddress**: Index
- **VpsAdmin::API::Resources::IpAddress**: Index
- **VpsAdmin::API::Resources::Location**: Index, Show
- **VpsAdmin::API::Resources::NetworkInterface**: Show
- **VpsAdmin::API::Resources::Node**: Index, Show
- **VpsAdmin::API::Resources::OsFamily**: Index
- **VpsAdmin::API::Resources::OsTemplate**: Index, Show
- **VpsAdmin::API::Resources::User**: Current, Show
- **VpsAdmin::API::Resources::User::EnvironmentConfig**: Index
- **VpsAdmin::API::Resources::UserNamespaceMap**: Index
- **VpsAdmin::API::Resources::VPS**: Index, Show
- **VpsAdmin::API::Resources::VpsUserData**: Index

## webui/pages/page_adminm.php

- Matched API calls: **56** (unique actions: **26**)
- Ignored/non-action calls: **5** (ignored_client_method)

- **VpsAdmin::API::Resources::IncomingPayment**: Update
- **VpsAdmin::API::Resources::MetricsAccessToken**: Create, Delete
- **VpsAdmin::API::Resources::PaymentStats**: EstimateIncome
- **VpsAdmin::API::Resources::User**: Create, Current, Index, Show
- **VpsAdmin::API::Resources::User::ClusterResource**: Index
- **VpsAdmin::API::Resources::User::EnvironmentConfig**: Update
- **VpsAdmin::API::Resources::User::MailRoleRecipient**: Update
- **VpsAdmin::API::Resources::User::MailTemplateRecipient**: Update
- **VpsAdmin::API::Resources::User::PublicKey**: Create, Delete, Index, Show, Update
- **VpsAdmin::API::Resources::UserAccount**: Update
- **VpsAdmin::API::Resources::UserClusterResourcePackage**: Create, Delete, Update
- **VpsAdmin::API::Resources::UserPayment**: Create
- **VpsAdmin::API::Resources::UserRequest::Change**: Create
- **VpsAdmin::API::Resources::UserSession**: Close, Update
- **VpsAdmin::API::Resources::VPS**: Index

## webui/pages/page_adminvps.php

- Matched API calls: **53** (unique actions: **27**)
- Ignored/non-action calls: **3** (ignored_client_method)

- **VpsAdmin::API::Resources::DnsResolver**: Index
- **VpsAdmin::API::Resources::HostIpAddress**: Assign, Free, Index
- **VpsAdmin::API::Resources::IpAddress**: Assign, AssignWithHostAddress, Free
- **VpsAdmin::API::Resources::NetworkInterface**: Index, Update
- **VpsAdmin::API::Resources::NetworkInterfaceAccounting**: Index
- **VpsAdmin::API::Resources::OsTemplate**: Show
- **VpsAdmin::API::Resources::User**: Index, Show
- **VpsAdmin::API::Resources::UserNamespaceMap**: Index
- **VpsAdmin::API::Resources::VPS**: Boot, Create, Delete, DeployPublicKey, Migrate, Passwd, Reinstall, Restart, Show, Start, Stop, Update
- **VpsAdmin::API::Resources::VpsUserData**: Show

## webui/pages/page_backup.php

- Matched API calls: **12** (unique actions: **7**)

- **VpsAdmin::API::Resources::Dataset**: Show
- **VpsAdmin::API::Resources::Dataset::Snapshot**: Create, Delete
- **VpsAdmin::API::Resources::SnapshotDownload**: Create, Delete, Show
- **VpsAdmin::API::Resources::VPS**: Show

## webui/pages/page_cluster.php

- Matched API calls: **43** (unique actions: **38**)
- Ignored/non-action calls: **2** (ignored_client_method, no_action_match)

- **VpsAdmin::API::Resources::ClusterResourcePackage**: Create, Delete, Update
- **VpsAdmin::API::Resources::ClusterResourcePackage::Item**: Create, Delete, Update
- **VpsAdmin::API::Resources::DnsResolver**: Create, Delete, Index, Show, Update
- **VpsAdmin::API::Resources::Environment**: Index, Show, Update
- **VpsAdmin::API::Resources::HelpBox**: Create, Delete, Update
- **VpsAdmin::API::Resources::IpAddress**: Create
- **VpsAdmin::API::Resources::Location**: Create, Index, Show, Update
- **VpsAdmin::API::Resources::LocationNetwork**: Create, Delete, Update
- **VpsAdmin::API::Resources::NewsLog**: Create, Delete, Update
- **VpsAdmin::API::Resources::Node**: Create, Index, Show, Update
- **VpsAdmin::API::Resources::OsTemplate**: Create, Delete, Index, Show, Update
- **VpsAdmin::API::Resources::SystemConfig**: Update

## webui/pages/page_console.php

- Matched API calls: **1** (unique actions: **1**)

- **VpsAdmin::API::Resources::VPS**: Show

## webui/pages/page_dataset.php

- Matched API calls: **19** (unique actions: **12**)
- Ignored/non-action calls: **4** (ignored_client_method)

- **VpsAdmin::API::Resources::Dataset**: Create, Delete, Show
- **VpsAdmin::API::Resources::Dataset::Plan**: Create, Delete
- **VpsAdmin::API::Resources::DatasetExpansion**: Create, RegisterExpanded, Show
- **VpsAdmin::API::Resources::VPS**: Show
- **VpsAdmin::API::Resources::VPS::Mount**: Create, Delete, Update

## webui/pages/page_dns.php

- Matched API calls: **17** (unique actions: **12**)

- **VpsAdmin::API::Resources::DnsRecord**: Create, Delete, Update
- **VpsAdmin::API::Resources::DnsServerZone**: Create, Delete
- **VpsAdmin::API::Resources::DnsTsigKey**: Create, Delete
- **VpsAdmin::API::Resources::DnsZone**: Create, Delete, Show
- **VpsAdmin::API::Resources::DnsZoneTransfer**: Create, Delete

## webui/pages/page_export.php

- Matched API calls: **9** (unique actions: **7**)

- **VpsAdmin::API::Resources::Dataset**: Show
- **VpsAdmin::API::Resources::Export**: Create, Delete, Update
- **VpsAdmin::API::Resources::Export::Host**: Create, Delete, Update

## webui/pages/page_incidents.php

- Matched API calls: **1** (unique actions: **1**)

- **VpsAdmin::API::Resources::IncidentReport**: Create

## webui/pages/page_index.php

- Matched API calls: **3** (unique actions: **3**)

- **VpsAdmin::API::Resources::Cluster**: PublicStats
- **VpsAdmin::API::Resources::NewsLog**: Index
- **VpsAdmin::API::Resources::Node**: PublicStatus

## webui/pages/page_jumpto.php

- Matched API calls: **0** (unique actions: **0**)
- Ignored/non-action calls: **1** (ignored_client_method)


## webui/pages/page_log.php

- Matched API calls: **1** (unique actions: **1**)

- **VpsAdmin::API::Resources::NewsLog**: Index

## webui/pages/page_login.php

- Matched API calls: **0** (unique actions: **0**)
- Ignored/non-action calls: **2** (ignored_client_method, unknown_resource_chain)


## webui/pages/page_monitoring.php

- Matched API calls: **2** (unique actions: **2**)

- **VpsAdmin::API::Resources::MonitoredEvent**: Acknowledge, Ignore

## webui/pages/page_networking.php

- Matched API calls: **21** (unique actions: **15**)

- **VpsAdmin::API::Resources::Environment**: Index
- **VpsAdmin::API::Resources::HostIpAddress**: Assign, Create, Delete, Free, Update
- **VpsAdmin::API::Resources::IpAddress**: Assign, AssignWithHostAddress, Show, Update
- **VpsAdmin::API::Resources::Location**: Index
- **VpsAdmin::API::Resources::NetworkInterfaceAccounting**: Index, UserTop
- **VpsAdmin::API::Resources::NetworkInterfaceMonitor**: Index
- **VpsAdmin::API::Resources::Node**: Index

## webui/pages/page_oom_reports.php

- Matched API calls: **3** (unique actions: **3**)

- **VpsAdmin::API::Resources::OomReportRule**: Create, Delete, Update

## webui/pages/page_outage.php

- Matched API calls: **9** (unique actions: **5**)

- **VpsAdmin::API::Resources::Language**: Index
- **VpsAdmin::API::Resources::Outage**: Create, Show, Update
- **VpsAdmin::API::Resources::OutageUpdate**: Create

## webui/pages/page_redirect.php

- Matched API calls: **2** (unique actions: **2**)

- **VpsAdmin::API::Resources::HostIpAddress**: Show
- **VpsAdmin::API::Resources::UserPayment**: Show

## webui/pages/page_transactions.php

- Matched API calls: **5** (unique actions: **5**)

- **VpsAdmin::API::Resources::Node**: Index
- **VpsAdmin::API::Resources::Transaction**: Index, Show
- **VpsAdmin::API::Resources::TransactionChain**: Index, Show

## webui/pages/page_userdata.php

- Matched API calls: **4** (unique actions: **2**)

- **VpsAdmin::API::Resources::VpsUserData**: Create, Show

## webui/pages/page_userns.php

- Matched API calls: **6** (unique actions: **6**)

- **VpsAdmin::API::Resources::UserNamespaceMap**: Create, Delete, Update
- **VpsAdmin::API::Resources::UserNamespaceMap::Entry**: Create, Delete, Update
