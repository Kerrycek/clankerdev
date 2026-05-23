# New vpsAdmin UI – IA draft v0.2.1

Auto-grouped from capabilities_matrix_v3.2 + heuristics.
We will reorganize by workflows; treat this as an exhaustive coverage list.

## User workspace
### account
- VpsAdmin::API::Resources::User
- VpsAdmin::API::Resources::User::KnownDevice
- VpsAdmin::API::Resources::User::PublicKey
- VpsAdmin::API::Resources::User::TotpDevice
- VpsAdmin::API::Resources::User::WebauthnCredential
- VpsAdmin::API::Resources::UserAccount
- VpsAdmin::API::Resources::UserClusterResourcePackage
- VpsAdmin::API::Resources::UserNamespace
- VpsAdmin::API::Resources::UserNamespaceMap
- VpsAdmin::API::Resources::UserOutage
- VpsAdmin::API::Resources::UserPayment
- VpsAdmin::API::Resources::UserSession

### cluster_admin
- VpsAdmin::API::Resources::Cluster

### dns
- VpsAdmin::API::Resources::DnsRecord
- VpsAdmin::API::Resources::DnsRecordLog
- VpsAdmin::API::Resources::DnsResolver
- VpsAdmin::API::Resources::DnsServer
- VpsAdmin::API::Resources::DnsServerZone
- VpsAdmin::API::Resources::DnsTsigKey
- VpsAdmin::API::Resources::DnsZone
- VpsAdmin::API::Resources::DnsZoneTransfer
- VpsAdmin::API::Resources::DnssecRecord

### misc
- VpsAdmin::API::Resources::ApiServer
- VpsAdmin::API::Resources::ClusterResourcePackage::Item
- VpsAdmin::API::Resources::Debug
- VpsAdmin::API::Resources::Language
- VpsAdmin::API::Resources::MailRecipient
- VpsAdmin::API::Resources::MailTemplate
- VpsAdmin::API::Resources::MailTemplate::Recipient
- VpsAdmin::API::Resources::MailTemplate::Translation
- VpsAdmin::API::Resources::Mailbox
- VpsAdmin::API::Resources::Mailbox::Handler
- VpsAdmin::API::Resources::MetricsAccessToken
- VpsAdmin::API::Resources::MigrationPlan
- VpsAdmin::API::Resources::MonitoredEvent
- VpsAdmin::API::Resources::Node::Status
- VpsAdmin::API::Resources::Oauth2Client
- VpsAdmin::API::Resources::ObjectHistory
- VpsAdmin::API::Resources::OomReport::Stat
- VpsAdmin::API::Resources::OomReport::Task
- VpsAdmin::API::Resources::OomReport::Usage
- VpsAdmin::API::Resources::OsFamily
- VpsAdmin::API::Resources::Outage::Entity
- VpsAdmin::API::Resources::Outage::Handler
- VpsAdmin::API::Resources::SystemConfig
- VpsAdmin::API::Resources::Transaction
- VpsAdmin::API::Resources::TransactionChain
- VpsAdmin::API::Resources::User::MailRoleRecipient
- VpsAdmin::API::Resources::User::MailTemplateRecipient
- VpsAdmin::API::Resources::UserClusterResourcePackage::Item
- VpsAdmin::API::Resources::UserNamespaceMap::Entry
- VpsAdmin::API::Resources::UserRequest::Change
- VpsAdmin::API::Resources::UserRequest::Registration
- VpsAdmin::API::Resources::VPS::Feature
- VpsAdmin::API::Resources::VPS::MaintenanceWindow
- VpsAdmin::API::Resources::VPS::Status
- VpsAdmin::API::Resources::Webauthn::Authentication
- VpsAdmin::API::Resources::Webauthn::Registration

### networking
- VpsAdmin::API::Resources::HostIpAddress
- VpsAdmin::API::Resources::IpAddress
- VpsAdmin::API::Resources::IpAddressAssignment
- VpsAdmin::API::Resources::LocationNetwork
- VpsAdmin::API::Resources::Network
- VpsAdmin::API::Resources::NetworkInterface
- VpsAdmin::API::Resources::NetworkInterfaceAccounting
- VpsAdmin::API::Resources::NetworkInterfaceMonitor

