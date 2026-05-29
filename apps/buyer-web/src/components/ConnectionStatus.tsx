"use client";

import React, { useEffect, useState } from "react";

type ConnStatus = "online" | "degraded" | "offline";

export function ConnectionStatus() {
  const [status, setStatus] = useState<ConnStatus>("online");
  const [socketConnected, setSocketConnected] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Monitor browser online/offline
    const handleOnline = () => updateStatus(true, socketConnected);
    const handleOffline = () => updateStatus(false, socketConnected);

    // Monitor socket events
    const handleSocketConnected = () => {
      setSocketConnected(true);
      updateStatus(navigator.onLine, true);
    };
    const handleSocketDisconnected = () => {
      setSocketConnected(false);
      updateStatus(navigator.onLine, false);
    };
    const handleSocketError = () => {
      setSocketConnected(false);
      updateStatus(navigator.onLine, false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("dravio:socket_connected", handleSocketConnected);
    window.addEventListener("dravio:socket_disconnected", handleSocketDisconnected);
    window.addEventListener("dravio:socket_error", handleSocketError);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("dravio:socket_connected", handleSocketConnected);
      window.removeEventListener("dravio:socket_disconnected", handleSocketDisconnected);
      window.removeEventListener("dravio:socket_error", handleSocketError);
    };
  }, [socketConnected]);

  const updateStatus = (isOnline: boolean, isSocketConnected: boolean) => {
    if (!isOnline) {
      setStatus("offline");
      setVisible(true);
    } else if (!isSocketConnected) {
      setStatus("degraded");
      setVisible(true);
      // Auto-hide degraded status after 10 seconds
      setTimeout(() => {
        setVisible((v) => (status === "degraded" ? false : v));
      }, 10000);
    } else {
      setStatus("online");
      // Show "reconnected" briefly then hide
      setVisible(true);
      setTimeout(() => setVisible(false), 3000);
    }
  };

  if (!visible) return null;

  return (
    <div
      className="fixed top-20 left-1/2 z-50 animate-fade-in"
      style={{ transform: "translateX(-50%)" }}
    >
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest border"
        style={{
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          background:
            status === "offline"
              ? "rgba(255, 80, 80, 0.1)"
              : status === "degraded"
              ? "rgba(255, 200, 0, 0.1)"
              : "rgba(0, 255, 170, 0.1)",
          borderColor:
            status === "offline"
              ? "rgba(255, 80, 80, 0.3)"
              : status === "degraded"
              ? "rgba(255, 200, 0, 0.3)"
              : "rgba(0, 255, 170, 0.3)",
          color:
            status === "offline"
              ? "#ff5050"
              : status === "degraded"
              ? "#ffc800"
              : "#00ffaa",
        }}
      >
        <span
          className="w-2 h-2 rounded-full"
          style={{
            background:
              status === "offline"
                ? "#ff5050"
                : status === "degraded"
                ? "#ffc800"
                : "#00ffaa",
            animation: status !== "online" ? "pulse 2s ease-in-out infinite" : "none",
          }}
        />
        {status === "offline" && "No Internet Connection"}
        {status === "degraded" && "Reconnecting to Real-Time Server..."}
        {status === "online" && "Connected"}
      </div>
    </div>
  );
}
