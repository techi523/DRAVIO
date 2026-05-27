"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.push("/");
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err: any) {
      const msg = err?.code || err?.message || "Login failed";
      if (msg.includes("INVALID_CREDENTIALS")) {
        setError("Invalid email or password.");
      } else if (msg.includes("timed out")) {
        setError("Server unreachable. Please try again.");
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-6">
      <div className="glass-card p-12 w-full max-w-md text-center">
        <h2 className="text-3xl font-black mb-2 tracking-tighter neon-text">
          WELCOME BACK
        </h2>
        <p className="text-white/40 mb-10 text-sm">
          Sign in to your DRAVIO account
        </p>

        {error && (
          <div className="error-banner mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
            {error}
          </div>
        )}

        <form className="space-y-6 text-left" onSubmit={handleSubmit}>
          <div>
            <label className="text-[10px] uppercase font-bold text-white/30 ml-2">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-primary transition-all mt-1 text-white"
              placeholder="name@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-white/30 ml-2">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-primary transition-all mt-1 text-white"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
          <button
            id="login-submit"
            type="submit"
            className="btn-primary w-full py-4 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={submitting}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Authenticating...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <p className="mt-8 text-sm text-white/30">
          New to DRAVIO?{" "}
          <a href="/register" className="text-primary hover:underline">
            Create an account
          </a>
        </p>
      </div>
    </div>
  );
}
