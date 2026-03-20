"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Home;
function Home() {
    return (<div className="max-w-7xl mx-auto px-6 py-12">
      {/* Hero Section */}
      <section className="text-center mb-24">
        <h2 className="text-6xl md:text-8xl font-black mb-6 leading-tight">
          Unleash <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">Limitless</span> Data.
        </h2>
        <p className="text-lg text-white/50 max-w-2xl mx-auto mb-10">
          The world's first decentralized marketplace for high-speed internet. 
          Buy data from anyone, anywhere. Encrypted. Secure. Instant.
        </p>
        <button className="btn-primary">Explore Marketplace</button>
      </section>

      {/* Featured Sellers Preview */}
      <h3 className="text-2xl font-bold mb-8">Nearby High-Reliability Sellers</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (<div key={i} className="glass-card p-6 group">
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary"/>
              <span className="text-primary font-mono text-sm">99.9% Uptime</span>
            </div>
            <h4 className="text-xl font-bold mb-2">Alpha Relay #0{i}</h4>
            <div className="flex gap-4 text-sm text-white/40 mb-6">
              <span>Nairobi, KE</span>
              <span>•</span>
              <span>15ms Latency</span>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-white/30">Starts at</p>
                <p className="text-2xl font-black">$0.50<span className="text-sm font-normal text-white/40">/GB</span></p>
              </div>
              <button className="bg-white/5 group-hover:bg-primary group-hover:text-black p-3 rounded-xl transition-all">
                →
              </button>
            </div>
          </div>))}
      </div>
    </div>);
}
