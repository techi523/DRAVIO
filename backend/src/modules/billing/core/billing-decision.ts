import { settleCentCarry } from '../../payment/money.js';

const BYTES_PER_MB = 1024 * 1024;

export interface BillingDecision {
  deltaBytes: bigint;
  billable: boolean;
  deltaMb: number;
  exactCost: number;
  settledCost: number;
  carryOver: number;
  moveMoney: boolean;
}

/**
 * Pure billing decision for a usage report: how much to bill, whether any
 * money moves in this report, and how much fractional-cent value carries over
 * to the next report. Has no I/O dependencies so it can be tested directly.
 */
export function computeBillingDecision(
  committedBytes: bigint,
  bytesUsed: bigint,
  pricePerMb: number,
  pendingCostUsd: number,
): BillingDecision {
  const deltaBytes = bytesUsed - committedBytes;
  const billable = deltaBytes > 0n;
  const deltaMb = Number(deltaBytes) / BYTES_PER_MB;
  const exactCost = deltaMb * pricePerMb;
  const { cost, carryOver } = settleCentCarry(pendingCostUsd, exactCost);
  const moveMoney = billable && exactCost > 0 && cost >= 0.01;
  return { deltaBytes, billable, deltaMb, exactCost, settledCost: cost, carryOver, moveMoney };
}