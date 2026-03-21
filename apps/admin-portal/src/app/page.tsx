import "./globals.css";

export default function AdminDashboard() {
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1 className="header-title">COMMAND CENTER <span className="header-subtitle">// OPS_DIRECT</span></h1>
        <div className="sys-status-badge">
          <span className="status-dot" /> SYSTEM NOMINAL
        </div>
      </header>

      {/* KPI Grid */}
      <div className="kpi-grid">
        {[
          { label: "Active Sessions", value: "1,442", trend: "+12%", trendClass: "trend-positive" },
          { label: "Gross GMV", value: "$42,504", trend: "+5.4%", trendClass: "trend-positive" },
          { label: "Kafka Lag", value: "14ms", trend: "NOMINAL", trendClass: "trend-success" },
          { label: "Active Nodes", value: "312", trend: "-1", trendClass: "trend-negative" },
        ].map((kpi, i) => (
          <div key={i} className="tactical-panel">
            <p className="kpi-label">{kpi.label}</p>
            <div className="kpi-data">
              <h3 className="kpi-value">{kpi.value}</h3>
              <span className={kpi.trendClass}>{kpi.trend}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="main-grid">
        {/* Main Observation Pane */}
        <div className="tactical-panel">
          <h4 className="panel-header">Global Transaction Stream</h4>
          <div className="tx-list">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="tx-row">
                <span className="tx-time">14:32:0{i}</span>
                <span className="tx-type">TX_SESSION_START</span>
                <span className="tx-hash">0x84f2...a12{i}</span>
                <span className="tx-amount">+$0.50</span>
                <button className="btn-inspect">INSpect</button>
              </div>
            ))}
          </div>
        </div>

        {/* System Health Sidebar */}
        <div className="tactical-panel">
          <h4 className="panel-header">Service Status</h4>
          <div className="service-list">
            {["Auth", "Session", "Marketplace", "Payment", "Metering", "ISP-GW"].map((s, i) => (
              <div key={i} className="service-row">
                <span className="service-name">{s} Service</span>
                <div className="service-metrics">
                  <span className="service-uptime">99.9%</span>
                  <div className="status-dot" style={{ width: '8px', height: '8px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
