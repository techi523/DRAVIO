import React from 'react';
import '../globals.css';
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from 'next/link';
import { Activity, ShieldAlert, Network, CreditCard, Users, Settings, LogOut, TerminalSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { AuthGuard } from "@/components/AuthGuard";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGuard>
      <div className="flex h-screen bg-[var(--bg-main)] text-[var(--fg-main)] overflow-hidden transition-colors duration-300">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 border-r border-[var(--border-main)] bg-[var(--bg-sidebar)] flex flex-col transition-colors duration-300">
          <div className="p-6 border-b border-[var(--border-main)] flex items-center gap-3">
            <TerminalSquare className="text-[var(--brand-primary)] h-6 w-6" />
            <h1 className="font-mono text-xl font-black tracking-tight text-[var(--fg-main)]">
              {"DRAVIO"}<span className="text-[var(--brand-primary)]">{"NOC"}</span>
            </h1>
          </div>
          
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-3">
              <li>
                <Link href="/" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[rgba(0,242,255,0.1)] hover:text-[#00f2ff] transition-colors text-sm font-medium">
                  <Activity className="h-4 w-4" /> Command Center
                </Link>
              </li>
              <li>
                <Link href="/network" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[rgba(0,242,255,0.1)] hover:text-[#00f2ff] transition-colors text-sm font-medium">
                  <Network className="h-4 w-4" /> Network & VPN
                </Link>
              </li>
              <li>
                <Link href="/soc" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[rgba(255,0,51,0.1)] hover:text-[#ff0033] transition-colors text-sm font-medium">
                  <ShieldAlert className="h-4 w-4" /> Security (SOC)
                </Link>
              </li>
              <li>
                <Link href="/billing" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[rgba(0,242,255,0.1)] hover:text-[#00f2ff] transition-colors text-sm font-medium">
                  <CreditCard className="h-4 w-4" /> Billing Control
                </Link>
              </li>
              <li>
                <Link href="/users" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[rgba(0,242,255,0.1)] hover:text-[#00f2ff] transition-colors text-sm font-medium">
                  <Users className="h-4 w-4" /> Users & Sellers
                </Link>
              </li>
              <li>
                <Link href="/automation" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[rgba(0,242,255,0.1)] hover:text-[#00f2ff] transition-colors text-sm font-medium">
                  <Settings className="h-4 w-4" /> Automation Rules
                </Link>
              </li>
            </ul>
          </nav>

          <div className="p-4 border-t border-[var(--border-main)]">
            <div className="flex items-center gap-3 px-3 py-2 text-sm text-[var(--fg-muted)]">
              <div className="w-2 h-2 rounded-full bg-[#00ff66] shadow-[0_0_8px_#00ff66]"></div>
              System Online
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col relative overflow-hidden">
          {/* Topbar */}
          <header className="h-16 border-b border-[var(--border-main)] bg-[var(--bg-header)] backdrop-blur-md flex items-center justify-between px-6 z-10 transition-colors duration-300">
            <div className="flex items-center gap-2">
                <span className="live-indicator">
                    <span className="pulse-dot"></span> LIVE DATA STREAM
                </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-mono text-[var(--fg-muted)]">{"ADMIN: SYS_01_SUPER"}</span>
              <ThemeToggle />
              <button 
                onClick={() => {
                  localStorage.removeItem('dravio_admin_token');
                  window.location.href = '/login';
                }} 
                className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Page Content */}
          <div className="flex-1 overflow-y-auto p-6 dashboard-container w-full">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
