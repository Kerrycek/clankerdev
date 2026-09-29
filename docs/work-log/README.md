# Work log

This directory is the versioned record of work on vpsAdmin WebUI Next (Clankerdev),
started on 2026-09-27 for project handover. It records what changed, why, decisions,
verification and release outcomes. It complements the [design handbook](../design/README.md),
requirements, Git history and PRs; it is not a competing specification.

## One file per change

- Create `YYYY-MM-DD-descriptive-change.md` here, using the start date and a stable,
  specific topic (for example `2026-09-27-session-countdown.md`). If that topic
  already exists, continue its file. Use a more specific slug for unrelated work
  with a similar name. Do not rename files when their status or PR number changes.
- One feature may span several PRs. Keep its rationale and dated follow-ups in the
  same file, linking each PR, tested revision and outcome. Before adding a follow-up,
  read the existing record and append at the bottom; retain superseded decisions.
- Unrelated work gets separate files. Do not edit this README, the root compatibility
  pointer or a shared entry list just to add a record. The directory listing is the
  index. This removes a common merge-conflict point for parallel contributors;
  contributors to the same feature still need to coordinate edits to its file.
- A release covering several features can have its own release record. Link the
  relevant feature records rather than duplicating their histories. Later deployment
  evidence belongs in that release record, not unrelated feature PRs.
- Read the relevant feature and latest release records before working. Browse the
  directory or use `rg --files docs/work-log | sort` and `rg 'topic|PR number' docs/work-log`.
  Filenames use the start date; follow-up headings carry their own dates.

## Content and evidence

Write in English. Use Europe/Prague dates unless an explicit UTC timestamp is given.
Record the request, reason, implementation or decision, references, verification,
current stage and next step. State whether a change is prepared, merged, deployed
or blocked, including the target and revision. A green check is not a deployment.

Distinguish synthetic fixture/browser tests, isolated real API checks and anonymous
public checks. Do not call fixture tests live lifecycle certification. Link durable
repository/CI evidence. If evidence is only operator-held, state that limitation.
Do not store credentials, session tokens, personal data, private screenshots or raw
production responses. Recording work does not authorize merging, deployment or
resuming paused automation.

The migrated records retain historical wording and intermediate states; later dated
entries supersede earlier ones. Pre-start entries are selective retrospectives,
not a complete reconstructed history. Missing evidence is not a passing check.

## New record / follow-up template

Copy the template into your change file, removing unused fields. For a follow-up,
append a dated section to that same file rather than replacing its history.

```markdown
# Short feature or change name

## YYYY-MM-DD — Initial change or subsequent outcome

**Request / reason:** ...
**Change / decision:** ...
**References:** PR, commit, issue, requirement, related work-log record or CI links.
**Verification:** commands/results, tested revision, and fixture/live scope.
**Status:** prepared / merged / deployed / blocked (target and revision).
**Next / limitations:** remaining step, risk or required decision.
```

Before committing, run `npm run audit:design-docs` to check local links in every
work-log file as well as the design documentation. Review factual accuracy too.

## Publishing outcomes

A merged feature's initial record is historical, not its permanent status. Add a
dated merge/release follow-up in the next relevant documentation PR before marking
the handover ready. Link that follow-up from the feature or release record; do not
redeploy to publish a receipt. If it is temporarily local, record the branch and
publication task in the private handoff and keep the repository status explicitly
pending an outcome update. Release closure includes publishing the sanitized
receipt; a private chat alone does not close the documentation work.
