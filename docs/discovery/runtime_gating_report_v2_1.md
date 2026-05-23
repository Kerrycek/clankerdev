# Runtime gating signals (v2.1)

Total actions: 418
Actions with runtime_checks: 54
Actions with level_related code: 8

## Actions with explicit runtime checks (error!/access denied)

### Dataset
- `VpsAdmin::API::Resources::Dataset::Create`
  - line ~190: `error!('insufficient permission to create a dataset')`
  - line ~193: `error!('access denied')`
  - line ~208: `error!('insufficient permission to create a dataset')`
- `VpsAdmin::API::Resources::Dataset::Delete`
  - line ~284: `error!('insufficient permission to destroy this dataset')`
- `VpsAdmin::API::Resources::Dataset::Inherit`
  - line ~324: `error!('insufficient permission to inherit this property') if current_user.role != :admin && !ds.user_editable`
- `VpsAdmin::API::Resources::Dataset::Migrate`
  - line ~417: `error!('access denied to maintenance window VPS')`

### Plan
- `VpsAdmin::API::Resources::Dataset::Plan::Create`
  - line ~764: `error!('Insufficient permission') if !input[:environment_dataset_plan].user_add && current_user.role != :admin`
- `VpsAdmin::API::Resources::Dataset::Plan::Delete`
  - line ~786: `error!('Insufficient permission')`

### DnsZoneTransfer
- `VpsAdmin::API::Resources::DnsZoneTransfer::Create`
  - line ~101: `error!('access denied')`

### Export
- `VpsAdmin::API::Resources::Export::Create`
  - line ~138: `error!('access denied') if !current_user.role == :admin && ds.user_id != current_user.id`

### HostIpAddress
- `VpsAdmin::API::Resources::HostIpAddress::Assign`
  - line ~340: `error!('access denied')`
- `VpsAdmin::API::Resources::HostIpAddress::Create`
  - line ~239: `error!('access denied') if current_user.role != :admin && ip.current_owner != current_user`
- `VpsAdmin::API::Resources::HostIpAddress::Delete`
  - line ~303: `error!('access denied') if current_user.role != :admin && host.current_owner != current_user`
- `VpsAdmin::API::Resources::HostIpAddress::Free`
  - line ~382: `error!('access denied')`
- `VpsAdmin::API::Resources::HostIpAddress::Update`
  - line ~266: `error!('access denied') if current_user.role != :admin && host.current_owner != current_user`

### IpAddress
- `VpsAdmin::API::Resources::IpAddress::Assign`
  - line ~325: `error!('access denied')`
- `VpsAdmin::API::Resources::IpAddress::AssignWithHostAddress`
  - line ~382: `error!('access denied')`
- `VpsAdmin::API::Resources::IpAddress::Free`
  - line ~434: `error!('access denied')`

### OomReportRule
- `VpsAdmin::API::Resources::OomReportRule::Create`
  - line ~90: `error!('access denied')`

### User
- `VpsAdmin::API::Resources::User::GetPaymentInstructions`
  - line ~39: `error!('access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`
- `VpsAdmin::API::Resources::User::Show`
  - line ~231: `error!('access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`
- `VpsAdmin::API::Resources::User::Touch`
  - line ~210: `error!('access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`
- `VpsAdmin::API::Resources::User::Update`
  - line ~271: `error!('access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`

### EnvironmentConfig
- `VpsAdmin::API::Resources::User::EnvironmentConfig::Index`
  - line ~391: `error!('access denied') if current_user.role != :admin && params[:user_id].to_i != current_user.id`
- `VpsAdmin::API::Resources::User::EnvironmentConfig::Show`
  - line ~423: `error!('access denied') if current_user.role != :admin && params[:user_id].to_i != current_user.id`

### KnownDevice
- `VpsAdmin::API::Resources::User::KnownDevice::Delete`
  - line ~653: `error!('access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`
- `VpsAdmin::API::Resources::User::KnownDevice::Index`
  - line ~605: `error!('access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`
- `VpsAdmin::API::Resources::User::KnownDevice::Show`
  - line ~632: `error!('access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`

### MailRoleRecipient
- `VpsAdmin::API::Resources::User::MailRoleRecipient::Index`
  - line ~1183: `error!('Access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`
- `VpsAdmin::API::Resources::User::MailRoleRecipient::Show`
  - line ~1209: `error!('Access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`
