import type { EasypaisaConfig } from '../config.js';
import { unknownResult, type GatewayResult, type WalletGateway, type WalletPaymentRequest } from './types.js';

/**
 * Easypaisa "Mobile Account" (MA) REST API v4.
 *
 * The customer enters their Easypaisa number; Easypaisa asks them to approve on
 * their phone and answers this request with the result. Requests authenticate
 * with the partner username:password (Base64) in a `Credentials` header — no
 * request signing is used for this API.
 */

/**
 * 0001 is Easypaisa's generic system error: the payment may or may not have
 * gone through, so ask again rather than fail. Other refusals are shown with
 * Easypaisa's own description.
 */
const UNSURE = new Set(['0001']);

function describe(gatewayMessage: string): string {
  return gatewayMessage ? `Easypaisa: ${gatewayMessage}` : 'Easypaisa could not complete the payment.';
}

/** Paisa -> "1234.50", the decimal-rupee format Easypaisa expects. */
export function toRupeeAmount(paisa: number): string {
  return (paisa / 100).toFixed(2);
}

export function createEasypaisa(config: EasypaisaConfig, timeoutMs: number): WalletGateway {
  const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64');

  async function post(path: string, body: Record<string, unknown>, timeout: number): Promise<Record<string, unknown>> {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Credentials: credentials },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
    if (!response.ok) throw Object.assign(new Error(`Easypaisa HTTP ${response.status}`), { name: 'HttpError' });
    return (await response.json()) as Record<string, unknown>;
  }

  const str = (value: unknown) => (value === null || value === undefined ? '' : String(value));

  return {
    async pay(request: WalletPaymentRequest): Promise<GatewayResult> {
      let reply: Record<string, unknown>;
      try {
        reply = await post(
          config.walletPath,
          {
            orderId: request.txnRef,
            storeId: config.storeId,
            transactionAmount: toRupeeAmount(request.amount),
            transactionType: 'MA',
            mobileAccountNo: request.mobileNumber,
            emailAddress: request.email,
          },
          timeoutMs,
        );
      } catch (error) {
        return unknownResult(error);
      }

      const code = str(reply.responseCode);
      const providerRef = str(reply.transactionId) || undefined;
      if (code === '0000') return { outcome: 'PAID', code, message: 'Paid with Easypaisa.', providerRef };
      if (UNSURE.has(code)) return { outcome: 'PENDING', code, message: 'Waiting for confirmation from Easypaisa.', providerRef };
      return { outcome: 'FAILED', code, message: describe(str(reply.responseDesc)), providerRef };
    },

    async inquire(txnRef: string, amount: number): Promise<GatewayResult> {
      let reply: Record<string, unknown>;
      try {
        reply = await post(
          config.inquiryPath,
          { orderId: txnRef, storeId: config.storeId, accountNum: config.accountNumber },
          30_000,
        );
      } catch (error) {
        return unknownResult(error);
      }

      if (str(reply.responseCode) !== '0000') {
        return { outcome: 'PENDING', code: `INQ_${str(reply.responseCode)}`, message: 'Waiting for confirmation from Easypaisa.' };
      }
      const status = str(reply.transactionStatus).toUpperCase();
      const providerRef = str(reply.transactionId) || undefined;

      if (status === 'PAID') {
        const reported = Number(str(reply.transactionAmount));
        if (Number.isFinite(reported) && reported > 0 && Math.round(reported * 100) !== amount) {
          return { outcome: 'REVIEW', code: 'AMOUNT_MISMATCH', message: 'Payment received with an unexpected amount.', providerRef };
        }
        return { outcome: 'PAID', code: 'PAID', message: 'Paid with Easypaisa.', providerRef };
      }
      if (status === 'PENDING' || status === 'INITIATED' || status === '') {
        return { outcome: 'PENDING', code: status || 'PENDING', message: 'Waiting for confirmation from Easypaisa.', providerRef };
      }
      return { outcome: 'FAILED', code: status, message: 'Easypaisa did not complete the payment.', providerRef };
    },
  };
}
