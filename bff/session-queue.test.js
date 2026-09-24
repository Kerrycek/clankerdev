'use strict';
const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');
const express = require('express');
const session = require('express-session');
const signature = require('cookie-signature');
const { createSessionQueue } = require('./session-queue');
const secret = 'fixture-signing-secret-long-enough';
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

test('queue spans delayed store persistence and bounds pending requests', async () => {
  const app = express(), store = new session.MemoryStore();
  const held = deferred(), entered = deferred(), secondArrived = deferred();
  const originalSet = store.set.bind(store);
  let delay = true, reads = 0;
  store.set = (id, value, cb) => {
    if (!delay) return originalSet(id, value, cb);
    entered.resolve(); held.promise.then(() => originalSet(id, value, cb));
  };
  const originalGet = store.get.bind(store);
  store.get = (...args) => { reads += 1; originalGet(...args); };
  await new Promise((resolve) => originalSet('fixture-id', { cookie: { maxAge: 60000 }, counter: 0 }, resolve));
  app.use((req, _res, next) => { if (req.query.second) secondArrived.resolve(); next(); });
  app.use(createSessionQueue({ name: 'sid', secret, maxPending: 2 }));
  app.use(session({ name: 'sid', secret, store, resave: false, saveUninitialized: false }));
  app.get('/', (req, res) => { req.session.counter += 1; res.json({ counter: req.session.counter }); });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  const value = 's:' + signature.sign('fixture-id', secret);
  const headers = { cookie: `sid=${encodeURIComponent(value)}` };
  try {
    const first = fetch(url, { headers }).then((r) => r.json()); await entered.promise;
    const second = fetch(url + '?second=1', { headers }).then((r) => r.json());
    await secondArrived.promise;
    const rejected = await fetch(url, { headers });
    assert.equal(rejected.status, 503);
    assert.equal(reads, 1, 'queued requests must not load stale store snapshots');
    delay = false; held.resolve();
    assert.deepEqual(await first, { counter: 1 });
    assert.deepEqual(await second, { counter: 2 });
    assert.deepEqual(await (await fetch(url, { headers })).json(), { counter: 3 });
  } finally { delay = false; held.resolve(); await new Promise((r) => server.close(r)); }
});
