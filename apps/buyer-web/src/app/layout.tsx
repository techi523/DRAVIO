import type { Metadata } from "next";
import { api, WalletBalance } from "@/lib/api";
import "./globals.css";

export const metadata: Metadata = {
  title: "DRAVIO | Global Data Marketplace",
  description: "Secure, P2P high-speed data tunneling and session management.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const wallet: WalletBalance = await api.getWalletBalance();

  return (
    <html lang="en">
      <body>
        <div className="mesh-bg" />
        <nav className="fixed top-0 w-full z-50 glass border-b border-white/10 px-8 py-5">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-black neon-text tracking-tighter underline-offset-8 cursor-pointer active:scale-95 transition-all">DRAVIO</h1>
            <div className="flex gap-12 text-sm font-bold uppercase tracking-widest text-white/50">
              <a href="#" className="hover:text-primary transition-all duration-300 relative group">
                Marketplace
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
              </a>
              <a href="#" className="hover:text-primary transition-all duration-300 relative group">
                Active Sessions
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
              </a>
              <div className="flex flex-col items-center">
                <a href="#" className="hover:text-primary transition-all duration-300 relative group">
                  Wallet
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
                </a>
                <span className="text-[9px] font-black text-primary mt-1">${wallet.balance.toFixed(2)} {wallet.currency}</span>
              </div>
            </div>
            <button className="bg-primary/10 border border-primary/30 text-primary px-8 py-2.5 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-primary hover:text-black transition-all duration-500 shadow-[0_0_15px_rgba(0,242,255,0.2)] active:scale-95">
              Connect
            </button>
          </div>
        </nav>
        <main className="pt-24 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
