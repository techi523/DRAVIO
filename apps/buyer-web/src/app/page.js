"use client";
import React, { useState, useEffect } from "react";

export default function Home() {
  const [balance, setBalance] = useState(1250.50);
  const [usage, setUsage] = useState(0.00);
  const [isConnected, setIsConnected] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Simulated real-time usage and balance deduction
  useEffect(() => {
    let interval;
    if (isConnected && balance > 0) {
      interval = setInterval(() => {
        const consumed = Math.random() * 0.8; // Random MB consumed
        const cost = consumed * 0.01; // 0.01 KES per MB
        
        setUsage(prev => prev + consumed);
        setBalance(prev => Math.max(0, prev - cost));
        
        if (balance <= cost) {
          setIsConnected(false);
          alert("⚡ Balance depleted! Your session has been automatically terminated.");
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isConnected, balance]);

  const handleTopUp = () => {
    setIsProcessing(true);
    // Simulate STK Push delay
    setTimeout(() => {
      setBalance(prev => prev + parseFloat(topUpAmount || "0"));
      setShowTopUp(false);
      setTopUpAmount("");
      setIsProcessing(false);
    }, 2000);
  };

  return (
    <div className="mesh-background" style={{ minHeight: '100vh', padding: '2rem 0' }}>
      <div className="container">
        {/* WALLET SECTION */}
        <div className="glass-card animate-fade-in" style={{ padding: '3rem', marginBottom: '3rem', border: '1px solid rgba(0, 242, 255, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
            <div>
              <h2 className="text-gradient" style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '2px' }}>VIRTUAL WALLET</h2>
              <p style={{ fontSize: '4.5rem', fontWeight: 900, marginTop: '0.5rem', fontFamily: 'monospace' }}>
                <span style={{ fontSize: '2rem', opacity: 0.5, marginRight: '0.5rem' }}>KES</span>
                {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <button 
                className="btn-primary" 
                onClick={() => setShowTopUp(true)}
                style={{ filter: isConnected ? 'hue-rotate(200deg)' : 'none' }}
              >
                Deposit Funds (M-Pesa)
              </button>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '1rem' }}>
                Status: <span style={{ color: '#00f2ff' }}>Secure & Verified</span>
              </p>
            </div>
          </div>
        </div>

        {/* CONNECTION MODAL SIM */}
        {showTopUp && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-card" style={{ width: '400px', padding: '3rem' }}>
              <h3 className="section-title">Top Up Wallet</h3>
              <p style={{ marginBottom: '2rem', color: 'var(--color-text-muted)' }}>Enter amount to deposit via M-Pesa STK Push.</p>
              <input 
                type="number" 
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder="Amount in KES"
                style={{ width: '100%', padding: '1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-glass-border)', borderRadius: '12px', color: '#fff', fontSize: '1.2rem', marginBottom: '2rem' }}
              />
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn-primary" onClick={handleTopUp} disabled={isProcessing} style={{ flex: 1 }}>
                  {isProcessing ? "PROCESSING..." : "CONFIRM"}
                </button>
                <button onClick={() => setShowTopUp(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* DASHBOARD GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2.5rem', marginBottom: '4rem' }}>
          
          {/* USAGE PANEL */}
          <div className="glass-card" style={{ padding: '3rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h3 className="section-title" style={{ margin: 0 }}>Active Session</h3>
              <div style={{ padding: '0.5rem 1rem', borderRadius: '99px', background: isConnected ? 'rgba(0, 242, 255, 0.1)' : 'rgba(255, 0, 0, 0.1)', color: isConnected ? '#00f2ff' : '#ff4b2b', fontWeight: 800, fontSize: '0.8rem' }}>
                {isConnected ? "LIVE" : "OFFLINE"}
              </div>
            </div>

            <div style={{ marginBottom: '3rem' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>SESSION USAGE</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <p style={{ fontSize: '4.5rem', fontWeight: 900, lineHeight: 1 }}>{usage.toFixed(2)}</p>
                <span style={{ fontSize: '1.5rem', opacity: 0.5 }}>MB</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <button 
                className="btn-primary" 
                onClick={() => setIsConnected(!isConnected)}
                style={{ flex: 1, background: isConnected ? '#ff4b2b' : 'linear-gradient(135deg, #00f2ff, #7000ff)', color: isConnected ? '#fff' : '#000' }}
              >
                {isConnected ? "STOP CONNECTION" : "CONNECT TO VPN"}
              </button>
            </div>
          </div>

          {/* NETWORK STATS */}
          <div className="glass-card" style={{ padding: '3rem' }}>
            <h3 className="section-title">Network Performance</h3>
            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Latency</span>
                <span style={{ color: '#00f2ff', fontWeight: 700 }}>{isConnected ? "12ms" : "---"}</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginBottom: '2.5rem' }}>
                <div style={{ width: isConnected ? '85%' : '0%', height: '100%', background: '#00f2ff', transition: 'width 1s ease-in-out' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Bandwidth Stability</span>
                <span style={{ color: '#00f2ff', fontWeight: 700 }}>{isConnected ? "99.8%" : "---"}</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                <div style={{ width: isConnected ? '95%' : '0%', height: '100%', background: '#7000ff', transition: 'width 1s 0.2s ease-in-out' }} />
              </div>

              <div style={{ marginTop: '3rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="glass" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>DOWN</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800 }}>{isConnected ? "42.5" : "0"}<span style={{ fontSize: '0.8rem', opacity: 0.5 }}> Mbps</span></p>
                </div>
                <div className="glass" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>UP</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800 }}>{isConnected ? "8.2" : "0"}<span style={{ fontSize: '0.8rem', opacity: 0.5 }}> Mbps</span></p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* MARKETPLACE SECTION */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h3 className="section-title" style={{ margin: 0 }}>Available Nodes</h3>
          <button style={{ background: 'transparent', border: '1px solid var(--color-glass-border)', color: 'var(--color-text-muted)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>Refresh Global Nodes</button>
        </div>

        <div className="marketplace-grid">
          {[
            { id: 1, name: "Node_Alpha_X", price: "0.20", region: "NAIROBI", load: "Ligh Load" },
            { id: 2, name: "Dravio_Server_4", price: "0.45", region: "LONDON", load: "Medium Load" },
            { id: 3, name: "Home_Relay_007", price: "0.15", region: "NAIROBI", load: "Heavy Load" },
            { id: 4, name: "SkyLink_Bridge", price: "0.90", region: "TOKYO", load: "Light Load" }
          ].map((node) => (
            <div key={node.id} className="glass-card" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🌐</div>
                <span style={{ fontSize: '0.7rem', color: '#00f2ff' }}>{node.load}</span>
              </div>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>{node.name}</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '2rem' }}>{node.region} • WIREGUARD • ENCRYPTED</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '0.7rem', opacity: 0.3 }}>RATE</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 900 }}>KES {node.price}<span style={{ fontSize: '0.8rem', opacity: 0.5 }}>/MB</span></p>
                </div>
                <div className="btn-arrow">✓</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
