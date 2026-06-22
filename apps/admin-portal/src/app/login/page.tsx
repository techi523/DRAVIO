'use client';

import React, { useState } from 'react';
import { TerminalSquare, Lock, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://127.0.0.1:8080';
      const res = await fetch(`${GATEWAY_URL}/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || 'Invalid credentials');
      }

      // Check if user has ADMIN role
      if (data.data?.user?.role !== 'admin') {
         throw new Error('Access Denied. Administrator privileges required.');
      }

      // Save token and redirect
      localStorage.setItem('dravio_admin_token', data.data.token);
      window.location.href = '/';

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: string) => {
    setError('');
    setLoading(true);
    try {
      if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
        throw new Error(`${provider} authentication is not fully configured yet.`);
      }
      
      const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://127.0.0.1:8080';
      const res = await fetch(`${GATEWAY_URL}/v1/auth/oauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, id_token: 'mock_token', role_preference: 'ADMIN' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'OAuth login failed');
      if (data.data?.user?.role !== 'admin') throw new Error('Access Denied. Administrator privileges required.');

      localStorage.setItem('dravio_admin_token', data.data.token);
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#0a0a0f] p-4 font-mono">
      <div className="w-full max-w-md bg-[#12121a] border border-[#1f1f2e] rounded-xl shadow-2xl p-8 relative overflow-hidden">
        {/* Decorative corner glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#00f2ff] opacity-10 blur-3xl rounded-full"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-[#00ff66] opacity-10 blur-3xl rounded-full"></div>

        <div className="flex flex-col items-center mb-10 z-10 relative">
          <TerminalSquare className="text-[#00f2ff] h-12 w-12 mb-4" />
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center">
            {"DRAVIO"}<span className="text-[#00f2ff]">{"NOC"}</span>
          </h1>
          <p className="text-[#8f8f9d] text-sm mt-2 tracking-widest uppercase">{"Secured Access Portal"}</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg mb-6 text-sm flex items-center gap-2">
            <Lock className="w-4 h-4" /> {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5 z-10 relative">
          <div>
            <label className="block text-xs font-bold text-[#8f8f9d] mb-2 tracking-wider">{"AUTHORIZATION ID"}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0a0a0f] border border-[#2a2a3b] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00f2ff] transition-colors"
              placeholder="admin@dravio.app"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#8f8f9d] mb-2 tracking-wider">{"PASSCODE"}</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0a0a0f] border border-[#2a2a3b] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00f2ff] transition-colors"
                placeholder="••••••••"
                required
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-[#8f8f9d] hover:text-white"
              >
                {showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00f2ff] hover:bg-[#00d0db] text-black font-bold py-3 rounded-lg mt-4 transition-colors tracking-wide flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'AUTHENTICATING...' : 'INITIALIZE UPLINK'}
          </button>
        </form>

        <div className="my-6 relative flex items-center justify-center">
          <div className="absolute w-full border-t border-[#1f1f2e]"></div>
          <span className="bg-[#12121a] px-3 text-xs text-[#555566] tracking-widest relative z-10">SSO OVERRIDE</span>
        </div>

        <div className="grid grid-cols-2 gap-3 z-10 relative">
          {['google', 'apple', 'github', 'microsoft'].map(provider => (
            <button
              key={provider}
              type="button"
              onClick={() => handleOAuthLogin(provider)}
              disabled={loading}
              className="w-full border border-[#2a2a3b] hover:bg-[#1a1a24] text-[#8f8f9d] hover:text-white py-2 rounded-lg text-xs font-bold uppercase transition-colors tracking-wider"
            >
              {provider}
            </button>
          ))}
        </div>

        <div className="mt-8 text-center border-t border-[#1f1f2e] pt-6">
          <p className="text-[10px] text-[#555566] tracking-widest uppercase">
            {"UNAUTHORIZED ACCESS IS STRICTLY PROHIBITED. IP ADDRESS LOGGED."}
          </p>
        </div>
      </div>
    </div>
  );
}
