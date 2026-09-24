// Pricing / fee transparency (buyer pays package price; platform fee is borne by
// the SELLER out of the received amount). Pure module built on money.ts exact
// integer-cent arithmetic. NO DB/IO imports.

import { computeFees, getPlatformFeePct, roundToCents } from '../../payment/money.js';

export interface FeeDisclosure {
  packagePriceUsd: number;
  platformFeeUsd: number;
  sellerNetUsd: number;
  /** The buyer is charged exactly the package price (fee is seller-borne). */
  totalChargedToBuyerUsd: number;
  feeBearer: 'SELLER';
  currency: 'USD';
}

export function quoteForAmount(amountUsd: number): FeeDisclosure {
  const safe = Number(amountUsd);
  if (!Number.isFinite(safe) || safe <= 0) {
    throw new Error('INVALID_AMOUNT');
  }
  const fees = computeFees(safe);
  return {
    packagePriceUsd: roundToCents(fees.amountUsd),
    platformFeeUsd: fees.platformFeeUsd,
    sellerNetUsd: fees.sellerNetUsd,
    totalChargedToBuyerUsd: roundToCents(fees.amountUsd),
    feeBearer: 'SELLER',
    currency: 'USD',
  };
}

/** Human-readable, exact breakdown lines shown to both sides before purchase. */
export function feeStatementLines(amountUsd: number): string[] {
  const q = quoteForAmount(amountUsd);
  return [
    `Package price: $${q.packagePriceUsd.toFixed(2)}`,
    `You (buyer) pay: $${q.totalChargedToBuyerUsd.toFixed(2)}`,
    `Platform fee (${(getPlatformFeePct() * 100).toFixed(0)}%, borne by seller): $${q.platformFeeUsd.toFixed(2)}`,
    `Seller receives: $${q.sellerNetUsd.toFixed(2)}`,
  ];
}

/** In cent-integer form for exact DB settlement math. */
export function quoteInCents(amountUsd: number): {
  packagePriceCents: number;
  platformFeeCents: number;
  sellerNetCents: number;
} {
  const q = quoteForAmount(amountUsd);
  return {
    packagePriceCents: Math.round(q.packagePriceUsd * 100),
    platformFeeCents: Math.round(q.platformFeeUsd * 100),
    sellerNetCents: Math.round(q.sellerNetUsd * 100),
  };
}