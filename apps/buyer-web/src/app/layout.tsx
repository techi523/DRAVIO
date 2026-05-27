"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

function NavBar() {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="fixed top-0 w-full z-50 glass border-b border-white/10 px-8 py-5">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <a href="/">
          <h1 className="text-2xl font-black neon-text tracking-tighter underline-offset-8 cursor-pointer active:scale-95 transition-all">
            DRAVIO
          </h1>
        </a>

        <div className="flex gap-12 text-sm font-bold uppercase tracking-widest text-white/50">
          <a
            href="/marketplace"
            className={`hover:text-primary transition-all duration-300 relative group ${
              isActive("/marketplace") ? "text-primary" : ""
            }`}
          >
            Marketplace
            <span
              className={`absolute -bottom-1 left-0 h-0.5 bg-primary transition-all ${
                isActive("/marketplace") ? "w-full" : "w-0 group-hover:w-full"
              }`}
            />
          </a>
          <a
            href="/session"
            className={`hover:text-primary transition-all duration-300 relative group ${
              isActive("/session") ? "text-primary" : ""
            }`}
          >
            Active Sessions
            <span
              className={`absolute -bottom-1 left-0 h-0.5 bg-primary transition-all ${
                isActive("/session") ? "w-full" : "w-0 group-hover:w-full"
              }`}
            />
          </a>
          {user && (
            <a
              href="/wallet"
              className={`hover:text-primary transition-all duration-300 relative group ${
                isActive("/wallet") ? "text-primary" : ""
              }`}
            >
              Wallet
              <span
                className={`absolute -bottom-1 left-0 h-0.5 bg-primary transition-all ${
                  isActive("/wallet") ? "w-full" : "w-0 group-hover:w-full"
                }`}
              />
            </a>
          )}
        </div>

        <div className="flex items-center gap-4">
          {loading ? (
            <div className="w-20 h-8 bg-white/5 rounded-full animate-pulse" />
          ) : user ? (
            <>
              <span className="text-[11px] font-bold text-white/40 hidden md:block">
                {user.email}
              </span>
              <button
                id="nav-logout"
                onClick={logout}
                className="bg-red-500/10 border border-red-500/30 text-red-400 px-6 py-2.5 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all duration-500 active:scale-95"
              >
                Logout
              </button>
            </>
          ) : (
            <a
              href="/login"
              className="bg-primary/10 border border-primary/30 text-primary px-8 py-2.5 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-primary hover:text-black transition-all duration-500 shadow-[0_0_15px_rgba(0,242,255,0.2)] active:scale-95"
            >
              Sign In
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>DRAVIO | Global Data Marketplace</title>
        <meta
          name="description"
          content="Secure, P2P high-speed data tunneling and session management."
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ToastProvider>
          <AuthProvider>
            <div className="mesh-bg" />
            <NavBar />
            <main className="pt-24 min-h-screen">{children}</main>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
