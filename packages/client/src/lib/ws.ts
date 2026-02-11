import type { WsMessage, ServerEventName, ServerEvents } from '@faceless/shared';
import { useConnectionStore } from '../stores/connection.js';
import { getAuthToken } from './api.js';

type EventHandler<E extends ServerEventName> = (data: ServerEvents[E]) => void;

class WsClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<Function>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const url = useConnectionStore.getState().getWsUrl();
    const token = getAuthToken();
    if (!token) return;
    this.ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);

    this.ws.onopen = () => {
      console.log('[WS] Connected');
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        const eventHandlers = this.handlers.get(msg.event);
        if (eventHandlers) {
          for (const handler of eventHandlers) {
            handler(msg.data);
          }
        }
      } catch {
        // Ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      console.log('[WS] Disconnected, reconnecting in 3s...');
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  send<E extends string>(event: E, data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data }));
    }
  }

  on<E extends ServerEventName>(event: E, handler: EventHandler<E>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }
}

export const wsClient = new WsClient();
