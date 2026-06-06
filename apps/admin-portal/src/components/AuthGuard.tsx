'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TerminalSquare } from 'lucide-react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('dravio_admin_token');
    if (!token) {
      router.push('/login');
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0a0a0f]">
        <div className="animate-pulse flex flex-col items-center">
          <TerminalSquare className="text-[#00f2ff] h-12 w-12 mb-4 animate-spin-slow" />
          <p className="text-[#00f2ff] font-mono tracking-widest text-sm">{"SECURING UPLINK..."}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
