"use client";

import React, { useEffect, useState, useCallback } from "react";
import { api, type Invoice } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { subscribeToBalanceUpdates } from "@/lib/socket";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function WalletPage() {
  const { user } = useAuth();

  const [balance, setBalance] = useState<number | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Deposit modal
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState("100");
  const [depositLoading, setDepositLoading] = useState(false);

  const fetchWallet = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [balRes, invRes] = await Promise.allSettled([
        api.wallet.getBalance(),
        api.wallet.getInvoices(),
      ]);

      if (balRes.status === "fulfilled") {
        setBalance(balRes.value.balance_usd ?? 0);
      }
      if (invRes.status === "fulfilled") {
        setInvoices(invRes.value.invoices ?? []);
      }
    } catch (err: any) {
      setError(err.message || "Unable to sync with billing server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchWallet();

    // Subscribe to real-time balance updates via Socket.IO
    const unsub = subscribeToBalanceUpdates((data) => {
      setBalance(data.balance);
    });

    return unsub;
  }, [user, fetchWallet]);

  const handleDeposit = async () => {
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    setDepositLoading(true);
    try {
      const res = await api.wallet.topup(amt);
      if (res.new_balance_usd !== undefined) {
        setBalance(res.new_balance_usd);
      }
      setShowDeposit(false);
      setDepositAmount("100");
      // Refresh transactions
      setTimeout(fetchWallet, 2000);
    } catch (err: any) {
      alert(err.message || "Top-up failed. Please try again.");
    } finally {
      setDepositLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
            <p className="text-white/40 text-sm uppercase tracking-widest">
              Synchronizing Ledger...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="glass-card p-12 max-w-md mx-auto">
          <p className="text-4xl mb-4">💳</p>
          <h2 className="text-xl font-black mb-2">Billing Core Offline</h2>
          <p className="text-white/40 mb-6 text-sm">{error}</p>
          <button onClick={fetchWallet} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left: Balance & Top-up */}
          <div className="lg:col-span-2 space-y-8">
            <div
              className="glass-card p-10"
              style={{
                background:
                  "linear-gradient(135deg, rgba(20,25,50,0.8), rgba(10,12,30,0.9))",
                borderColor: "rgba(0, 242, 255, 0.15)",
              }}
            >
            <p className="text-sm text-white/40 mb-2">Available Balance</p>
            <h2 className="text-7xl font-black mb-2" style={{ fontFamily: "monospace" }}>
              <span className="text-2xl text-white/40 mr-2">$</span>
              {(balance ?? 0).toFixed(2)}
            </h2>
            <p className="text-xs text-white/20 mb-10 uppercase tracking-widest">
              USD • Real-time synchronized
            </p>
            <div className="flex gap-4 flex-wrap">
              <button
                id="wallet-deposit"
                className="btn-primary"
                onClick={() => setShowDeposit(true)}
              >
                Add Funds
              </button>
            </div>
          </div>

          {/* Transaction History */}
          <h3 className="text-2xl font-bold px-2">Recent Transactions</h3>
          <div className="space-y-4">
            {invoices.length === 0 ? (
              <div
                className="glass-card p-8 text-center"
                style={{ borderColor: "rgba(255,255,255,0.05)" }}
              >
                <p className="text-white/30 text-sm">
                  No transactions recorded yet. Start by depositing funds or purchasing data.
                </p>
              </div>
            ) : (
              invoices.map((inv) => (
                <div
                  key={inv.id}
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
                          inv.status === "PAID"
                            ? "rgba(0, 255, 170, 0.08)"
                            : "rgba(255, 200, 0, 0.08)",
                      }}
                    >
                      <span
                        style={{
                          color:
                            inv.status === "PAID" ? "#00ffaa" : "#ffc800",
                        }}
                      >
                        {inv.status === "PAID" ? "✓" : "⏳"}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-sm">
                        Invoice #{inv.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-white/30">
                        {new Date(inv.created_at).toLocaleDateString()}{" "}
                        {new Date(inv.created_at).toLocaleTimeString()} •{" "}
                        {inv.status}
                      </p>
                    </div>
                  </div>
                  <p className="text-lg font-black">
                    ${Number(inv.amount_usd).toFixed(2)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold px-2">Quick Actions</h3>
          <div className="glass-card p-6 space-y-4">
            <button
              onClick={() => setShowDeposit(true)}
              className="w-full text-left p-4 rounded-xl bg-white/5 border border-white/10 hover:border-primary/30 transition-all group"
            >
              <p className="font-bold group-hover:text-primary transition-colors">
                💰 Deposit Funds
              </p>
              <p className="text-xs text-white/30 mt-1">
                Top up via wallet balance
              </p>
            </button>
            <a
              href="/marketplace"
              className="block w-full text-left p-4 rounded-xl bg-white/5 border border-white/10 hover:border-primary/30 transition-all group"
            >
              <p className="font-bold group-hover:text-primary transition-colors">
                🛒 Browse Marketplace
              </p>
              <p className="text-xs text-white/30 mt-1">
                Find data sellers near you
              </p>
            </a>
            <a
              href="/session"
              className="block w-full text-left p-4 rounded-xl bg-white/5 border border-white/10 hover:border-primary/30 transition-all group"
            >
              <p className="font-bold group-hover:text-primary transition-colors">
                📊 Active Sessions
              </p>
              <p className="text-xs text-white/30 mt-1">
                Monitor your VPN connections
              </p>
            </a>
          </div>
        </div>
      </div>

      {/* Deposit Modal */}
      {showDeposit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.8)" }}
        >
          <div className="glass-card w-full max-w-md p-8">
            <h3 className="text-xl font-black mb-2">Top Up Wallet</h3>
            <p className="text-white/40 text-sm mb-6">
              Enter amount in USD to deposit to your wallet.
            </p>

            <div className="flex items-center gap-3 mb-6">
              <span className="text-lg font-black text-white/40">$</span>
              <input
                id="deposit-amount"
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-primary text-2xl font-black text-white"
                min="1"
                step="1"
                autoFocus
              />
            </div>

            <div className="flex gap-2 mb-6">
              {[10, 25, 50, 100].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setDepositAmount(String(amt))}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${
                    depositAmount === String(amt)
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-white/5 border-white/10 text-white/50 hover:border-white/20"
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                id="deposit-confirm"
                className="btn-primary flex-1 py-4 disabled:opacity-50"
                onClick={handleDeposit}
                disabled={depositLoading}
              >
                {depositLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  "Confirm Deposit"
                )}
              </button>
              <button
                onClick={() => setShowDeposit(false)}
                className="px-6 py-4 text-white/50 hover:text-white transition-colors font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ProtectedRoute>
  );
}
