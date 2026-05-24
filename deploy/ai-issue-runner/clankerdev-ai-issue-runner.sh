#!/usr/bin/env bash
set -Eeuo pipefail

REPO="${REPO:-Kerrycek/clankerdev}"
REPO_URL="${REPO_URL:-git@github.com:Kerrycek/clankerdev.git}"
BASE_BRANCH="${BASE_BRANCH:-main}"
WORKDIR="${WORKDIR:-/srv/clankerdev-ai/worktree}"
STATE_DIR="${STATE_DIR:-/var/lib/clankerdev-ai}"
LOG_DIR="${LOG_DIR:-/var/log/clankerdev-ai}"
ISSUE_LABEL="${ISSUE_LABEL:-ai-fix}"
IN_PROGRESS_LABEL="${IN_PROGRESS_LABEL:-ai-in-progress}"
DONE_LABEL="${DONE_LABEL:-ai-pr}"
FAILED_LABEL="${FAILED_LABEL:-ai-failed}"
CODEX_MODEL="${CODEX_MODEL:-}"
CODEX_SANDBOX="${CODEX_SANDBOX:-workspace-write}"
CODEX_APPROVAL="${CODEX_APPROVAL:-never}"

mkdir -p "$STATE_DIR" "$LOG_DIR"
exec 9>"$STATE_DIR/runner.lock"
if ! flock -n 9; then
  echo "Another runner instance is active; exiting."
  exit 0
fi

run_id="$(date -u +%Y%m%dT%H%M%SZ)"
run_dir="$STATE_DIR/runs/$run_id"
mkdir -p "$run_dir"
log_file="$LOG_DIR/run-$run_id.log"
exec > >(tee -a "$log_file") 2>&1

echo "[$(date -Is)] clankerdev AI issue runner starting"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 2
  fi
}

need_cmd git
need_cmd gh
need_cmd jq
need_cmd codex

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Run: gh auth login"
  exit 2
fi

ensure_label() {
  local name="$1"
  local color="$2"
  local description="$3"
  gh label create "$name" --repo "$REPO" --color "$color" --description "$description" >/dev/null 2>&1 || true
}

ensure_label "$ISSUE_LABEL" "0e8a16" "Let the Codex issue runner propose a fix"
ensure_label "$IN_PROGRESS_LABEL" "fbca04" "Codex issue runner is working on this"
ensure_label "$DONE_LABEL" "5319e7" "Codex opened a pull request"
ensure_label "$FAILED_LABEL" "b60205" "Codex issue runner failed"

issue_json="$run_dir/issue-list.json"
gh issue list \
  --repo "$REPO" \
  --state open \
  --label "$ISSUE_LABEL" \
  --json number,title,body,url,labels \
  --limit 20 > "$issue_json"

