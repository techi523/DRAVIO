import React from 'react';
import './globals.css';
import { SocketProvider } from "@/components/providers/socket-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { NeonAuthUIProvider } from "@neondatabase/auth/react";
import { authClient } from "@/lib/auth/client";
import "@neondatabase/auth/ui/css";

export const metadata = {
  title: 'DRAVIO | Command Center',
  description: 'Telecom-Grade Administration Platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex h-screen bg-[var(--bg-main)] text-[var(--fg-main)] overflow-hidden transition-colors duration-300">
        <ThemeProvider>
          <SocketProvider>
            <NeonAuthUIProvider authClient={authClient}>
              {children}
            </NeonAuthUIProvider>
          </SocketProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
