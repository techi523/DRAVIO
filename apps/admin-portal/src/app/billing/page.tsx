import React from 'react';
import { CommandPanel } from '@/components/CommandPanel';

export default function BillingPage() {
    return (
        <div className="flex flex-col gap-6">
            <div className="dashboard-header">
                <h2 className="header-title">BILLING <span className="header-accent">CONTROL</span></h2>
            </div>
            <CommandPanel />
        </div>
    );
}
