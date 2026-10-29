import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as flush } from 'node:timers/promises';
import { createGameConnection } from '../src/lib/game-connection.js';

function timers() {
  let now = 0, next = 0;
  const pending = new Map();
  return {
    clock: () => now,
    setTimer: (callback, delay) => { const id = ++next; pending.set(id, { at: now + delay, callback }); return id; },
    clearTimer: (id) => pending.delete(id),
    pending,
    async advance(ms) {
      const end = now + ms;
      while (true) {
        const first = [...pending].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!first) break;
        now = first[1].at; pending.delete(first[0]); first[1].callback(); await flush();
      }
      now = end; await flush();
    },
  };
}
class Socket {
  constructor(url, protocols) { this.url = url; this.protocols = protocols; this.readyState = 0; this.sent = []; }
  open() { this.readyState = 1; this.onopen?.(); }
  receive(event) { this.onmessage?.({ data: JSON.stringify(event) }); }
  send(data) { this.sent.push(JSON.parse(data)); }
  close() { this.readyState = 3; this.onclose?.(); }
}
function fixture(t, { hidden = false, requestTicket } = {}) {
  const page = new EventTarget(); page.hidden = hidden;
  const network = new EventTarget();
  const time = timers();
  let online = true;
  const requests = [], sockets = [], statuses = [], events = [], errors = [];
  let currentSocket = null, disconnects = 0;
  const connection = createGameConnection({
    page, network, ...time, pageProtocol: 'https:', random: () => 0,
    isOnline: () => online,
    requestTicket: (signal) => { requests.push(signal); return requestTicket ? requestTicket(signal) : Promise.resolve({ socketUrl: 'wss://api.example/api/socket', ticket: String(requests.length).padStart(32, 'a') }); },
    createSocket: (url, protocols) => { const ws = new Socket(url, protocols); sockets.push(ws); return ws; },
    onSocket: (ws) => { currentSocket = ws; },
    onStatus: (status) => statuses.push(status),
    onDisconnect: () => disconnects++,
    onEvent: (event) => events.push(event),
    onError: (error) => errors.push(error),
  });
  t.after(() => connection.stop());
  return {
    connection, page, network, time, requests, sockets, statuses, events, errors,
    get currentSocket() { return currentSocket; }, get disconnects() { return disconnects; },
    async start() { connection.start(); await flush(); },
    async hide(value = true) { page.hidden = value; page.dispatchEvent(new Event('visibilitychange')); await flush(); },
    async setOnline(value) { online = value; network.dispatchEvent(new Event(value ? 'online' : 'offline')); await flush(); },
    ready() { const ws = sockets.at(-1); ws.open(); ws.receive({ type: 'state', world: { revision: sockets.length } }); return ws; },
  };
}

test('a hidden tab releases its connection after 30 seconds and resumes with a fresh state', async (t) => {
  const f = fixture(t); await f.start();
  const old = f.ready();
  await f.hide(); await f.time.advance(29_999);
  assert.deepEqual(old.sent.at(-1), { type: 'visibility', hidden: true });
  assert.equal(old.readyState, 1);
  await f.time.advance(1);
  assert.equal(old.readyState, 3);
  assert.equal(f.statuses.at(-1), 'paused');
  const events = f.events.length;
  old.receive({ type: 'state', world: { revision: 999 } });
  await f.time.advance(300_000);
  assert.equal(f.events.length, events, 'late callbacks from a parked socket are ignored');
  assert.equal(f.requests.length, 1, 'a parked tab never retries in the background');
  await f.hide(false);
  assert.equal(f.requests.length, 2);
  assert.equal(f.statuses.at(-1), 'connecting');
  f.ready();
  assert.equal(f.statuses.at(-1), 'connected');
});

test('a brief tab switch keeps the live socket and opening a background tab never connects', async (t) => {
  const f = fixture(t); await f.start(); const ws = f.ready();
  await f.hide(); await f.time.advance(20_000); await f.hide(false); await f.time.advance(20_000);
  assert.equal(ws.readyState, 1); assert.equal(f.requests.length, 1);
  assert.deepEqual(ws.sent, [{ type: 'visibility', hidden: true }, { type: 'visibility', hidden: false }]);
  const background = fixture(t, { hidden: true }); await background.start();
  await background.time.advance(300_000); assert.equal(background.requests.length, 0);
  await background.hide(false); assert.equal(background.requests.length, 1);
});

