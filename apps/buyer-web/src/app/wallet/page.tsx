"use client";

import React, { useEffect, useState, useCallback } from "react";
import { api, type Invoice, type Transaction } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { subscribeToBalanceUpdates } from "@/lib/socket";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type PaymentMethod = "STRIPE" | "MPESA";

export default function WalletPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Deposit flow
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState("100");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("STRIPE");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);
  const [paymentPending, setPaymentPending] = useState<string | null>(null);

  const fetchWallet = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [balRes, txRes, invRes] = await Promise.allSettled([
        api.wallet.getBalance(),
        api.wallet.getTransactions(),
        api.wallet.getInvoices(),
      ]);

      if (balRes.status === "fulfilled") {
        setBalance(balRes.value.balance_usd ?? 0);
      }
      if (txRes.status === "fulfilled") {
        setTransactions(Array.isArray(txRes.value) ? txRes.value : []);
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
      fetchWallet(); // Fetch updated transaction history
    });

    const handleReconnect = () => fetchWallet();
    window.addEventListener("dravio:socket_connected", handleReconnect);

    return () => {
      unsub();
      window.removeEventListener("dravio:socket_connected", handleReconnect);
    };
  }, [user, fetchWallet]);

  // Poll for payment completion
  useEffect(() => {
    if (!paymentPending) return;

    const interval = setInterval(async () => {
      try {
        const status = await api.payments.getStatus(paymentPending);
        if (status.status === "COMPLETED") {
          clearInterval(interval);
          setPaymentPending(null);
          showToast("Payment received! Wallet updated.", "success", {
            action: { label: "View Balance", onClick: () => {} },
          });
          fetchWallet();
        } else if (status.status === "FAILED") {
          clearInterval(interval);
          setPaymentPending(null);
          showToast("Payment failed. Please try again.", "error");
        }
      } catch {
        // Non-fatal — keep polling
      }
    }, 3000);

    // Stop polling after 5 minutes
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setPaymentPending(null);
    }, 300000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [paymentPending, fetchWallet, showToast]);

  const handleDeposit = async () => {
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast("Please enter a valid amount.", "warning");
      return;
    }

    if (paymentMethod === "MPESA" && !mpesaPhone) {
      showToast("Please enter your M-Pesa phone number.", "warning");
      return;
    }

    setDepositLoading(true);
    try {
      const result = await api.payments.initiate(
        amt,
        paymentMethod === "MPESA" ? "KES" : "USD",
        paymentMethod,
        paymentMethod === "MPESA" ? mpesaPhone : undefined
      );

      setShowDeposit(false);
      setDepositAmount("100");
      setMpesaPhone("");

      if (result.checkout_url) {
        // Stripe — open checkout in new tab
        window.open(result.checkout_url, "_blank");
        showToast("Redirecting to Stripe checkout...", "info", { duration: 6000 });
      } else {
        // M-Pesa — STK push sent
        showToast("M-Pesa payment request sent to your phone.", "info", {
          duration: 8000,
        });
      }

      // Start polling for payment completion
      setPaymentPending(result.payment_id);
    } catch (err: any) {
      if (err.code === "VALIDATION_FAILED") {
        showToast("Invalid payment details. Please check and try again.", "error");
      } else {
        showToast(err.message || "Payment initiation failed. Please try again.", "error");
      }
    } finally {
      setDepositLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="max-w-7xl mx-auto px-6 py-12">
        {loading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="text-center">
              <div className="inline-block w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
              <p className="text-white/40 text-sm uppercase tracking-widest">
                Synchronizing Ledger...
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="glass-card p-12 max-w-md text-center">
              <p className="text-4xl mb-4">💳</p>
              <h2 className="text-xl font-black mb-2">Billing Core Offline</h2>
              <p className="text-white/40 mb-6 text-sm">{error}</p>
              <button onClick={fetchWallet} className="btn-primary">
                Retry
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Left: Balance & Transactions */}
            <div className="lg:col-span-2 space-y-8">
              {/* Balance Card */}
              <div
                className="glass-card p-10"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(20,25,50,0.8), rgba(10,12,30,0.9))",
                  borderColor: "rgba(0, 242, 255, 0.15)",
                }}
              >
                <p className="text-sm text-white/40 mb-2">Available Balance</p>
                <h2
                  className="text-7xl font-black mb-2"
                  style={{ fontFamily: "monospace" }}
                >
                  <span className="text-2xl text-white/40 mr-2">$</span>
                  {(balance ?? 0).toFixed(2)}
                </h2>
                <p className="text-xs text-white/20 mb-10 uppercase tracking-widest">
                  USD • Real-time synchronized
                  {paymentPending && (
                    <span className="ml-4 text-primary animate-pulse">
                      • Payment pending...
                    </span>
                  )}
                </p>
                <div className="flex gap-4 flex-wrap">
                  <button
                    id="wallet-deposit"
                    className="btn-primary"
                    onClick={() => setShowDeposit(true)}
                  >
                    Add Funds
                  </button>
                  <a
                    href="/marketplace"
                    className="px-6 py-3 rounded-full border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-all font-bold text-sm"
                  >
                    Buy Data →
                  </a>
                </div>
              </div>

              {/* Transaction History */}
              <h3 className="text-2xl font-bold px-2">Transaction History</h3>
              <div className="space-y-3">
                {transactions.length === 0 && invoices.length === 0 ? (
                  <div
                    className="glass-card p-8 text-center"
                    style={{ borderColor: "rgba(255,255,255,0.05)" }}
                  >
                    <p className="text-white/30 text-sm">
                      No transactions recorded yet. Start by depositing funds or
                      purchasing data.
                    </p>
                  </div>
                ) : (
                  (transactions.length > 0 ? transactions : invoices.map(inv => ({
                    id: inv.id,
                    type: 'debit' as const,
                    amount: inv.amount_usd,
                    description: `Invoice #${inv.id.slice(0, 8)}`,
                    created_at: inv.created_at,
                    status: inv.status,
                  }))).map((tx) => (
                    <div
                      key={tx.id}
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
                              tx.type === "credit"
                                ? "rgba(0, 255, 170, 0.08)"
                                : "rgba(255, 80, 80, 0.08)",
                          }}
                        >
                          <span
                            style={{
                              color:
                                tx.type === "credit"
                                  ? "#00ffaa"
                                  : "#ff5050",
                              fontWeight: 900,
                            }}
                          >
                            {tx.type === "credit" ? "+" : "−"}
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-sm">
                            {tx.description}
                          </p>
                          <p className="text-xs text-white/30">
                            {new Date(tx.created_at).toLocaleDateString()}{" "}
                            {new Date(tx.created_at).toLocaleTimeString()}
                            {tx.status && (
                              <span
                                className="ml-2"
                                style={{
                                  color:
                                    tx.status === "PAID" || tx.status === "COMPLETED"
                                      ? "#00ffaa"
                                      : tx.status === "ACTIVE"
                                      ? "#00f2ff"
                                      : "#ffc800",
                                }}
                              >
                                • {tx.status}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <p
                        className="text-lg font-black"
                        style={{
                          color:
                            tx.type === "credit"
                              ? "#00ffaa"
                              : "#ff5050",
                        }}
                      >
                        {tx.type === "credit" ? "+" : "−"}$
                        {Number(tx.amount).toFixed(2)}
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
                    Via Stripe or M-Pesa
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

              {/* Wallet Info */}
              <div className="glass-card p-6" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <p className="text-xs font-bold text-white/20 uppercase tracking-widest mb-3">
                  Security
                </p>
                <div className="space-y-2 text-xs text-white/30">
                  <p>✓ End-to-end encrypted transactions</p>
                  <p>✓ Real-time balance synchronization</p>
                  <p>✓ Idempotent payment processing</p>
                  <p>✓ Escrow-protected session billing</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Deposit Modal */}
        <ConfirmDialog
          open={showDeposit}
          title="Add Funds to Wallet"
          message="Select a payment method and amount to deposit."
          confirmLabel={depositLoading ? "Processing..." : "Initiate Payment"}
          loading={depositLoading}
          onConfirm={handleDeposit}
          onCancel={() => {
            if (!depositLoading) {
              setShowDeposit(false);
              setDepositAmount("100");
              setMpesaPhone("");
            }
          }}
        >
          {/* Payment Method Selector */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setPaymentMethod("STRIPE")}
              className={`flex-1 p-4 rounded-xl border text-center transition-all ${
                paymentMethod === "STRIPE"
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"
              }`}
            >
              <p className="text-lg mb-1">💳</p>
              <p className="text-xs font-bold">Stripe</p>
              <p className="text-xs opacity-50 mt-1">Card / Bank</p>
            </button>
            <button
              onClick={() => setPaymentMethod("MPESA")}
              className={`flex-1 p-4 rounded-xl border text-center transition-all ${
                paymentMethod === "MPESA"
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"
              }`}
            >
              <p className="text-lg mb-1">📱</p>
              <p className="text-xs font-bold">M-Pesa</p>
              <p className="text-xs opacity-50 mt-1">Mobile Money</p>
            </button>
          </div>

          {/* Amount Input */}
          <div className="flex items-center gap-3 mb-4">
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

          {/* Quick Amount Buttons */}
          <div className="flex gap-2 mb-4">
            {[5, 10, 25, 50, 100].map((amt) => (
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

          {/* M-Pesa Phone Number */}
          {paymentMethod === "MPESA" && (
            <div className="mb-2">
              <label className="text-xs uppercase font-bold text-white/30 ml-1 block mb-1" style={{ fontSize: "10px" }}>
                M-Pesa Phone Number
              </label>
              <input
                type="tel"
                value={mpesaPhone}
                onChange={(e) => setMpesaPhone(e.target.value)}
                placeholder="+254 7XX XXX XXX"
                className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-primary text-white text-sm"
              />
            </div>
          )}
        </ConfirmDialog>
      </div>
    </ProtectedRoute>
  );
}
