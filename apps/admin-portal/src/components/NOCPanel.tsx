'use client';

import React, { useEffect, useState } from 'react';
import { Activity, Globe, Zap, ShieldCheck } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip } from 'recharts';

export const NOCPanel = () => {
  const [stats, setStats] = useState({
    activeTunnels: 0,
    totalBandwidth: 0,
    latency: 'N/A',
    systemLoad: 'Normal'
  });
  const [trafficData, setTrafficData] = useState<any[]>([]);

  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://127.0.0.1:8080';
        const token = localStorage.getItem('dravio_admin_token');
        if (!token) return;

        const res = await fetch(`${GATEWAY_URL}/v1/admin/telemetry`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setStats({
            activeTunnels: data.active_tunnels || 0,
            totalBandwidth: data.total_bandwidth_gb || 0,
            latency: '24ms', // TODO: Fetch real latency when API supports it
            systemLoad: data.lockdown_active ? 'LOCKDOWN' : 'Normal'
          });
          
          setTrafficData(prev => {
            const newData = [...prev, { time: new Date().toLocaleTimeString(), traffic: (data.total_bandwidth_gb || 0) * 1024 }];
            return newData.slice(-20);
          });
        }
      } catch (err) {
        console.error('Failed to fetch telemetry');
      }
    };
    
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="tactical-panel">
      <div className="panel-header">
        <span>{"NETWORK_OPS_CENTER // NOC_01"}</span>
        <Activity className="panel-title-icon" />
      </div>

      <div className="noc-stat-grid mb-6">
        <div className="noc-stat-card">
          <p className="noc-stat-label">{"Active Tunnels"}</p>
          <p className="noc-stat-value text-primary">{stats.activeTunnels}</p>
        </div>
        <div className="noc-stat-card">
          <p className="noc-stat-label">{"Total Bandwidth"}</p>
          <p className="noc-stat-value text-success">{stats.totalBandwidth.toFixed(2)} {"GB"}</p>
        </div>
        <div className="noc-stat-card">
          <p className="noc-stat-label">{"Avg Latency"}</p>
          <p className="noc-stat-value text-warning">{stats.latency}</p>
        </div>
        <div className="noc-stat-card">
          <p className="noc-stat-label">{"System Load"}</p>
          <p className="noc-stat-value text-primary">{stats.systemLoad}</p>
        </div>
      </div>

      <div className="h-[150px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trafficData}>
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
          {"LIVE_DATA_STREAM"}
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
