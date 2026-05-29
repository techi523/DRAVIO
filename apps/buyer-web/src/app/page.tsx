"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { api, type Seller } from "@/lib/api";
import { subscribeToBalanceUpdates } from "@/lib/socket";

function DashboardView() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [activeSessions, setActiveSessions] = useState(0);
  const [topSellers, setTopSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [balRes, sessRes, sellRes] = await Promise.allSettled([
        api.wallet.getBalance(),
        api.sessions.getActive(),
        api.marketplace.getSellers(),
      ]);

      if (balRes.status === "fulfilled") {
        setBalance(balRes.value.balance_usd ?? 0);
      }
      if (sessRes.status === "fulfilled") {
        setActiveSessions(sessRes.value.sessions?.length ?? 0);
      }
      if (sellRes.status === "fulfilled") {
        // Show top 3 sellers sorted by speed
        const sorted = (sellRes.value.results || [])
          .sort((a: Seller, b: Seller) => b.avg_speed - a.avg_speed)
          .slice(0, 3);
        setTopSellers(sorted);
      }
    } catch {
      // Non-fatal for dashboard
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();

    const unsub = subscribeToBalanceUpdates((data) => {
      setBalance(data.balance);
    });

    return unsub;
  }, [fetchDashboard]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 animate-fade-in">
      {/* Welcome Section */}
      <div className="mb-16">
        <h2 className="text-4xl font-black mb-2">
          Welcome back,{" "}
          <span className="text-gradient">
            {user?.profile?.full_name || user?.email?.split("@")[0] || "Buyer"}
          </span>
        </h2>
        <p className="text-white/40">
          Your decentralized data marketplace dashboard.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {/* Wallet Balance */}
        <a
          href="/wallet"
          className="glass-card p-8 cursor-pointer group"
          style={{ borderColor: "rgba(0,242,255,0.1)" }}
        >
          <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">
            Wallet Balance
          </p>
          {loading ? (
            <div className="w-24 h-10 bg-white/5 rounded animate-pulse" />
          ) : (
            <p className="text-4xl font-black" style={{ fontFamily: "monospace" }}>
              <span className="text-xl text-white/30">$</span>
              {(balance ?? 0).toFixed(2)}
            </p>
          )}
          <p className="text-xs text-primary/50 mt-3 group-hover:text-primary transition-colors">
            View Wallet →
          </p>
        </a>

        {/* Active Sessions */}
        <a
          href="/session"
          className="glass-card p-8 cursor-pointer group"
          style={{
            borderColor:
              activeSessions > 0
                ? "rgba(0, 255, 170, 0.15)"
                : "rgba(255,255,255,0.05)",
          }}
        >
          <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">
            Active Sessions
          </p>
          {loading ? (
            <div className="w-16 h-10 bg-white/5 rounded animate-pulse" />
          ) : (
            <div className="flex items-baseline gap-3">
              <p className="text-4xl font-black">{activeSessions}</p>
              {activeSessions > 0 && (
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ background: "#00ffaa" }}
                  />
                  <span className="text-xs text-green-400">Live</span>
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-primary/50 mt-3 group-hover:text-primary transition-colors">
            View Sessions →
          </p>
        </a>

        {/* Online Sellers */}
        <a
          href="/marketplace"
          className="glass-card p-8 cursor-pointer group"
          style={{ borderColor: "rgba(255,255,255,0.05)" }}
        >
          <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">
            Online Sellers
          </p>
          {loading ? (
            <div className="w-16 h-10 bg-white/5 rounded animate-pulse" />
          ) : (
            <p className="text-4xl font-black">{topSellers.length}+</p>
          )}
          <p className="text-xs text-primary/50 mt-3 group-hover:text-primary transition-colors">
            Browse Marketplace →
          </p>
        </a>
      </div>

      {/* Top Sellers */}
      {topSellers.length > 0 && (
        <div className="mb-16">
          <h3 className="text-2xl font-bold mb-6">Fastest Nodes Available</h3>
          <div className="grid grid-cols-1 gap-4">
            {topSellers.map((s) => (
              <a
                key={s.id}
                href="/marketplace"
                className="glass-card p-6 flex justify-between items-center group"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  borderColor: "transparent",
                }}
              >
                <div className="flex items-center gap-6">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(0,242,255,0.1), rgba(112,0,255,0.1))",
                    }}
                  >
                    <span className="text-xl">📡</span>
                  </div>
                  <div>
                    <p className="font-bold group-hover:text-primary transition-colors">
                      {s.name || `Node ${s.id.slice(0, 6)}`}
                    </p>
                    <p className="text-xs text-white/30">
                      {s.avg_speed} Mbps • {s.stability}% stable •{" "}
                      {s.distance?.toFixed(1)} {s.unit}
                    </p>
                  </div>
                </div>
                <p className="text-lg font-black">
                  ${s.price_per_gb.toFixed(2)}<span className="text-xs text-white/30">/GB</span>
                </p>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <a
          href="/marketplace"
          className="glass-card p-8 cursor-pointer group text-center"
          style={{ borderColor: "rgba(0,242,255,0.1)" }}
        >
          <p className="text-3xl mb-4">🛒</p>
          <p className="font-bold text-lg group-hover:text-primary transition-colors mb-2">
            Buy Data
          </p>
          <p className="text-sm text-white/30">
            Browse sellers and start a VPN session
          </p>
        </a>
        <a
          href="/wallet"
          className="glass-card p-8 cursor-pointer group text-center"
          style={{ borderColor: "rgba(112,0,255,0.1)" }}
        >
          <p className="text-3xl mb-4">💰</p>
          <p className="font-bold text-lg group-hover:text-primary transition-colors mb-2">
            Add Funds
          </p>
          <p className="text-sm text-white/30">
            Deposit via Stripe or M-Pesa
          </p>
        </a>
        <a
          href="/session"
          className="glass-card p-8 cursor-pointer group text-center"
          style={{ borderColor: "rgba(0,255,170,0.1)" }}
        >
          <p className="text-3xl mb-4">📊</p>
          <p className="font-bold text-lg group-hover:text-primary transition-colors mb-2">
            Monitor Usage
          </p>
          <p className="text-sm text-white/30">
            View active sessions and data consumption
          </p>
        </a>
      </div>
    </div>
  );
}

