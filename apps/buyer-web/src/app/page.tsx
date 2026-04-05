import { api, Seller } from "@/lib/api";
import "./globals.css";

export default async function Home() {
  const sellers: Seller[] = await api.getSellers();

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
            {sellers.length > 0 ? sellers.map((seller) => (
              <div key={seller.id} className="glass-card group">
                <div className="card-header flex justify-between items-start mb-6">
                  <div className="card-icon w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20" />
                  <div className="flex flex-col items-end">
                    <span className="badge-uptime text-[10px] font-bold uppercase tracking-widest text-primary mb-1">{seller.uptime} Uptime</span>
                    <div className="h-1 w-12 bg-primary/20 rounded-full overflow-hidden">
                      <div className="h-full bg-primary w-[99.9%]" />
                    </div>
                  </div>
                </div>
                
                <h4 className="card-title text-xl font-bold mb-2 group-hover:text-primary transition-colors">{seller.name}</h4>
                
                <div className="flex flex-wrap gap-3 mb-8">
                  <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-tighter text-white/40">{seller.location}</div>
                  <div className="px-3 py-1 rounded-full bg-primary/5 border border-primary/20 text-[10px] font-bold uppercase tracking-tighter text-primary">{seller.latency} Latency</div>
                </div>

                <div className="card-footer mt-auto flex justify-between items-end border-t border-white/5 pt-6">
                  <div>
                    <p className="price-label text-[9px] font-black uppercase tracking-[0.2em] text-white/20 mb-1">Starts at</p>
                    <p className="price-value text-3xl font-black text-white">${seller.price_per_gb.toFixed(2)}<span className="price-unit text-sm font-medium text-white/30 ml-1">/GB</span></p>
                  </div>
                  <button className="btn-arrow w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl group-hover:bg-primary group-hover:text-black transition-all duration-300">
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                </div>
              </div>
            )) : (
              <div className="col-span-full py-12 text-center text-white/30 font-medium italic border border-dashed border-white/10 rounded-2xl bg-white/5">
                Connecting to marketplace nodes...
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
