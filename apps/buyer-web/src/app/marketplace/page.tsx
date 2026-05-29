// noinspection JSXElementNotInternationalized
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { api, type Seller } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { subscribeToPeerUpdates } from "@/lib/socket";

export default function MarketplacePage() {
  const t = (str: string) => str;
  const { user } = useAuth();
  const { showToast } = useToast();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [filteredSellers, setFilteredSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"price" | "speed" | "stability">("price");

  // Purchase flow
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [provisionedConfig, setProvisionedConfig] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Geolocation
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);

  // Attempt to get user geolocation on mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        () => {
          // Permission denied or error — fallback to global search
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    }
  }, []);

  const fetchSellers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let data;
      if (userLocation) {
        data = await api.marketplace.searchSellers(userLocation.lat, userLocation.lon);
      } else {
        data = await api.marketplace.getSellers();
      }
      setSellers(data.results || []);
    } catch (err: any) {
      setError(err.message || "Failed to load marketplace.");
    } finally {
      setLoading(false);
    }
  }, [userLocation]);

  useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  // Auto-refresh sellers every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchSellers, 30000);
    return () => clearInterval(interval);
  }, [fetchSellers]);

  // Subscribe to real-time seller updates
  useEffect(() => {
    const unsub = subscribeToPeerUpdates((data) => {
      setSellers((prev) => {
        if (data.status === "offline") {
          return prev.filter((s) => s.id !== data.sellerId);
        }
        
        // Handle online/heartbeat updates
        const existingIdx = prev.findIndex((s) => s.id === data.sellerId);
        
        if (existingIdx !== -1) {
          // Update existing
          const next = [...prev];
          next[existingIdx] = { ...next[existingIdx], ...data.sellerData };
          return next;
        } else {
          // Add new
          if (data.sellerData) {
            return [...prev, data.sellerData as Seller];
          }
          return prev;
        }
      });
    });
    return unsub;
  }, []);

  // Filter and sort
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

  // Fetch wallet balance when user tries to purchase
  const handleBuyClick = async (seller: Seller) => {
    if (!user) {
      window.location.href = "/login";
      return;
    }

    // Fetch current balance for the confirmation dialog
    try {
      const { balance_usd } = await api.wallet.getBalance();
      setWalletBalance(balance_usd);
    } catch {
      setWalletBalance(null);
    }

    setSelectedSeller(seller);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedSeller) return;

    setPurchasing(true);
    try {
      const pricePerMb = selectedSeller.price_per_gb / 1024;
      const result = await api.sessions.start(
        selectedSeller.id,
        pricePerMb,
        selectedSeller.id
      );

      setPurchaseSuccess(selectedSeller.id);
      setSelectedSeller(null);
      setTimeout(() => setPurchaseSuccess(null), 5000);

      if (result.vpn_config) {
        setProvisionedConfig(result.vpn_config);
      }

      showToast("Session started successfully!", "success", {
        action: { label: "View Session", href: "/session" },
      });
    } catch (err: any) {
      if (err.status === 402) {
        showToast("Insufficient wallet balance.", "error", {
          action: { label: "Add Funds", href: "/wallet" },
        });
      } else {
        showToast(err.message || "Failed to start session.", "error");
      }
    } finally {
      setPurchasing(false);
    }
  };

  const getNodeGradient = (idx: number) => {
    const m = idx % 4;
    if (m === 0) return "rgba(0,242,255,0.15)";
    if (m === 1) return "rgba(112,0,255,0.15)";
    if (m === 2) return "rgba(0,255,170,0.15)";
    return "rgba(255,100,200,0.15)";
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <div>
          <h2 className="text-4xl font-black mb-2">{t("Marketplace")}</h2>
          <p className="text-white/40">
            {t("Discover high-speed data sellers near you.")}{" "}
            {sellers.length > 0 && (
              <span className="text-primary font-bold">
                {sellers.length} {t("node")}{sellers.length !== 1 ? "s" : ""} {t("online")}
              </span>
            )}
            {userLocation && (
              <span className="text-white/20 ml-2">• {t("Location-based")}</span>
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
            <option value="price">{t("Price: Low → High")}</option>
            <option value="speed">{t("Speed: Fast → Slow")}</option>
            <option value="stability">{t("Stability: Best → Low")}</option>
          </select>
          <button
            onClick={fetchSellers}
            disabled={loading}
            className="bg-white/5 border border-white/10 px-4 py-3 rounded-full text-sm text-white/50 hover:text-white hover:border-white/20 transition-all disabled:opacity-50"
          >
            {loading ? "..." : "↻"}
          </button>
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
          <button
            onClick={fetchSellers}
            className="btn-primary"
            style={{ fontSize: "0.9rem" }}
          >
            {t("Retry")}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && sellers.length === 0 && (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="glass-card p-6 flex justify-between items-center animate-pulse"
            >
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
          <div
            className="glass-card p-12 text-center"
            style={{ gridColumn: "1 / -1" }}
          >
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
                ? "border-green-500/50"
                : ""
            }`}
            style={{
              boxShadow:
                purchaseSuccess === s.id
                  ? "0 0 20px rgba(0,255,170,0.1)"
                  : undefined,
            }}
          >
            <div className="flex items-center gap-6">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center border border-white/10"
                style={{
                  background: `linear-gradient(135deg, ${getNodeGradient(idx)}, transparent)`,
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
                  <span>
                    {s.distance?.toFixed(1)} {s.unit}
                  </span>
                  <span>•</span>
                  <span className="text-primary">{s.status}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-8">
              <div className="text-right">
                <p className="text-2xl font-black">
                  ${s.price_per_gb.toFixed(2)}
                </p>
                <p className="text-xs text-white/30">{t("per GB")}</p>
              </div>

              {purchaseSuccess === s.id ? (
                <div className="bg-green-500/20 text-green-400 py-2 px-6 rounded-xl text-sm font-bold">
                  ✓ Session Started
                </div>
              ) : (
                <button
                  id={`buy-${s.id}`}
                  className="btn-primary py-2 px-6 text-sm disabled:opacity-50"
                  onClick={() => handleBuyClick(s)}
                  disabled={purchasing}
                >
                  {t("Buy Data")}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Purchase Confirmation Dialog */}
      <ConfirmDialog
        open={!!selectedSeller}
        title="Confirm Data Purchase"
        message={
          selectedSeller
            ? `Start a data session with ${selectedSeller.name || `Node ${selectedSeller.id.slice(0, 6)}`}?`
            : ""
        }
        confirmLabel="Start Session"
        loading={purchasing}
        onConfirm={handleConfirmPurchase}
        onCancel={() => setSelectedSeller(null)}
      >
        {selectedSeller && (
          <div className="space-y-4 mb-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-3 rounded-xl">
                <p className="text-xs text-white/30 uppercase mb-1">{t("Price")}</p>
                <p className="text-xl font-black">
                  ${selectedSeller.price_per_gb.toFixed(2)}/GB
                </p>
              </div>
              <div className="bg-white/5 p-3 rounded-xl">
                <p className="text-xs text-white/30 uppercase mb-1">{t("Speed")}</p>
                <p className="text-xl font-black">
                  {selectedSeller.avg_speed} Mbps
                </p>
              </div>
              <div className="bg-white/5 p-3 rounded-xl">
                <p className="text-xs text-white/30 uppercase mb-1">{t("Stability")}</p>
                <p className="text-xl font-black">
                  {selectedSeller.stability}%
                </p>
              </div>
              <div className="bg-white/5 p-3 rounded-xl">
                <p className="text-xs text-white/30 uppercase mb-1">
                  {t("Wallet Balance")}
                </p>
                <p
                  className="text-xl font-black"
                  style={{
                    color:
                      walletBalance !== null && walletBalance > 0
                        ? "#00ffaa"
                        : "#ff5050",
                  }}
                >
                  {walletBalance !== null ? `$${walletBalance.toFixed(2)}` : "..."}
                </p>
              </div>
            </div>
            <p className="text-xs text-white/20 text-center">
              {t("Usage is billed in real-time. You can disconnect at any time.")}
            </p>
          </div>
        )}
      </ConfirmDialog>

      {/* VPN Config Modal for Desktop Users */}
      <ConfirmDialog
        open={!!provisionedConfig}
        title="VPN Tunnel Provisioned"
        message="Your session is active. Since web browsers cannot natively establish WireGuard tunnels, please copy the configuration below to your WireGuard client."
        confirmLabel="Copy & Close"
        onConfirm={() => {
          if (provisionedConfig) {
            navigator.clipboard.writeText(provisionedConfig);
            showToast("VPN Config copied to clipboard!", "success");
          }
          setProvisionedConfig(null);
        }}
        onCancel={() => setProvisionedConfig(null)}
      >
        <div className="bg-black/50 p-4 rounded-xl border border-white/10 mb-4 mt-2">
          <pre className="text-[10px] sm:text-xs text-primary font-mono whitespace-pre-wrap break-all max-h-48 overflow-y-auto custom-scrollbar">
            {provisionedConfig}
          </pre>
        </div>
      </ConfirmDialog>
    </div>
  );
}
