"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadata = void 0;
exports.default = RootLayout;
require("./globals.css");
exports.metadata = {
    title: "DRAVIO | Global Data Marketplace",
    description: "Secure, P2P high-speed data tunneling and session management.",
};
function RootLayout({ children, }) {
    return (<html lang="en">
      <body>
        <div className="mesh-bg"/>
        <nav className="fixed top-0 w-full z-50 glass border-b border-white/10 px-6 py-4">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-black neon-text tracking-tighter">DRAVIO</h1>
            <div className="flex gap-8 text-sm font-medium text-white/70">
              <a href="#" className="hover:text-primary transition-colors">Marketplace</a>
              <a href="#" className="hover:text-primary transition-colors">Active Sessions</a>
              <a href="#" className="hover:text-primary transition-colors">Wallet</a>
            </div>
            <button className="bg-white text-black px-6 py-2 rounded-full font-bold text-sm">Connect</button>
          </div>
        </nav>
        <main className="pt-24 min-h-screen">
          {children}
        </main>
      </body>
    </html>);
}
