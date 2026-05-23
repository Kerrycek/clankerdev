# New Web UI: Information Architecture draft (v0.1)

This is a first-pass IA draft built from the current API capabilities matrix and a simple module heuristic.
It is meant as a *navigation starting point*; we will refine it into real workflows + page specs.

## Workspaces

- **User workspace**: normal users managing their own VPSes and related objects.
- **Admin workspace**: cluster/admin management and cross-user operations.

## User navigation

### Storage (12)

- Dataset
- Dataset::Plan
- Dataset::PropertyHistory
- Dataset::Snapshot
- DatasetExpansion
- DatasetExpansion::History
- DatasetPlan
- Environment::DatasetPlan
- Export
- Export::Host
- ExportOutage
- SnapshotDownload

### Networking (9)

- HostIpAddress
- IpAddress
- IpAddressAssignment
- Network
- NetworkInterface
- NetworkInterfaceAccounting
- NetworkInterfaceMonitor
- User::MailRoleRecipient
- User::MailTemplateRecipient

### DNS (9)

- DnsRecord
- DnsRecordLog
- DnsResolver
- DnsServer
- DnsServerZone
- DnsTsigKey
- DnsZone
- DnsZoneTransfer
- DnssecRecord

### Monitoring (17)

- IncidentReport
- MonitoredEvent
- MonitoredEvent::Log
- NewsLog
- OomReport
- OomReport::Stat
- OomReport::Task
- OomReport::Usage
- OomReportRule
- Outage
- Outage::Entity
- Outage::Handler
- OutageUpdate
- Transaction
- TransactionChain
- UserOutage
- VpsOutage

### Payments (1)

- UserPayment

### Account (20)

- MetricsAccessToken
- User
- User::ClusterResource
- User::EnvironmentConfig
- User::KnownDevice
- User::PublicKey
- User::TotpDevice
- User::WebauthnCredential
- UserClusterResourcePackage
- UserClusterResourcePackage::Item
- UserNamespace
- UserNamespaceMap
- UserNamespaceMap::Entry
- UserRequest::Change
- UserRequest::Registration
- UserSession
- VPS::SshHostKey
- VpsUserData
- Webauthn::Authentication
- Webauthn::Registration

### Other (20)

- Cluster
- ClusterResource
- Component
- DefaultObjectClusterResource
- Environment
- HelpBox
- Language
- Location
- Node
- ObjectHistory
- OsFamily
- OsTemplate
- Pool
- SystemConfig
- VPS
- VPS::ConsoleToken
- VPS::Feature
- VPS::MaintenanceWindow
- VPS::Mount
- VPS::Status

## Admin navigation

### Overview (15)

- Cluster
- ClusterResource
- ClusterResourcePackage
- ClusterResourcePackage::Item
- DefaultObjectClusterResource
- Environment
- HelpBox
- Location
- MailTemplate
- MailTemplate::Translation
- Mailbox
- Mailbox::Handler
- Node
- Node::Status
- SystemConfig

### Users (14)

- IncomingPayment
- Oauth2Client
- PaymentStats
- User
- User::ClusterResource
- User::EnvironmentConfig
- UserAccount
- UserClusterResourcePackage
- UserPayment
- UserRequest
- UserRequest::Change
- UserRequest::Registration
- UserSession
- Webauthn

### Storage (3)

- Dataset
- DatasetExpansion
- DatasetExpansion::History

### Networking (6)

- IpAddress
- LocationNetwork
- MailRecipient
- MailTemplate::Recipient
- Network
- NetworkInterfaceAccounting

### DNS (3)

- DnsResolver
- DnsServer
- DnsServerZone

### Operations (7)

- IncidentReport
- MailLog
- NewsLog
- Outage
- Outage::Entity
- Outage::Handler
- OutageUpdate

### Other (8)

- ApiServer
- Debug
- MigrationPlan
- MigrationPlan::VpsMigration
- OsFamily
- OsTemplate
- Pool
- VPS
