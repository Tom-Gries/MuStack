import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApiProxy } from '../api/proxy.js';
import { socketTicketOptions } from '../src/useGame.js';

async function serve(t, handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('frontend HTTP proxy forwards cookie, origin and raw JSON while preserving first-party login cookies', async (t) => {
  const upstream = await serve(t, async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    assert.equal(request.url, '/api/join');
    assert.equal(request.headers.cookie, 'wald_und_werk=opaque');
    assert.equal(request.headers.origin, 'https://game.example');
    assert.deepEqual(JSON.parse(Buffer.concat(chunks)), { name: 'Tom' });
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Set-Cookie', ['wald_und_werk=next; HttpOnly; SameSite=Lax; Path=/', 'extra=value; Path=/']);
    response.statusCode = 201; response.end(JSON.stringify({ player: { name: 'Tom' } }));
  });
  const front = await serve(t, createApiProxy({ backendUrl: upstream }));
  const response = await fetch(`${front}/api/proxy?path=join`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'wald_und_werk=opaque', Origin: 'https://game.example' }, body: JSON.stringify({ name: 'Tom' }) });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.match(response.headers.getSetCookie()[0], /HttpOnly; SameSite=Lax; Path=\//);
  assert.deepEqual(await response.json(), { player: { name: 'Tom' } });
});

test('frontend proxy accepts parsed Vercel request bodies and route arrays', async (t) => {
  let seen;
  const proxy = createApiProxy({ backendUrl: 'https://api.example', fetchImpl: async (url, options) => { seen = { url, options }; return new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } }); } });
  const front = await serve(t, (request, response) => {
    request.query = { path: ['command'] }; request.body = { command: { type: 'move' }, commandId: 'id' };
    return proxy(request, response);
  });
  const response = await fetch(`${front}/api/proxy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 200);
  assert.equal(seen.url, 'https://api.example/api/command');
  assert.deepEqual(JSON.parse(seen.options.body), { command: { type: 'move' }, commandId: 'id' });
  assert.equal(seen.options.redirect, 'manual');
});

test('frontend proxy forwards backend failures and allows the ticket route without changing payloads', async (t) => {
  const proxy = createApiProxy({ backendUrl: 'https://api.example', fetchImpl: async (url) => new Response(JSON.stringify({ message: url.endsWith('socket-ticket') ? 'Sitzung fehlt.' : 'Veralteter Stand.' }), { status: url.endsWith('socket-ticket') ? 401 : 409 }) });
  const front = await serve(t, proxy);
  const response = await fetch(`${front}/api/socket-ticket`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: 'Sitzung fehlt.' });
  const conflict = await fetch(`${front}/api/proxy?path=command`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(conflict.status, 409);
});

test('the proxy cannot be used for arbitrary upstream paths, methods, media types or URLs', async (t) => {
  let calls = 0;
  const front = await serve(t, createApiProxy({ backendUrl: 'https://api.example', fetchImpl: async () => { calls++; return new Response('{}'); } }));
  for (const path of ['https://elsewhere.example', '../admin', 'socket', 'admin', 'session%2Fextra']) {
    const response = await fetch(`${front}/api/proxy?path=${encodeURIComponent(path)}`);
    assert.equal(response.status, 404);
  }
  assert.equal((await fetch(`${front}/api/proxy?path=join`)).status, 405);
  assert.equal((await fetch(`${front}/api/proxy?path=join`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status, 415);
  assert.equal(calls, 0);
  for (const backendUrl of ['', 'javascript:alert(1)', 'http://remote.example', 'https://user:pass@api.example', 'https://api.example/api', 'https://api.example/?url=other', 'https://api.example/#fragment']) assert.throws(() => createApiProxy({ backendUrl }));
});

test('oversized raw and already parsed commands are rejected before reaching the API', async (t) => {
  let calls = 0;
  const proxy = createApiProxy({ backendUrl: 'https://api.example', fetchImpl: async () => { calls++; return new Response('{}'); } });
  const front = await serve(t, proxy);
  const large = JSON.stringify({ content: 'x'.repeat(256 * 1024) });
  const response = await fetch(`${front}/api/proxy?path=command`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: large });
  assert.equal(response.status, 413);
  const parsed = await serve(t, (request, response) => { request.body = JSON.parse(large); return proxy(request, response); });
  const parsedResponse = await fetch(`${parsed}/api/proxy?path=command`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(parsedResponse.status, 413);
  assert.equal(calls, 0);
});

test('proxy network errors and redirects fail without leaking credentials or following the destination', async (t) => {
  const front = await serve(t, createApiProxy({ backendUrl: 'https://api.example', fetchImpl: async () => { throw new Error('sensitive backend details'); } }));
  const response = await fetch(`${front}/api/health`);
  assert.equal(response.status, 502);
  assert.equal((await response.text()).includes('sensitive'), false);
  const redirect = await serve(t, createApiProxy({ backendUrl: 'https://api.example', fetchImpl: async () => new Response(null, { status: 302, headers: { Location: 'https://elsewhere.example' } }) }));
  assert.equal((await fetch(`${redirect}/api/health`)).status, 502);
});

test('socket tickets travel in protocols rather than URLs, with secure or local socket origins', () => {
  const ticket = 'a-random-opaque-socket-ticket';
  const result = socketTicketOptions({ socketUrl: 'wss://api.example/api/socket', ticket }, 'https:');
  assert.deepEqual(result, { url: 'wss://api.example/api/socket', protocols: ['stackfriends', `ticket.${ticket}`] });
  assert.ok(!result.url.includes(ticket));
  assert.equal(socketTicketOptions({ socketUrl: 'ws://localhost:3001/api/socket', ticket }, 'http:').url, 'ws://localhost:3001/api/socket');
  for (const socketUrl of ['ws://api.example/api/socket', 'https://api.example/api/socket', 'wss://user:pass@api.example/api/socket', 'wss://api.example/api/socket?ticket=secret', 'wss://api.example/elsewhere']) assert.throws(() => socketTicketOptions({ socketUrl, ticket }, 'https:'));
  assert.throws(() => socketTicketOptions({ socketUrl: 'wss://api.example/api/socket', ticket: 'invalid token value' }, 'https:'));
});
