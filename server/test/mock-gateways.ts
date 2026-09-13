/**
 * Local stand-ins for JazzCash and Easypaisa, for tests and local end-to-end
 * runs. Never used in production.
 *
 * The outcome is chosen by the LAST DIGIT of the customer's mobile number:
 *   1  approved after a short delay
 *   2  declined
 *   3  "still processing": the first inquiry says pending, the next says paid
 *   4  never answers (the server times out); inquiries then say failed
 *   5  approved, but for the wrong amount
 *
 * JazzCash requests must carry a valid pp_SecureHash for MOCK_JAZZCASH_SALT,
 * and Easypaisa requests the expected Credentials header, or they are refused
 * exactly as the real gateways would refuse them.
 *
 *   npm run mock-gateways        # listens on MOCK_GATEWAY_PORT (default 4600)
 */
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { secureHash } from '../src/gateways/jazzcash.js';

export const MOCK_JAZZCASH_SALT = 'TESTSALT123';
export const MOCK_EASYPAISA_CREDENTIALS = Buffer.from('ep-user:ep-pass').toString('base64');

interface Attempt {
  scenario: string;
  amount: string;
  inquiries: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of request) raw += chunk;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export interface MockGateways {
  server: Server;
  url: string;
  /** Every request received, newest last — tests assert on what was sent. */
  log: Array<{ path: string; body: Record<string, unknown>; headers: IncomingMessage['headers'] }>;
  close(): Promise<void>;
}

export async function startMockGateways(port = 0, { hangMs = 5000, approveMs = 1200 } = {}): Promise<MockGateways> {
  const attempts = new Map<string, Attempt>();
  const log: MockGateways['log'] = [];

  const signed = (fields: Record<string, string>) => ({ ...fields, pp_SecureHash: secureHash(fields, MOCK_JAZZCASH_SALT) });

  const server = createServer(async (request, response) => {
    const body = await readJson(request);
    const path = request.url ?? '';
    log.push({ path, body, headers: request.headers });
    const send = (payload: unknown) => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(payload));
    };

    // ---- JazzCash ----------------------------------------------------------
    if (path.includes('DoMWalletTransaction') || path.includes('PaymentInquiry')) {
      const fields = Object.fromEntries(Object.entries(body).map(([k, v]) => [k, String(v)]));
      if (fields.pp_SecureHash !== secureHash(fields, MOCK_JAZZCASH_SALT)) {
        return send(signed({ pp_ResponseCode: '110', pp_ResponseMessage: 'Invalid value for pp_SecureHash' }));
      }

      if (path.includes('DoMWalletTransaction')) {
        const scenario = (fields.pp_MobileNumber ?? '').slice(-1);
        const ref = fields.pp_TxnRefNo ?? '';
        attempts.set(ref, { scenario, amount: fields.pp_Amount ?? '', inquiries: 0 });
        if (scenario === '4') await sleep(hangMs);
        else await sleep(approveMs);
        const base = { pp_TxnRefNo: ref, pp_RetreivalReferenceNo: `JC${ref.slice(-8)}` };
        if (scenario === '1') return send(signed({ ...base, pp_ResponseCode: '000', pp_ResponseMessage: 'Thank you for Using JazzCash, your transaction was successful.', pp_Amount: fields.pp_Amount ?? '' }));
        if (scenario === '2') return send(signed({ ...base, pp_ResponseCode: '409', pp_ResponseMessage: 'Transaction declined' }));
        if (scenario === '3') return send(signed({ ...base, pp_ResponseCode: '157', pp_ResponseMessage: 'Transaction is pending' }));
        if (scenario === '5') return send(signed({ ...base, pp_ResponseCode: '000', pp_ResponseMessage: 'OK', pp_Amount: '100' }));
        return send(signed({ ...base, pp_ResponseCode: '999', pp_ResponseMessage: 'Transaction failed' }));
      }

      const attempt = attempts.get(fields.pp_TxnRefNo ?? '');
      if (!attempt) return send(signed({ pp_ResponseCode: '000', pp_PaymentResponseCode: '199', pp_Status: 'Failed' }));
      attempt.inquiries += 1;
      if (attempt.scenario === '3') {
        return send(signed(attempt.inquiries >= 2
          ? { pp_ResponseCode: '000', pp_PaymentResponseCode: '000', pp_Status: 'Completed', pp_Amount: attempt.amount, pp_RetreivalReferenceNo: 'JCLATE01' }
          : { pp_ResponseCode: '000', pp_PaymentResponseCode: '157', pp_Status: 'Pending' }));
      }
      return send(signed({ pp_ResponseCode: '000', pp_PaymentResponseCode: '199', pp_Status: 'Failed' }));
    }

    // ---- Easypaisa ---------------------------------------------------------
    if (path.includes('initiate-ma-transaction') || path.includes('inquire-transaction')) {
      if (request.headers.credentials !== MOCK_EASYPAISA_CREDENTIALS) {
        return send({ responseCode: '0004', responseDesc: 'Incomplete merchant information' });
      }

      if (path.includes('initiate-ma-transaction')) {
        const scenario = String(body.mobileAccountNo ?? '').slice(-1);
        const orderId = String(body.orderId ?? '');
        attempts.set(orderId, { scenario, amount: String(body.transactionAmount ?? ''), inquiries: 0 });
        if (scenario === '4') await sleep(hangMs);
        else await sleep(approveMs);
        const base = { orderId, storeId: body.storeId, transactionId: `EP${orderId.slice(-8)}`, transactionDateTime: new Date().toISOString() };
        if (scenario === '1' || scenario === '5') return send({ ...base, responseCode: '0000', responseDesc: 'SUCCESS' });
        if (scenario === '3') return send({ ...base, responseCode: '0001', responseDesc: 'System error' });
        return send({ ...base, responseCode: '0005', responseDesc: 'Transaction declined by customer' });
      }

      const attempt = attempts.get(String(body.orderId ?? ''));
      if (!attempt) return send({ responseCode: '0003', responseDesc: 'Invalid order id' });
      attempt.inquiries += 1;
      if (attempt.scenario === '3' && attempt.inquiries >= 2) {
        return send({ responseCode: '0000', transactionStatus: 'PAID', transactionAmount: attempt.amount, transactionId: 'EPLATE01' });
      }
      if (attempt.scenario === '3') return send({ responseCode: '0000', transactionStatus: 'PENDING' });
      if (attempt.scenario === '5') return send({ responseCode: '0000', transactionStatus: 'PAID', transactionAmount: '1.00' });
      return send({ responseCode: '0000', transactionStatus: 'FAILED' });
    }

    response.writeHead(404).end();
  });

  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : port}`;

  return {
    server,
    url,
    log,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

// Run directly: npm run mock-gateways
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop() ?? '')) {
  const mock = await startMockGateways(Number(process.env.MOCK_GATEWAY_PORT ?? 4600));
  console.info(`mock gateways listening on ${mock.url}`);
}
