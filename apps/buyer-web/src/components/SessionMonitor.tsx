"use client";
import { useEffect, useState } from "react";

export default function SessionMonitor() {
  const [bytes, setBytes] = useState(1420);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setBytes(prev => prev + Math.floor(Math.random() * 500000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatMB = (b: number) => (b / (1024 * 1024)).toFixed(2);

  return (
    <div className="glass-card p-8 border-primary/20 shadow-[0_0_30px_rgba(0,242,255,0.05)]">
      <div className="flex justify-between items-start mb-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-bold text-primary uppercase tracking-widest">Live Session Active</span>
          </div>
          <h3 className="text-3xl font-black">Alpha Relay #01</h3>
        </div>
        <button className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition-all">
          Disconnect
        </button>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <p className="text-xs text-white/30 uppercase mb-1">Data Consumed</p>
          <p className="text-4xl font-black font-mono">{formatMB(bytes)} <span className="text-sm font-normal text-white/40 ml-1">MB</span></p>
        </div>
        <div>
          <p className="text-xs text-white/30 uppercase mb-1">Session Duration</p>
          <p className="text-4xl font-black font-mono">00:14:42</p>
        </div>
      </div>

      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-primary to-secondary w-1/3 shadow-[0_0_10px_rgba(0,242,255,0.5)]" />
      </div>
      <div className="flex justify-between items-center mt-2 text-[10px] text-white/20 uppercase font-black">
        <span>0 MB</span>
        <span>Allocated: 1.0 GB</span>
      </div>
    </div>
  );
}
