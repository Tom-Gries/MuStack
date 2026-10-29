import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import { createApiProxy } from '../../api/proxy.js';

async function apiServerFactory() {
  const apiDirectory = process.env.API_DIR
    ? path.resolve(process.env.API_DIR)
    : fileURLToPath(new URL('../../../backend/', import.meta.url));
  try {
    return (await import(pathToFileURL(path.join(apiDirectory, 'server/app.js')).href)).createGameServer;
  } catch (cause) {
    throw new Error(`Der optionale Integrationstest benötigt einen installierten API-Checkout unter ${apiDirectory}. Im API-Repository zuerst npm ci ausführen oder API_DIR auf dessen Ordner setzen.`, { cause });
  }
}

test('separate frontend and API preserve a first-party session and synchronize direct ticket sockets', async (t) => {
  const createGameServer = await apiServerFactory();
  const directory = await mkdtemp(path.join(tmpdir(), 'stackfriends-split-'));
  const frontendOrigin = 'https://game.example.test';
  const config = { mode: 'local', worldFile: path.join(directory, 'world.json'), secureCookie: false, publicOrigin: frontendOrigin };
  const api = await createGameServer({ config });
  await new Promise((resolve) => api.server.listen(0, '127.0.0.1', resolve));
  const apiOrigin = `http://127.0.0.1:${api.server.address().port}`;
  config.socketOrigin = apiOrigin;
  const frontend = http.createServer(createApiProxy({ backendUrl: apiOrigin }));
  await new Promise((resolve) => frontend.listen(0, '127.0.0.1', resolve));
  const address = `http://127.0.0.1:${frontend.address().port}`;
  const sockets = [];
  t.after(async () => {
    sockets.forEach((socket) => socket.terminate());
    await new Promise((resolve) => frontend.close(resolve));
    await api.close();
    if (path.dirname(directory) !== path.resolve(tmpdir()) || !path.basename(directory).startsWith('stackfriends-split-')) throw new Error('Ungültiger Test-Verzeichnispfad.');
    await rm(directory, { recursive: true, force: true });
  });
  async function request(endpoint, body, cookie) {
    return fetch(`${address}/api/${endpoint}`, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: frontendOrigin, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  }
  const joined = await request('join', { name: 'Getrennt' });
  assert.equal(joined.status, 200);
  const cookieHeader = joined.headers.get('set-cookie');
  assert.match(cookieHeader, /HttpOnly/i); assert.match(cookieHeader, /SameSite=Lax/i);
  assert.ok(!/Domain=/i.test(cookieHeader));
  const cookie = cookieHeader.split(';')[0];
  const state = await joined.json();
  const restored = await (await request('session', undefined, cookie)).json();
  assert.equal(restored.player.id, state.player.id);
  async function connect() {
    const ticketResponse = await request('socket-ticket', {}, cookie);
    assert.equal(ticketResponse.status, 200);
    const ticket = await ticketResponse.json();
    assert.equal(new URL(ticket.socketUrl).host, new URL(apiOrigin).host);
    assert.equal(new URL(ticket.socketUrl).search, '');
    const socket = new WebSocket(ticket.socketUrl, ['stackfriends', `ticket.${ticket.ticket}`], { headers: { Origin: frontendOrigin } });
    sockets.push(socket);
    const messages = [], waiters = [];
    socket.on('message', (buffer) => { const event = JSON.parse(buffer.toString()); messages.push(event); for (const wake of [...waiters]) wake(event); });
    const wait = (predicate) => {
      const existing = messages.find(predicate); if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Keine Socketbestätigung erhalten.')), 4000);
        const receive = (event) => { if (predicate(event)) { clearTimeout(timeout); waiters.splice(waiters.indexOf(receive), 1); resolve(event); } };
        waiters.push(receive);
      });
    };
    await wait((event) => event.type === 'state');
    return { socket, wait };
  }
  const first = await connect(), second = await connect();
  first.socket.send(JSON.stringify({ type: 'command', commandId: 'split-move', command: { type: 'move', cardId: state.player.cardId, x: 650, y: 350, split: true } }));
  await first.wait((event) => event.type === 'ack' && event.commandId === 'split-move');
  const patch = await second.wait((event) => event.type === 'patch' && event.upsert?.some((card) => card.id === state.player.cardId && card.x === 650));
  assert.ok(patch.revision > state.world.revision);
  const confirmed = await (await request('session', undefined, cookie)).json();
  assert.equal(confirmed.world.cards.find((card) => card.id === state.player.cardId).x, 650);
  assert.equal((await fetch(`${apiOrigin}/`)).headers.get('content-type')?.includes('application/json'), true);
});
