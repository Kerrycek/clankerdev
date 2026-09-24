'use strict';

const cookie = require('cookie');
const signature = require('cookie-signature');

// Install BEFORE express-session: its store read and response-time save/touch
// must both happen inside the queue. One BFF process must own each session store.
function createSessionQueue({ name, secret, maxPending = 32 }) {
  const queues = new Map();
  return function sessionQueue(req, res, next) {
    const value = cookie.parse(req.headers.cookie || '')[name];
    const id = value?.startsWith('s:') ? signature.unsign(value.slice(2), secret) : false;
    // Unauthenticated/invalid cookies produce independent new session IDs.
    if (!id) return next();

    let queue = queues.get(id);
    if (!queue) {
      queue = [];
      queues.set(id, queue);
    }
    if (queue.length >= maxPending) {
      res.setHeader('cache-control', 'no-store');
      res.setHeader('retry-after', '1');
      return res.status(503).type('text/plain').send('Session busy. Please retry.');
    }

    const run = () => {
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        queue.shift();
        if (queue.length) queueMicrotask(queue[0]);
        else queues.delete(id);
      };
      if (res.destroyed) return release();

      // express-session wraps this end and calls it AFTER its asynchronous
      // store write. Socket close alone must not unlock a still-running refresh.
      const end = res.end;
      res.end = function (...args) {
        try { return end.apply(this, args); }
        finally { release(); }
      };
      try { next(); }
      catch (error) { next(error); }
    };
    queue.push(run);
    if (queue.length === 1) run();
  };
}

module.exports = { createSessionQueue };
