import { createApp } from './app.js';
import { config, enabledProviders } from './config.js';
import { expireUnpaidOrders, reconcilePending } from './payments.js';

process.on('unhandledRejection', (reason) => console.error('[api] unhandled rejection:', reason));

const app = createApp();

app.listen(config.port, () => {
  const providers = enabledProviders();
  console.info(`[api] listening on ${config.port}; wallets: ${providers.length ? providers.join(', ') : 'none configured'}`);
  console.info(`[api] allowed origins: ${config.allowedOrigins.join(', ')}`);
});

/** Run a job on an interval without ever overlapping itself. */
function every(ms: number, name: string, job: () => Promise<void>) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await job();
    } catch (error) {
      console.error(`[job] ${name} failed:`, error);
    } finally {
      running = false;
    }
  };
  setInterval(() => void tick(), ms).unref();
  void tick();
}

if (config.jobsEnabled) {
  every(30_000, 'reconcile-pending', reconcilePending);
  every(60_000, 'expire-unpaid', expireUnpaidOrders);
}

// Gateways often allow requests only from whitelisted server IPs. Log ours so
// it can be given to JazzCash / Easypaisa.
void fetch('https://api.ipify.org', { signal: AbortSignal.timeout(10_000) })
  .then((response) => response.text())
  .then((ip) => console.info(`[api] outbound IP for gateway whitelisting: ${ip.trim()}`))
  .catch(() => undefined);
