import React from 'react';
import { NOCPanel } from '@/components/NOCPanel';

export default function NetworkPage() {
    return (
        <div className="flex flex-col gap-6">
            <div className="dashboard-header">
                <h2 className="header-title">NETWORK <span className="header-accent">OPERATIONS CENTER</span></h2>
            </div>
            <NOCPanel />
        </div>
    );
}