### payments
- VpsAdmin::API::Resources::IncomingPayment
- VpsAdmin::API::Resources::PaymentStats

### storage
- VpsAdmin::API::Resources::Dataset
- VpsAdmin::API::Resources::Dataset::Plan
- VpsAdmin::API::Resources::Dataset::PropertyHistory
- VpsAdmin::API::Resources::Dataset::Snapshot
- VpsAdmin::API::Resources::DatasetExpansion
- VpsAdmin::API::Resources::DatasetExpansion::History
- VpsAdmin::API::Resources::DatasetPlan
- VpsAdmin::API::Resources::Environment::DatasetPlan
- VpsAdmin::API::Resources::Export
- VpsAdmin::API::Resources::Export::Host
- VpsAdmin::API::Resources::ExportOutage
- VpsAdmin::API::Resources::Pool
- VpsAdmin::API::Resources::SnapshotDownload
- VpsAdmin::API::Resources::VpsUserData

### vps
- VpsAdmin::API::Resources::MigrationPlan::VpsMigration
- VpsAdmin::API::Resources::VPS
- VpsAdmin::API::Resources::VPS::ConsoleToken
- VpsAdmin::API::Resources::VPS::Mount
- VpsAdmin::API::Resources::VPS::SshHostKey
- VpsAdmin::API::Resources::VpsOutage

## Admin workspace
### account
- VpsAdmin::API::Resources::User
- VpsAdmin::API::Resources::User::KnownDevice
- VpsAdmin::API::Resources::User::PublicKey
- VpsAdmin::API::Resources::User::TotpDevice
- VpsAdmin::API::Resources::User::WebauthnCredential
- VpsAdmin::API::Resources::UserAccount
- VpsAdmin::API::Resources::UserClusterResourcePackage
- VpsAdmin::API::Resources::UserNamespace
- VpsAdmin::API::Resources::UserNamespaceMap
- VpsAdmin::API::Resources::UserOutage
- VpsAdmin::API::Resources::UserPayment
- VpsAdmin::API::Resources::UserSession

### cluster_admin
- VpsAdmin::API::Resources::Cluster
- VpsAdmin::API::Resources::ClusterResource
- VpsAdmin::API::Resources::ClusterResourcePackage
- VpsAdmin::API::Resources::Component
- VpsAdmin::API::Resources::DefaultObjectClusterResource
- VpsAdmin::API::Resources::Environment
- VpsAdmin::API::Resources::HelpBox
- VpsAdmin::API::Resources::Location
- VpsAdmin::API::Resources::Node
- VpsAdmin::API::Resources::OsTemplate
- VpsAdmin::API::Resources::User::ClusterResource
- VpsAdmin::API::Resources::User::EnvironmentConfig

### dns
- VpsAdmin::API::Resources::DnsRecord
- VpsAdmin::API::Resources::DnsRecordLog
- VpsAdmin::API::Resources::DnsResolver
- VpsAdmin::API::Resources::DnsServer
- VpsAdmin::API::Resources::DnsServerZone
- VpsAdmin::API::Resources::DnsTsigKey
- VpsAdmin::API::Resources::DnsZone
- VpsAdmin::API::Resources::DnsZoneTransfer
- VpsAdmin::API::Resources::DnssecRecord

