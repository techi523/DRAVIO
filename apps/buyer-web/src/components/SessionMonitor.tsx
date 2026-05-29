// noinspection JSXElementNotInternationalized
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  subscribeToMeteringUpdates,
  subscribeToSessionEvents,
  subscribeToSessionStarted,
} from "@/lib/socket";
import { api, type ActiveSession } from "@/lib/api";

interface SessionDisplay {
  id: string;
  sessionToken: string;
  hardwareId: string;
  bytesUsed: number;
  costAccumulated: number;
  duration: number;
  status: "connected" | "disconnected";
  startedAt: string;
}

export default function SessionMonitor() {
  const t = (str: string) => str;
  const [sessions, setSessions] = useState<SessionDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Fetch active sessions from backend on mount
  const fetchActiveSessions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.sessions.getActive();
      const mapped: SessionDisplay[] = (data.sessions || []).map(
        (s: ActiveSession) => ({
          id: s.id,
          sessionToken: s.session_token,
          hardwareId: s.hardware_id,
          bytesUsed: parseInt(String(s.bytes_used || "0"), 10),
          costAccumulated: parseFloat(String(s.cost_accumulated || "0")),
          duration: Math.floor(
            (Date.now() - new Date(s.started_at).getTime()) / 1000
          ),
          status: "connected" as const,
          startedAt: s.started_at,
        })
      );
      setSessions(mapped);
    } catch (err: any) {
      setError(err.message || "Failed to fetch active sessions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveSessions();

    const handleReconnect = () => fetchActiveSessions();
    window.addEventListener("dravio:socket_connected", handleReconnect);
    return () => window.removeEventListener("dravio:socket_connected", handleReconnect);
  }, [fetchActiveSessions]);

  // Listen for real-time events
  useEffect(() => {
    // Listen for real metering updates from billing service
    const unsubMetering = subscribeToMeteringUpdates((data) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.status === "connected"
            ? {
                ...s,
                bytesUsed: s.bytesUsed + (data.bytesIn || 0) + (data.bytesOut || 0),
              }
            : s
        )
      );
    });

    // Listen for session end events
    const unsubSession = subscribeToSessionEvents((data) => {
      if (data.status === "ended" || data.status === "terminated") {
        setSessions((prev) =>
          prev.filter((s) => s.sessionToken !== data.sessionId && s.id !== data.sessionId)
        );
      }
    });

    // Listen for new session starts
    const unsubStarted = subscribeToSessionStarted(() => {
      // Refresh the session list when a new session starts
      fetchActiveSessions();
    });

    return () => {
      unsubMetering();
      unsubSession();
      unsubStarted();
    };
  }, [fetchActiveSessions]);

  // Track duration via timer
  useEffect(() => {
    if (sessions.length === 0 || sessions.every((s) => s.status !== "connected"))
      return;

    const interval = setInterval(() => {
      setSessions((prev) =>
        prev.map((s) =>
          s.status === "connected" ? { ...s, duration: s.duration + 1 } : s
        )
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [sessions.length]);

  const handleDisconnect = useCallback(
    async (session: SessionDisplay) => {
      setDisconnectingId(session.id);
      try {
        await api.sessions.end(session.sessionToken);
        setSessions((prev) => prev.filter((s) => s.id !== session.id));
      } catch {
        // Best effort — session may have already ended
        setSessions((prev) => prev.filter((s) => s.id !== session.id));
      } finally {
        setDisconnectingId(null);
      }
    },
    []
  );

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m
      .toString()
      .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="glass-card p-8" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <div className="flex items-center justify-center gap-3">
          <span className="inline-block w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm text-white/40">{t("Loading sessions...")}</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="glass-card p-8" style={{ borderColor: "rgba(255, 100, 100, 0.15)" }}>
        <div className="text-center">
          <p className="text-red-400 text-sm mb-3">⚠ {error}</p>
          <button onClick={fetchActiveSessions} className="btn-primary" style={{ fontSize: "0.85rem", padding: "0.5rem 1.5rem" }}>
            {t("Retry")}
          </button>
        </div>
      </div>
    );
  }

  // No active sessions
  if (sessions.length === 0) {
    return (
      <div
        className="glass-card p-8"
        style={{ borderColor: "rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-center gap-3 mb-4">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: "rgba(255,255,255,0.2)" }}
          />
          <span className="text-xs font-bold text-white/30 uppercase tracking-widest">
            {t("No Active Sessions")}
          </span>
        </div>
        <p className="text-white/20 text-sm">
          {t("Purchase data from the")}{" "}
          <a href="/marketplace" className="text-primary hover:underline">
            {t("Marketplace")}
          </a>{" "}
          {t("to start a session.")}
        </p>
      </div>
    );
  }

  // Active sessions list
  return (
    <div className="space-y-6">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="glass-card p-8 border-primary/20"
          style={{ boxShadow: "0 0 30px rgba(0,242,255,0.05)" }}
        >
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-bold text-primary uppercase tracking-widest">
                  {t("Live Session Active")}
                </span>
              </div>
              <h3 className="text-2xl font-black">
                {t("Node")} {session.hardwareId.slice(0, 8)}
              </h3>
              <p className="text-xs text-white/20 mt-1">
                {t("Started")} {new Date(session.startedAt).toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => handleDisconnect(session)}
              disabled={disconnectingId === session.id}
              className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
            >
              {disconnectingId === session.id ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                  Ending...
                </span>
              ) : (
                "Disconnect"
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-xs text-white/30 uppercase mb-1">
                {t("Data Consumed")}
              </p>
              <p className="text-3xl font-black font-mono">
                {formatBytes(session.bytesUsed)}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/30 uppercase mb-1">
                {t("Session Duration")}
              </p>
              <p className="text-3xl font-black font-mono">
                {formatDuration(session.duration)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-6">
            <div>
              <p className="text-xs text-white/30 uppercase mb-1">
                {t("Cost Accumulated")}
              </p>
              <p className="text-xl font-black text-primary">
                ${session.costAccumulated.toFixed(4)}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/30 uppercase mb-1">
                {t("Session Token")}
              </p>
              <p
                className="text-xs font-mono text-white/20 truncate"
                title={session.sessionToken}
              >
                {session.sessionToken}
              </p>
            </div>
          </div>

          {/* Usage progress bar */}
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-secondary"
              style={{
                width: `${Math.min(
                  (session.bytesUsed / (1024 * 1024 * 1024)) * 100,
                  100
                )}%`,
                boxShadow: "0 0 10px rgba(0,242,255,0.5)",
                transition: "width 0.5s ease-out",
              }}
            />
          </div>
          <div className="flex justify-between items-center mt-2 text-white/20" style={{ fontSize: "10px", fontWeight: 900, textTransform: "uppercase" }}>
            <span>0 MB</span>
            <span>1.0 GB</span>
          </div>
        </div>
      ))}
    </div>
  );
}
