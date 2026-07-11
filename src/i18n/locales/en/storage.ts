// Storage / datasets / exports / NAS
import { enStorageExports } from "./storage/exports";
export const enStorage = {
  "datasets.list.title": "Datasets",
  "datasets.list.description":
    "Browse storage datasets, snapshots and downloads.",
  "datasets.list.search.placeholder": "Search datasets (name, VPS, user, #id)…",
  "nas.list.title": "NAS",
  "nas.list.description":
    "Browse primary-pool user datasets without VPS-specific filters.",
  "nas.list.search.placeholder": "Search NAS datasets (name, user, #id)…",
  "nas.list.load_error.title": "Failed to load NAS datasets",
  "nas.list.empty.title": "No NAS datasets found",
  "nas.list.empty.body":
    "Primary-pool datasets appear here when the API returns datasets with the primary role.",
  "datasets.smart.suggest.open_dataset": "Open dataset #{id}",
  "datasets.smart.suggest.open_dataset.secondary": "Go to the dataset detail",
  "datasets.smart.suggest.vps_id": "Filter by VPS ID",
  "datasets.smart.suggest.user_id": "Filter by user ID",
  "datasets.smart.suggest.search": "Search: “{q}”",
  "datasets.smart.suggest.search.secondary": "Full-text search",
  "datasets.smart_help.title": "Dataset filters",
  "datasets.smart_help.intro":
    "Use key:value filters or plain text. Press Enter to apply the best suggestion.",
  "datasets.smart_help.items.help": "Show this help",
  "datasets.smart_help.items.open": "Open dataset #123",
  "datasets.smart_help.items.q":
    "Search by dataset name/full name, VPS hostname, or user",
  "datasets.smart_help.items.user": "Filter by owner user (admin only)",
  "datasets.smart_help.items.vps": "Filter by VPS ID",
  "datasets.smart_help.items.free": "Plain text is treated as a search query",
  "datasets.smart_help.footnote":
    'Tip: wrap values with spaces in quotes, e.g. q:"foo bar".',
  "datasets.advanced.q.label": "Search",
  "datasets.advanced.q.placeholder": "Search by dataset, VPS hostname, or user",
  "datasets.advanced.user.label": "Owner",
  "datasets.advanced.user.placeholder": "Select a user…",
  "datasets.advanced.vps.label": "VPS",
  "datasets.advanced.vps.placeholder": "Select a VPS…",
  "datasets.advanced.note":
    "Filters are stored in the URL so you can bookmark/share them.",
  "datasets.list.load_error.title": "Failed to load datasets",
  "datasets.list.empty": "No datasets found.",
  "datasets.usage.aria_label": "Dataset space usage",
  "datasets.usage.no_data": "No data",
  "datasets.usage.used_mib": "{mib} MiB used",
  "datasets.usage.free_mib": "{mib} MiB free",
  "dataset.layout.invalid_id": "Invalid dataset ID",
  "dataset.layout.load_error.title": "Failed to load dataset",
  "dataset.layout.back_to_list": "Back to datasets",
  "dataset.tabs.overview": "Overview",
  "dataset.tabs.snapshots": "Snapshots",
  "dataset.tabs.downloads": "Downloads",
  "dataset.field.name": "Name",
  "dataset.field.pool": "Pool",
  "dataset.field.type": "Type",
  "dataset.field.state": "State",
  "dataset.field.created": "Created",
  "dataset.field.updated": "Updated",
  "dataset.field.usage": "Usage",
  "dataset.field.used": "Used",
  "dataset.field.available": "Available",
  "dataset.field.reference_quota": "Reference quota",
  "dataset.field.quota": "Quota",
  "dataset.field.referenced": "Referenced",
  "dataset.field.children": "Children",
  "dataset.field.snapshots": "Snapshots",
  "dataset.field.mounts": "Mounts",
  "dataset.field.exports": "Exports",
  "dataset.overview.space.title": "Space",
  "dataset.overview.space.note": "Reported in MiB by the API.",
  "dataset.overview.counts.title": "Counts",
  "dataset.overview.details.title": "Details",
  "dataset.overview.actions.title": "Quick actions",
  "dataset.overview.actions.snapshots": "Manage snapshots",
  "dataset.overview.actions.downloads": "Snapshot downloads",
  "dataset.overview.actions.open_vps": "Open VPS",
  "dataset.overview.tips.title": "Tips",
  "dataset.overview.tips.item1":
    "Snapshots let you rollback quickly before risky changes.",
  "dataset.overview.tips.item2":
    "Use incremental downloads to export changes efficiently.",
  "dataset.overview.tips.item3":
    "If an action is blocked, open Tasks to see what is running.",
  "dataset.overview.transactions.title": "Transactions",
  "dataset.overview.transactions.subtitle":
    "Recent transaction chains involving this dataset.",
  "dataset.overview.transactions.loading": "Loading transaction chains…",
  "dataset.overview.transactions.load_error.title":
    "Failed to load transaction chains",
  "dataset.overview.transactions.load_error.body":
    "This dataset’s related transaction chains could not be loaded.",
  "dataset.overview.transactions.empty":
    "No recent transaction chains found for this dataset.",
  "dataset.overview.transactions.chains_chip_title":
    "Transaction chains involving this dataset",
  "dataset.overview.transactions.chains_chip_label": "Chains",
  "dataset.overview.transactions.chain_chip_label": "Chain #{id}",
  "dataset.overview.transactions.chain_items_title":
    "Transaction chain #{id} · show individual transactions",
  "dataset.overview.transactions.chain_items_label": "Tx items",
  "dataset.overview.transactions.page_link_label": "Transaction chains",
  "dataset.overview.transactions.page_link_title":
    "Open the transaction chains page",
  "dataset.overview.transactions.chain_failed_row_title":
    "This transaction chain has failures",
  "dataset.manage.title": "Dataset management",
  "dataset.manage.subtitle":
    "Update dataset size and storage properties directly here.",
  "dataset.manage.current": "Current dataset: {dataset} (#{id})",
  "dataset.manage.user_limited.title": "Admin-managed dataset actions",
  "dataset.manage.user_limited.body":
    "You can resize within available resources. Admins also get destructive actions and quota override.",
  "dataset.manage.create.open": "Create subdataset",
  "dataset.manage.create.title": "Create subdataset",
  "dataset.manage.create.scope":
    "Parent dataset: {dataset}. The new subdataset opens after the create action starts if the API returns its ID.",
  "dataset.manage.create.error": "Dataset creation failed",
  "dataset.manage.edit.title": "Edit dataset properties",
  "dataset.manage.edit.error": "Dataset update failed",
  "dataset.manage.delete.title": "Delete dataset",
  "dataset.manage.delete.description":
    "Delete {dataset} and all its descendants and snapshots? This cannot be undone.",
  "dataset.manage.delete.error": "Dataset deletion failed",
  "dataset.manage.validation.title": "Check dataset properties",
  "dataset.manage.validation.properties":
    "Use non-negative GiB values and a record size between 4 and 128 KiB.",
  "dataset.manage.field.child_name": "Subdataset name",
  "dataset.manage.field.automount": "Automatically mount under parent mounts",
  "dataset.manage.field.quota": "Quota (GiB)",
  "dataset.manage.field.refquota": "Reference quota (GiB)",
  "dataset.manage.field.recordsize": "Record size (KiB)",
  "dataset.manage.field.sync": "Sync",
  "dataset.manage.field.compression": "Compression",
  "dataset.manage.field.atime": "Access time",
  "dataset.manage.field.relatime": "Relative access time",
  "dataset.manage.field.sharenfs": "NFS share",
  "dataset.manage.field.admin_override": "Set regardless of available resources",
  "dataset.manage.field.admin_lock_type": "Admin lock type",
  "dataset.manage.sync.standard": "Standard",
  "dataset.manage.sync.disabled": "Disabled",
  "dataset.manage.admin_lock.no_lock": "No lock",
  "dataset.manage.admin_lock.absolute": "Absolute",
  "dataset.manage.admin_lock.not_less": "Not less",
  "dataset.manage.admin_lock.not_more": "Not more",
  "dataset.snapshots.title": "Snapshots",
  "dataset.snapshots.subtitle":
    "Create, rollback and delete dataset snapshots.",
  "dataset.snapshots.search.placeholder":
    "Filter by snapshot name, label or ID",
  "dataset.snapshots.load_error.title": "Failed to load snapshots",
  "dataset.snapshots.empty": "No snapshots.",
  "dataset.snapshots.created_at": "Created {dt}",
  "dataset.snapshots.create.open": "Create snapshot",
  "dataset.snapshots.create.modal_title": "Create snapshot",
  "dataset.snapshots.create.help":
    "Creates a point-in-time snapshot of this dataset and starts a trackable backend action when the API returns one.",
  "dataset.snapshots.create.scope":
    "Target dataset: {dataset}. The new snapshot appears in this list after the action starts.",
  "dataset.snapshots.create.label.placeholder": "e.g. before-upgrade",
  "dataset.snapshots.create.error.title": "Snapshot creation failed",
  "dataset.snapshots.confirm.rollback.title": "Rollback snapshot?",
  "dataset.snapshots.confirm.rollback.body":
    "This rolls the target dataset back to {snapshot}. Data written after that snapshot can be lost.",
  "dataset.snapshots.confirm.delete.title": "Delete snapshot?",
  "dataset.snapshots.confirm.delete.body":
    "This permanently deletes {snapshot}. Existing download links based on it may stop working.",
  "dataset.download.modal_title": "Create snapshot download",
  "dataset.download.modal_help":
    "Create a temporary download link for {snapshot}.",
  "dataset.download.scope":
    "Target dataset: {dataset}. The generated link appears on the Downloads tab with readiness and expiration details.",
  "dataset.download.field.snapshot": "Snapshot",
  "dataset.download.snapshot.placeholder": "Select a snapshot…",
  "dataset.download.snapshot.help": "Need an older snapshot? Load more.",
  "dataset.download.field.format": "Format",
  "dataset.download.format.archive": "Archive",
  "dataset.download.format.stream": "Stream",
  "dataset.download.format.incremental_stream": "Incremental stream",
  "dataset.download.field.from_snapshot": "From snapshot",
  "dataset.download.from_snapshot.none": "None",
  "dataset.download.from_snapshot.help":
    "Optional base snapshot for incremental send.",
  "dataset.download.load_older": "Load older snapshots",
  "dataset.download.no_more": "No more snapshots",
  "dataset.download.candidates.error.title":
    "Failed to load snapshot candidates",
  "dataset.download.send_mail.label": "Send notification email",
  "dataset.download.create.error.title": "Download creation failed",
  "dataset.download.create_link": "Create link",
  "dataset.download.created.title.pending": "Backup is being prepared",
  "dataset.download.created.title.ready": "Backup is ready",
  "dataset.download.created.body.pending":
    "Preparation is running in the background. When the link is ready, we will send it by email and show it in Downloads.",
  "dataset.download.created.body.ready":
    "The temporary snapshot download link is ready. We sent it by email and it is also available in Downloads.",
  "dataset.download.created.open_downloads": "Open downloads",
  "dataset.downloads.title": "Downloads",
  "dataset.downloads.subtitle": "Create and manage snapshot download links.",
  "dataset.downloads.search.placeholder":
    "Filter by snapshot ID, format, filename or download ID",
  "dataset.downloads.create.open": "New download",
  "dataset.downloads.load_error.title": "Failed to load snapshot downloads",
  "dataset.downloads.empty": "No downloads.",
  "dataset.downloads.state.ready": "Ready",
  "dataset.downloads.state.pending": "Pending",
  "dataset.downloads.state.expired": "Expired",
  "dataset.downloads.state.failed": "Failed",
  "dataset.downloads.state.missing_link": "Link missing",
  "dataset.downloads.state.unknown": "Unknown",
  "dataset.downloads.state_detail.ready": "Ready to download and copy.",
  "dataset.downloads.state_detail.pending":
    "Preparation is still running. When the link is ready, it will be sent by email and shown in Downloads.",
  "dataset.downloads.state_detail.expired":
    "The generated link expired. Create a fresh download before sharing.",
  "dataset.downloads.state_detail.failed":
    "Generation failed. Retry creates a new download request from the same snapshot.",
  "dataset.downloads.state_detail.missing_link":
    "The backend marked this ready but did not expose a usable link. Retry or refresh.",
  "dataset.downloads.state_detail.unknown":
    "The backend did not expose a clear readiness state. Refresh before sharing.",
  "dataset.downloads.item_title": "Download #{id}",
  "dataset.downloads.snapshot_ref": "Snapshot #{id}",
  "dataset.downloads.from_snapshot_ref": "From snapshot #{id}",
  "dataset.downloads.from_snapshot": "From {snapshot}",
  "dataset.downloads.expires_at": "Expires {dt}",
  "dataset.downloads.size": "Size {size}",
  "dataset.downloads.table.snapshot": "Snapshot",
  "dataset.downloads.table.format": "Format",
  "dataset.downloads.table.state": "State",
  "dataset.downloads.table.expires": "Expires",
  "dataset.downloads.create.help":
    "Select a snapshot and choose a format. The API creates a temporary link as a trackable backend action when supported.",
  "dataset.downloads.create.scope":
    "Target dataset: {dataset}. Ready links show their URL, checksum, size and expiration when the API exposes them.",
  "dataset.downloads.confirm.delete.title": "Delete download?",
  "dataset.downloads.confirm.delete.body":
    "This will permanently delete download #{id}.",
  "dataset.downloads.review.title": "Review download request",
  "dataset.downloads.review.intro":
    "Check the source snapshot and lifecycle before creating the generated link.",
  "dataset.downloads.validation.from_snapshot.title":
    "Check incremental base snapshot",
  "dataset.downloads.validation.from_snapshot.body":
    "The base snapshot must be older than the target snapshot for an incremental stream.",
  "dataset.downloads.review.temporary":
    "Generated links are temporary and should be treated as short-lived artifacts.",
  "dataset.downloads.review.readiness":
    "Creation may start a background action; wait for the link to become ready before sharing it.",
  "dataset.downloads.review.incremental":
    "Incremental streams require both snapshots to remain available until the download is consumed.",
  "dataset.downloads.review.full":
    "Full exports do not need a base snapshot, but they can be larger.",
  "dataset.downloads.confirm.delete.review.title": "Deletion review",
  "dataset.downloads.confirm.delete.review.body":
    "Deleting a generated link removes this download artifact only. It does not delete the snapshot.",
  "dataset.tabs.exports": "Exports",
  ...enStorageExports,
  "dataset.tabs.plans": "Plans",
  "dataset.tabs.expansion": "Temporary increase",
  "dataset.plans.title": "Dataset plans",
  "dataset.plans.subtitle": "Assign environment dataset plans to this dataset.",
  "dataset.plans.assigned_count": "Assigned plans",
  "dataset.plans.available_count": "Available to assign",
  "dataset.plans.environment": "Environment",
  "dataset.plans.load_error.title": "Failed to load dataset plans",
  "dataset.plans.empty.title": "No dataset plans assigned",
  "dataset.plans.empty.body":
    "Assign an available plan to automate snapshots or other dataset actions.",
  "dataset.plans.empty.no_available":
    "No assignable environment dataset plans are available for this dataset.",
  "dataset.plans.busy.title": "Dataset is busy",
  "dataset.plans.busy.body":
    "Wait until the current dataset action finishes before changing assigned plans.",
  "dataset.plans.environment_missing.title": "Environment not available",
  "dataset.plans.environment_missing.body":
    "This dataset does not currently expose its environment, so available plans cannot be listed.",
  "dataset.plans.available_load_error.title": "Failed to load available plans",
  "dataset.plans.available_load_error.body":
    "Assigned plans are shown, but the list of available environment plans could not be loaded.",
  "dataset.plans.column.label": "Plan label",
  "dataset.plans.column.source": "Source plan",
  "dataset.plans.column.permissions": "User permissions",
  "dataset.plans.permission.user_add": "User can add",
  "dataset.plans.permission.user_add_off": "User cannot add",
  "dataset.plans.permission.user_remove": "User can remove",
  "dataset.plans.permission.user_remove_off": "User cannot remove",
  "dataset.plans.assign.open": "Assign plan",
  "dataset.plans.assign.title": "Assign dataset plan",
  "dataset.plans.assign.field": "Environment dataset plan",
  "dataset.plans.assign.placeholder": "Select a plan…",
  "dataset.plans.assign.submit": "Assign",
  "dataset.plans.assign.success": "Dataset plan assigned",
  "dataset.plans.assign.error": "Failed to assign dataset plan",
  "dataset.plans.remove.title": "Remove dataset plan?",
  "dataset.plans.remove.body": "This removes {label} from the dataset.",
  "dataset.plans.remove.success": "Dataset plan removed",
  "dataset.plans.remove.error": "Failed to remove dataset plan",
  "dataset.plans.remove.not_allowed": "Removal restricted",
  "dataset.expansion.title": "Temporary quota increase",
  "dataset.expansion.subtitle":
    "Track added quota, safeguards and expansion history for this dataset.",
  "dataset.expansion.load_error.title": "Failed to load dataset expansion",
  "dataset.expansion.busy.title": "Dataset is busy",
  "dataset.expansion.busy.body":
    "Wait until the current dataset action finishes before changing expansion settings.",
  "dataset.expansion.state.active": "Active",
  "dataset.expansion.state.resolved": "Resolved",
  "dataset.expansion.field.added_space": "Added space",
  "dataset.expansion.field.original_refquota": "Original refquota",
  "dataset.expansion.field.current_refquota": "Current refquota",
  "dataset.expansion.field.created": "Created",
  "dataset.expansion.field.notify": "Notifications",
  "dataset.expansion.field.auto_shrink": "Auto-shrink",
  "dataset.expansion.field.stop_vps": "Stop VPS",
  "dataset.expansion.field.max_over": "Max over-quota time",
  "dataset.expansion.field.over_quota": "Over-quota so far",
  "dataset.expansion.empty.title": "No temporary expansion",
  "dataset.expansion.empty.body_admin":
    "Create or register a temporary expansion for this dataset.",
  "dataset.expansion.empty.body_user":
    "This dataset does not currently have a temporary expansion.",
  "dataset.expansion.create.open": "Create expansion",
  "dataset.expansion.register.open": "Register expanded dataset",
  "dataset.expansion.create.title": "Create temporary expansion",
  "dataset.expansion.register.title": "Register already expanded dataset",
  "dataset.expansion.create.submit": "Create expansion",
  "dataset.expansion.register.submit": "Register expansion",
  "dataset.expansion.create.success": "Dataset expansion change started",
  "dataset.expansion.create.error": "Failed to start dataset expansion change",
  "dataset.expansion.edit.title": "Edit expansion settings",
  "dataset.expansion.update.success": "Dataset expansion updated",
  "dataset.expansion.update.error": "Failed to update dataset expansion",
  "dataset.expansion.add_space.open": "Add space",
  "dataset.expansion.add_space.title": "Add more space",
  "dataset.expansion.add_space.submit": "Add space",
  "dataset.expansion.add_space.success":
    "Additional dataset space change started",
  "dataset.expansion.add_space.error": "Failed to add dataset space",
  "dataset.expansion.add_space.warning_title": "Another expansion step",
  "dataset.expansion.add_space.warning_body":
    "Adding more space creates another expansion history item and may trigger VPS-side follow-up actions.",
  "dataset.expansion.form.added_space": "Added space (GiB)",
  "dataset.expansion.form.added_space_hint":
    "Enter the amount of additional space in GiB.",
  "dataset.expansion.form.original_refquota": "Original refquota (GiB)",
  "dataset.expansion.form.original_refquota_hint":
    "Enter the refquota before the dataset was expanded. Current refquota: {current}.",
  "dataset.expansion.form.max_over": "Max over-quota time (hours)",
  "dataset.expansion.form.max_over_hint":
    "Leave empty to let the backend use its default policy.",
  "dataset.expansion.form.enable_notifications": "Send notification emails",
  "dataset.expansion.form.enable_shrink":
    "Allow automatic shrink when possible",
  "dataset.expansion.form.stop_vps":
    "Stop VPS when over-quota limits are exceeded",
  "dataset.expansion.validation.added_space":
    "Added space must be a positive number of GiB.",
  "dataset.expansion.validation.original_refquota":
    "Original refquota must be a positive number of GiB.",
  "dataset.expansion.validation.max_hours":
    "Max over-quota time must be a positive number of hours.",
  "dataset.expansion.history.load_error.title":
    "Failed to load expansion history",
  "dataset.expansion.history.empty.title": "No expansion history yet",
  "dataset.expansion.history.empty.body":
    "No history entries are available for this dataset expansion.",
  "dataset.expansion.history.new_refquota": "New refquota",
  "dataset.expansion.resolved.title": "Expansion is resolved",
  "dataset.expansion.resolved.body":
    "This expansion is no longer active. You can still review its history below.",
  "dataset.expansion.internal_missing_id": "Dataset expansion id is missing.",
} as const;
