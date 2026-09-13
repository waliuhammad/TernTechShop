/**
 * What a gateway call means for the order, independent of which gateway.
 *
 * - PAID     the gateway confirmed the money was taken
 * - FAILED   the gateway confirmed it was not (declined, wrong PIN, timed out on the phone…)
 * - PENDING  no definite answer yet (network error, "in process") — ask again with an inquiry
 * - REVIEW   an answer that doesn't add up (amount mismatch, bad signature) — a person must check
 */
export type Outcome = 'PAID' | 'FAILED' | 'PENDING' | 'REVIEW';

export interface GatewayResult {
  outcome: Outcome;
  /** The gateway's own response code, for the audit log. */
  code: string;
  /** Safe to show the customer. */
  message: string;
  /** The gateway's transaction / retrieval reference, when it gave one. */
  providerRef?: string;
}

export interface WalletPaymentRequest {
  /** Our unique reference for this attempt (≤ 20 alphanumeric characters). */
  txnRef: string;
  /** Integer paisa, from the order document — never from the browser. */
  amount: number;
  /** 03XXXXXXXXX */
  mobileNumber: string;
  /** Last six digits of the payer's CNIC. JazzCash only; never stored. */
  cnicLast6?: string;
  manifestId: string;
  email: string;
  /** When the gateway should stop accepting approval. */
  expiresAt: Date;
}

export interface WalletGateway {
  pay(request: WalletPaymentRequest): Promise<GatewayResult>;
  inquire(txnRef: string, amount: number): Promise<GatewayResult>;
}

/** A network failure or timeout: we don't know whether the customer paid. */
export function unknownResult(error: unknown): GatewayResult {
  const timedOut = (error as { name?: string })?.name === 'TimeoutError';
  return {
    outcome: 'PENDING',
    code: timedOut ? 'TIMEOUT' : 'NETWORK',
    message: 'Waiting for confirmation from the payment provider.',
  };
}
