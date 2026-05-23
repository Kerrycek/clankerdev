# Legacy WebUI → API action cross-check (v3.2.1)

Scanned PHP files under `webui/`.

Total extracted call chains: **516**
Matched to capabilities matrix: **512**
Unmatched: **4**

## Unmatched reasons
- **no_resource_match**: 3
- **no_action:VpsAdmin::API::Resources::Location::Delete**: 1

## Unmatched examples (first 60)
- `/mnt/data/vpsadmin_work/vpsadmin/webui/forms/dns.forms.php`: `$api->dns_record_log->list->getparameters()` → no_resource_match
- `/mnt/data/vpsadmin_work/vpsadmin/webui/pages/page_adminvps.php`: `$api->user($vps->user_id)->public_key->list()` → no_resource_match
- `/mnt/data/vpsadmin_work/vpsadmin/webui/pages/page_cluster.php`: `$api->location->delete()` → no_action:VpsAdmin::API::Resources::Location::Delete
- `/mnt/data/vpsadmin_work/vpsadmin/webui/pages/page_jumpto.php`: `$api->cluster->search(['value' => $search])->getResponse()` → no_resource_match
