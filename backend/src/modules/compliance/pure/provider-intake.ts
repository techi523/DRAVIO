// Provider onboarding intake configuration + validation.
// Pure module: NO DB/IO imports. Provider types and their verification-field
// requirements are a CONFIG MAP (not hardcoded statutory requirements) so the
// platform can adapt to validated legal guidance per jurisdiction.

export const PROVIDER_TYPE_IDS = [
  'INDIVIDUAL',
  'BUSINESS',
  'ISP',
  'HOTSPOT_OPERATOR',
  'NETWORK_OPERATOR',
  'OTHER_AUTHORIZED_PROVIDER',
] as const;

export type ProviderTypeId = (typeof PROVIDER_TYPE_IDS)[number];

export interface ProviderTypeConfig {
  id: ProviderTypeId;
  label: string;
  /** Required before a listing can be published (config, not law). */
  requiredFields: ReadonlyArray<string>;
  optionalFields: ReadonlyArray<string>;
  /** Business-style providers must carry organization registration details. */
  businessRecordRequired: boolean;
}

export const PROVIDER_TYPE_CONFIG: ReadonlyArray<ProviderTypeConfig> = [
  {
    id: 'INDIVIDUAL',
    label: 'Individual provider',
    requiredFields: [],
    optionalFields: ['government_id_flag'],
    businessRecordRequired: false,
  },
  {
    id: 'BUSINESS',
    label: 'Business entity',
    requiredFields: ['legal_name', 'registration_number'],
    optionalFields: ['tax_id'],
    businessRecordRequired: true,
  },
  {
    id: 'ISP',
    label: 'Internet service provider',
    requiredFields: ['legal_name', 'registration_number'],
    optionalFields: ['authorization_identifier'],
    businessRecordRequired: true,
  },
  {
    id: 'HOTSPOT_OPERATOR',
    label: 'Hotspot operator',
    requiredFields: ['legal_name'],
    optionalFields: ['registration_number', 'authorization_identifier'],
    businessRecordRequired: true,
  },
  {
    id: 'NETWORK_OPERATOR',
    label: 'Network operator',
    requiredFields: ['legal_name', 'registration_number'],
    optionalFields: ['authorization_identifier'],
    businessRecordRequired: true,
  },
  {
    id: 'OTHER_AUTHORIZED_PROVIDER',
    label: 'Authorized provider (other)',
    requiredFields: ['legal_name'],
    optionalFields: ['registration_number'],
    businessRecordRequired: true,
  },
];

export function providerTypeConfig(typeId: string): ProviderTypeConfig | undefined {
  return PROVIDER_TYPE_CONFIG.find((t) => t.id === typeId);
}

export function isProviderTypeId(value: string): value is ProviderTypeId {
  return (PROVIDER_TYPE_IDS as readonly string[]).includes(value);
}

function normalizeFieldValue(field: string, value: unknown): unknown {
  if (typeof value === 'string') {
    const clean = value.trim();
    if (field === 'country_code') return clean.toUpperCase();
    if (clean === '') return undefined;
    return clean;
  }
  if (typeof value === 'boolean') return value;
  return value;
}

/** Validate + normalize an intake payload against the type's config.
 *  Required fields must be present and non-empty (strings). Returns errors. */
export function validateIntake(
  typeId: string,
  payload: Record<string, unknown>
): {
  ok: boolean;
  errors: Array<{ field: string; message: string }>;
  normalized: Record<string, unknown>;
} {
  const errors: Array<{ field: string; message: string }> = [];
  const config = providerTypeConfig(typeId);

  if (!config) {
    return { ok: false, errors: [{ field: 'provider_type', message: 'UNKNOWN_PROVIDER_TYPE' }], normalized: {} };
  }

  const normalized: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of Object.entries(payload || {})) {
    const value = normalizeFieldValue(rawKey, rawValue);
    if (value !== undefined) normalized[rawKey] = value;
  }

  // Unknown-field rejection: never silently accept registration payload fields.
  const knownFields = new Set([
    ...config.requiredFields,
    ...config.optionalFields,
    'country_code',
    'business_record_attached',
  ]);
  const violations = Object.keys(normalized).filter((k) => !knownFields.has(k));
  for (const field of violations) {
    errors.push({ field, message: 'UNKNOWN_FIELD' });
  }

  if (config.businessRecordRequired && normalized.business_record_attached !== true) {
    errors.push({ field: 'business_record_attached', message: 'REQUIRED' });
  }

  for (const field of config.requiredFields) {
    const value = normalized[field];
    if (typeof value !== 'string' || value.length < 2) {
      errors.push({ field, message: 'REQUIRED' });
    }
  }

  const ok = errors.length === 0;
  return { ok, errors, normalized };
}

/** Whether a submitted/verification payload satisfies SELL-gating requirements
 *  for the type. This is config-driven; the marketplace may opt to require it. */
export function intakeSatisfiesSellGate(typeId: string, verification: Record<string, unknown>): boolean {
  const config = providerTypeConfig(typeId);
  if (!config) return false;
  if (config.businessRecordRequired && verification.business_record_attached !== true) {
    return false;
  }
  return config.requiredFields.every((field) => {
    const value = verification[field];
    return typeof value === 'string' && value.trim().length >= 2;
  });
}