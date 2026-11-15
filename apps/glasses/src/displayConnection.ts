export type DisplayCredentials = { sessionId: string; displayToken: string; api: string };
export function parseDisplayCredentials(fragment: string): DisplayCredentials | null {
  const values = new URLSearchParams(fragment.replace(/^#/, ''));
  const sessionId = values.get('sessionId') ?? '';
  const displayToken = values.get('displayToken') ?? '';
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(sessionId) || !/^[a-zA-Z0-9_-]{32,512}$/.test(displayToken)) return null;
  try {
    const api = new URL(values.get('api') ?? '');
    const loopback = api.hostname === 'localhost' || api.hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(api.hostname);
    if (api.username || api.password || api.search || api.hash || api.pathname !== '/' || api.protocol !== 'https:' && !(api.protocol === 'http:' && loopback)) return null;
    return { sessionId, displayToken, api: api.origin };
  } catch { return null; }
}
export function displaySocketUrl(credentials: DisplayCredentials) {
  const url = new URL(`/v1/sessions/${encodeURIComponent(credentials.sessionId)}/display-stream`, credentials.api);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}
export type ObserverSocket = Pick<WebSocket, 'close' | 'onmessage' | 'onclose' | 'onerror'>;
export type ConnectionDependencies = {
  socket: (url: string, protocols: string[]) => ObserverSocket;
  schedule: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancel: (timer: ReturnType<typeof setTimeout>) => void;
};
/** This observer never sends a controller command and never connects to /stream. */
export function connectDisplay(credentials: DisplayCredentials, receive: (message: unknown) => void, disconnected: () => void, dependencies: ConnectionDependencies = {
  socket: (url, protocols) => new WebSocket(url, protocols), schedule: setTimeout, cancel: clearTimeout,
}) {
  let stopped = false;
  let socket: ObserverSocket | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let snapshotReceived = false;
  const connect = () => {
    if (stopped) return;
    snapshotReceived = false;
    try {
      socket = dependencies.socket(displaySocketUrl(credentials), ['actually-display-v1', `display.${credentials.displayToken}`]);
    } catch {
      disconnected();
      timer = dependencies.schedule(connect, Math.min(500 * 2 ** attempt++, 8000));
      return;
    }
    const current = socket;
    socket.onmessage = event => {
      if (stopped || socket !== current || typeof event.data !== 'string' || event.data.length > 100_000) return;
      try {
        const message = JSON.parse(event.data) as { type?: string };
        if (!snapshotReceived && message?.type !== 'display.snapshot') return;
        if (message?.type === 'display.snapshot') { snapshotReceived = true; attempt = 0; }
        receive(message);
      } catch { /* Malformed frames never reach the display. */ }
    };
    socket.onerror = () => { /* The close event drives retry, without logging credentials. */ };
    socket.onclose = event => {
      if (stopped || socket !== current) return;
      disconnected();
      if ([1000, 1008, 4001, 4002, 4003].includes(event.code)) return;
      timer = dependencies.schedule(connect, Math.min(500 * 2 ** attempt++, 8000));
    };
  };
  connect();
  return () => { stopped = true; if (timer) dependencies.cancel(timer); socket?.close(1000); };
}

/** Grant rotation closes the old observer before accepting any frames for the new link. */
export function createDisplayObserver(receive: (message: unknown, sessionId: string) => void, disconnected: () => void, dependencies?: ConnectionDependencies) {
  let stop: (() => void) | undefined;
  let generation = 0;
  return {
    replace(credentials: DisplayCredentials | null) {
      const current = ++generation;
      stop?.();
      stop = undefined;
      if (credentials) stop = connectDisplay(credentials, message => {
        if (current === generation) receive(message, credentials.sessionId);
      }, () => { if (current === generation) disconnected(); }, dependencies);
    },
    stop() { ++generation; stop?.(); stop = undefined; },
  };
}
