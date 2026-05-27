"use client";

import React, { useEffect, useState } from "react";
import { api, type Seller } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function MarketplacePage() {
  const { user } = useAuth();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [filteredSellers, setFilteredSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"price" | "speed" | "stability">("price");
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchSellers();
  }, []);

  useEffect(() => {
    let results = [...sellers];

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      results = results.filter(
        (s) =>
          (s.name || s.id).toLowerCase().includes(q) ||
          s.pricing_model.toLowerCase().includes(q)
      );
    }

    // Sort
    switch (sortBy) {
      case "price":
        results.sort((a, b) => a.price_per_gb - b.price_per_gb);
        break;
      case "speed":
        results.sort((a, b) => b.avg_speed - a.avg_speed);
        break;
      case "stability":
        results.sort((a, b) => b.stability - a.stability);
        break;
    }

    setFilteredSellers(results);
  }, [sellers, search, sortBy]);

  const fetchSellers = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.marketplace.getSellers();
      setSellers(data.results || []);
    } catch (err: any) {
      setError(err.message || "Failed to load marketplace.");
    } finally {
      setLoading(false);
    }
  };

  const handleBuyData = async (seller: Seller) => {
    if (!user) {
      window.location.href = "/login";
      return;
    }

    setConnectingId(seller.id);
    setPurchaseSuccess(null);
    try {
      const pricePerMb = seller.price_per_gb / 1024;
      await api.sessions.start(seller.id, pricePerMb, seller.id);
      setPurchaseSuccess(seller.id);
      setTimeout(() => setPurchaseSuccess(null), 5000);
    } catch (err: any) {
      if (err.status === 402) {
        alert("Insufficient wallet balance. Please top up your wallet first.");
      } else {
        alert(err.message || "Failed to start session.");
      }
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <div>
          <h2 className="text-4xl font-black mb-2">Marketplace</h2>
          <p className="text-white/40">
            Discover high-speed data sellers near you.{" "}
            {sellers.length > 0 && (
              <span className="text-primary font-bold">
                {sellers.length} node{sellers.length !== 1 ? "s" : ""} online
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <input
            id="marketplace-search"
            type="text"
            placeholder="Search nodes..."
            className="bg-white/5 border border-white/10 px-6 py-3 rounded-full w-64 focus:border-primary outline-none transition-all text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            id="marketplace-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-white/5 border border-white/10 px-4 py-3 rounded-full text-sm text-white/70 outline-none focus:border-primary cursor-pointer"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <option value="price">Price: Low → High</option>
            <option value="speed">Speed: Fast → Slow</option>
            <option value="stability">Stability: Best → Low</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div
          className="glass-card mb-8"
          style={{
            padding: "2rem",
            borderColor: "rgba(255, 100, 100, 0.2)",
            textAlign: "center",
          }}
        >
          <p style={{ color: "rgba(255, 100, 100, 0.8)", marginBottom: "1rem" }}>
            ⚠ {error}
          </p>
          <button onClick={fetchSellers} className="btn-primary" style={{ fontSize: "0.9rem" }}>
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && sellers.length === 0 && (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card p-6 flex justify-between items-center animate-pulse">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-white/5" />
                <div>
                  <div className="w-40 h-4 bg-white/5 rounded mb-2" />
                  <div className="w-60 h-3 bg-white/3 rounded" />
                </div>
              </div>
              <div className="w-20 h-10 bg-white/5 rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* Seller List */}
      <div className="grid grid-cols-1 gap-4">
        {!loading && filteredSellers.length === 0 && !error && (
          <div className="glass-card p-12 text-center" style={{ gridColumn: "1 / -1" }}>
            <p className="text-white/30 text-lg">
              {search
                ? `No nodes match "${search}"`
                : "No sellers are currently broadcasting."}
            </p>
            <p className="text-white/20 text-sm mt-2">
              {search
                ? "Try a different search term."
                : "Sellers appear when they start sharing internet through DRAVIO."}
            </p>
          </div>
        )}

        {filteredSellers.map((s, idx) => (
          <div
            key={s.id}
            className={`glass-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center group gap-4 ${
              purchaseSuccess === s.id
                ? "border-green-500/50 shadow-[0_0_20px_rgba(0,255,170,0.1)]"
                : ""
            }`}
          >
            <div className="flex items-center gap-6">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center border border-white/10"
                style={{
                  background: `linear-gradient(135deg, ${
                    idx % 3 === 0
                      ? "rgba(0,242,255,0.15)"
                      : idx % 3 === 1
                      ? "rgba(112,0,255,0.15)"
                      : "rgba(0,255,170,0.15)"
                  }, transparent)`,
                }}
              >
                <span className="text-2xl">📡</span>
              </div>
              <div>
                <h4 className="text-xl font-bold group-hover:text-primary transition-colors">
                  {s.name || `Node ${s.id.slice(0, 6)}`}
                </h4>
                <div className="flex gap-4 text-sm text-white/40 flex-wrap">
                  <span>{s.avg_speed} Mbps</span>
                  <span>•</span>
                  <span
                    className={
                      s.stability >= 95
                        ? "text-green-400"
                        : s.stability >= 80
                        ? "text-yellow-400"
                        : "text-red-400"
                    }
                  >
                    {s.stability}% Stable
                  </span>
                  <span>•</span>
                  <span>{s.distance?.toFixed(1)} {s.unit}</span>
                  <span>•</span>
                  <span className="text-primary">{s.status}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-8">
              <div className="text-right">
                <p className="text-2xl font-black">${s.price_per_gb.toFixed(2)}</p>
                <p className="text-xs text-white/30">per GB</p>
              </div>

              {purchaseSuccess === s.id ? (
                <div className="bg-green-500/20 text-green-400 py-2 px-6 rounded-xl text-sm font-bold">
                  ✓ Session Started
                </div>
              ) : (
                <button
                  id={`buy-${s.id}`}
                  className="btn-primary py-2 px-6 text-sm disabled:opacity-50"
                  onClick={() => handleBuyData(s)}
                  disabled={connectingId !== null}
                >
                  {connectingId === s.id ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Connecting...
                    </span>
                  ) : (
                    "Buy Data"
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