issue_number="$(
  jq -r --arg in_progress "$IN_PROGRESS_LABEL" '
    map(select((.labels // [] | map(.name) | index($in_progress) | not)))
    | first.number // empty
  ' "$issue_json"
)"

if [[ -z "$issue_number" ]]; then
  echo "No open issue with label '$ISSUE_LABEL' is ready."
  exit 0
fi

issue_detail="$run_dir/issue-$issue_number.json"
gh issue view "$issue_number" \
  --repo "$REPO" \
  --json number,title,body,url,comments,labels > "$issue_detail"

issue_title="$(jq -r '.title' "$issue_detail")"
issue_url="$(jq -r '.url' "$issue_detail")"
issue_payload="$(jq '.' "$issue_detail")"
slug="$(printf '%s' "$issue_title" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g' | cut -c1-48)"
if [[ -z "$slug" ]]; then
  slug="issue"
fi
branch="ai/issue-$issue_number-$slug"

open_pr_list="$run_dir/open-pr-list.json"
gh pr list \
  --repo "$REPO" \
  --state open \
  --head "$branch" \
  --json number,title,url,headRefName,baseRefName > "$open_pr_list"

pr_number="$(jq -r '.[0].number // empty' "$open_pr_list")"
pr_url="$(jq -r '.[0].url // empty' "$open_pr_list")"
mode="create"
if [[ -n "$pr_number" ]]; then
  mode="revise"
  echo "Found open PR #$pr_number for $branch; checking review context."
fi

comment_issue_failure() {
  local body_file="$run_dir/failure-comment.md"
  {
    echo "Codex runner failed while working on this issue."
    echo
    echo "Run ID: \`$run_id\`"
    echo "Log file on runner: \`$log_file\`"
    if [[ -s "$last_message" ]]; then
      echo
      echo "Last Codex message:"
      echo
      sed -n '1,120p' "$last_message"
    fi
  } > "$body_file"
  gh issue comment "$issue_number" --repo "$REPO" --body-file "$body_file" >/dev/null || true
  if [[ -n "${pr_number:-}" ]]; then
    gh pr comment "$pr_number" --repo "$REPO" --body-file "$body_file" >/dev/null || true
  fi
  gh issue edit "$issue_number" --repo "$REPO" --remove-label "$IN_PROGRESS_LABEL" --add-label "$FAILED_LABEL" >/dev/null || true
}

gh issue edit "$issue_number" --repo "$REPO" --add-label "$IN_PROGRESS_LABEL" --remove-label "$FAILED_LABEL" >/dev/null || true

if [[ ! -d "$WORKDIR/.git" ]]; then
  mkdir -p "$(dirname "$WORKDIR")"
  git clone "$REPO_URL" "$WORKDIR"
fi

cd "$WORKDIR"
if [[ "$WORKDIR" != /srv/clankerdev-ai/* ]]; then
  echo "Refusing to reset unexpected workdir: $WORKDIR"
  exit 2
fi

prompt_file="$run_dir/prompt.md"
last_message="$run_dir/codex-final.md"

if [[ "$mode" == "revise" ]]; then
  pr_detail="$run_dir/pr-$pr_number.json"
  pr_review_comments="$run_dir/pr-$pr_number-review-comments.json"

  gh pr view "$pr_number" \
    --repo "$REPO" \
    --json number,title,body,url,comments,reviews,headRefName,baseRefName,labels,state,reviewDecision > "$pr_detail"

  gh api "repos/$REPO/pulls/$pr_number/comments" > "$pr_review_comments" || echo "[]" > "$pr_review_comments"

  review_context_hash="$(cat "$issue_detail" "$pr_detail" "$pr_review_comments" | sha256sum | awk '{print $1}')"
  review_context_state="$STATE_DIR/issue-$issue_number-pr-$pr_number.review-context.sha"
  if [[ -f "$review_context_state" && "$(cat "$review_context_state")" == "$review_context_hash" ]]; then
    echo "No new issue or PR review context for issue #$issue_number / PR #$pr_number."
    gh issue edit "$issue_number" --repo "$REPO" --remove-label "$IN_PROGRESS_LABEL" --add-label "$DONE_LABEL" >/dev/null || true
    exit 0
  fi

  git fetch origin "$BASE_BRANCH" "$branch" --prune
  git checkout -B "$branch" "origin/$branch"
  git reset --hard "origin/$branch"
  git clean -fdx

  context_dir="$WORKDIR/.codex-run-context"
  rm -rf "$context_dir"
  mkdir -p "$context_dir"
  cp "$issue_detail" "$context_dir/issue.json"
  cp "$pr_detail" "$context_dir/pr.json"
  cp "$pr_review_comments" "$context_dir/pr-review-comments.json"
  git diff --stat "origin/$BASE_BRANCH...HEAD" > "$context_dir/pr-diff-stat.txt" || true
  git diff --name-status "origin/$BASE_BRANCH...HEAD" > "$context_dir/pr-diff-files.txt" || true
  git diff --color=never "origin/$BASE_BRANCH...HEAD" > "$context_dir/pr-diff.patch" || true

  cat > "$prompt_file" <<EOF
You are the automated Codex maintainer for $REPO.

Revise the existing GitHub pull request for issue #$issue_number.

Issue URL:
$issue_url

Pull request URL:
$pr_url

Issue title:
$issue_title

Context files are available inside the repository checkout:
- .codex-run-context/issue.json
- .codex-run-context/pr.json
- .codex-run-context/pr-review-comments.json
- .codex-run-context/pr-diff-stat.txt
- .codex-run-context/pr-diff-files.txt
- .codex-run-context/pr-diff.patch

Read AGENTS.md first and obey it strictly.

Hard rules:
- Read the issue comments, PR comments, PR reviews, and inline review comments.
- Revise the existing branch according to that feedback.
- Keep useful existing PR work where possible.
- Do not deploy.
- Do not change anything on remote servers.
- Do not modify secrets or credentials.
- Do not push, merge, or create a pull request; the runner handles git and PR updates.
- Keep the change scoped to the issue and review feedback.
- Run relevant tests or lightweight verification when possible.
- Leave the working tree changed with the revision.

In your final response, include:
- Summary of changes.
- Verification performed.
- Which feedback was addressed.
- Risks or follow-up needed.
EOF
else
  git fetch origin "$BASE_BRANCH" --prune
  git checkout -B "$BASE_BRANCH" "origin/$BASE_BRANCH"
  git reset --hard "origin/$BASE_BRANCH"
  git clean -fdx
  git checkout -B "$branch"

  cat > "$prompt_file" <<EOF
You are the automated Codex maintainer for $REPO.

Resolve GitHub issue #$issue_number.

Issue URL:
$issue_url

Issue title:
$issue_title

Issue JSON, including body and comments:

\`\`\`json
$issue_payload
\`\`\`

Read AGENTS.md first and obey it strictly.

Hard rules:
- Do not deploy.
- Do not change anything on remote servers.
- Do not modify secrets or credentials.
- Do not push, merge, or create a pull request; the runner handles git and PR creation.
- Keep the change scoped to the issue.
- Run relevant tests or lightweight verification when possible.
- Leave the working tree changed with the fix.

In your final response, include:
- Summary of changes.
- Verification performed.
- Risks or follow-up needed.
EOF
fi

codex_cmd=(codex --ask-for-approval "$CODEX_APPROVAL" exec -C "$WORKDIR" -s "$CODEX_SANDBOX" -o "$last_message")
if [[ -n "$CODEX_MODEL" ]]; then
  codex_cmd+=(-m "$CODEX_MODEL")
fi
codex_cmd+=(-)

echo "Running Codex in $mode mode for issue #$issue_number on branch $branch"
if ! "${codex_cmd[@]}" < "$prompt_file"; then
  echo "Codex failed for issue #$issue_number"
  rm -rf "$WORKDIR/.codex-run-context"
  comment_issue_failure
  exit 1
fi

rm -rf "$WORKDIR/.codex-run-context"

if [[ -z "$(git status --porcelain)" ]]; then
  no_change_body="$run_dir/no-change-comment.md"
  {
    if [[ "$mode" == "revise" ]]; then
      echo "Codex checked the latest issue/PR feedback but did not leave any repository changes."
    else
      echo "Codex completed but did not leave any repository changes."
    fi
    echo
    echo "Run ID: \`$run_id\`"
    echo "Log file on runner: \`$log_file\`"
    if [[ -s "$last_message" ]]; then
      echo
      echo "Codex summary:"
      echo
      sed -n '1,160p' "$last_message"
    fi
  } > "$no_change_body"
  if [[ "$mode" == "revise" ]]; then
    printf '%s\n' "$review_context_hash" > "$review_context_state"
    gh pr comment "$pr_number" --repo "$REPO" --body-file "$no_change_body" >/dev/null || true
    gh issue edit "$issue_number" --repo "$REPO" --remove-label "$IN_PROGRESS_LABEL" --add-label "$DONE_LABEL" >/dev/null || true
    exit 0
  else
    gh issue comment "$issue_number" --repo "$REPO" --body-file "$no_change_body" >/dev/null || true
    gh issue edit "$issue_number" --repo "$REPO" --remove-label "$IN_PROGRESS_LABEL" --add-label "$FAILED_LABEL" >/dev/null || true
    exit 1
  fi
fi

git add -A
git config user.name "${GIT_AUTHOR_NAME:-clanker-codex}"
git config user.email "${GIT_AUTHOR_EMAIL:-clanker-codex@users.noreply.github.com}"

if [[ "$mode" == "revise" ]]; then
  git commit -m "Revise issue #$issue_number: $issue_title"
  git push origin "$branch"
  printf '%s\n' "$review_context_hash" > "$review_context_state"

  revision_comment="$run_dir/revision-comment.md"
  {
    echo "Codex pushed a revision to the existing PR after reading the latest issue/PR feedback."
    echo
    echo "PR: $pr_url"
    echo
    echo "Run ID: \`$run_id\`"
    echo "No deployment was performed."
    echo
    if [[ -s "$last_message" ]]; then
      sed -n "1,240p" "$last_message"
    else
      echo "Codex did not produce a final summary."
    fi
  } > "$revision_comment"

  gh pr comment "$pr_number" --repo "$REPO" --body-file "$revision_comment" >/dev/null || true
  gh issue edit "$issue_number" --repo "$REPO" --remove-label "$IN_PROGRESS_LABEL" --add-label "$DONE_LABEL" >/dev/null || true
  echo "Updated PR: $pr_url"
else
  git commit -m "Resolve issue #$issue_number: $issue_title"
  git push -u origin "$branch"

  pr_body="$run_dir/pr-body.md"
  {
    echo "Fixes #$issue_number"
    echo
    echo "Automated Codex run: \`$run_id\`"
    echo
    echo "Important: this PR was prepared only for human review. It was not deployed and must not be merged without review."
    echo
    if [[ -s "$last_message" ]]; then
      sed -n "1,240p" "$last_message"
    else
      echo "Codex did not produce a final summary."
    fi
  } > "$pr_body"

  pr_url="$(gh pr create \
    --repo "$REPO" \
    --base "$BASE_BRANCH" \
    --head "$branch" \
    --title "Resolve #$issue_number: $issue_title" \
    --body-file "$pr_body")"

  pr_number="$(gh pr view "$pr_url" --repo "$REPO" --json number --jq '.number')"
  pr_detail="$run_dir/pr-$pr_number.json"
  pr_review_comments="$run_dir/pr-$pr_number-review-comments.json"
  gh pr view "$pr_number" \
    --repo "$REPO" \
    --json number,title,body,url,comments,reviews,headRefName,baseRefName,labels,state,reviewDecision > "$pr_detail"
  gh api "repos/$REPO/pulls/$pr_number/comments" > "$pr_review_comments" || echo "[]" > "$pr_review_comments"
  review_context_hash="$(cat "$issue_detail" "$pr_detail" "$pr_review_comments" | sha256sum | awk '{print $1}')"
  printf '%s\n' "$review_context_hash" > "$STATE_DIR/issue-$issue_number-pr-$pr_number.review-context.sha"

  issue_comment="$run_dir/issue-comment.md"
  {
    echo "Codex opened a pull request for this issue:"
    echo
    echo "$pr_url"
    echo
    echo "Run ID: \`$run_id\`"
    echo "No deployment was performed."
  } > "$issue_comment"

  gh issue comment "$issue_number" --repo "$REPO" --body-file "$issue_comment" >/dev/null || true
  gh issue edit "$issue_number" --repo "$REPO" --remove-label "$IN_PROGRESS_LABEL" --add-label "$DONE_LABEL" >/dev/null || true

  echo "Opened PR: $pr_url"
fi

echo "[$(date -Is)] clankerdev AI issue runner finished"
