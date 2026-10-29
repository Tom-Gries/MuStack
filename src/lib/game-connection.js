export function socketTicketOptions(result, pageProtocol = location.protocol) {
  const url = new URL(result.socketUrl);
  if (!/^[A-Za-z0-9_-]{16,200}$/.test(result.ticket || '') || url.username || url.password || url.pathname !== '/api/socket' || url.search || url.hash
    || !(url.protocol === 'wss:' || url.protocol === 'ws:' && pageProtocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('Die Echtzeitverbindung konnte nicht vorbereitet werden.');
  return { url: url.href, protocols: ['stackfriends', `ticket.${result.ticket}`] };
}

// Keep the connection lifecycle outside React so pauses, aborted requests and
// delayed socket callbacks share one generation and can be tested together.
export function createGameConnection({
  requestTicket, onEvent, onStatus, onSocket, onDisconnect, onError,
  page = document, network = window, isOnline = () => navigator.onLine !== false,
  createSocket = (url, protocols) => new WebSocket(url, protocols),
  clock = () => performance.now(), random = Math.random,
  setTimer = setTimeout, clearTimer = clearTimeout,
  pageProtocol = location.protocol, hiddenDelayMs = 30_000,
}) {
  let stopped = true;
  let paused = false;
  let generation = 0;
  let attempt = 0;
  let socket = null;
  let ticketRequest = null;
  let reconnectTimer;
  let hiddenTimer;
  let stateTimer;
  let preparedTicket;
  const closeSocket = (ws) => { try { ws?.close(); } catch { /* Already closing. */ } };

  function suspend(reason) {
    if (stopped) return;
    paused = true;
    generation++;
    clearTimer(reconnectTimer); reconnectTimer = undefined;
    clearTimer(hiddenTimer); hiddenTimer = undefined;
    clearTimer(stateTimer); stateTimer = undefined;
    ticketRequest?.abort(); ticketRequest = null;
    const previous = socket;
    socket = null; onSocket(null);
    closeSocket(previous);
    onDisconnect();
    onStatus(reason);
  }

  function reconnect() {
    if (stopped || paused) return;
    if (!isOnline()) return suspend('offline');
    if (page.hidden) return suspend('paused');
    onStatus('reconnecting');
    clearTimer(reconnectTimer);
    reconnectTimer = setTimer(() => { reconnectTimer = undefined; connect(); }, Math.min(15000, 700 * 2 ** attempt++) + random() * 500);
  }

  async function connect() {
    if (stopped || paused || socket || ticketRequest) return;
    if (!isOnline()) return suspend('offline');
    if (page.hidden) return suspend('paused');
    const currentGeneration = ++generation;
    onStatus('connecting');
    const controller = new AbortController();
    ticketRequest = controller;
    let timeout;
    let ws;
    try {
      // Take a prepared ticket out of memory before trying it: a failed
      // upgrade must fetch a fresh one, never retry a consumed credential.
      const prepared = preparedTicket;
      preparedTicket = undefined;
      let result;
      if (prepared && prepared.deadline > clock() + 1000) result = prepared;
      else {
        timeout = setTimer(() => controller.abort(), 12000);
        controller.signal.addEventListener('abort', () => clearTimer(timeout), { once: true });
        result = await requestTicket(controller.signal);
      }
      if (stopped || paused || currentGeneration !== generation) return;
      const options = socketTicketOptions(result, pageProtocol);
      ws = createSocket(options.url, options.protocols);
    } catch (error) {
      if (!stopped && !paused && currentGeneration === generation) {
        onError(error.name === 'AbortError' ? 'Die Echtzeitverbindung ist gerade nicht erreichbar.' : error.message);
        reconnect();
      }
      return;
    } finally {
      clearTimer(timeout);
      if (ticketRequest === controller) ticketRequest = null;
    }
    socket = ws; onSocket(ws);
    const current = () => !stopped && !paused && socket === ws && generation === currentGeneration;
    stateTimer = setTimer(() => {
      if (!current()) return;
      onError('Der aktuelle Spielstand konnte nicht geladen werden. Die Verbindung wird erneut aufgebaut.');
      closeSocket(ws);
    }, 12000);
    ws.onopen = () => { if (!current()) closeSocket(ws); };
    ws.onmessage = ({ data }) => {
      if (!current()) return;
      let event;
      try { event = JSON.parse(data); } catch { return; }
      if (!event || typeof event !== 'object') return;
      if (event.type === 'socket-ticket') {
        const remaining = Math.min(30_000, event.expiresAt - event.serverTime);
        if (/^[A-Za-z0-9_-]{32}$/.test(event.ticket || '') && Number.isFinite(event.serverTime) && Number.isFinite(event.expiresAt) && remaining > 1000) {
          // Bind to the authenticated socket's URL, never to an event URL.
          // A monotonic deadline also survives changes to the computer clock.
          preparedTicket = { socketUrl: ws.url, ticket: event.ticket, deadline: clock() + remaining };
        }
      }
      if (event.type === 'state') {
        clearTimer(stateTimer); stateTimer = undefined;
        attempt = 0; onStatus('connected');
      }
      onEvent(event, ws);
    };
    ws.onclose = () => {
      if (!current()) return;
      clearTimer(stateTimer); stateTimer = undefined;
      socket = null; onSocket(null);
      onDisconnect(); reconnect();
    };
    ws.onerror = () => { if (current()) closeSocket(ws); };
  }

  function resume() {
    if (stopped || page.hidden) return;
    if (!isOnline()) return suspend('offline');
    clearTimer(hiddenTimer); hiddenTimer = undefined;
    if (!paused) return;
    paused = false; attempt = 0;
    connect();
  }
  function visibility() {
    clearTimer(hiddenTimer); hiddenTimer = undefined;
    if (page.hidden) {
      if (!paused && (!socket || socket.readyState !== 1)) return suspend('paused');
      if (!paused) {
        sendVisibility(true);
        hiddenTimer = setTimer(() => suspend('paused'), hiddenDelayMs);
      }
    } else { sendVisibility(false); resume(); }
  }
  function sendVisibility(hidden) {
    if (stopped || paused || socket?.readyState !== 1) return;
    try { socket.send(JSON.stringify({ type: 'visibility', hidden })); }
    catch { closeSocket(socket); }
  }
  const offline = () => suspend('offline');
  const pageHide = () => suspend('paused');

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      page.addEventListener('visibilitychange', visibility);
      network.addEventListener('online', resume);
      network.addEventListener('offline', offline);
      network.addEventListener('pagehide', pageHide);
      network.addEventListener('pageshow', visibility);
      if (page.hidden || !isOnline()) suspend(isOnline() ? 'paused' : 'offline');
      else { paused = false; connect(); }
    },
    stop() {
      if (stopped) return;
      suspend('paused'); stopped = true;
      preparedTicket = undefined;
      page.removeEventListener('visibilitychange', visibility);
      network.removeEventListener('online', resume);
      network.removeEventListener('offline', offline);
      network.removeEventListener('pagehide', pageHide);
      network.removeEventListener('pageshow', visibility);
    },
  };
}
