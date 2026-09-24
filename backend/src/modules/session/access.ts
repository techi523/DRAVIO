// Pure session access-control and VPN-config helpers with no service-side
// dependencies, so they can be unit-tested without booting the platform.

export const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

export function isAdminUser(roles?: string[]): boolean {
  return !!roles && roles.some((r) => ADMIN_ROLES.includes(r));
}

export function canAccessSession(
  session: { buyer_id: string },
  callerId: string,
  roles?: string[],
): boolean {
  return session.buyer_id === callerId || isAdminUser(roles);
}

/**
 * Builds a WireGuard config from the seller's REAL registered relay
 * credentials (endpoint + public key). There is no invented relay: if the
 * provider has not provisioned a live relay, session creation fails closed.
 *
 * The Interface.PrivateKey is intentionally a sentinel: the buyer device must
 * substitute the private key it generated (and whose public key it supplied to
 * the relay during handshake authorization) before establishing the tunnel.
 * The relay-facing Peer block uses the provider's actual endpoint/key.
 */
export function buildVpnConfigFromSeller(seller: {
  relay_endpoint: string | null;
  relay_public_key: string | null;
}): string {
  if (!seller.relay_endpoint || !seller.relay_public_key) {
    const err = new Error('SELLER_RELAY_NOT_REGISTERED') as Error & { statusCode?: number };
    err.statusCode = 409;
    throw err;
  }

  const tunnelByte = 40 + Math.floor(Math.random() * 200);

  return `[Interface]\nPrivateKey = [CLIENT-KEY-GENERATED-ON-DEVICE]\nAddress = 10.42.${tunnelByte}.5/32\nDNS = 1.1.1.1\n\n[Peer]\nPublicKey = ${seller.relay_public_key}\nEndpoint = ${seller.relay_endpoint}\nAllowedIPs = 0.0.0.0/0\nPersistentKeepalive = 25`;
}