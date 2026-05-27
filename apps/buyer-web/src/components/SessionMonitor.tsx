"use client";

import { useEffect, useState, useCallback } from "react";
import {
  subscribeToMeteringUpdates,
  subscribeToSessionEvents,
} from "@/lib/socket";
import { api } from "@/lib/api";

interface SessionData {
  sessionToken: string;
  bytesIn: number;
  bytesOut: number;
  duration: number;
  status: "connected" | "disconnected";
  sellerName?: string;
}

export default function SessionMonitor() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    // Listen for real metering updates from billing service
    const unsubMetering = subscribeToMeteringUpdates((data) => {
      setSession((prev) => {
        if (!prev || prev.status !== "connected") return prev;
        return {
          ...prev,
          bytesIn: prev.bytesIn + (data.bytesIn || 0),
          bytesOut: prev.bytesOut + (data.bytesOut || 0),
        };
      });
    });

    // Listen for session end events
    const unsubSession = subscribeToSessionEvents((data) => {
      if (data.status === "ended" || data.status === "terminated") {
        setSession(null);
      }
    });

    return () => {
      unsubMetering();
      unsubSession();
    };
  }, []);

  // Track duration via timer
  useEffect(() => {
    if (!session || session.status !== "connected") return;

    const interval = setInterval(() => {
      setSession((prev) =>
        prev ? { ...prev, duration: prev.duration + 1 } : null
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.status]);

  const handleDisconnect = useCallback(async () => {
    if (!session?.sessionToken) return;

    setDisconnecting(true);
    try {
      await api.sessions.end(session.sessionToken);
      setSession(null);
    } catch {
      // Best effort — session may have already ended
      setSession(null);
    } finally {
      setDisconnecting(false);
    }
  }, [session]);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m
      .toString()
      .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formatMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);

  // Method exposed for parent components to set session
  // In a real app, this would come from a shared store
  if (typeof window !== "undefined") {
    (window as any).__setDravioSession = (data: SessionData) =>
      setSession(data);
  }

  if (!session) {
    return (
      <div className="glass-card p-8" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <div className="flex items-center gap-3 mb-4">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: "rgba(255,255,255,0.2)" }}
          />
          <span className="text-xs font-bold text-white/30 uppercase tracking-widest">
            No Active Session
          </span>
        </div>
        <p className="text-white/20 text-sm">
          Purchase data from the{" "}
          <a href="/marketplace" className="text-primary hover:underline">
            Marketplace
          </a>{" "}
          to start a session.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-8 border-primary/20 shadow-[0_0_30px_rgba(0,242,255,0.05)]">
      <div className="flex justify-between items-start mb-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-bold text-primary uppercase tracking-widest">
              Live Session Active
            </span>
          </div>
          <h3 className="text-3xl font-black">
            {session.sellerName || "VPN Session"}
          </h3>
        </div>
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
        >
          {disconnecting ? "Ending..." : "Disconnect"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <p className="text-xs text-white/30 uppercase mb-1">Data Consumed</p>
          <p className="text-4xl font-black font-mono">
            {formatMB(session.bytesIn)}{" "}
            <span className="text-sm font-normal text-white/40 ml-1">MB</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-white/30 uppercase mb-1">
            Session Duration
          </p>
          <p className="text-4xl font-black font-mono">
            {formatDuration(session.duration)}
          </p>
        </div>
      </div>

      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-secondary shadow-[0_0_10px_rgba(0,242,255,0.5)]"
          style={{
            width: `${Math.min(
              (session.bytesIn / (1024 * 1024 * 1024)) * 100,
              100
            )}%`,
          }}
        />
      </div>
      <div className="flex justify-between items-center mt-2 text-[10px] text-white/20 uppercase font-black">
        <span>0 MB</span>
        <span>Allocated: 1.0 GB</span>
      </div>
    </div>
  );
}
