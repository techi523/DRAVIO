import axios, { AxiosInstance } from 'axios';

const MPESA_ENV = process.env.MPESA_ENV || 'sandbox';
const BASE_URL = MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

export interface STKPushResult {
  providerRef: string;
  merchantRequestId: string;
  responseCode: string;
  responseDescription: string;
}

export interface MpesaCallbackData {
  resultCode: number;
  resultDesc: string;
  checkoutRequestID: string;
  merchantRequestID: string;
  amount?: number;
  mpesaReceiptNumber?: string;
  transactionDate?: string;
  phoneNumber?: string;
}

class MpesaProvider {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({ baseURL: BASE_URL, timeout: 30000 });
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    if (!consumerKey || !consumerSecret) {
      throw new Error('MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET are required');
    }

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const response = await this.httpClient.get('/oauth/v1/generate?grant_type=client_credentials', {
      headers: { Authorization: `Basic ${auth}` }
    });

    this.accessToken = response.data.access_token;
    this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;
    return this.accessToken!;
  }

  private generatePassword(timestamp: string): string {
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    if (!shortcode || !passkey) {
      throw new Error('MPESA_SHORTCODE and MPESA_PASSKEY are required');
    }
    return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
  }

  async initiateSTKPush(
    phoneNumber: string,
    amountKes: number,
    accountRef: string,
    transactionDesc: string = 'DRAVIO Wallet Top-Up'
  ): Promise<STKPushResult> {
    const token = await this.getAccessToken();
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const password = this.generatePassword(timestamp);
    const shortcode = process.env.MPESA_SHORTCODE!;
    const callbackUrl = process.env.MPESA_CALLBACK_URL;

    if (!callbackUrl) {
      throw new Error('MPESA_CALLBACK_URL is required for STK Push');
    }

    const normalizedPhone = phoneNumber.replace(/^(\+?254|0)/, '254');

    const response = await this.httpClient.post(
      '/mpesa/stkpush/v1/processrequest',
      {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.ceil(amountKes),
        PartyA: normalizedPhone,
        PartyB: shortcode,
        PhoneNumber: normalizedPhone,
        CallBackURL: callbackUrl,
        AccountReference: accountRef,
        TransactionDesc: transactionDesc,
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    const data = response.data;
    if (data.ResponseCode !== '0') {
      throw new Error(`M-Pesa STK Push failed: ${data.ResponseDescription || data.errorMessage}`);
    }

    return {
      providerRef: data.CheckoutRequestID,
      merchantRequestId: data.MerchantRequestID,
      responseCode: data.ResponseCode,
      responseDescription: data.ResponseDescription,
    };
  }

  parseCallback(body: any): MpesaCallbackData {
    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback) {
      throw new Error('Invalid M-Pesa callback payload');
    }

    const result: MpesaCallbackData = {
      resultCode: stkCallback.ResultCode,
      resultDesc: stkCallback.ResultDesc,
      checkoutRequestID: stkCallback.CheckoutRequestID,
      merchantRequestID: stkCallback.MerchantRequestID,
    };

    if (stkCallback.ResultCode === 0 && stkCallback.CallbackMetadata?.Item) {
      for (const item of stkCallback.CallbackMetadata.Item) {
        switch (item.Name) {
          case 'Amount':
            result.amount = item.Value;
            break;
          case 'MpesaReceiptNumber':
            result.mpesaReceiptNumber = item.Value;
            break;
          case 'TransactionDate':
            result.transactionDate = String(item.Value);
            break;
          case 'PhoneNumber':
            result.phoneNumber = String(item.Value);
            break;
        }
      }
    }

    return result;
  }

  async queryTransactionStatus(checkoutRequestId: string): Promise<any> {
    const token = await this.getAccessToken();
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const password = this.generatePassword(timestamp);
    const shortcode = process.env.MPESA_SHORTCODE!;

    const response = await this.httpClient.post(
      '/mpesa/stkpushquery/v1/query',
      {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    return response.data;
  }
}

export const mpesaProvider = new MpesaProvider();
