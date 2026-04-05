"use client";
import React, { useState, useEffect } from "react";

export default function Home() {
  const [balance, setBalance] = useState(1250.50);
  const [usage, setUsage] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  // Simulated real-time usage increment
  useEffect(() => {
    let interval;
    if (isConnected) {
      interval = setInterval(() => {
        setUsage(prev => prev + Math.random() * 0.5);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isConnected]);

  const toggleConnection = () => {
    setIsConnected(!isConnected);
  };

  return (
    <div className="mesh-background">
      <div className="container">
        {/* Header / Wallet Section */}
        <div className="glass-card mb-12 animate-fade-in" style={{ padding: '3rem', marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="text-gradient" style={{ fontSize: '1.5rem', fontWeight: 800 }}>MY WALLET</h2>
              <p style={{ fontSize: '4rem', fontWeight: 900, marginTop: '0.5rem' }}>
                KES {balance.toLocaleString()}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <button className="btn-primary" style={{ marginBottom: '1rem' }}>Top Up with M-Pesa</button>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Last deposit: +500 KES (2 hours ago)</p>
            </div>
          </div>
        </div>

        {/* Connection Status Section */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '4rem' }}>
          <div className="glass-card" style={{ padding: '2.5rem' }}>
            <h3 className="section-title">Current Session</h3>
            <div style={{ marginBottom: '2rem' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem' }}>Status</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: isConnected ? '#00f2ff' : '#ff4b2b', boxShadow: isConnected ? '0 0 10px #00f2ff' : 'none' }} />
                <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>{isConnected ? 'CONNECTED' : 'DISCONNECTED'}</span>
              </div>
            </div>
            <div style={{ marginBottom: '2rem' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem' }}>Total Usage This Session</p>
              <p style={{ fontSize: '2.5rem', fontWeight: 800 }}>{usage.toFixed(2)} MB</p>
            </div>
            <button 
              className="btn-primary" 
              style={{ width: '100%', background: isConnected ? 'rgba(255, 75, 43, 0.2)' : 'linear-gradient(135deg, #00f2ff, #7000ff)', border: isConnected ? '1px solid #ff4b2b' : 'none', color: isConnected ? '#ff4b2b' : '#fff' }}
              onClick={toggleConnection}
            >
              {isConnected ? 'STOP SESSION' : 'START SURFING'}
            </button>
          </div>

          <div className="glass-card" style={{ padding: '2.5rem' }}>
            <h3 className="section-title" style={{ color: 'var(--color-primary)' }}>Live Traffic</h3>
            <div style={{ height: '150px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>Usage Graph Visualization</p>
            </div>
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Download</p>
                <p style={{ fontSize: '1.25rem', fontWeight: 700 }}>{isConnected ? (Math.random() * 5).toFixed(2) : '0.00'} Mb/s</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Upload</p>
                <p style={{ fontSize: '1.25rem', fontWeight: 700 }}>{isConnected ? (Math.random() * 1).toFixed(2) : '0.00'} Mb/s</p>
              </div>
            </div>
          </div>
        </div>

        {/* Marketplace Preview */}
        <h3 className="section-title">Recommended Sellers Nearby</h3>
        <div className="marketplace-grid">
          {[
            { id: 1, name: "Z-Link HighSpeed", loc: "Kilimani, Nairobi", price: "10.00", uptime: "99.9%" },
            { id: 2, name: "G-Fiber Node 4", loc: "Westlands, Nairobi", price: "12.50", uptime: "98.5%" },
            { id: 3, name: "Safaricom 5G Share", loc: "CBD, Nairobi", price: "15.00", uptime: "100%" }
          ].map((seller) => (
            <div key={seller.id} className="glass-card">
              <div className="card-header">
                <div className="card-icon" />
                <span className="badge-uptime">{seller.uptime} UPTIME</span>
              </div>
              <h4 className="card-title">{seller.name}</h4>
              <div className="card-details">
                <span>{seller.loc}</span>
                <span>•</span>
                <span>12ms Latency</span>
              </div>
              <div className="card-footer">
                <div>
                  <p className="price-label">Price per GB</p>
                  <p className="price-value">KES {seller.price}<span className="price-unit">/GB</span></p>
                </div>
                <div className="btn-arrow">→</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
