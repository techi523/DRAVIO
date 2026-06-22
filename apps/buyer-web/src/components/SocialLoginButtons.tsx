"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth";

interface SocialLoginButtonsProps {
  onSuccess?: () => void;
  onError?: (err: string) => void;
  rolePreference?: string;
}

export function SocialLoginButtons({ onSuccess, onError, rolePreference = 'BUYER' }: SocialLoginButtonsProps) {
  const { oauthLogin, sendOtp, verifyOtp } = useAuth();
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const [phoneMode, setPhoneMode] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  // In a real production setup without NextAuth, you would load the respective 
  // provider JS SDKs here (e.g. Google Identity Services, Facebook SDK) 
  // or redirect to an OAuth authorization URL and handle the callback on another page.
  // For Expo (Mobile), `expo-auth-session` handles this natively.

  const handleProviderLogin = async (provider: string) => {
    setLoadingProvider(provider);
    try {
      // Placeholder for Provider SDK interaction:
      // const idToken = await triggerGoogleLogin();
      // await oauthLogin(provider, { id_token: idToken }, rolePreference);
      
      console.log(`[SocialAuth] Initiating login for ${provider}...`);
      
      // Simulate OAuth redirect or SDK popup for demonstration
      // Replace this with actual SDK calls once Client IDs are provisioned
      if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
        throw new Error(`${provider} authentication is not fully configured yet. Missing Client IDs.`);
      }

    } catch (err: any) {
      if (onError) onError(err.message || `Failed to login with ${provider}`);
    } finally {
      setLoadingProvider(null);
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!otpSent) {
        setLoadingProvider("phone_send");
        await sendOtp(phoneNumber);
        setOtpSent(true);
      } else {
        setLoadingProvider("phone_verify");
        await verifyOtp(phoneNumber, otpCode, rolePreference);
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      if (onError) onError(err.message || "Phone authentication failed");
    } finally {
      setLoadingProvider(null);
    }
  };

  if (phoneMode) {
    return (
      <div className="w-full space-y-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-white/50 cursor-pointer hover:text-white" onClick={() => { setPhoneMode(false); setOtpSent(false); }}>
            ← Back to Social
          </span>
          <span className="text-sm font-bold">Phone Authentication</span>
        </div>
        <form onSubmit={handlePhoneSubmit} className="space-y-4 text-left">
          {!otpSent ? (
            <div>
              <label className="text-[10px] uppercase font-bold text-white/30 ml-2">Phone Number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-primary text-white mt-1"
                placeholder="+1234567890"
                required
              />
            </div>
          ) : (
            <div>
              <label className="text-[10px] uppercase font-bold text-white/30 ml-2">Verification Code</label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-primary text-white mt-1 text-center tracking-widest text-lg"
                placeholder="000000"
                maxLength={6}
                required
              />
            </div>
          )}
          <button
            type="submit"
            className="btn-primary w-full py-3 mt-2 disabled:opacity-50"
            disabled={loadingProvider !== null}
          >
            {loadingProvider ? "Please wait..." : (otpSent ? "Verify Code" : "Send OTP")}
          </button>
        </form>
      </div>
    );
  }

  const providers = [
    { id: "google", name: "Google", icon: "G", color: "bg-white text-black hover:bg-gray-200" },
    { id: "apple", name: "Apple", icon: "", color: "bg-black text-white border border-white/20 hover:bg-white/10" },
    { id: "github", name: "GitHub", icon: "GH", color: "bg-[#24292e] text-white hover:bg-[#2f363d]" },
    { id: "microsoft", name: "Microsoft", icon: "M", color: "bg-[#00a4ef] text-white hover:bg-[#0078d7]" },
    { id: "facebook", name: "Facebook", icon: "f", color: "bg-[#1877f2] text-white hover:bg-[#166fe5]" },
    { id: "x", name: "X", icon: "𝕏", color: "bg-black text-white border border-white/20 hover:bg-white/10" },
  ];

  return (
    <div className="w-full space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {providers.map((p) => (
          <button
            key={p.id}
            onClick={() => handleProviderLogin(p.id)}
            disabled={loadingProvider !== null}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${p.color} disabled:opacity-50`}
          >
            {loadingProvider === p.id ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="font-bold">{p.icon}</span>
            )}
            <span className="text-sm">{p.name}</span>
          </button>
        ))}
      </div>
      
      <button
        onClick={() => setPhoneMode(true)}
        disabled={loadingProvider !== null}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium border border-white/10 text-white hover:bg-white/5 transition-all"
      >
        📱 Continue with Phone
      </button>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-[#0a0a0a] text-white/40">or continue with email</span>
        </div>
      </div>
    </div>
  );
}
