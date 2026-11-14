import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectDisplay, createDisplayObserver, displaySocketUrl, parseDisplayCredentials, type ObserverSocket } from './displayConnection.js';
const credentials = { sessionId: 'session-1', displayToken: 'a'.repeat(40), api: 'http://localhost:3000' };
const fragment = (api: string) => new URLSearchParams({ ...credentials, api }).toString();
afterEach(() => vi.useRealTimers());
describe('display observer credentials and connection', () => {
  it('accepts HTTPS/loopback only, validates credentials, and never puts tokens in a URL', () => {
    expect(parseDisplayCredentials(fragment('https://api.example.com'))?.api).toBe('https://api.example.com');
    expect(parseDisplayCredentials(fragment('http://127.0.0.1:3000'))).not.toBeNull();
    for (const api of ['http://api.example.com', 'javascript:alert(1)', 'https://user:pass@example.com', 'https://example.com/?token=secret', 'https://example.com/path', 'file:///tmp/a']) expect(parseDisplayCredentials(fragment(api))).toBeNull();
    expect(parseDisplayCredentials(fragment(credentials.api).replace(credentials.displayToken, 'short'))).toBeNull();
    const url = displaySocketUrl(credentials);
    expect(url).toBe('ws://localhost:3000/v1/sessions/session-1/display-stream');
    expect(url).not.toContain(credentials.displayToken);
  });
  it('opens only the observer protocol, waits for snapshot, clears disconnect and reconnects with snapshot', () => {
    vi.useFakeTimers();
    const sockets: ObserverSocket[] = [];
    const create = vi.fn(() => { const socket = { close: vi.fn(), onmessage: null, onclose: null, onerror: null } as ObserverSocket; sockets.push(socket); return socket; });
    const receive = vi.fn(); const disconnected = vi.fn();
    const stop = connectDisplay(credentials, receive, disconnected, { socket: create, schedule: setTimeout, cancel: clearTimeout });
    expect(create).toHaveBeenCalledWith(displaySocketUrl(credentials), ['actually-display-v1', `display.${credentials.displayToken}`]);
    const message = (socket: ObserverSocket, data: string) => socket.onmessage?.call({} as WebSocket, { data } as MessageEvent);
    message(sockets[0], '{invalid'); message(sockets[0], JSON.stringify({ type: 'claim.result' }));
    expect(receive).not.toHaveBeenCalled();
    message(sockets[0], JSON.stringify({ type: 'display.snapshot' }));
    expect(receive).toHaveBeenCalledTimes(1);
    sockets[0].onclose?.call({} as WebSocket, { code: 1006 } as CloseEvent);
    expect(disconnected).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(500);
    expect(create).toHaveBeenCalledTimes(2);
    message(sockets[1], JSON.stringify({ type: 'claim.result' }));
    expect(receive).toHaveBeenCalledTimes(1);
    stop();
    expect(sockets[1].close).toHaveBeenCalledWith(1000);
    message(sockets[0], JSON.stringify({ type: 'display.snapshot' }));
    expect(receive).toHaveBeenCalledTimes(1);
  });
  it('does not retry a rejected/expired grant or after cleanup', () => {
    vi.useFakeTimers();
    const socket = { close: vi.fn(), onmessage: null, onclose: null, onerror: null } as ObserverSocket;
    const create = vi.fn(() => socket);
    const stop = connectDisplay(credentials, vi.fn(), vi.fn(), { socket: create, schedule: setTimeout, cancel: clearTimeout });
    socket.onclose?.call({} as WebSocket, { code: 1008 } as CloseEvent);
    vi.runAllTimers();
    expect(create).toHaveBeenCalledOnce();
    stop();
    vi.runAllTimers();
    expect(create).toHaveBeenCalledOnce();
  });
  it('re-pairs to a fresh fragment grant and rejects all old socket callbacks', () => {
    const sockets: ObserverSocket[] = [];
    const create = vi.fn(() => { const socket = { close: vi.fn(), onmessage: null, onclose: null, onerror: null } as ObserverSocket; sockets.push(socket); return socket; });
    const receive = vi.fn(); const disconnected = vi.fn();
    const observer = createDisplayObserver(receive, disconnected, { socket: create, schedule: setTimeout, cancel: clearTimeout });
    observer.replace(credentials);
    const oldMessage = sockets[0].onmessage;
    const oldClose = sockets[0].onclose;
    const next = { ...credentials, sessionId: 'new-session', displayToken: 'b'.repeat(40) };
    observer.replace(next);
    expect(sockets[0].close).toHaveBeenCalledWith(1000);
    expect(create).toHaveBeenLastCalledWith(displaySocketUrl(next), ['actually-display-v1', `display.${next.displayToken}`]);
    oldMessage?.call({} as WebSocket, { data: JSON.stringify({ type: 'display.snapshot' }) } as MessageEvent);
    oldClose?.call({} as WebSocket, { code: 1006 } as CloseEvent);
    expect(receive).not.toHaveBeenCalled();
    expect(disconnected).not.toHaveBeenCalled();
    sockets[1].onmessage?.call({} as WebSocket, { data: JSON.stringify({ type: 'display.snapshot' }) } as MessageEvent);
    expect(receive).toHaveBeenCalledWith({ type: 'display.snapshot' }, 'new-session');
    observer.stop();
    expect(sockets[1].close).toHaveBeenCalledWith(1000);
  });

  it('handles a browser socket-construction failure quietly and cancels its retry', () => {
    vi.useFakeTimers();
    const create = vi.fn(() => { throw new Error('Browser blocked connection'); });
    const disconnected = vi.fn();
    const stop = connectDisplay(credentials, vi.fn(), disconnected, { socket: create, schedule: setTimeout, cancel: clearTimeout });
    expect(disconnected).toHaveBeenCalledOnce();
    stop();
    vi.runAllTimers();
    expect(create).toHaveBeenCalledOnce();
  });

});
