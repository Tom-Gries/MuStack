const MAX_BODY_BYTES = 256 * 1024;
const ROUTES = new Map([['session', 'GET'], ['health', 'GET'], ['join', 'POST'], ['command', 'POST'], ['sync', 'POST'], ['presence', 'POST'], ['players', 'GET'], ['materials', 'POST'], ['gift', 'POST']]);
const localHost = (hostname) => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);

function backendOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('BACKEND_URL fehlt oder ist ungültig.'); }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash || !(url.protocol === 'https:' || url.protocol === 'http:' && localHost(url.hostname))) {
    throw new Error('BACKEND_URL muss eine HTTPS-Adresse ohne Pfad oder Zugangsdaten sein.');
  }
  return url.origin;
}

function apiPath(request) {
  const url = new URL(request.url || '/', 'http://proxy.local');
  const rewritten = request.query?.path ?? url.searchParams.get('path');
  return Array.isArray(rewritten) ? rewritten.join('/') : rewritten ?? url.pathname.replace(/^\/api\//, '');
}

async function bodyOf(request) {
  const length = Number(request.headers['content-length']);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) throw Object.assign(new Error('Zu große Spielaktion.'), { status: 413 });
  if (request.body !== undefined) {
    const body = Buffer.isBuffer(request.body) ? request.body : Buffer.from(typeof request.body === 'string' ? request.body : JSON.stringify(request.body));
    if (body.length > MAX_BODY_BYTES) throw Object.assign(new Error('Zu große Spielaktion.'), { status: 413 });
    return body;
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const clean = () => { request.off('data', data); request.off('end', end); request.off('error', failed); request.off('aborted', aborted); };
    const failed = (error) => { clean(); reject(error); };
    const aborted = () => failed(new Error('Spielaktion unterbrochen.'));
    const end = () => { clean(); resolve(Buffer.concat(chunks)); };
    const data = (chunk) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > MAX_BODY_BYTES) { clean(); request.resume(); reject(Object.assign(new Error('Zu große Spielaktion.'), { status: 413 })); return; }
      chunks.push(bytes);
    };
    request.on('data', data); request.on('end', end); request.on('error', failed); request.on('aborted', aborted);
  });
}

function failure(response, status, message) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify({ message }));
}

/** First-party short HTTP requests; the API owns game state and gift delivery. */
export function createApiProxy({ backendUrl, fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  const origin = backendOrigin(backendUrl);
  return async function proxy(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const path = apiPath(request);
    const method = ROUTES.get(path);
    if (!method) return failure(response, 404, 'Dieser API-Endpunkt existiert nicht.');
    if (request.method !== method) {
      response.setHeader('Allow', method);
      return failure(response, 405, 'Diese HTTP-Methode ist hier nicht erlaubt.');
    }
    if (method === 'POST' && !/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] || '')) return failure(response, 415, 'Spielaktionen benötigen JSON.');
    try {
      const headers = { Accept: 'application/json' };
      for (const name of ['cookie', 'origin', 'content-type']) if (request.headers[name]) headers[name] = request.headers[name];
      const body = method === 'POST' ? await bodyOf(request) : undefined;
      const upstream = await fetchImpl(`${origin}/api/${path}`, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
      if (upstream.status >= 300 && upstream.status < 400) return failure(response, 502, 'Der Spielserver ist gerade nicht erreichbar.');
      response.statusCode = upstream.status;
      response.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
      const cookies = upstream.headers.getSetCookie?.() || (upstream.headers.get('set-cookie') ? [upstream.headers.get('set-cookie')] : []);
      if (cookies.length) response.setHeader('Set-Cookie', cookies);
      response.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (error) {
      if (error.status === 413) request.resume?.();
      failure(response, error.status === 413 ? 413 : 502, error.status === 413 ? 'Die Spielaktion ist zu groß.' : 'Der Spielserver ist gerade nicht erreichbar. Bitte erneut versuchen.');
    }
  };
}

export default async function proxy(request, response) {
  try { return await createApiProxy({ backendUrl: process.env.BACKEND_URL })(request, response); }
  catch {
    response.setHeader('Cache-Control', 'no-store');
    return failure(response, 503, 'Die Verbindung zum Spielserver ist noch nicht konfiguriert.');
  }
}
