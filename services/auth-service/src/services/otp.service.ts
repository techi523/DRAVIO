import twilio from 'twilio';

// Twilio Verify Service SID is required to use their Verify API (which handles OTP generation & checking automatically)
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

let client: twilio.Twilio | null = null;
if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
}

export class OtpService {
  async sendOtp(phoneNumber: string): Promise<void> {
    if (!client || !verifyServiceSid) {
      console.warn(`[Mock OTP] Sending OTP to ${phoneNumber}. Ensure TWILIO_ACCOUNT_SID and TWILIO_VERIFY_SERVICE_SID are set in production.`);
      return;
    }
    
    await client.verify.v2.services(verifyServiceSid).verifications.create({
      to: phoneNumber,
      channel: 'sms',
    });
  }

  async verifyOtp(phoneNumber: string, code: string): Promise<boolean> {
    if (!client || !verifyServiceSid) {
      console.warn(`[Mock OTP] Auto-verifying OTP ${code} for ${phoneNumber} because Twilio is not configured.`);
      return code === '123456'; // Mock successful verification for dev
    }

    const verificationCheck = await client.verify.v2.services(verifyServiceSid).verificationChecks.create({
      to: phoneNumber,
      code,
    });

    return verificationCheck.status === 'approved';
  }
}

export const otpService = new OtpService();