function LandingView() {
  return (
    <div className="text-center">
      <div className="container py-20">
        <h1 className="hero-title">
          <span className="text-gradient">Internet</span> From Anyone,{" "}
          <span className="text-gradient">Anywhere</span>
        </h1>
        <p className="hero-subtitle">
          The world&apos;s first decentralized data marketplace. Purchase
          high-speed internet access from verified sellers, secured by
          WireGuard VPN tunnels with real-time metered billing.
        </p>
        <div className="flex gap-4 justify-center">
          <a href="/register" className="btn-primary">
            Get Started
          </a>
          <a
            href="/marketplace"
            className="px-8 py-4 rounded-full border border-white/15 text-white/60 hover:text-white hover:border-white/30 transition-all font-bold"
          >
            Explore Marketplace
          </a>
        </div>
      </div>

      {/* Features */}
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="glass-card p-8 text-left">
            <div className="card-icon mb-6 flex items-center justify-center">
              <span className="text-xl">🔒</span>
            </div>
            <h3 className="text-xl font-bold mb-2">Military-Grade Encryption</h3>
            <p className="text-white/30 text-sm">
              Every byte travels through AES-256 encrypted WireGuard tunnels.
              Zero knowledge of your traffic by anyone.
            </p>
          </div>
          <div className="glass-card p-8 text-left">
            <div className="card-icon mb-6 flex items-center justify-center">
              <span className="text-xl">⚡</span>
            </div>
            <h3 className="text-xl font-bold mb-2">Pay Per Megabyte</h3>
            <p className="text-white/30 text-sm">
              No monthly contracts. Usage metered every 5 seconds with
              sub-cent precision. Only pay for what you use.
            </p>
          </div>
          <div className="glass-card p-8 text-left">
            <div className="card-icon mb-6 flex items-center justify-center">
              <span className="text-xl">🌍</span>
            </div>
            <h3 className="text-xl font-bold mb-2">Global Coverage</h3>
            <p className="text-white/30 text-sm">
              Access internet through sellers worldwide. Choose by speed,
              price, stability, and proximity.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div
        className="container"
        style={{
          paddingTop: "6rem",
          paddingBottom: "6rem",
        }}
      >
        <div
          className="flex justify-center gap-16 flex-wrap"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          }}
        >
          <div>
            <p className="text-4xl font-black text-gradient">WireGuard</p>
            <p className="text-sm text-white/40 mt-1">VPN Protocol</p>
          </div>
          <div>
            <p className="text-4xl font-black text-gradient">Real-time</p>
            <p className="text-sm text-white/40 mt-1">Metered Billing</p>
          </div>
          <div>
            <p className="text-4xl font-black text-gradient">P2P</p>
            <p className="text-sm text-white/40 mt-1">Decentralized</p>
          </div>
          <div>
            <p className="text-4xl font-black text-gradient">AES-256</p>
            <p className="text-sm text-white/40 mt-1">Encrypted</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="inline-block w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return user ? <DashboardView /> : <LandingView />;
}
