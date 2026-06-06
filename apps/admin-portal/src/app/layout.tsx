import React from 'react';
import './globals.css';
import { SocketProvider } from "@/components/providers/socket-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";

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
    <html lang="en">
      <body className="flex h-screen bg-[var(--bg-main)] text-[var(--fg-main)] overflow-hidden transition-colors duration-300">
        <ThemeProvider>
          <SocketProvider>
            {children}
          </SocketProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
