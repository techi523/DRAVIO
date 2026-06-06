import React from 'react';
import { RuleEngineUI } from '@/components/RuleEngineUI';

export default function AutomationPage() {
    return (
        <div className="flex flex-col gap-6">
            <div className="dashboard-header">
                <h2 className="header-title">AUTOMATION <span className="header-accent">ENGINE</span></h2>
            </div>
            <RuleEngineUI />
        </div>
    );
}
