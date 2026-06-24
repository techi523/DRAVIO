"use client";

import { io, Socket } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || (process.env.NODE_ENV === 'production' ? 'https://api.dravio.com' : 'http://localhost:8080');

// ─── Singleton Socket Manager ──────────────────────────────────────

let socket: Socket | null = null;
let connectionState: "disconnected" | "connecting" | "connected" = "disconnected";
let currentToken: string | null = null;

/**
 * Get or create a Socket.IO connection to the Gateway.
 * Authenticates via JWT token from localStorage.
 * Implements proper singleton with connection state tracking.
 */
export function getSocket(): Socket {
  // Return existing socket if connected or actively connecting
  if (socket && (socket.connected || connectionState === "connecting")) {
    return socket;
  }

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("dravio_access_token")
      : null;

  // Don't create a socket without auth
  if (!token) {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    connectionState = "disconnected";
    // Return a noop socket to prevent errors
    return createNoopSocket();
  }

  // If token changed, disconnect old socket
  if (socket && currentToken !== token) {
    socket.disconnect();
    socket = null;
  }

  currentToken = token;
  connectionState = "connecting";

  socket = io(WS_URL, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 15000,
    timeout: 10000,
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    connectionState = "connected";
    console.log("[DRAVIO] WebSocket connected:", socket?.id);

    // Auto-join user's room for targeted events
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.sub) {
        socket?.emit("join_room", payload.sub);
      }
    } catch {
      // Token decode failed — non-fatal
    }

    // Notify UI components
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("dravio:socket_connected"));
    }
  });

  socket.on("connect_error", (error) => {
    console.warn("[DRAVIO] Socket error:", error.message);

    // If auth failed, don't keep reconnecting with bad token
    if (error.message.includes("AUTHENTICATION_FAILED")) {
      connectionState = "disconnected";
      socket?.disconnect();
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("dravio:socket_error", { detail: { message: error.message } })
      );
    }
  });

  socket.on("disconnect", (reason) => {
    connectionState = "disconnected";
    console.log("[DRAVIO] Socket disconnected:", reason);

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("dravio:socket_disconnected", { detail: { reason } })
      );
    }
  });

  // Handle token refresh — reconnect with new token
  socket.io.on("reconnect_attempt", () => {
    const freshToken = typeof window !== "undefined"
      ? localStorage.getItem("dravio_access_token")
      : null;
    if (freshToken && socket) {
      socket.auth = { token: freshToken };
      currentToken = freshToken;
    }
  });

  return socket;
}

/**
 * Creates a no-op socket proxy that won't throw errors
 * Used when there's no auth token available.
 */
function createNoopSocket(): Socket {
  return {
    connected: false,
    on: () => {},
    off: () => {},
    emit: () => {},
    disconnect: () => {},
    connect: () => {},
    id: undefined,
  } as unknown as Socket;
}

/**
 * Disconnect and destroy the socket instance.
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  connectionState = "disconnected";
  currentToken = null;
}

/**
 * Reconnect with a fresh token (called after token refresh).
 */
export function reconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  connectionState = "disconnected";
  currentToken = null;
  getSocket();
}

/**
 * Get current connection state.
 */
export function getConnectionState(): string {
  return connectionState;
}

/**
 * Subscribe to a specific event. Returns an unsubscribe function.
 * Includes deduplication via event timestamp tracking.
 */
const recentEvents = new Map<string, number>();
const DEDUPE_WINDOW = 100; // ms

export function onSocketEvent<T = unknown>(
  event: string,
  callback: (data: T) => void,
  dedupe = true
): () => void {
  const s = getSocket();

  const wrappedCallback = (data: T) => {
    if (dedupe) {
      const key = `${event}:${JSON.stringify(data)}`;
      const now = Date.now();
      const lastSeen = recentEvents.get(key);
      if (lastSeen && now - lastSeen < DEDUPE_WINDOW) {
        return; // Duplicate event within window
      }
      recentEvents.set(key, now);

      // Clean old entries periodically
      if (recentEvents.size > 100) {
        const cutoff = now - DEDUPE_WINDOW * 2;
        for (const [k, v] of recentEvents) {
          if (v < cutoff) recentEvents.delete(k);
        }
      }
    }
    callback(data);
  };

  s.on(event, wrappedCallback);
  return () => {
    s.off(event, wrappedCallback);
  };
}

// ─── Typed Event Subscriptions ─────────────────────────────────────

export const subscribeToBalanceUpdates = (
  callback: (data: { balance: number }) => void
) => onSocketEvent("balance_update", callback);

export const subscribeToBillingAlerts = (
  callback: (data: { type: string; message: string }) => void
) => onSocketEvent("billing_alert", callback);

export const subscribeToSessionEvents = (
  callback: (data: { sessionId: string; status: string }) => void
) => onSocketEvent("session_ended", callback);

export const subscribeToMeteringUpdates = (
  callback: (data: { bytesIn: number; bytesOut: number }) => void
) => onSocketEvent("metering_update", callback);

export const subscribeToPeerUpdates = (
  callback: (data: { sellerId: string; status: string; sellerData?: any }) => void
) => onSocketEvent("peer_update", callback);

export const subscribeToSessionStarted = (
  callback: (data: { sessionId: string; sessionToken: string }) => void
) => onSocketEvent("session_started", callback);

// ─── Auth Lifecycle Integration ────────────────────────────────────

if (typeof window !== "undefined") {
  // Connect socket when user authenticates
  window.addEventListener("dravio:authenticated", () => {
    reconnectSocket();
  });

  // Disconnect socket when user logs out
  window.addEventListener("dravio:logged_out", () => {
    disconnectSocket();
  });

  // Reconnect with fresh token after refresh
  window.addEventListener("dravio:token_refreshed", () => {
    // Update socket auth for next reconnect
    const freshToken = localStorage.getItem("dravio_access_token");
    if (socket && freshToken) {
      socket.auth = { token: freshToken };
      currentToken = freshToken;
    }
  });
}
