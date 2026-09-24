import axios from 'axios';
import { Wallet, Transaction } from '../schema/wallet.schema.js';

export class MpesaService {
  private consumerKey: string;
  private consumerSecret: string;
  private shortCode: string;
  private passkey: string;
  private callbackUrl: string;

  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY || '';
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET || '';
    this.shortCode = process.env.MPESA_SHORTCODE || '';
    this.passkey = process.env.MPESA_PASSKEY || '';
    this.callbackUrl = process.env.MPESA_CALLBACK_URL || '';

    if (!this.consumerKey || !this.consumerSecret || !this.shortCode || !this.passkey || !this.callbackUrl) {
      throw new Error('MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY and MPESA_CALLBACK_URL must be configured');
    }
  }

  private async getAccessToken() {
    const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
    const response = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: { Authorization: `Basic ${auth}` }
    });
    return response.data.access_token;
  }

  async stkPush(phoneNumber: string, amount: number, userId: string) {
    const token = await this.getAccessToken();
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const password = Buffer.from(`${this.shortCode}${this.passkey}${timestamp}`).toString('base64');

    const body = {
      BusinessShortCode: this.shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phoneNumber,
      PartyB: this.shortCode,
      PhoneNumber: phoneNumber,
      CallBackURL: this.callbackUrl,
      AccountReference: `DRAVIO_${userId}`,
      TransactionDesc: 'Wallet Deposit'
    };

    const response = await axios.post('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', body, {
      headers: { Authorization: `Bearer ${token}` }
    });

    return response.data;
  }

  async handleCallback(data: any) {
    const { Body } = data;
    if (Body.stkCallback.ResultCode === 0) {
      const metadata = Body.stkCallback.CallbackMetadata.Item;
      const amount = metadata.find((i: any) => i.Name === 'Amount').Value;
      const mpesaRef = metadata.find((i: any) => i.Name === 'MpesaReceiptNumber').Value;
      const userId = Body.stkCallback.AccountReference.split('_')[1];

      // Update wallet
      const wallet = await Wallet.findOneAndUpdate(
        { userId },
        { $inc: { balance: amount } },
        { upsert: true, new: true }
      );

      // Record transaction
      await Transaction.create({
        walletId: wallet._id,
        type: 'DEPOSIT',
        amount: amount,
        provider: 'MPESA',
        externalRef: mpesaRef,
        description: 'M-Pesa Deposit'
      });

      return { success: true, userId, amount };
    }
    return { success: false };
  }
}
