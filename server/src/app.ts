import express, { type NextFunction, type Request, type Response } from 'express';
import { config, enabledProviders } from './config.js';
import { auth } from './firebase.js';
import { PaymentError, startPayment } from './payments.js';

/**
 * HTTP surface. Deliberately tiny:
 *
 *   GET  /health                  liveness, for Hostinger and for you
 *   GET  /api/payments/config     which wallets are switched on (no secrets)
 *   POST /api/payments/start      begin a wallet payment for your own order
 */

/** Fixed-window limiter, in memory. One process on Hostinger, so this is enough. */
function rateLimit(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string): boolean => {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  };
}

const perUser = rateLimit(config.rateLimitPerUser, 10 * 60_000);
const perIp = rateLimit(config.rateLimitPerIp, 10 * 60_000);

async function uidFrom(request: Request): Promise<string> {
  const header = request.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new PaymentError(401, 'Sign in to pay.');
  try {
    return (await auth.verifyIdToken(token)).uid;
  } catch {
    throw new PaymentError(401, 'Your session has expired. Sign in again to pay.');
  }
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Hostinger terminates HTTPS in front of the app; trust it for the client IP.
  app.set('trust proxy', 1);

  app.use((request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    const origin = request.header('origin');
    if (origin && config.allowedOrigins.includes(origin.replace(/\/$/, ''))) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      response.setHeader('Access-Control-Max-Age', '600');
    }
    if (request.method === 'OPTIONS') {
      response.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: '10kb' }));

  app.get('/health', (_request, response) => {
    response.json({ ok: true, providers: enabledProviders() });
  });

  app.get('/api/payments/config', (_request, response) => {
    response.json({ providers: enabledProviders(), paymentWindowMinutes: config.paymentWindowMinutes });
  });

  app.post('/api/payments/start', async (request, response, next) => {
    try {
      if (!perIp(request.ip ?? 'unknown')) throw new PaymentError(429, 'Too many requests. Please wait a few minutes.');
      const uid = await uidFrom(request);
      if (!perUser(uid)) throw new PaymentError(429, 'Too many payment attempts. Please wait a few minutes.');

      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await startPayment({
        uid,
        orderId: body.orderId,
        provider: body.provider,
        mobileNumber: body.mobileNumber,
        cnicLast6: body.cnicLast6,
      });
      response.status(202).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.use((_request, response) => {
    response.status(404).json({ error: 'Not found.' });
  });

  // Never leak stack traces or gateway internals to the browser.
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof PaymentError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    if ((error as { type?: string })?.type === 'entity.parse.failed') {
      response.status(400).json({ error: 'Invalid request.' });
      return;
    }
    console.error('[api] unexpected error:', error);
    response.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  return app;
}
