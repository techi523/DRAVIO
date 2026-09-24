import twilio from 'twilio';
import { randomInt } from 'crypto';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

let client: twilio.Twilio | null = null;
if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
}

// Mock OTP store — ONLY used when NODE_ENV === 'test' and Twilio is not configured.
// Never ships a universal passcode that works in dev/production.
interface MockOtp {
  code: string;
  expiresAt: number;
  attempts: number;
}
const mockOtps = new Map<string, MockOtp>();
const MOCK_OTP_TTL_MS = 5 * 60 * 1000;
const MOCK_MAX_ATTEMPTS = 5;

export class OtpService {
  async sendOtp(phoneNumber: string): Promise<void> {
    // Mock mode (test only): generate and store a random code so tests can use it.
    if (process.env.NODE_ENV === 'test' && (!client || !verifyServiceSid)) {
      const code = String(randomInt(100000, 999999));
      mockOtps.set(phoneNumber, { code, expiresAt: Date.now() + MOCK_OTP_TTL_MS, attempts: 0 });
      console.error(`[Mock OTP (test only)] Code for ${phoneNumber}: ${code}`);
      return;
    }

    if (!client || !verifyServiceSid) {
      throw new Error(
        'OTP_UNAVAILABLE: Twilio is not configured. OTP-based login is disabled in this environment.'
      );
    }

    await client.verify.v2.services(verifyServiceSid).verifications.create({
      to: phoneNumber,
      channel: 'sms',
    });
  }

  async verifyOtp(phoneNumber: string, code: string): Promise<boolean> {
    // Mock mode (test only)
    if (process.env.NODE_ENV === 'test' && (!client || !verifyServiceSid)) {
      const entry = mockOtps.get(phoneNumber);
      if (!entry) return false;
      if (entry.attempts >= MOCK_MAX_ATTEMPTS) {
        mockOtps.delete(phoneNumber);
        return false;
      }
      entry.attempts += 1;
      if (Date.now() > entry.expiresAt) {
        mockOtps.delete(phoneNumber);
        return false;
      }
      const valid = entry.code === code;
      if (valid) mockOtps.delete(phoneNumber);
      return valid;
    }

    if (!client || !verifyServiceSid) {
      // No universal fallback. If Twilio is not configured, OTP login cannot work.
      throw new Error(
        'OTP_UNAVAILABLE: Twilio is not configured. OTP-based login is disabled in this environment.'
      );
    }

    const verificationCheck = await client.verify.v2.services(verifyServiceSid).verificationChecks.create({
      to: phoneNumber,
      code,
    });

    return verificationCheck.status === 'approved';
  }
}

export const otpService = new OtpService();