### misc
- VpsAdmin::API::Resources::ApiServer
- VpsAdmin::API::Resources::ClusterResourcePackage::Item
- VpsAdmin::API::Resources::Debug
- VpsAdmin::API::Resources::Language
- VpsAdmin::API::Resources::MailRecipient
- VpsAdmin::API::Resources::MailTemplate
- VpsAdmin::API::Resources::MailTemplate::Recipient
- VpsAdmin::API::Resources::MailTemplate::Translation
- VpsAdmin::API::Resources::Mailbox
- VpsAdmin::API::Resources::Mailbox::Handler
- VpsAdmin::API::Resources::MetricsAccessToken
- VpsAdmin::API::Resources::MigrationPlan
- VpsAdmin::API::Resources::MonitoredEvent
- VpsAdmin::API::Resources::Node::Status
- VpsAdmin::API::Resources::Oauth2Client
- VpsAdmin::API::Resources::ObjectHistory
- VpsAdmin::API::Resources::OomReport::Stat
- VpsAdmin::API::Resources::OomReport::Task
- VpsAdmin::API::Resources::OomReport::Usage
- VpsAdmin::API::Resources::OsFamily
- VpsAdmin::API::Resources::Outage::Entity
- VpsAdmin::API::Resources::Outage::Handler
- VpsAdmin::API::Resources::SystemConfig
- VpsAdmin::API::Resources::Transaction
- VpsAdmin::API::Resources::TransactionChain
- VpsAdmin::API::Resources::User::MailRoleRecipient
- VpsAdmin::API::Resources::User::MailTemplateRecipient
- VpsAdmin::API::Resources::UserClusterResourcePackage::Item
- VpsAdmin::API::Resources::UserNamespaceMap::Entry
- VpsAdmin::API::Resources::UserRequest::Change
- VpsAdmin::API::Resources::UserRequest::Registration
- VpsAdmin::API::Resources::VPS::Feature
- VpsAdmin::API::Resources::VPS::MaintenanceWindow
- VpsAdmin::API::Resources::VPS::Status
- VpsAdmin::API::Resources::Webauthn::Authentication
- VpsAdmin::API::Resources::Webauthn::Registration

### networking
- VpsAdmin::API::Resources::HostIpAddress
- VpsAdmin::API::Resources::IpAddress
- VpsAdmin::API::Resources::IpAddressAssignment
- VpsAdmin::API::Resources::LocationNetwork
- VpsAdmin::API::Resources::Network
- VpsAdmin::API::Resources::NetworkInterface
- VpsAdmin::API::Resources::NetworkInterfaceAccounting
- VpsAdmin::API::Resources::NetworkInterfaceMonitor

### ops
- VpsAdmin::API::Resources::IncidentReport
- VpsAdmin::API::Resources::MailLog
- VpsAdmin::API::Resources::MonitoredEvent::Log
- VpsAdmin::API::Resources::NewsLog
- VpsAdmin::API::Resources::OomReport
- VpsAdmin::API::Resources::OomReportRule
- VpsAdmin::API::Resources::Outage
- VpsAdmin::API::Resources::OutageUpdate
- VpsAdmin::API::Resources::User::StateLog
- VpsAdmin::API::Resources::VPS::StateLog

### payments
- VpsAdmin::API::Resources::IncomingPayment
- VpsAdmin::API::Resources::PaymentStats

### storage
- VpsAdmin::API::Resources::Dataset
- VpsAdmin::API::Resources::Dataset::Plan
- VpsAdmin::API::Resources::Dataset::PropertyHistory
- VpsAdmin::API::Resources::Dataset::Snapshot
- VpsAdmin::API::Resources::DatasetExpansion
- VpsAdmin::API::Resources::DatasetExpansion::History
- VpsAdmin::API::Resources::DatasetPlan
- VpsAdmin::API::Resources::Environment::DatasetPlan
- VpsAdmin::API::Resources::Export
- VpsAdmin::API::Resources::Export::Host
- VpsAdmin::API::Resources::ExportOutage
- VpsAdmin::API::Resources::Pool
- VpsAdmin::API::Resources::SnapshotDownload
- VpsAdmin::API::Resources::VpsUserData

### vps
- VpsAdmin::API::Resources::MigrationPlan::VpsMigration
- VpsAdmin::API::Resources::VPS
- VpsAdmin::API::Resources::VPS::ConsoleToken
- VpsAdmin::API::Resources::VPS::Mount
- VpsAdmin::API::Resources::VPS::SshHostKey
- VpsAdmin::API::Resources::VpsOutage

