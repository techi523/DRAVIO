"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Wallet;
const SessionMonitor_1 = __importDefault(require("@/components/SessionMonitor"));
function Wallet() {
    return (<div className="max-w-7xl mx-auto px-6 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left: Balance & Top-up */}
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-card p-10 bg-gradient-to-br from-surface-mid/80 to-surface-low border-white/5">
            <p className="text-sm text-white/40 mb-2">Available Balance</p>
            <h2 className="text-7xl font-black mb-10">$142.50</h2>
            <div className="flex gap-4">
              <button className="btn-primary w-full">Add Funds</button>
              <button className="glass-card px-8 py-3 text-sm font-bold hover:bg-white/5">Withdraw</button>
            </div>
          </div>

          <h3 className="text-2xl font-bold px-2">Recent Transactions</h3>
          <div className="space-y-4">
            {[
            { type: "Purchase", name: "Session: Alpha Relay", amount: -0.50, date: "Today" },
            { type: "Top-up", name: "Stripe Payment", amount: 50.00, date: "Yesterday" },
            { type: "Purchase", name: "Session: Highspeed Node", amount: -1.25, date: "Mar 18" },
        ].map((tx, i) => (<div key={i} className="glass-card p-4 flex justify-between items-center bg-white/5 border-transparent hover:border-white/10">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.amount > 0 ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"}`}>
                    {tx.amount > 0 ? "↓" : "↑"}
                  </div>
                  <div>
                    <p className="font-bold">{tx.name}</p>
                    <p className="text-xs text-white/30">{tx.date} • {tx.type}</p>
                  </div>
                </div>
                <p className={`text-lg font-black ${tx.amount > 0 ? "text-green-400" : "text-white"}`}>
                  {tx.amount > 0 ? "+" : ""}{tx.amount.toFixed(2)}
                </p>
              </div>))}
          </div>
        </div>

        {/* Right: Active Monitoring Sidebar */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold px-2">Active Controls</h3>
          <SessionMonitor_1.default />
        </div>
      </div>
    </div>);
}
