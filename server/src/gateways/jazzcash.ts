import { createHmac, timingSafeEqual } from 'node:crypto';
import type { JazzCashConfig } from '../config.js';
import { karachiStamp } from '../time.js';
import { unknownResult, type GatewayResult, type WalletGateway, type WalletPaymentRequest } from './types.js';

/**
 * JazzCash Mobile Wallet REST API v2.0 (CNIC enabled).
 *
 * The customer enters their JazzCash number and the last 6 digits of their
 * CNIC; JazzCash sends an approval prompt to their phone and answers this
 * request once they approve, reject, or the prompt times out.
 *
 * Every request and response carries pp_SecureHash: HMAC-SHA256, keyed with
 * the integrity salt, over the salt followed by the values of every non-empty
 * pp* field sorted by field name, joined with '&', as uppercase hex.
 */

type Fields = Record<string, string>;

export function secureHash(fields: Fields, integritySalt: string): string {
  const values = Object.keys(fields)
    .filter((key) => key.startsWith('pp') && key !== 'pp_SecureHash' && fields[key] !== undefined && fields[key] !== '')
    .sort()
    .map((key) => fields[key]);
  return createHmac('sha256', integritySalt).update([integritySalt, ...values].join('&')).digest('hex').toUpperCase();
}

function hashMatches(fields: Fields, integritySalt: string): boolean {
  const received = String(fields.pp_SecureHash ?? '').toUpperCase();
  const expected = secureHash(fields, integritySalt);
  return received.length === expected.length && timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

/** JazzCash accepts letters and digits only in references and descriptions. */
const alnum = (value: string) => value.replace(/[^A-Za-z0-9]/g, '');

const PAID = new Set(['000', '121']);
const PENDING = new Set(['124', '157']);

/** Customer-facing wording for the common refusals; anything else stays generic. */
const FRIENDLY: Record<string, string> = {
  '001': 'The payment exceeds your JazzCash limit.',
  '002': 'No JazzCash account was found for that mobile number.',
  '110': 'JazzCash rejected the payment details. Check the mobile number and CNIC digits.',
  '129': 'The payment was not completed. Please try again.',
  '409': 'JazzCash declined the payment.',
};

function describe(code: string, gatewayMessage: string): string {
  return FRIENDLY[code] ?? (gatewayMessage ? `JazzCash: ${gatewayMessage}` : 'JazzCash could not complete the payment.');
}

function stringFields(body: unknown): Fields {
  const out: Fields = {};
  if (body && typeof body === 'object') {
    for (const [key, value] of Object.entries(body)) out[key] = value === null || value === undefined ? '' : String(value);
  }
  return out;
}

export function createJazzCash(config: JazzCashConfig, timeoutMs: number): WalletGateway {
  async function post(path: string, fields: Fields, timeout: number): Promise<Fields> {
    const signed = { ...fields, pp_SecureHash: secureHash(fields, config.integritySalt) };
    const response = await fetch(`${config.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(signed),
      signal: AbortSignal.timeout(timeout),
    });
    if (!response.ok) throw Object.assign(new Error(`JazzCash HTTP ${response.status}`), { name: 'HttpError' });
    return stringFields(await response.json());
  }

  /** A response we can't authenticate is never trusted as paid. */
  function untrusted(fields: Fields): GatewayResult | null {
    if (fields.pp_SecureHash && !hashMatches(fields, config.integritySalt)) {
      return { outcome: 'PENDING', code: 'BAD_HASH', message: 'Waiting for confirmation from JazzCash.' };
    }
    return null;
  }

  return {
    async pay(request: WalletPaymentRequest): Promise<GatewayResult> {
      const now = new Date();
      const fields: Fields = {
        pp_Language: 'EN',
        pp_MerchantID: config.merchantId,
        pp_Password: config.password,
        pp_TxnRefNo: request.txnRef,
        pp_MobileNumber: request.mobileNumber,
        pp_CNIC: request.cnicLast6 ?? '',
        pp_Amount: String(request.amount),
        pp_TxnCurrency: 'PKR',
        pp_TxnDateTime: karachiStamp(now),
        pp_TxnExpiryDateTime: karachiStamp(request.expiresAt),
        pp_BillReference: alnum(request.manifestId),
        pp_Description: `Order ${alnum(request.manifestId)}`,
      };

      let reply: Fields;
      try {
        reply = await post(config.walletPath, fields, timeoutMs);
      } catch (error) {
        return unknownResult(error);
      }

      const rejected = untrusted(reply);
      if (rejected) return rejected;

      const code = reply.pp_ResponseCode ?? '';
      const providerRef = reply.pp_RetreivalReferenceNo || reply.pp_RetrievalReferenceNo || undefined;
      if (PAID.has(code)) {
        if (reply.pp_Amount && reply.pp_Amount !== String(request.amount)) {
          return { outcome: 'REVIEW', code: 'AMOUNT_MISMATCH', message: 'Payment received with an unexpected amount.', providerRef };
        }
        return { outcome: 'PAID', code, message: 'Paid with JazzCash.', providerRef };
      }
      if (PENDING.has(code)) return { outcome: 'PENDING', code, message: 'Waiting for confirmation from JazzCash.', providerRef };
      return { outcome: 'FAILED', code, message: describe(code, reply.pp_ResponseMessage ?? ''), providerRef };
    },

    async inquire(txnRef: string, amount: number): Promise<GatewayResult> {
      let reply: Fields;
      try {
        reply = await post(
          config.inquiryPath,
          { pp_TxnRefNo: txnRef, pp_MerchantID: config.merchantId, pp_Password: config.password },
          30_000,
        );
      } catch (error) {
        return unknownResult(error);
      }

      const rejected = untrusted(reply);
      if (rejected) return rejected;

      // pp_ResponseCode describes the inquiry itself; the payment's own result
      // is in pp_PaymentResponseCode / pp_Status.
      if (reply.pp_ResponseCode !== '000') {
        return { outcome: 'PENDING', code: `INQ_${reply.pp_ResponseCode ?? ''}`, message: 'Waiting for confirmation from JazzCash.' };
      }
      const code = reply.pp_PaymentResponseCode ?? '';
      const status = (reply.pp_Status ?? '').toLowerCase();
      const providerRef = reply.pp_RetreivalReferenceNo || reply.pp_RetrievalReferenceNo || undefined;

      if (PAID.has(code) || status === 'completed') {
        if (reply.pp_Amount && reply.pp_Amount !== String(amount)) {
          return { outcome: 'REVIEW', code: 'AMOUNT_MISMATCH', message: 'Payment received with an unexpected amount.', providerRef };
        }
        return { outcome: 'PAID', code: code || 'COMPLETED', message: 'Paid with JazzCash.', providerRef };
      }
      if (PENDING.has(code) || status === 'pending' || status === '') {
        return { outcome: 'PENDING', code: code || 'PENDING', message: 'Waiting for confirmation from JazzCash.', providerRef };
      }
      return { outcome: 'FAILED', code, message: describe(code, reply.pp_PaymentResponseMessage ?? ''), providerRef };
    },
  };
}
