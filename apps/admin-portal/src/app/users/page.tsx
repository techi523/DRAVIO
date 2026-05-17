import React from 'react';
import { UserInvestigation } from '@/components/UserInvestigation';

export default function UsersPage() {
    return (
        <div className="flex flex-col gap-6">
            <div className="dashboard-header">
                <h2 className="header-title">USER <span className="header-accent">MANAGEMENT</span></h2>
            </div>
            <UserInvestigation />
        </div>
    );
}
