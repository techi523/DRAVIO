"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { api, type ActiveSession } from "@/lib/api";
import SessionMonitor from "@/components/SessionMonitor";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function SessionPage() {
  const { user } = useAuth();
  const [history, setHistory] = useState<ActiveSession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await api.sessions.getHistory();
      setHistory(data.sessions || []);
    } catch {
      // Non-fatal
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && showHistory) {
      fetchHistory();
    }
  }, [user, showHistory, fetchHistory]);

  const formatBytes = (bytes: string | number) => {
    const b = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`;
    return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "#00f2ff";
      case "CLOSED":
        return "#00ffaa";
      case "KILLED":
        return "#ff5050";
      default:
        return "rgba(255,255,255,0.3)";
    }
  };

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h2 className="text-4xl font-black mb-2">Sessions</h2>
          <p className="text-white/40">
            Monitor your encrypted VPN connections in real time.
          </p>
        </div>

        {/* Active Sessions */}
        <SessionMonitor />

        {/* Session History Toggle */}
        <div className="mt-12">
          <button
            onClick={() => {
              setShowHistory(!showHistory);
              if (!showHistory) fetchHistory();
            }}
            className="flex items-center gap-2 text-sm font-bold text-white/40 hover:text-white transition-colors uppercase tracking-widest"
          >
            <span
              style={{
                transform: showHistory ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
                display: "inline-block",
              }}
            >
              ▸
            </span>
            Session History
            {!historyLoading && history.length > 0 && (
              <span className="text-primary ml-2">
                ({history.filter((s) => s.status !== "ACTIVE").length})
              </span>
            )}
          </button>

          {showHistory && (
            <div className="mt-4 space-y-3 animate-fade-in">
              {historyLoading ? (
                <div className="glass-card p-6 text-center">
                  <span className="inline-block w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : history.filter((s) => s.status !== "ACTIVE").length === 0 ? (
                <div
                  className="glass-card p-6 text-center"
                  style={{ borderColor: "rgba(255,255,255,0.05)" }}
                >
                  <p className="text-white/30 text-sm">
                    No past sessions found.
                  </p>
                </div>
              ) : (
                history
                  .filter((s) => s.status !== "ACTIVE")
                  .map((s) => (
                    <div
                      key={s.id}
                      className="glass-card p-4 flex justify-between items-center"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        borderColor: "transparent",
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{
                            background:
                              s.status === "CLOSED"
                                ? "rgba(0, 255, 170, 0.08)"
                                : "rgba(255, 80, 80, 0.08)",
                          }}
                        >
                          <span style={{ color: getStatusColor(s.status) }}>
                            {s.status === "CLOSED" ? "✓" : "✕"}
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-sm">
                            Node {s.hardware_id?.slice(0, 8) || "Unknown"}
                          </p>
                          <p className="text-xs text-white/30">
                            {new Date(s.started_at).toLocaleDateString()}{" "}
                            {new Date(s.started_at).toLocaleTimeString()}
                            {s.ended_at && (
                              <span className="ml-2">
                                → {new Date(s.ended_at).toLocaleTimeString()}
                              </span>
                            )}
                            <span
                              className="ml-2"
                              style={{ color: getStatusColor(s.status) }}
                            >
                              • {s.status}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black">
                          {formatBytes(s.bytes_used)}
                        </p>
                        <p className="text-xs text-white/30">
                          ${parseFloat(String(s.cost_accumulated || "0")).toFixed(4)}
                        </p>
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}
        </div>

        {/* Session Tips */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            className="glass-card p-6"
            style={{ borderColor: "rgba(255,255,255,0.05)" }}
          >
            <p className="text-primary font-bold mb-2">💡 How it works</p>
            <p className="text-sm text-white/30">
              Purchase data from a seller in the Marketplace. A WireGuard VPN
              tunnel is established and your usage is billed in real-time.
            </p>
          </div>
          <div
            className="glass-card p-6"
            style={{ borderColor: "rgba(255,255,255,0.05)" }}
          >
            <p className="text-primary font-bold mb-2">🔒 Encrypted</p>
            <p className="text-sm text-white/30">
              All sessions use AES-256 encryption through WireGuard protocol.
              Your data is never visible to intermediaries.
            </p>
          </div>
          <div
            className="glass-card p-6"
            style={{ borderColor: "rgba(255,255,255,0.05)" }}
          >
            <p className="text-primary font-bold mb-2">📊 Real-time Billing</p>
            <p className="text-sm text-white/30">
              Usage is metered every 5 seconds and deducted from your wallet
              balance. No surprise charges.
            </p>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
