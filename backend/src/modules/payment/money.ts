// Monetary helpers.
// All monetary math is performed in integer minor-unit cents to avoid
// floating-point rounding errors, then converted back for storage (DECIMAL).

export const DEFAULT_PLATFORM_FEE_PCT = 0.20;

export function getPlatformFeePct(): number {
  const raw = Number(process.env.PLATFORM_FEE_PCT ?? DEFAULT_PLATFORM_FEE_PCT);
  if (!Number.isFinite(raw) || raw < 0 || raw > 0.5) {
    return DEFAULT_PLATFORM_FEE_PCT;
  }
  return raw;
}

function toCents(amountUsd: number): number {
  return Math.round(amountUsd * 100);
}

export function roundToCents(amountUsd: number): number {
  return toCents(amountUsd) / 100;
}

export interface FeeBreakdown {
  amountUsd: number;
  platformFeeUsd: number;
  sellerNetUsd: number;
}

/** Compute a 20%-style platform fee and seller net, rounded to cents. */
export function computeFees(amountUsd: number): FeeBreakdown {
  const amountCents = toCents(amountUsd);
  const feePct = getPlatformFeePct();
  const platformFeeCents = Math.round(amountCents * feePct);
  const sellerNetCents = amountCents - platformFeeCents;
  return {
    amountUsd: amountCents / 100,
    platformFeeUsd: platformFeeCents / 100,
    sellerNetUsd: sellerNetCents / 100,
  };
}

export interface CentSettlement {
  /** Whole-cent portion to debit from the wallet (0 when below a cent). */
  cost: number;
  /** Fractional cents to carry over to the next usage report. */
  carryOver: number;
}

/**
 * Split an exact monetary amount into a settleable whole-cent cost and a
 * fractional-cent carry-over. Used by the usage billing engine so that
 * sub-cent per-MB charges are never lost nor improperly rounded.
 * exactCost must be >= 0.
 */
export function settleCentCarry(pendingCarryUsd: number, exactCost: number): CentSettlement {
  const total = pendingCarryUsd + exactCost;
  const cost = Math.floor(total * 100) / 100;
  const carryOver = Math.round((total - cost) * 1_000_000) / 1_000_000;
  return { cost, carryOver };
}