import "./globals.css";

export default function Home() {
  return (
    <>
      <div className="mesh-background"></div>
      <main className="container">
        {/* Hero Section */}
        <section className="text-center" style={{ marginBottom: "6rem" }}>
          <h2 className="hero-title">
            Unleash <span className="text-gradient">Limitless</span> Data.
          </h2>
          <p className="hero-subtitle">
            The world's first decentralized marketplace for high-speed internet. 
            Buy data from anyone, anywhere. Encrypted. Secure. Instant.
          </p>
          <button className="btn-primary">Explore Marketplace</button>
        </section>

        {/* Featured Sellers Preview */}
        <section>
          <h3 className="section-title">Nearby High-Reliability Sellers</h3>
          <div className="marketplace-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card">
                <div className="card-header">
                  <div className="card-icon" />
                  <span className="badge-uptime">99.9% Uptime</span>
                </div>
                <h4 className="card-title">Alpha Relay #0{i}</h4>
                <div className="card-details">
                  <span>Nairobi, KE</span>
                  <span>•</span>
                  <span>15ms Latency</span>
                </div>
                <div className="card-footer">
                  <div>
                    <p className="price-label">Starts at</p>
                    <p className="price-value">$0.50<span className="price-unit">/GB</span></p>
                  </div>
                  <button className="btn-arrow">→</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
