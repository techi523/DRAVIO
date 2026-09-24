// Pure session-open validation used by SessionManager. Has no I/O
// dependencies so it can be tested directly without booting the platform.

export const MIN_SESSION_BALANCE_USD = 0.5;

export type SessionStartGate =
  | 'OK'
  | 'SELLER_REQUIRED'
  | 'HARDWARE_REQUIRED'
  | 'SELLER_PRICE_UNAVAILABLE'
  | 'INSUFFICIENT_FUNDS';

export type SessionStartCheck = {
  sellerId: string | undefined;
  hardwareId: string | undefined;
  pricePerMb: number | undefined;
  balanceUsd: number;
};

/**
 * Session-open gate. Order matters: missing seller, then hardware, then
 * server-resolved price (must be positive), then a server-checked wallet
 * balance that covers the minimum to open a session. The client can never
 * propose its own price — pricePerMb always comes from the seller listing.
 */
export function validateSessionStart(input: SessionStartCheck): SessionStartGate {
  if (!input.sellerId) return 'SELLER_REQUIRED';
  if (!input.hardwareId || typeof input.hardwareId !== 'string' || !input.hardwareId.trim()) {
    return 'HARDWARE_REQUIRED';
  }
  if (!input.pricePerMb || input.pricePerMb <= 0) return 'SELLER_PRICE_UNAVAILABLE';
  if (input.balanceUsd < MIN_SESSION_BALANCE_USD) return 'INSUFFICIENT_FUNDS';
  return 'OK';
}