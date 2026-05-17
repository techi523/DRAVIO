'use client';

import React, { useEffect, useState } from 'react';
import { Activity, Globe, Zap, ShieldCheck } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip } from 'recharts';

const mockData = Array.from({ length: 20 }, (_, i) => ({
  time: i,
  traffic: Math.floor(Math.random() * 1000)
}));

export const NOCPanel = () => {
  return (
    <div className="tactical-panel">
      <div className="panel-header">
        <span>NETWORK_OPS_CENTER // NOC_01</span>
        <Activity className="panel-title-icon" />
      </div>

      <div className="noc-stat-grid mb-6">
        <div className="noc-stat-card">
          <p className="noc-stat-label">Active Tunnels</p>
          <p className="noc-stat-value text-primary">1,442</p>
        </div>
        <div className="noc-stat-card">
          <p className="noc-stat-label">Total Bandwidth</p>
          <p className="noc-stat-value text-success">4.2 GB/s</p>
        </div>
        <div className="noc-stat-card">
          <p className="noc-stat-label">Avg Latency</p>
          <p className="noc-stat-value text-warning">24ms</p>
        </div>
        <div className="noc-stat-card">
          <p className="noc-stat-label">System Load</p>
          <p className="noc-stat-value text-primary">12%</p>
        </div>
      </div>

      <div className="h-[150px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={mockData}>
            <Line 
              type="monotone" 
              dataKey="traffic" 
              stroke="#00f2ff" 
              strokeWidth={2} 
              dot={false}
              isAnimationActive={false}
            />
            <Tooltip 
               contentStyle={{ backgroundColor: '#0d1117', border: '1px solid rgba(255,255,255,0.1)' }}
               itemStyle={{ color: '#00f2ff' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex justify-between items-center">
        <div className="live-indicator">
          <div className="pulse-dot" />
          LIVE_DATA_STREAM
        </div>
        <div className="flex gap-2">
            <Globe size={14} className="text-text-muted" />
            <Zap size={14} className="text-text-muted" />
            <ShieldCheck size={14} className="text-text-muted" />
        </div>
      </div>
    </div>
  );
};
