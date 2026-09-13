/**
 * Everything the payment server needs, read once from environment variables.
 *
 * On Hostinger these are set in the web app's Environment variables panel.
 * Merchant credentials NEVER belong in the repository or in the website's
 * VITE_ variables — anything there is shipped to every visitor's browser.
 *
 * A provider is enabled only when all of its credentials are present, so the
 * server can go live with one gateway while the other is still being set up.
 */

export type Provider = 'JAZZCASH' | 'EASYPAISA';

export interface JazzCashConfig {
  merchantId: string;
  password: string;
  integritySalt: string;
  baseUrl: string;
  walletPath: string;
  inquiryPath: string;
}

export interface EasypaisaConfig {
  storeId: string;
  username: string;
  password: string;
  /** The merchant's own Easypaisa account number, required by the inquiry API. */
  accountNumber: string;
  baseUrl: string;
  walletPath: string;
  inquiryPath: string;
}

const env = process.env;

function text(name: string, fallback = ''): string {
  return (env[name] ?? fallback).trim();
}

function number(name: string, fallback: number): number {
  const value = Number(env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function jazzcash(): JazzCashConfig | null {
  const merchantId = text('JAZZCASH_MERCHANT_ID');
  const password = text('JAZZCASH_PASSWORD');
  const integritySalt = text('JAZZCASH_INTEGRITY_SALT');
  if (!merchantId || !password || !integritySalt) return null;
  return {
    merchantId,
    password,
    integritySalt,
    baseUrl: text('JAZZCASH_BASE_URL', 'https://payments.jazzcash.com.pk').replace(/\/$/, ''),
    walletPath: text('JAZZCASH_WALLET_PATH', '/ApplicationAPI/API/2.0/Purchase/DoMWalletTransaction'),
    inquiryPath: text('JAZZCASH_INQUIRY_PATH', '/ApplicationAPI/API/PaymentInquiry/Inquire'),
  };
}

function easypaisa(): EasypaisaConfig | null {
  const storeId = text('EASYPAISA_STORE_ID');
  const username = text('EASYPAISA_USERNAME');
  const password = text('EASYPAISA_PASSWORD');
  const accountNumber = text('EASYPAISA_ACCOUNT_NUMBER');
  if (!storeId || !username || !password || !accountNumber) return null;
  return {
    storeId,
    username,
    password,
    accountNumber,
    baseUrl: text('EASYPAISA_BASE_URL', 'https://easypay.easypaisa.com.pk').replace(/\/$/, ''),
    walletPath: text('EASYPAISA_WALLET_PATH', '/easypay-service/rest/v4/initiate-ma-transaction'),
    inquiryPath: text('EASYPAISA_INQUIRY_PATH', '/easypay-service/rest/v4/inquire-transaction'),
  };
}

export const config = {
  port: number('PORT', 3000),
  /** Browsers may only call the API from these origins (comma-separated). */
  allowedOrigins: text('ALLOWED_ORIGINS', 'https://terntechshop.com,https://www.terntechshop.com')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
  /** Unpaid online orders are cancelled, and their stock returned, after this long. */
  paymentWindowMinutes: number('PAYMENT_WINDOW_MINUTES', 30),
  /** How long to wait for the gateway while the customer approves on their phone. */
  gatewayTimeoutMs: number('GATEWAY_TIMEOUT_SECONDS', 90) * 1000,
  /** A payment still unconfirmed after this long is flagged for staff to check by hand. */
  reviewAfterMinutes: number('REVIEW_AFTER_MINUTES', 20),
  maxAttemptsPerOrder: number('MAX_ATTEMPTS_PER_ORDER', 5),
  /** Payment starts allowed per customer, and per IP address, every 10 minutes. */
  rateLimitPerUser: number('RATE_LIMIT_PER_USER', 10),
  rateLimitPerIp: number('RATE_LIMIT_PER_IP', 30),
  jobsEnabled: text('DISABLE_JOBS') !== '1',
  jazzcash: jazzcash(),
  easypaisa: easypaisa(),
};

export function enabledProviders(): Provider[] {
  const providers: Provider[] = [];
  if (config.jazzcash) providers.push('JAZZCASH');
  if (config.easypaisa) providers.push('EASYPAISA');
  return providers;
}
