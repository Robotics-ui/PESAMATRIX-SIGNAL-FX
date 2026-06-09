import { Response } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db/connection.js';
import {
  subscriptions,
  subscriptionSettings,
  payments,
} from '../../lib/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { MpesaService } from '../../config/mpesa.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';

function normalizeMpesaPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) return '254' + digits.slice(1);
  if (digits.startsWith('254')) return digits;
  return '254' + digits;
}

// POST /api/billing/mpesa/stk-push
export async function initiateStkPush(req: AuthenticatedRequest, res: Response) {
  const schema = z.object({
    phoneNumber: z.string().min(9, 'Enter a valid phone number'),
    tradingDays: z.number().int().positive('Trading days must be a positive integer'),
  });

  try {
    const parsed = schema.parse(req.body);

    const settings = await db.select().from(subscriptionSettings).limit(1);
    if (!settings.length || !settings[0].isActive) {
      return res.status(400).json({ error: 'Subscriptions are currently unavailable.' });
    }

    const s = settings[0];
    if (parsed.tradingDays < s.minDays || parsed.tradingDays > s.maxDays) {
      return res.status(400).json({
        error: `Trading days must be between ${s.minDays} and ${s.maxDays}.`,
      });
    }

    const amount = parseFloat(s.feePerDay) * parsed.tradingDays;
    const phone = normalizeMpesaPhone(parsed.phoneNumber);
    const ref = `PMX-${Date.now()}`;

    const mpesaResult = await MpesaService.initiateStkPush(phone, amount, ref);

    // Record pending payment
    await db.insert(payments).values({
      userId: req.user!.id,
      planId: '00000000-0000-0000-0000-000000000000', // placeholder — no plan-based flow
      merchantRequestId: mpesaResult.MerchantRequestID,
      checkoutRequestId: mpesaResult.CheckoutRequestID,
      phoneNumber: phone,
      amount: String(amount.toFixed(2)),
      status: 'pending',
    });

    return res.json({
      success: true,
      merchantRequestId: mpesaResult.MerchantRequestID,
      checkoutRequestId: mpesaResult.CheckoutRequestID,
      amount,
      tradingDays: parsed.tradingDays,
      message: 'STK push sent. Complete payment on your phone.',
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}
