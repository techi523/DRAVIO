"use client";

import { io, Socket } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:8080";

let socket: Socket | null = null;

/**
 * Get or create a Socket.IO connection to the Gateway.
 * Authenticates via JWT token from localStorage.
 */
export function getSocket(): Socket {
  if (socket?.connected) return socket;

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("dravio_access_token")
      : null;

  socket = io(WS_URL, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    console.log("[DRAVIO] WebSocket connected");
  });

  socket.on("connect_error", (error) => {
    console.warn("[DRAVIO] Socket error:", error.message);
  });

  socket.on("disconnect", (reason) => {
    console.log("[DRAVIO] Socket disconnected:", reason);
  });

  return socket;
}

/**
 * Disconnect and destroy the socket instance.
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Subscribe to a specific event. Returns an unsubscribe function.
 */
export function onSocketEvent<T = unknown>(
  event: string,
  callback: (data: T) => void
): () => void {
  const s = getSocket();
  s.on(event, callback);
  return () => {
    s.off(event, callback);
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
