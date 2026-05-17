"use client";

import React, { useState } from 'react';
import { UserX, ShieldBan, RefreshCcw, Wallet, ZapOff, Play, Pause } from 'lucide-react';

export const CommandPanel = () => {
    const [targetId, setTargetId] = useState('');

    return (
        <div className="tactical-panel">
            <div className="panel-header">
                <span>COMMAND_DIRECT // EXEC_ACTION</span>
                <ShieldBan className="panel-title-icon" />
            </div>

            <div className="mb-4">
                <input 
                    type="text" 
                    placeholder="TARGET_USER_ID / TARGET_SESSION_ID"
                    className="w-full bg-black/40 border border-panel-border rounded p-2 text-xs font-mono text-primary outline-none focus:border-primary"
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-2 gap-2">
                <button className="command-button command-button-danger">
                    <UserX size={14} /> SUSPEND
                </button>
                <button className="command-button command-button-danger">
                    <ZapOff size={14} /> DISCONNECT
                </button>
                <button className="command-button">
                    <Wallet size={14} /> FREEZE_WALLET
                </button>
                <button className="command-button">
                    <RefreshCcw size={14} /> RESET_SESS
                </button>
            </div>

            <div className="mt-6">
                <h5 className="text-[0.6rem] font-black text-text-muted uppercase mb-3 border-b border-panel-border pb-1">Marketplace Controls</h5>
                <div className="flex gap-2">
                    <button className="command-button flex-1 justify-center bg-success/10 text-success border-success/20">
                        <Play size={14} /> RESUME_MKT
                    </button>
                    <button className="command-button flex-1 justify-center bg-warning/10 text-warning border-warning/20">
                        <Pause size={14} /> PAUSE_MKT
                    </button>
                </div>
            </div>
        </div>
    );
};
