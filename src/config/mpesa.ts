import { env } from './env.js';

export class MpesaService {
  private static async getAccessToken(): Promise<string> {
    const auth = Buffer.from(`${env.MPESA_CONSUMER_KEY}:${env.MPESA_CONSUMER_SECRET}`).toString('base64');
    const baseUrl = env.MPESA_ENV === 'live' 
      ? 'https://safaricom.co.ke' 
      : 'https://safaricom.co.ke';

    const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      method: 'GET',
      headers: { Authorization: `Basic ${auth}` }
    });

    if (!response.ok) throw new Error('Failed to fetch access token from Safaricom API server.');
    const data = await response.json() as { access_token: string };
    return data.access_token;
  }

  public static async initiateStkPush(phoneNumber: string, amount: number, accountReference: string): Promise<{ MerchantRequestID: string, CheckoutRequestID: string }> {
    const accessToken = await this.getAccessToken();
    const baseUrl = env.MPESA_ENV === 'live' ? 'https://safaricom.co.ke' : 'https://safaricom.co.ke';
    
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(`${env.MPESA_SHORTCODE}${env.MPESA_LNM_PASSKEY}${timestamp}`).toString('base64');

    const payload = {
      BusinessShortCode: env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.ceil(amount),
      PartyA: phoneNumber,
      PartyB: env.MPESA_SHORTCODE,
      PhoneNumber: phoneNumber,
      CallBackURL: env.MPESA_CALLBACK_URL,
      AccountReference: accountReference,
      TransactionDesc: `PMATRIX Subscription Activation Plan: ${accountReference}`
    };

    const response = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`M-Pesa STK Push execution rejected: ${errText}`);
    }

    return await response.json() as { MerchantRequestID: string, CheckoutRequestID: string };
  }
}
