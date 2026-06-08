import { env } from './env.js';

const LIVE_BASE_URL = 'https://api.safaricom.co.ke';
const SANDBOX_BASE_URL = 'https://sandbox.safaricom.co.ke';

function getBaseUrl(): string {
  return env.MPESA_ENV === 'live' ? LIVE_BASE_URL : SANDBOX_BASE_URL;
}

export class MpesaService {
  private static async getAccessToken(): Promise<string> {
    const auth = Buffer.from(`${env.MPESA_CONSUMER_KEY}:${env.MPESA_CONSUMER_SECRET}`).toString('base64');
    const baseUrl = getBaseUrl();

    const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      method: 'GET',
      headers: { Authorization: `Basic ${auth}` }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to fetch M-Pesa access token: ${errText}`);
    }

    const data = await response.json() as { access_token: string };
    return data.access_token;
  }

  public static async initiateStkPush(
    phoneNumber: string,
    amount: number,
    accountReference: string
  ): Promise<{ MerchantRequestID: string; CheckoutRequestID: string }> {
    const accessToken = await this.getAccessToken();
    const baseUrl = getBaseUrl();

    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(
      `${env.MPESA_SHORTCODE}${env.MPESA_LNM_PASSKEY}${timestamp}`
    ).toString('base64');

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
      TransactionDesc: `PMATRIX Subscription: ${accountReference}`
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
      throw new Error(`M-Pesa STK Push failed: ${errText}`);
    }

    return await response.json() as { MerchantRequestID: string; CheckoutRequestID: string };
  }

  public static async handleCallback(body: any): Promise<{
    success: boolean;
    merchantRequestId: string;
    checkoutRequestId: string;
    mpesaReceiptNumber?: string;
    amount?: number;
    phoneNumber?: string;
  }> {
    const stk = body?.Body?.stkCallback;
    if (!stk) throw new Error('Invalid M-Pesa callback payload structure');

    const merchantRequestId: string = stk.MerchantRequestID;
    const checkoutRequestId: string = stk.CheckoutRequestID;
    const resultCode: number = stk.ResultCode;

    if (resultCode !== 0) {
      return { success: false, merchantRequestId, checkoutRequestId };
    }

    const items: any[] = stk.CallbackMetadata?.Item ?? [];
    const get = (name: string) => items.find((i: any) => i.Name === name)?.Value;

    return {
      success: true,
      merchantRequestId,
      checkoutRequestId,
      mpesaReceiptNumber: get('MpesaReceiptNumber'),
      amount: get('Amount'),
      phoneNumber: String(get('PhoneNumber') ?? '')
    };
  }
}
