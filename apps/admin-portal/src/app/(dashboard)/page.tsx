'use client';

import React, { useState, useEffect } from 'react';
import { useSocket } from '@/components/providers/socket-provider';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Zap, Server, Shield, Globe } from 'lucide-react';

export default function CommandCenter() {
    const { socket, systemHealth } = useSocket();
    const [trafficData, setTrafficData] = useState<any[]>([]);
    const [incidents, setIncidents] = useState<any[]>([]);
    
    useEffect(() => {
        if (!socket) return;
        
        socket.on('live_traffic', (data) => {
            setTrafficData(prev => {
                const newData = [...prev, { time: new Date().toLocaleTimeString(), in: data.bytes_in / 1000, out: data.bytes_out / 1000 }];
                return newData.slice(-15); // Keep last 15 ticks
            });
        });

        const fetchIncidents = async () => {
            try {
                const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://127.0.0.1:8080';
                const token = localStorage.getItem('dravio_admin_token');
                if (!token) return;
                const res = await fetch(`${GATEWAY_URL}/v1/admin/incidents`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setIncidents(data.slice(0, 5));
                }
            } catch (err) {
                console.error('Failed to fetch incidents', err);
            }
        };

        fetchIncidents();
        const interval = setInterval(fetchIncidents, 10000);

        return () => {
            socket.off('live_traffic');
            clearInterval(interval);
        };
    }, [socket]);

    return (
        <div>
            <div className="dashboard-header">
                <h2 className="header-title">{"GLOBAL "}<span className="header-accent">{"COMMAND CENTER"}</span></h2>
                <div className="flex gap-4">
                    <button className="command-button text-[#00f2ff] border-[#00f2ff]">
                        <Activity className="w-4 h-4" /> GENERATE REPORT
                    </button>
                    <button className="command-button command-button-danger border-[#ff0033] text-[#ff0033]">
                        <Shield className="w-4 h-4" /> LOCKDOWN PROTOCOL
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="tactical-panel">
                    <div className="panel-header">
                        <span>{"SYSTEM STATUS"}</span>
                        <Activity className="panel-title-icon text-[#00ff66]" />
                    </div>
                    <div className="text-3xl font-mono font-bold text-[#00ff66]">
                        {systemHealth?.api === 'up' ? 'NOMINAL' : 'DEGRADED'}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">{"All core services responding"}</div>
                </div>
                
                <div className="tactical-panel">
                    <div className="panel-header">
                        <span>{"ACTIVE SESSIONS"}</span>
                        <Globe className="panel-title-icon" />
                    </div>
                    <div className="text-3xl font-mono font-bold text-white">
                        {systemHealth?.active_sessions || 0}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">{"Global VPN Tunnels"}</div>
                </div>

                <div className="tactical-panel">
                    <div className="panel-header">
                        <span>{"VPN NODES"}</span>
                        <Server className="panel-title-icon" />
                    </div>
                    <div className="text-3xl font-mono font-bold text-white">
                        {systemHealth?.vpn_nodes || 0}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">{"Active exit nodes globally"}</div>
                </div>

                <div className="tactical-panel">
                    <div className="panel-header">
                        <span>{"THREAT LEVEL"}</span>
                        <Shield className="panel-title-icon" />
                    </div>
                    <div className="text-3xl font-mono font-bold text-[#00ff66]">
                        {systemHealth?.threat_level?.toUpperCase() || 'LOW'}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">{"No active intrusions detected"}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="tactical-panel lg:col-span-2">
                    <div className="panel-header">
                        <span>{"LIVE TRAFFIC TELEMETRY (KB/s)"}</span>
                        <Zap className="panel-title-icon" />
                    </div>
                    <div className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trafficData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                <XAxis dataKey="time" stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 10 }} tickMargin={10} />
                                <YAxis stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 10 }} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #00f2ff' }}
                                    itemStyle={{ color: '#00f2ff' }}
                                />
                                <Line type="monotone" dataKey="in" stroke="#00f2ff" strokeWidth={2} dot={false} animationDuration={300} />
                                <Line type="monotone" dataKey="out" stroke="#ff00ff" strokeWidth={2} dot={false} animationDuration={300} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="tactical-panel">
                    <div className="panel-header">
                        <span>{"RECENT SYSTEM EVENTS"}</span>
                    </div>
                    <div className="space-y-4 mt-4 overflow-y-auto max-h-[300px]">
                        {incidents.length === 0 ? (
                            <div className="text-xs text-gray-500 italic text-center py-4">
                                {"No recent events logged."}
                            </div>
                        ) : (
                            incidents.map((inc, i) => (
                                <div key={i} className="flex justify-between items-center text-sm border-b border-[rgba(255,255,255,0.05)] pb-2">
                                    <div>
                                        <span className={inc.severity === 'high' ? 'text-[#ff0033]' : 'text-[#00f2ff]'}>
                                            {inc.action || 'SYSTEM_EVENT'}
                                        </span>
                                        <div className="text-xs text-gray-500">{inc.description || inc.resource_type || 'System action logged'}</div>
                                    </div>
                                    <span className="text-xs text-gray-400">
                                        {new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
