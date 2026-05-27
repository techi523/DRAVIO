"use client";

import React, { useEffect, useState } from "react";
import { api, type Seller } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const { user } = useAuth();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSellers();
  }, []);

  const fetchSellers = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.marketplace.getSellers();
      setSellers(data.results || []);
    } catch (err: any) {
      setError(err.message || "Failed to connect to marketplace.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mesh-background" />
      <main className="container">
        {/* Hero Section */}
        <section className="text-center" style={{ marginBottom: "6rem" }}>
          <h2 className="hero-title">
            Unleash <span className="text-gradient">Limitless</span> Data.
          </h2>
          <p className="hero-subtitle">
            The world&apos;s first decentralized marketplace for high-speed internet.
            Buy data from anyone, anywhere. Encrypted. Secure. Instant.
          </p>
          <a href="/marketplace" className="btn-primary" id="explore-marketplace">
            Explore Marketplace
          </a>
        </section>

        {/* Featured Sellers Preview */}
        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "2rem",
            }}
          >
            <h3 className="section-title" style={{ margin: 0 }}>
              Nearby High-Reliability Sellers
            </h3>
            <button
              onClick={fetchSellers}
              className="btn-refresh"
              disabled={loading}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.5)",
                padding: "0.5rem 1rem",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              {loading ? "Refreshing..." : "Refresh Nodes"}
            </button>
          </div>

          {error && (
            <div
              className="glass-card"
              style={{
                padding: "2rem",
                marginBottom: "2rem",
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
                style={{ fontSize: "0.9rem", padding: "0.75rem 2rem" }}
              >
                Retry
              </button>
            </div>
          )}

          {loading && sellers.length === 0 && (
            <div className="marketplace-grid">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="glass-card"
                  style={{ padding: "2rem", minHeight: "200px" }}
                >
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      background: "rgba(255,255,255,0.05)",
                      marginBottom: "1.5rem",
                    }}
                    className="animate-pulse"
                  />
                  <div
                    style={{
                      width: "60%",
                      height: "1rem",
                      background: "rgba(255,255,255,0.05)",
                      borderRadius: "4px",
                      marginBottom: "1rem",
                    }}
                    className="animate-pulse"
                  />
                  <div
                    style={{
                      width: "40%",
                      height: "0.75rem",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: "4px",
                    }}
                    className="animate-pulse"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="marketplace-grid">
            {!loading && sellers.length === 0 && !error && (
              <div
                className="col-span-full py-12 text-center text-white/30 font-medium italic border border-dashed border-white/10 rounded-2xl bg-white/5"
                style={{ gridColumn: "1 / -1" }}
              >
                No sellers are currently broadcasting. Check back soon or{" "}
                <a href="/marketplace" className="text-primary hover:underline">
                  search the marketplace
                </a>
                .
              </div>
            )}

            {sellers.map((seller) => (
              <div key={seller.id} className="glass-card group">
                <div className="card-header flex justify-between items-start mb-6">
                  <div className="card-icon w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20" />
                  <div className="flex flex-col items-end">
                    <span className="badge-uptime text-[10px] font-bold uppercase tracking-widest text-primary mb-1">
                      {seller.stability}% Stability
                    </span>
                    <div className="h-1 w-12 bg-primary/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${seller.stability}%` }}
                      />
                    </div>
                  </div>
                </div>

                <h4 className="card-title text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                  {seller.name || `Node ${seller.id.slice(0, 6)}`}
                </h4>

                <div className="flex flex-wrap gap-3 mb-8">
                  <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-tighter text-white/40">
                    {seller.distance?.toFixed(1)} {seller.unit || "km"} away
                  </div>
                  <div className="px-3 py-1 rounded-full bg-primary/5 border border-primary/20 text-[10px] font-bold uppercase tracking-tighter text-primary">
                    {seller.avg_speed} Mbps
                  </div>
                </div>

                <div className="card-footer mt-auto flex justify-between items-end border-t border-white/5 pt-6">
                  <div>
                    <p className="price-label text-[9px] font-black uppercase tracking-[0.2em] text-white/20 mb-1">
                      Starts at
                    </p>
                    <p className="price-value text-3xl font-black text-white">
                      ${seller.price_per_gb.toFixed(2)}
                      <span className="price-unit text-sm font-medium text-white/30 ml-1">
                        /GB
                      </span>
                    </p>
                  </div>
                  <a
                    href="/marketplace"
                    className="btn-arrow w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl group-hover:bg-primary group-hover:text-black transition-all duration-300"
                  >
                    <span className="group-hover:translate-x-1 transition-transform">
                      →
                    </span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Stats Section */}
        {!user && (
          <section className="text-center" style={{ marginTop: "6rem" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "2rem",
              }}
            >
              <div className="glass-card" style={{ padding: "2rem", textAlign: "center" }}>
                <p className="text-3xl font-black text-gradient">P2P</p>
                <p className="text-sm text-white/40 mt-2">Decentralized Network</p>
              </div>
              <div className="glass-card" style={{ padding: "2rem", textAlign: "center" }}>
                <p className="text-3xl font-black text-gradient">AES-256</p>
                <p className="text-sm text-white/40 mt-2">End-to-End Encrypted</p>
              </div>
              <div className="glass-card" style={{ padding: "2rem", textAlign: "center" }}>
                <p className="text-3xl font-black text-gradient">WireGuard</p>
                <p className="text-sm text-white/40 mt-2">Military-Grade VPN</p>
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
