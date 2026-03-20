"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Marketplace;
const react_1 = require("react");
const SELLERS = [
    { id: "1", name: "Alpha Relay #01", location: "Nairobi, KE", price: 0.50, speed: "100Mbps", load: "24%" },
    { id: "2", name: "Highspeed Node B", location: "Lagos, NG", price: 0.75, speed: "1Gbps", load: "62%" },
    { id: "3", name: "Satellite Link X", location: "Cape Town, ZA", price: 1.20, speed: "50Mbps", load: "12%" },
];
function Marketplace() {
    const [search, setSearch] = (0, react_1.useState)("");
    return (<div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h2 className="text-4xl font-black mb-2">Marketplace</h2>
          <p className="text-white/40">Discover high-speed data sellers near you.</p>
        </div>
        <input type="text" placeholder="Search by city or country..." className="glass-card bg-white/5 border-white/10 px-6 py-3 rounded-full w-80 focus:border-primary outline-none transition-all" value={search} onChange={(e) => setSearch(e.target.value)}/>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {SELLERS.map((s) => (<div key={s.id} className="glass-card p-6 flex justify-between items-center group">
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border border-white/10">
                <span className="text-2xl">📡</span>
              </div>
              <div>
                <h4 className="text-xl font-bold">{s.name}</h4>
                <div className="flex gap-4 text-sm text-white/40">
                  <span>{s.location}</span>
                  <span>•</span>
                  <span>{s.speed}</span>
                  <span>•</span>
                  <span className={parseInt(s.load) > 80 ? "text-red-400" : "text-green-400"}>
                    {s.load} Load
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-12">
              <div className="text-right">
                <p className="text-2xl font-black">${s.price.toFixed(2)}</p>
                <p className="text-xs text-white/30">per GB</p>
              </div>
              <button className="btn-primary py-2 px-6 text-sm">Buy Data</button>
            </div>
          </div>))}
      </div>
    </div>);
}
