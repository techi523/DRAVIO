"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { SocialLoginButtons } from "@/components/SocialLoginButtons";

export default function RegisterPage() {
  const { register, user, loading } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

    if (!fullName || !email || !password) {
      setError("All fields are required.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await register(email, password, fullName);
      router.push("/");
    } catch (err: any) {
      const msg = err?.code || err?.message || "Registration failed";
      if (msg.includes("EMAIL_ALREADY_EXISTS")) {
        setError("An account with this email already exists.");
      } else if (msg.includes("VALIDATION_FAILED")) {
        setError("Please check your input and try again.");
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
          JOIN DRAVIO
        </h2>
        <p className="text-white/40 mb-10 text-sm">
          Create your account to start buying data
        </p>

        {error && (
          <div className="error-banner mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
            {error}
          </div>
        )}

        <SocialLoginButtons onSuccess={() => router.push("/")} onError={(msg) => setError(msg)} />

        <form className="space-y-6 text-left" onSubmit={handleSubmit}>
          <div>
            <label className="text-[10px] uppercase font-bold text-white/30 ml-2">
              Full Name
            </label>
            <input
              id="register-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-primary transition-all mt-1 text-white"
              placeholder="John Doe"
              autoComplete="name"
              required
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-white/30 ml-2">
              Email Address
            </label>
            <input
              id="register-email"
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
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-primary transition-all mt-1 text-white"
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-white/30 ml-2">
              Confirm Password
            </label>
            <input
              id="register-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-primary transition-all mt-1 text-white"
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </div>
          <button
            id="register-submit"
            type="submit"
            className="btn-primary w-full py-4 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={submitting}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating Account...
              </span>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <p className="mt-8 text-sm text-white/30">
          Already have an account?{" "}
          <a href="/login" className="text-primary hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