- `VpsAdmin::API::Resources::User::MailRoleRecipient::Update`
  - line ~1238: `error!('Access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`

### MailTemplateRecipient
- `VpsAdmin::API::Resources::User::MailTemplateRecipient::Index`
  - line ~1276: `error!('Access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`
- `VpsAdmin::API::Resources::User::MailTemplateRecipient::Show`
  - line ~1302: `error!('Access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`
- `VpsAdmin::API::Resources::User::MailTemplateRecipient::Update`
  - line ~1331: `error!('Access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`

### PublicKey
- `VpsAdmin::API::Resources::User::PublicKey::Create`
  - line ~1100: `error!('Access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`
- `VpsAdmin::API::Resources::User::PublicKey::Delete`
  - line ~1150: `error!('Access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`
- `VpsAdmin::API::Resources::User::PublicKey::Index`
  - line ~1045: `error!('Access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`
- `VpsAdmin::API::Resources::User::PublicKey::Show`
  - line ~1071: `error!('Access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`
- `VpsAdmin::API::Resources::User::PublicKey::Update`
  - line ~1127: `error!('Access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`

### TotpDevice
- `VpsAdmin::API::Resources::User::TotpDevice::Confirm`
  - line ~789: `error!('access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`
- `VpsAdmin::API::Resources::User::TotpDevice::Create`
  - line ~762: `error!('access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`
- `VpsAdmin::API::Resources::User::TotpDevice::Delete`
  - line ~867: `error!('access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`
- `VpsAdmin::API::Resources::User::TotpDevice::Index`
  - line ~698: `error!('access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`
- `VpsAdmin::API::Resources::User::TotpDevice::Show`
  - line ~731: `error!('access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`
- `VpsAdmin::API::Resources::User::TotpDevice::Update`
  - line ~825: `error!('access denied')`

### WebauthnCredential
- `VpsAdmin::API::Resources::User::WebauthnCredential::Delete`
  - line ~994: `error!('access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`
- `VpsAdmin::API::Resources::User::WebauthnCredential::Index`
  - line ~913: `error!('access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`
- `VpsAdmin::API::Resources::User::WebauthnCredential::Show`
  - line ~942: `error!('access denied') if current_user.role != :admin && current_user.id != params[:user_id].to_i`
- `VpsAdmin::API::Resources::User::WebauthnCredential::Update`
  - line ~972: `error!('access denied')`

### UserNamespaceMap
- `VpsAdmin::API::Resources::UserNamespaceMap::Create`
  - line ~99: `error!('access denied') if !current_user.role == :admin && input[:user_namespace].user_id != current_user.id`

### Entry
- `VpsAdmin::API::Resources::UserNamespaceMap::Entry::Create`
  - line ~255: `error!('access denied')`

### VPS
- `VpsAdmin::API::Resources::VPS::Clone`
  - line ~891: `error!('insufficient permission to clone into this VPS')`
  - line ~915: `error!('insufficient permission to create a VPS in this environment')`
- `VpsAdmin::API::Resources::VPS::Create`
  - line ~293: `error!('insufficient permission to create a VPS in this environment')`
- `VpsAdmin::API::Resources::VPS::SwapWith`
  - line ~980: `error!('access denied')`

### Mount
- `VpsAdmin::API::Resources::VPS::Mount::Create`
  - line ~1319: `error!('insufficient permission to mount selected snapshot')`

### VpsUserData
- `VpsAdmin::API::Resources::VpsUserData::Deploy`
  - line ~157: `error!('access denied') if input[:vps].user_id != data.user_id`

## Actions with level-based filtering in code

### MonitoredEvent
- `VpsAdmin::API::Resources::MonitoredEvent::Acknowledge`
- `VpsAdmin::API::Resources::MonitoredEvent::Ignore`
- `VpsAdmin::API::Resources::MonitoredEvent::Index`
- `VpsAdmin::API::Resources::MonitoredEvent::Show`

### Log
- `VpsAdmin::API::Resources::MonitoredEvent::Log::Index`
- `VpsAdmin::API::Resources::MonitoredEvent::Log::Show`

### SystemConfig
- `VpsAdmin::API::Resources::SystemConfig::Index`
- `VpsAdmin::API::Resources::SystemConfig::Show`