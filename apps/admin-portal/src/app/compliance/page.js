"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ComplianceManager;
function ComplianceManager() {
    return (<div className="p-8 space-y-8 text-xs font-mono">
      <header className="mb-12">
        <h1 className="text-xl font-black border-l-4 border-warning pl-4">COMPLIANCE HUB <span className="text-white/20 ml-2"> // REG_OVERwatch</span></h1>
    // REG_OVERwatch</span></h1>
      </header>

      <div className="grid grid-cols-3 gap-8">
        {/* KYC Verification Queue */}
        <div className="col-span-2 space-y-6">
          <h4 className="text-xs font-bold text-warning uppercase">Pending identity Verifications</h4>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (<div key={i} className="tactical-border p-6 rounded-lg flex justify-between items-center group hover:border-warning/40 transition-all">
                <div className="flex gap-6">
                  <div className="w-16 h-16 rounded bg-white/5 border border-white/10 flex items-center justify-center text-xl grayscale group-hover:grayscale-0 transition-all">
                    🪪
                  </div>
                  <div>
                    <h5 className="font-bold text-sm mb-1 uppercase">User: ID_REQ_{i}042</h5>
                    <p className="text-white/40 mb-3">Country: Kenya • Level 2 Upgrade</p>
                    <div className="flex gap-2">
                      <span className="bg-white/5 px-2 py-0.5 rounded text-[10px]">PASSPORT</span>
                      <span className="bg-white/5 px-2 py-0.5 rounded text-[10px]">FACIAL_MATCH: 98%</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button className="bg-success/10 text-success border border-success/20 px-4 py-2 rounded hover:bg-success hover:text-black transition-all">APPROVE</button>
                  <button className="bg-danger/10 text-danger border border-danger/20 px-4 py-2 rounded hover:bg-danger hover:text-white transition-all">REJECT</button>
                </div>
              </div>))}
          </div>
        </div>

        {/* Audit Filter Sidebar */}
        <div className="space-y-6">
          <h4 className="text-xs font-bold text-white/40 uppercase">Audit Filters</h4>
          <div className="tactical-border p-6 rounded-lg space-y-4">
            {["Payment", "KYC", "Admin_Login", "Session_Kill", "Balance_Adj"].map(f => (<label key={f} className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" className="hidden"/>
                <div className="w-4 h-4 border border-white/20 rounded group-hover:border-primary"/>
                <span className="text-[10px] text-white/60 group-hover:text-white">{f}</span>
              </label>))}
            <hr className="border-white/5 my-6"/>
            <button className="w-full btn-primary py-2 text-xs">Run Audit Report</button>
          </div>
        </div>
      </div>
    </div>);
}
