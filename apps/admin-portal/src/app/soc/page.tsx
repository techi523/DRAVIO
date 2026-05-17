import React from 'react';
import { SOCPanel } from '@/components/SOCPanel';

export default function SOCPage() {
    return (
        <div className="flex flex-col gap-6">
            <div className="dashboard-header border-b border-[#ff0033]/30">
                <h2 className="header-title text-[#ff0033]">SECURITY <span className="text-white">OPERATIONS CENTER</span></h2>
            </div>
            <SOCPanel />
        </div>
    );
}
