"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function ProfilePage() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center min-h-[60vh]">
          <span className="inline-block w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-4xl font-black mb-10">User Profile</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <div className="glass-card p-8" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <h3 className="text-xl font-bold mb-6 text-primary">Personal Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs uppercase font-bold text-white/30 tracking-widest block mb-1">
                    Full Name
                  </label>
                  <p className="text-lg font-medium">{user?.profile?.full_name || "Not provided"}</p>
                </div>
                <div>
                  <label className="text-xs uppercase font-bold text-white/30 tracking-widest block mb-1">
                    Email Address
                  </label>
                  <p className="text-lg font-medium">{user?.email || "Unknown"}</p>
                </div>
                <div>
                  <label className="text-xs uppercase font-bold text-white/30 tracking-widest block mb-1">
                    Phone Number
                  </label>
                  <p className="text-lg font-medium">{user?.profile?.phone_number || "Not provided"}</p>
                </div>
                <div>
                  <label className="text-xs uppercase font-bold text-white/30 tracking-widest block mb-1">
                    Country
                  </label>
                  <p className="text-lg font-medium">{user?.profile?.country_code || "Unknown"}</p>
                </div>
              </div>
            </div>

            <div className="glass-card p-8" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <h3 className="text-xl font-bold mb-6 text-primary">Account Security</h3>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                <div>
                  <p className="font-bold">Password</p>
                  <p className="text-sm text-white/40 mt-1">Last changed: Unknown</p>
                </div>
                <button className="px-4 py-2 border border-white/20 rounded-lg text-sm font-bold hover:bg-white/10 transition-colors">
                  Change
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-card p-6" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <h3 className="text-lg font-bold mb-4">Account Status</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase font-bold text-white/30 tracking-widest mb-1">Role</p>
                  <span className="px-3 py-1 bg-primary/20 text-primary border border-primary/30 rounded-full text-xs font-bold uppercase tracking-widest">
                    {user?.role || "Buyer"}
                  </span>
                </div>
                <div>
                  <p className="text-xs uppercase font-bold text-white/30 tracking-widest mb-1">KYC Level</p>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black">Level {user?.profile?.kyc_level || 0}</span>
                    {user?.profile?.kyc_level === 0 && (
                      <span className="text-xs text-yellow-400 border border-yellow-400/30 bg-yellow-400/10 px-2 py-0.5 rounded uppercase font-bold">Unverified</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase font-bold text-white/30 tracking-widest mb-1">Account ID</p>
                  <p className="text-xs font-mono text-white/40 break-all">{user?.id}</p>
                </div>
              </div>
            </div>

            <div className="glass-card p-6" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <h3 className="text-lg font-bold mb-2">Want to sell data?</h3>
              <p className="text-sm text-white/40 mb-4">
                Earn money by sharing your high-speed internet with others.
              </p>
              <button className="w-full btn-primary py-3 text-sm">
                Become a Seller
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
