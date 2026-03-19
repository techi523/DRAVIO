/// <reference types="@jest/globals" />
import { describe, it, expect } from '@jest/globals';
import { generateDeviceFingerprint, evaluateRiskScore } from '../src/security';

describe('Security Layer', () => {
  it('should generate consistent fingerprints', () => {
    const headers = { 'user-agent': 'Mozilla/5.0', 'accept-language': 'en-US' };
    const fp1 = generateDeviceFingerprint(headers);
    const fp2 = generateDeviceFingerprint(headers);
    expect(fp1).toBe(fp2);
  });

  it('should flag malicious IPs', () => {
    const score = evaluateRiskScore('fp_abc', '1.2.3.4');
    expect(score).toBe(100);
  });
});
