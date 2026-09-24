// Configurable jurisdiction/sanctions gate.
// Pure module: NO DB/IO. The restricted list comes ONLY from the optional
// SANCTIONED_COUNTRIES env override (comma-separated ISO-3166 alpha-2) or an
// operator-seeded compliance.sanctions_config table. NO jurisdiction is hardcoded
// as restricted, and no list is fabricated. Activation requires counsel validation.

export function configuredRestrictedCountries(): string[] {
  const raw = process.env.SANCTIONED_COUNTRIES;
  if (!raw) return [];
  return raw
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
}

export function evaluateCountry(
  countryCode: string,
  restricted = configuredRestrictedCountries()
): { restricted: boolean; reason?: string } {
  const code = (countryCode || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    return { restricted: false, reason: 'INVALID_COUNTRY_CODE' };
  }
  if (restricted.includes(code)) {
    return { restricted: true, reason: 'COUNTRY_RESTRICTED' };
  }
  return { restricted: false };
}

export function assertCountryAllowed(countryCode: string, restricted?: string[]): void {
  const { restricted: blocked } = evaluateCountry(countryCode, restricted);
  if (blocked) {
    throw new Error('COUNTRY_RESTRICTED');
  }
}