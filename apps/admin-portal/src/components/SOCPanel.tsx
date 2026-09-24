"use client";

import React, { useEffect, useState } from 'react';
import { ShieldAlert, Fingerprint, Eye, Lock } from 'lucide-react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '@/lib/api';

export const SOCPanel = () => {
  const [alerts, setAlerts] = useState<any[]>([
    { id: 1, type: 'SUSPICIOUS_LOGIN', user: 'user_992', location: 'Kiev, UA', severity: 'HIGH' },
    { id: 2, type: 'RATE_LIMIT_EXCEEDED', user: 'gw_node_04', location: 'Internal', severity: 'MEDIUM' },
    { id: 3, type: 'WALLET_ABNORMAL_ACTIVITY', user: 'buyer_441', location: 'Mumbai, IN', severity: 'HIGH' },
  ]);

  useEffect(() => {
    const socket = io(API_BASE_URL);
    
    socket.on('security_alert', (newAlert) => {
        setAlerts(prev => [
            { id: Date.now(), ...newAlert },
            ...prev
        ].slice(0, 5));
    });

    return () => { socket.disconnect(); };
  }, []);
  return (
    <div className="tactical-panel">
      <div className="panel-header">
        <span>SECURITY_OPS_CENTER // SOC_RED_DAWN</span>
        <ShieldAlert className="panel-title-icon text-danger" />
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
            <span className="text-[0.65rem] font-bold text-text-muted uppercase">Global Threat Score</span>
            <span className="text-xs font-black text-danger">34% (STABLE)</span>
        </div>
        <div className="threat-meter">
            <div className="threat-fill" style={{ width: '34%' }} />
        </div>
      </div>

      <div className="space-y-3">
        {alerts.map(alert => (
            <div key={alert.id} className={`soc-alert-item ${alert.severity === 'HIGH' ? 'soc-alert-severity-high' : ''}`}>
                <div className="flex-1">
                    <div className="flex justify-between items-start">
                        <span className="text-[0.7rem] font-bold text-text-main">{alert.type}</span>
                        <span className={`text-[0.6rem] font-black ${alert.severity === 'HIGH' ? 'text-danger' : 'text-warning'}`}>{alert.severity}</span>
                    </div>
                    <div className="flex gap-2 mt-1">
                        <span className="text-[0.6rem] text-text-muted">{alert.user}</span>
                        <span className="text-[0.6rem] text-text-muted">@ {alert.location}</span>
                    </div>
                </div>
            </div>
        ))}
      </div>

      <button className="command-button command-button-danger w-full mt-4 justify-center">
        <Lock size={14} />
        INITIATE_GLOBAL_LOCKDOWN
      </button>

      <div className="mt-4 flex gap-4 justify-center">
        <Fingerprint size={16} className="text-text-muted opacity-50" />
        <Eye size={16} className="text-text-muted opacity-50" />
      </div>
    </div>
  );
};
