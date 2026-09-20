# Password-recovery runtime on dev.crucio.cz

The OAuth password-reset form writes requests into a database-backed queue.
The API process does not consume that queue. A separate worker must be running,
and the built-in `password_recovery` and `user_password_changed` notification
templates must exist before the worker starts.

On 2026-09-19 the active API release contained the queue and worker code, but
both systemd units were absent and the two templates were missing. A submitted
request therefore remained pending. Merely updating or restarting the API does
not repair this state.

## Reviewed rollout

The installer is deliberately a dry run unless both mutation flags are passed:

```sh
deploy/dev.crucio.cz/install-password-recovery-runtime.sh
deploy/dev.crucio.cz/install-password-recovery-runtime.sh \
  --apply --confirm-mail-delivery
```

Before apply mode, inspect the pending queue and confirm that the active dev
mailer path is allowed to deliver its messages. Starting the worker consumes
queued requests and can send recovery mail; the confirmation flag records that
this effect was considered. Do not use this helper on production.

Apply mode performs these operations in order:

1. verify the active API release, API, supervisor and mailer node service;
2. acquire a non-blocking host lock, then validate and atomically install the
   two tracked systemd units;
3. run the idempotent built-in-template installer;
4. enable and restart the queue worker only after template installation passed;
5. verify the worker process uses the active release and wait for the queue to
   drain without printing identifiers, recipients, tokens or other secrets.

Unit files are backed up before replacement. A failed rollout restores their
previous files, enabled state and active state. Notification-template inserts
are intentionally not deleted during rollback: they are additive, idempotent
configuration required by the active API release.

## API release checklist

The worker keeps the Ruby code loaded from the release that started it. After
every change of `/srv/vpsadmin-release/current`, rerun the reviewed installer so
new templates are installed and the worker restarts from the new release. Then
run the read-only health check:

```sh
deploy/dev.crucio.cz/check-password-recovery-runtime.sh
```

The check fails when a dependency or template is missing, the worker points at
an old release, password recovery is disabled, no active mailer node exists, or
the queue does not drain within `QUEUE_WAIT_SECONDS` (20 seconds by default).
