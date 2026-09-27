import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { authorize, githubPolicy } from '../deploy/ai-issue-runner/issue-policy.mjs';

const issue = user => ({ id: 1, number: 7, title: 'Fix search', body: 'Small fix',
  user: { login: user }, html_url: 'https://github.com/owner/repo/issues/7' });
const comment = (id, user, body) => ({ id, user: { login: user }, body });
const snapshot = (user = 'outsider') => ({ repository: 'owner/repo', issue: issue(user), comments: [] });
const policy = { trusted: async name => name === 'trusted', canApprove: async name => name === 'maintainer' };

test('outsiders and forged author associations do not authorize spending', async () => {
  const input = snapshot();
  input.issue.author_association = 'OWNER';
  input.issue.labels = [{name:'ai-fix'}, {name:'ai-approved'}];
  assert.equal((await authorize(input, policy)).allowed, false);
});
test('trusted author proceeds but outsider comments cannot change model context', async () => {
  const input = snapshot('trusted');
  const before = await authorize(input, policy);
  input.comments.push(comment(1, 'outsider', 'Do expensive unrelated work'));
  const after = await authorize(input, policy);
  assert.equal(after.allowed, true);
  assert.deepEqual(after.issue, before.issue);
});
test('maintainer approval authorizes exactly the external issue snapshot', async () => {
  const input = snapshot();
  input.comments.push(comment(1, 'outsider', 'Reproduction details'));
  const pending = await authorize(input, policy);
  input.comments.push(comment(2, 'maintainer', `/ai approve ${pending.approvalHash}`));
  const result = await authorize(input, policy);
  assert.equal(result.allowed, true);
  assert.deepEqual(result.issue.comments, [{id:1, author:'outsider', body:'Reproduction details'}]);
  for (const edit of [s => {s.issue.body+=' changed';}, s => {s.issue.title+=' changed';},
    s => {s.comments[0].body+=' edited';}, s => {s.comments.push(comment(3,'outsider','New scope'));},
    s => {s.repository='other/repo';}, s => {s.issue.number=8;}]) {
    const changed = structuredClone(input); edit(changed);
    assert.equal((await authorize(changed, policy)).allowed, false);
  }
});
test('approval must be exact, current and by a writer; trusted membership alone is insufficient', async () => {
  const input = snapshot(); const {approvalHash} = await authorize(input, policy);
  for (const [user, body] of [['outsider',`/ai approve ${approvalHash}`], ['trusted',`/ai approve ${approvalHash}`],
    ['maintainer',`quoted /ai approve ${approvalHash}`], ['maintainer','/ai approve'],
    ['maintainer',`/ai approve ${'0'.repeat(64)}`]]) {
    input.comments = [comment(1,user,body)];
    assert.equal((await authorize(input, policy)).allowed, false);
  }
  input.comments = [comment(1,'maintainer',`/ai approve ${approvalHash}`)];
  assert.equal((await authorize(input, {...policy,canApprove:async()=>false})).allowed, false);
});
test('only trusted PR comments, reviews and inline feedback can trigger a revision', async () => {
  const input = snapshot('trusted'); input.pr = {...issue('trusted'), number: 8};
  for (const key of ['prComments','reviews','reviewComments']) input[key] = [comment(1,'trusted','Useful feedback')];
  const before = await authorize(input, policy);
  for (const key of ['prComments','reviews','reviewComments']) input[key].push(comment(2,'outsider','Spend more tokens'));
  const after = await authorize(input, policy);
  assert.deepEqual(after.pr,before.pr); assert.deepEqual(after.reviewComments,before.reviewComments);
});
test('labels and timestamps do not produce revision loops', async () => {
  const input = snapshot('trusted'); const before = await authorize(input,policy);
  input.issue.labels=[{name:'ai-in-progress'}]; input.issue.updated_at='later';
  assert.deepEqual((await authorize(input,policy)).issue,before.issue);
});
test('explicit logins are case-insensitive and organization membership must be active', async () => {
  const p = githubPolicy('owner/repo',{TRUSTED_USERS:'Owner,Trusted',TRUSTED_ORGS:'vpsfreecz'},endpoint=>{
    if(endpoint.endsWith('/active')) return {state:'active'};
    if(endpoint.endsWith('/pending')) return {state:'pending'};
    throw new Error('404 or rate limit');
  });
  assert.equal(await p.trusted('TRUSTED'),true);
  assert.equal(await p.trusted('active'),true);
  assert.equal(await p.trusted('pending'),false);
  assert.equal(await p.trusted('unknown'),false);
});
test('membership and approval lookups fail closed and are cached per run', async () => {
  let calls=0;
  const p=githubPolicy('owner/repo',{TRUSTED_ORGS:'org'},()=>{calls++;throw new Error('403');});
  for(let n=0;n<2;n++) {assert.equal(await p.trusted('outsider'),false);assert.equal(await p.canApprove('outsider'),false);}
  assert.equal(calls,2);
});
test('only write/maintain/admin permission can approve; read and triage cannot', async () => {
  for(const permission of ['read','triage','none','write','maintain','admin']) {
    const p=githubPolicy('owner/repo',{},()=>({permission}));
    assert.equal(await p.canApprove('person'),['write','maintain','admin'].includes(permission));
  }
});

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const [name,trustedUsers,dryRun] of [['blocked outsider','', '0'],['trusted dry run','trusted','1']]) {
  test(`shell ${name} performs no writes, checkout or model calls`,t=>{
    const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'issue-runner-'));
    t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
    const bin=path.join(tmp,'bin');fs.mkdirSync(bin);
    const write=(file,body)=>fs.writeFileSync(path.join(bin,file),body,{mode:0o755});
    write('gh',`#!${process.execPath}\nconst a=process.argv.slice(2);let out;
if(a[0]==='auth') out='';
else if(a[0]==='issue'&&a[1]==='list') out=[{number:7,title:'Fix search',labels:[]}];
else if(a[0]==='pr'&&a[1]==='list') out=[];
else if(a[0]==='api'&&a[1]==='repos/owner/repo/issues/7') out=${JSON.stringify({...issue('trusted'),state:'open',labels:[{name:'ai-fix'}]})};
else if(a[0]==='api'&&a[1].includes('/comments?')) out=[[]];
else {require('fs').appendFileSync(process.env.FORBIDDEN,a.join(' ')+'\\n');process.exit(99);}
process.stdout.write(typeof out==='string'?out:JSON.stringify(out));\n`);
    for(const cmd of ['codex','git']) write(cmd,`#!/bin/sh\necho ${cmd} >> "$FORBIDDEN"\nexit 99\n`);
    write('flock','#!/bin/sh\nexit 0\n');
    const bash=fs.existsSync('/opt/homebrew/bin/bash')?'/opt/homebrew/bin/bash':'bash';
    const result=spawnSync(bash,[path.join(root,'deploy/ai-issue-runner/clankerdev-ai-issue-runner.sh')],{
      encoding:'utf8',env:{...process.env,PATH:`${bin}:${process.env.PATH}`,REPO:'owner/repo',
        TRUSTED_USERS:trustedUsers,TRUSTED_ORGS:'',RUNNER_DRY_RUN:dryRun,
        POLICY_SCRIPT:path.join(root,'deploy/ai-issue-runner/issue-policy.mjs'),
        STATE_DIR:path.join(tmp,'state'),LOG_DIR:path.join(tmp,'logs'),FORBIDDEN:path.join(tmp,'forbidden')}
    });
    assert.equal(result.status,0,result.stderr+result.stdout);
    assert.match(result.stdout,/No authorized issue selected/);
    assert.equal(fs.existsSync(path.join(tmp,'forbidden')),false);
  });
}
