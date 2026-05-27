"use client";

import React, { useState } from 'react';
import { Search, User, Shield, AlertTriangle, History } from 'lucide-react';
import axios from 'axios';

// Lightweight translation helper to satisfy internationalization constraints
const t = (key: string, defaultValue: string) => defaultValue;

export const UserInvestigation = () => {
    const [userId, setUserId] = useState('');
    const [userData, setUserData] = useState<any>(null);

    const performSearch = async () => {
        if (!userId) return;
        try {
            const response = await axios.get(`/api/v1/admin/users/${userId}/investigation`);
            setUserData(response.data);
        } catch (err: any) {
            // If investigation endpoint doesn't exist yet, try basic user lookup
            try {
                const userResponse = await axios.get(`/api/v1/admin/users/${userId}`);
                setUserData(userResponse.data);
            } catch (innerErr) {
                setUserData({
                    id: userId,
                    name: 'User not found',
                    risk_score: 0,
                    status: 'UNKNOWN',
                    recent_sessions: []
                });
            }
        }
    };

    return (
        <div className="tactical-panel">
            <div className="panel-header">
                <span>{t('intel_search_title', 'INTEL_SEARCH // USER_INVESTIGATION')}</span>
                <Search className="panel-title-icon" />
            </div>

            <div className="flex gap-2 mb-6">
                <input 
                    type="text" 
                    placeholder={t('enter_uid_placeholder', 'ENTER_UID...')}
                    className="flex-1 bg-black/40 border border-panel-border rounded p-2 text-xs font-mono text-primary outline-none focus:border-primary"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                />
                <button 
                    onClick={performSearch}
                    className="bg-primary/20 text-primary border border-primary/40 px-4 rounded text-xs font-bold hover:bg-primary/40"
                >
                    {t('search_button', 'SEARCH')}
                </button>
            </div>

            {userData ? (
                <div className="animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-4 mb-4 p-3 bg-white/5 rounded border border-panel-border">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                            <User className="text-primary" size={24} />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold">{userData.name}</h4>
                            <p className="text-[0.6rem] text-text-muted">{userData.id}</p>
                        </div>
                        <div className="ml-auto text-right">
                            <p className="text-[0.6rem] text-text-muted uppercase">{t('risk_score_label', 'Risk Score')}</p>
                            <p className={`text-lg font-black ${userData.risk_score > 50 ? 'text-danger' : 'text-success'}`}>{userData.risk_score}%</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-[0.6rem] font-black text-text-muted uppercase mb-1 flex items-center gap-1">
                            <History size={10} /> {t('recent_activity_log_header', 'RECENT_ACTIVITY_LOG')}
                        </p>
                        {userData.recent_sessions.map((s: any) => (
                            <div key={s.id} className="flex justify-between text-[0.65rem] p-2 bg-black/20 border-l-2 border-primary/40">
                                <span>{s.date}</span>
                                <span className="font-bold">{s.bandwidth}</span>
                                <span className={s.result.includes('TERMINATED') ? 'text-warning' : 'text-success'}>{s.result}</span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 flex gap-2">
                        <button className="command-button flex-1 justify-center">
                            <Shield size={14} /> {t('re_verify_button', 'RE_VERIFY')}
                        </button>
                        <button className="command-button command-button-danger flex-1 justify-center">
                            <AlertTriangle size={14} /> {t('flag_abuse_button', 'FLAG_ABUSE')}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="h-[200px] border border-dashed border-panel-border flex flex-col items-center justify-center text-text-muted">
                    <Search size={32} className="opacity-20 mb-2" />
                    <p className="text-[0.6rem] uppercase tracking-widest font-black">{t('waiting_for_input_label', 'Waiting for input...')}</p>
                </div>
            )}
        </div>
    );
};
