# Public (no-login) HaveAPI actions
These actions are declared with `auth false` (directly or via plugin overrides).
They are used by WebUI Next for the **public Overview** and **public Outages** pages, and for other transparency features.
**Count:** 26 public actions (from `docs/discovery/capabilities_matrix_v3_2.json`).

## Key public endpoints used by WebUI Next public pages
- Cluster stats: `Cluster::PublicStats`
- Node health: `Node::PublicStatus`
- Outages: `Outage::Index/Show` + `OutageUpdate::Index/Show` + nested `Outage::{Entity,Handler}`
- News log: `NewsLog::Index/Show`
- Public info blocks: `HelpBox::Index/Show`

## Full list
| Resource | Action | Method | Route override | Source |
|---|---|---|---|---|
| `Cluster` | `PublicStats` | `` | `` | `api/lib/vpsadmin/api/resources/cluster.rb:31` |
| `Component` | `Show` | `` | `` | `api/lib/vpsadmin/api/resources/component.rb:38` |
| `DnsRecord` | `DynamicUpdate` | `get` | `dynamic_update/{access_token}` | `api/lib/vpsadmin/api/resources/dns_record.rb:197` |
| `HelpBox` | `Index` | `` | `` | `plugins/webui/api/resources/help_box.rb:23` |
| `HelpBox` | `Show` | `` | `` | `plugins/webui/api/resources/help_box.rb:83` |
| `Language` | `Index` | `` | `` | `api/lib/vpsadmin/api/resources/language.rb:12` |
| `Location` | `Index` | `` | `` | `api/lib/vpsadmin/api/resources/location.rb:24` |
| `NewsLog` | `Index` | `` | `` | `plugins/newslog/api/resources/news_log.rb:18` |
| `NewsLog` | `Show` | `` | `` | `plugins/newslog/api/resources/news_log.rb:53` |
| `Node` | `PublicStatus` | `` | `` | `api/lib/vpsadmin/api/resources/node.rb:221` |
| `OsTemplate` | `Index` | `` | `` | `api/lib/vpsadmin/api/resources/os_template.rb:36` |
| `Outage` | `Index` | `` | `` | `plugins/outage_reports/api/resources/outage.rb:60` |
| `Outage` | `Show` | `` | `` | `plugins/outage_reports/api/resources/outage.rb:204` |
| `Entity` | `Index` | `` | `` | `plugins/outage_reports/api/resources/outage.rb:325` |
| `Entity` | `Show` | `` | `` | `plugins/outage_reports/api/resources/outage.rb:350` |
| `Handler` | `Index` | `` | `` | `plugins/outage_reports/api/resources/outage.rb:435` |
| `Handler` | `Show` | `` | `` | `plugins/outage_reports/api/resources/outage.rb:462` |
| `OutageUpdate` | `Index` | `` | `` | `plugins/outage_reports/api/resources/outage_update.rb:41` |
| `OutageUpdate` | `Show` | `` | `` | `plugins/outage_reports/api/resources/outage_update.rb:81` |
| `SystemConfig` | `Index` | `` | `` | `api/lib/vpsadmin/api/resources/system_config.rb:16` |
| `SystemConfig` | `Show` | `` | `{category}/{name}` | `api/lib/vpsadmin/api/resources/system_config.rb:47` |
| `Registration` | `Create` | `` | `` | `plugins/requests/api/resources/base.rb:85` |
| `Registration` | `Preview` | `get` | `{%{resource}_id}/{token}` | `plugins/requests/api/resources/registration.rb:76` |
| `Registration` | `Update` | `` | `{%{resource}_id}/{token}` | `plugins/requests/api/resources/registration.rb:99` |
| `Authentication` | `Begin` | `post` | `` | `api/lib/vpsadmin/api/resources/webauthn.rb:115` |
| `Authentication` | `Finish` | `post` | `` | `api/lib/vpsadmin/api/resources/webauthn.rb:151` |
