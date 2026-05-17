'use client';

import React, { useEffect, useState } from 'react';
import { Settings, Power, PowerOff, ShieldCheck } from 'lucide-react';
import axios from 'axios';

export const RuleEngineUI = () => {
    const [rules, setRules] = useState<any[]>([]);

    useEffect(() => {
        fetchRules();
    }, []);

    const fetchRules = async () => {
        try {
            const res = await axios.get('http://127.0.0.1:3008/v1/admin/rules');
            setRules(res.data.data);
        } catch (err) {
            console.error('Failed to fetch rules', err);
        }
    };

    const toggleRule = async (id: string) => {
        try {
            await axios.post(`http://127.0.0.1:3008/v1/admin/rules/${id}/toggle`);
            fetchRules();
        } catch (err) {
            console.error('Failed to toggle rule', err);
        }
    };

    return (
        <div className="tactical-panel">
            <div className="panel-header">
                <span>AUTOMATION_ENGINE // RULE_SET_01</span>
                <Settings className="panel-title-icon" />
            </div>

            <div className="space-y-3">
                {rules.map(rule => (
                    <div key={rule.id} className="flex justify-between items-center p-3 bg-white/5 rounded border border-panel-border">
                        <div>
                            <p className="text-xs font-bold text-text-main">{rule.name}</p>
                            <p className="text-[0.6rem] text-text-muted uppercase">IF {rule.condition} {rule.threshold}</p>
                        </div>
                        <button 
                            onClick={() => toggleRule(rule.id)}
                            className={`p-2 rounded ${rule.active ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}
                        >
                            {rule.active ? <Power size={14} /> : <PowerOff size={14} />}
                        </button>
                    </div>
                ))}
            </div>

            <button className="command-button w-full mt-4 justify-center border-dashed border-primary/40 text-primary/60">
                <ShieldCheck size={14} /> + ADD_NEW_RULE
            </button>
        </div>
    );
};
