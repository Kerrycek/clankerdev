import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const login = value => String(value ?? '').toLowerCase();
const actor = item => login(item?.user?.login);
const command = body => /^\/ai approve ([a-f0-9]{64})$/.exec(String(body ?? '').trim());
const isCommand = item => /^\/ai\s/.test(String(item.body ?? '').trim());
const comment = item => ({ id: item.id, author: actor(item), body: item.body ?? '',
  ...(item.path ? { path: item.path, line: item.line ?? item.original_line } : {}),
  ...(item.state ? { state: item.state } : {}) });
const record = item => ({ number: item.number, title: item.title, body: item.body ?? '',
  url: item.html_url, author: actor(item) });

// No author_association, issue text, labels or display names grant trust.
export async function authorize(snapshot, { trusted, canApprove }) {
  const issue = snapshot.issue;
  if (!actor(issue)) throw new Error('Issue author is missing');
  const normalComments = snapshot.comments.filter(item => !isCommand(item));
  const trustedComments = [];
  const externalComments = [];
  for (const item of normalComments) {
    (await trusted(actor(item)) ? trustedComments : externalComments).push(comment(item));
  }
  const approvalHash = createHash('sha256').update(JSON.stringify({
    repository: snapshot.repository.toLowerCase(), issue: record(issue),
    externalComments,
  })).digest('hex');
  let approved = false;
  for (const item of snapshot.comments) {
    if (command(item.body)?.[1] === approvalHash && await canApprove(actor(item))) {
      approved = true;
      break;
    }
  }
  const authorTrusted = await trusted(actor(issue));
  const allowed = authorTrusted || approved;
  const onlyTrusted = async items => {
    const result = [];
    for (const item of items ?? []) {
      if (!isCommand(item) && await trusted(actor(item))) result.push(comment(item));
    }
    return result;
  };
  return {
    allowed, reason: authorTrusted ? 'trusted author' : approved ? 'maintainer-approved snapshot' : 'approval required',
    approvalHash,
    issue: { ...record(issue), comments: normalComments
      .filter(item => approved || trustedComments.some(c => c.id === item.id)).map(comment) },
    pr: snapshot.pr ? { ...record(snapshot.pr),
      comments: await onlyTrusted(snapshot.prComments), reviews: await onlyTrusted(snapshot.reviews) } : null,
    reviewComments: await onlyTrusted(snapshot.reviewComments),
  };
}

export function githubPolicy(repository, env, api) {
  const parse = value => new Set(String(value ?? '').split(/[\s,]+/).filter(Boolean).map(login));
  const users = parse(env.TRUSTED_USERS);
  const orgs = parse(env.TRUSTED_ORGS);
  for (const value of [...users, ...orgs]) {
    if (!/^[a-z0-9][a-z0-9-]*(?:\[bot\])?$/.test(value)) throw new Error('Invalid trusted login or organization');
  }
  const trustCache = new Map();
  const permissionCache = new Map();
  return {
    trusted: async name => {
      name = login(name);
      if (!name) return false;
      if (users.has(name)) return true;
      if (!trustCache.has(name)) {
        let member = false;
        for (const org of orgs) {
          try {
            if (api(`orgs/${encodeURIComponent(org)}/memberships/${encodeURIComponent(name)}`).state === 'active') {
              member = true;
              break;
            }
          } catch { /* Unknown membership is not permission to spend tokens. */ }
        }
        trustCache.set(name, member);
      }
      return trustCache.get(name);
    },
    canApprove: async name => {
      name = login(name);
      if (!name) return false;
      if (!permissionCache.has(name)) {
        let allowed = false;
        try {
          const permission = api(`repos/${repository}/collaborators/${encodeURIComponent(name)}/permission`);
          allowed = permission.user?.permissions?.push === true || ['admin', 'write', 'maintain'].includes(permission.permission);
        } catch { /* Fail closed on missing permissions, rate limits and errors. */ }
        permissionCache.set(name, allowed);
      }
      return permissionCache.get(name);
    },
  };
}

function api(endpoint, pages = false) {
  const args = ['api', endpoint, ...(pages ? ['--paginate', '--slurp'] : [])];
  const result = JSON.parse(execFileSync('gh', args, { encoding: 'utf8', timeout: 30000,
    maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }));
  return pages ? result.flat() : result;
}

async function main() {
  const [repository, issueNumber, prNumber, output] = process.argv.slice(2);
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? '') || !/^\d+$/.test(issueNumber ?? '') ||
      !/^\d+$/.test(prNumber ?? '') || !output) throw new Error('Expected repository, issue number, PR number (0 for none), output directory');
  const issue = api(`repos/${repository}/issues/${issueNumber}`);
  if (issue.pull_request || issue.state !== 'open') throw new Error('Expected an open issue');
  const queueLabel = process.env.ISSUE_LABEL || 'ai-fix';
  if (!issue.labels?.some(label => label.name === queueLabel)) throw new Error('Issue is no longer queued');
  const comments = api(`repos/${repository}/issues/${issueNumber}/comments?per_page=100`, true);
  const snapshot = { repository, issue, comments };
  if (prNumber !== '0') {
    snapshot.pr = api(`repos/${repository}/pulls/${prNumber}`);
    snapshot.prComments = api(`repos/${repository}/issues/${prNumber}/comments?per_page=100`, true);
    snapshot.reviews = api(`repos/${repository}/pulls/${prNumber}/reviews?per_page=100`, true);
    snapshot.reviewComments = api(`repos/${repository}/pulls/${prNumber}/comments?per_page=100`, true);
  }
  const result = await authorize(snapshot, githubPolicy(repository, process.env, api));
  fs.mkdirSync(output, { recursive: true });
  for (const [name, content] of Object.entries({ decision: { allowed: result.allowed, reason: result.reason,
    approvalHash: result.approvalHash }, issue: result.issue, pr: result.pr, 'review-comments': result.reviewComments })) {
    fs.writeFileSync(path.join(output, `${name}.json`), JSON.stringify(content, null, 2) + '\n', { mode: 0o600 });
  }
  console.log(`Issue #${issueNumber}: ${result.reason}${result.allowed ? '' : `; approve with /ai approve ${result.approvalHash}`}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => { console.error('Issue policy could not be verified; refusing to run Codex.'); process.exitCode = 1; });
}