test('offline and pagehide stop retries, and returning online or from page cache restores the socket', async (t) => {
  const f = fixture(t); await f.start(); const ws = f.ready();
  await f.setOnline(false);
  assert.equal(ws.readyState, 3); assert.equal(f.statuses.at(-1), 'offline');
  await f.time.advance(300_000); assert.equal(f.requests.length, 1);
  await f.setOnline(true); const next = f.ready();
  assert.equal(f.requests.length, 2);
  f.network.dispatchEvent(new Event('pagehide'));
  assert.equal(next.readyState, 3);
  f.network.dispatchEvent(new Event('pageshow')); await flush();
  assert.equal(f.requests.length, 3);
});

test('pausing aborts a pending ticket request and its late response cannot open a socket', async (t) => {
  let resolve;
  const f = fixture(t, { requestTicket: () => new Promise((done) => { resolve = done; }) });
  await f.start(); await f.hide();
  assert.equal(f.requests[0].aborted, true);
  assert.equal(f.time.pending.size, 0);
  resolve({ socketUrl: 'wss://api.example/api/socket', ticket: 'a'.repeat(32) }); await flush();
  assert.equal(f.sockets.length, 0);
  await f.hide(false);
  resolve({ socketUrl: 'wss://api.example/api/socket', ticket: 'b'.repeat(32) }); await flush();
  assert.equal(f.sockets.length, 1);
});

test('prepared one-use tickets reconnect without HTTP and fall back to HTTP after an unsuccessful upgrade', async (t) => {
  const f = fixture(t); await f.start(); const ws = f.ready();
  ws.receive({ type: 'socket-ticket', ticket: 'b'.repeat(32), serverTime: 999_000, expiresAt: 1_029_000, socketUrl: 'wss://untrusted.example/api/socket' });
  ws.close(); await f.time.advance(700);
  assert.equal(f.requests.length, 1, 'no proxy/API ticket request is needed');
  const prepared = f.sockets.at(-1);
  assert.equal(prepared.url, ws.url);
  assert.equal(prepared.protocols[1], `ticket.${'b'.repeat(32)}`);
  assert.equal(f.statuses.at(-1), 'connecting', 'an upgrade alone does not declare a synchronized world');
  prepared.close(); await f.time.advance(1400);
  assert.equal(f.requests.length, 2, 'a consumed ticket is not reused after failure');
});

test('expired or malformed prepared tickets use a fresh HTTP ticket and stopping removes all work', async (t) => {
  const f = fixture(t); await f.start(); const ws = f.ready();
  ws.receive({ type: 'socket-ticket', ticket: 'b'.repeat(32), serverTime: 1000, expiresAt: 31000 });
  await f.time.advance(30_001); ws.close(); await f.time.advance(700);
  assert.equal(f.requests.length, 2);
  const next = f.ready();
  next.receive({ type: 'socket-ticket', ticket: 'bad ticket', serverTime: 1000, expiresAt: 31000 });
  next.close(); await f.time.advance(700);
  assert.equal(f.requests.length, 3);
  f.connection.stop();
  assert.equal(f.time.pending.size, 0);
  const calls = f.requests.length;
  await f.hide(false); await f.setOnline(true); await f.time.advance(60_000);
  assert.equal(f.requests.length, calls);
});

test('an upgrade or initial state that never arrives is closed and retried rather than staying stuck', async (t) => {
  const f = fixture(t); await f.start();
  const first = f.sockets[0];
  await f.time.advance(12_000);
  assert.equal(first.readyState, 3);
  assert.equal(f.errors.length, 1);
  assert.equal(f.statuses.at(-1), 'reconnecting');
  await f.time.advance(700);
  assert.equal(f.requests.length, 2);
  const second = f.sockets[1]; second.open();
  await f.time.advance(12_000);
  assert.equal(second.readyState, 3, 'an open socket also needs an initial state');
});
