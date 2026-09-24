import React from "react";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-16">
      <h1 className="text-4xl font-black neon-text mb-8">PRIVACY POLICY</h1>
      <div className="space-y-6 text-white/70 text-sm leading-7">
        <section>
          <h2 className="text-lg font-bold text-white mb-3">1. What we collect</h2>
          <p>
            DRAVIO collects account information you provide (email, name, phone
            number), payment transaction metadata required to operate the wallet,
            and session telemetry (bytes transferred, session duration) used to
            meter data sessions. Marketplace seller data (listing price, speed,
            stability) is derived from anonymised seller heartbeats.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-3">2. What we do NOT collect</h2>
          <p>
            We do not read or store the content of your data traffic. Session
            traffic is tunneled end-to-end. We only meter the volume of bytes
            transferred for billing purposes.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-3">3. How we use data</h2>
          <p>
            Data is used exclusively to authenticate you, process wallet
            transactions, bill data sessions, detect fraud, and comply with
            financial regulations. We never sell personal data to third parties.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-3">4. Retention</h2>
          <p>
            Financial ledger entries are retained for the period required by law.
            Session telemetry is retained as long as your account exists. You may
            request deletion of your account and associated data at any time.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-3">5. Contact</h2>
          <p>
            For privacy requests, contact: privacy@dravio.com
          </p>
        </section>
      </div>
    </div>
  );
}