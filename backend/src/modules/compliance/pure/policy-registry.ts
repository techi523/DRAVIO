// Policy versioning + acceptance registry.
// Pure module: NO DB/IO imports. The versions below are the registry of record;
// the actual policy TEXT lives in /docs/policies/ and in-app policy screens, and
// must never drift from these version identifiers without bumping `version`.

export interface PolicyDoc {
  id: string;
  name: string;
  version: string;
  effectiveAt: string; // ISO-8601
  requiredGates: Array<'REGISTER' | 'PURCHASE' | 'SELL'>;
  docPath: string;
}

export const POLICY_CATALOG: ReadonlyArray<PolicyDoc> = [
  {
    id: 'terms',
    name: 'Terms of Service',
    version: '1.0',
    effectiveAt: '2026-09-01T00:00:00.000Z',
    requiredGates: ['REGISTER'],
    docPath: '/docs/policies/buyer-terms.md',
  },
  {
    id: 'privacy',
    name: 'Privacy Policy',
    version: '1.0',
    effectiveAt: '2026-09-01T00:00:00.000Z',
    requiredGates: ['REGISTER'],
    docPath: '/docs/policies/acceptable-use-policy.md#privacy',
  },
  {
    id: 'aup',
    name: 'Acceptable Use Policy',
    version: '1.0',
    effectiveAt: '2026-09-01T00:00:00.000Z',
    requiredGates: ['REGISTER'],
    docPath: '/docs/policies/acceptable-use-policy.md',
  },
  {
    id: 'buyer_terms',
    name: 'Marketplace Buyer Terms',
    version: '1.0',
    effectiveAt: '2026-09-01T00:00:00.000Z',
    requiredGates: ['PURCHASE'],
    docPath: '/docs/policies/buyer-terms.md',
  },
  {
    id: 'provider_terms',
    name: 'Provider Terms of Sale',
    version: '1.0',
    effectiveAt: '2026-09-01T00:00:00.000Z',
    requiredGates: ['SELL'],
    docPath: '/docs/policies/provider-terms.md',
  },
];

export interface AcceptanceRecord {
  policyId: string;
  version: string;
  acceptedAt: string; // ISO-8601
}

export function policyById(policyId: string): PolicyDoc | undefined {
  return POLICY_CATALOG.find((p) => p.id === policyId);
}

/** A single acceptance is valid only when it targets the CURRENT version of an
 *  existing policy and the acceptance postdates the policy's effectiveAt. */
export function validateAcceptance(
  policyId: string,
  attemptedVersion: string,
  acceptedAt: string
): { ok: boolean; code?: string } {
  const policy = policyById(policyId);
  if (!policy) {
    return { ok: false, code: 'UNKNOWN_POLICY' };
  }
  if (attemptedVersion !== policy.version) {
    return { ok: false, code: 'VERSION_MISMATCH' };
  }
  if (new Date(acceptedAt).getTime() < new Date(policy.effectiveAt).getTime()) {
    return { ok: false, code: 'NOT_YET_EFFECTIVE' };
  }
  return { ok: true };
}

export interface GateResult {
  satisfied: boolean;
  missing: Array<{ policyId: string; version: string }>;
}

/** Whether a set of acceptance records satisfies a given gate (e.g. PURCHASE). */
export function assertSatisfiesGate(
  gate: 'REGISTER' | 'PURCHASE' | 'SELL',
  acceptances: ReadonlyArray<AcceptanceRecord>
): GateResult {
  const missing: Array<{ policyId: string; version: string }> = [];
  for (const policy of POLICY_CATALOG) {
    if (!policy.requiredGates.includes(gate)) continue;
    const accepted = acceptances.find(
      (a) => a.policyId === policy.id && a.version === policy.version
    );
    const valid =
      accepted &&
      validateAcceptance(policy.id, accepted.version, accepted.acceptedAt).ok;
    if (!valid) {
      missing.push({ policyId: policy.id, version: policy.version });
    }
  }
  return { satisfied: missing.length === 0, missing };
}

export function requiredPoliciesForGate(
  gate: 'REGISTER' | 'PURCHASE' | 'SELL'
): Array<{ policyId: string; version: string }> {
  return POLICY_CATALOG.filter((p) => p.requiredGates.includes(gate)).map((p) => ({
    policyId: p.id,
    version: p.version,
  }));
}