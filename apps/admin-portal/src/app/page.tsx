export default function AdminDashboard() {
  return (
    <div className="p-8 space-y-8">
      <header className="flex justify-between items-center mb-12">
        <h1 className="text-xl font-mono font-black border-l-4 border-primary pl-4">COMMAND CENTER <span className="text-white/20 ml-2">// OPS_DIRECT</span></h1>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 bg-success/10 px-4 py-1 rounded text-success text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> SYSTEM NOMINAL
          </div>
        </div>
      </header>

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-6">
        {[
          { label: "Active Sessions", value: "1,442", trend: "+12%" },
          { label: "Gross GMV", value: "$42,504", trend: "+5.4%" },
          { label: "Kafka Lag", value: "14ms", trend: "NOMINAL", color: "text-success" },
          { label: "Active Nodes", value: "312", trend: "-1" },
        ].map((kpi, i) => (
          <div key={i} className="tactical-border p-6 rounded-lg">
            <p className="text-[10px] uppercase font-bold text-white/30 mb-2">{kpi.label}</p>
            <div className="flex justify-between items-end">
              <h3 className="text-3xl font-black">{kpi.value}</h3>
              <span className={`text-[10px] font-bold ${kpi.color || "text-primary"}`}>{kpi.trend}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* Main Observation Pane */}
        <div className="col-span-2 tactical-border rounded-lg p-6">
          <h4 className="text-xs font-bold mb-6 text-white/40 uppercase">Global Transaction Stream</h4>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex justify-between items-center py-3 border-b border-white/5 text-xs font-mono">
                <span className="text-white/20">14:32:04</span>
                <span className="font-bold">TX_SESSION_START</span>
                <span className="text-primary truncate max-w-[150px]">0x84f2...a12c</span>
                <span className="text-success">+$0.50</span>
                <button className="text-[10px] bg-white/5 px-3 py-1 rounded">INSpect</button>
              </div>
            ))}
          </div>
        </div>

        {/* System Health Sidebar */}
        <div className="tactical-border rounded-lg p-6">
          <h4 className="text-xs font-bold mb-6 text-white/40 uppercase">Service Status</h4>
          <div className="space-y-4">
            {["Auth", "Session", "Marketplace", "Payment", "Metering", "ISP-GW"].map((s, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-xs font-medium">{s} Service</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/40 font-mono">99.9%</span>
                  <div className="w-2 h-2 rounded-full bg-success" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
