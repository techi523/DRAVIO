"use client";

import React from "react";
import { useAuth } from "@/lib/auth";
import SessionMonitor from "@/components/SessionMonitor";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function SessionPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h2 className="text-4xl font-black mb-2">Active Sessions</h2>
          <p className="text-white/40">
            Monitor your encrypted VPN connections in real time.
          </p>
        </div>

        <SessionMonitor />

        {/* Session Tips */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <p className="text-primary font-bold mb-2">💡 How it works</p>
            <p className="text-sm text-white/30">
              Purchase data from a seller in the Marketplace. A WireGuard VPN
              tunnel is established and your usage is billed in real-time.
            </p>
          </div>
          <div className="glass-card p-6" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <p className="text-primary font-bold mb-2">🔒 Encrypted</p>
            <p className="text-sm text-white/30">
              All sessions use AES-256 encryption through WireGuard protocol.
              Your data is never visible to intermediaries.
            </p>
          </div>
          <div className="glass-card p-6" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
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
