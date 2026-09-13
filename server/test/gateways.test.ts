import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createEasypaisa, toRupeeAmount } from '../src/gateways/easypaisa.js';
import { createJazzCash, secureHash } from '../src/gateways/jazzcash.js';
import type { WalletPaymentRequest } from '../src/gateways/types.js';
import { karachiStamp } from '../src/time.js';
import { MOCK_JAZZCASH_SALT, startMockGateways, type MockGateways } from './mock-gateways.js';

let mock: MockGateways;

before(async () => {
  mock = await startMockGateways(0, { hangMs: 1500, approveMs: 50 });
});

after(async () => {
  await mock.close();
});

const jazz = () =>
  createJazzCash(
    {
      merchantId: 'MC12345',
      password: 'secret-pass',
      integritySalt: MOCK_JAZZCASH_SALT,
      baseUrl: mock.url,
      walletPath: '/ApplicationAPI/API/2.0/Purchase/DoMWalletTransaction',
      inquiryPath: '/ApplicationAPI/API/PaymentInquiry/Inquire',
    },
    800,
  );

const easy = (password = 'ep-pass') =>
  createEasypaisa(
    {
      storeId: '12345',
      username: 'ep-user',
      password,
      accountNumber: '03000000000',
      baseUrl: mock.url,
      walletPath: '/easypay-service/rest/v4/initiate-ma-transaction',
      inquiryPath: '/easypay-service/rest/v4/inquire-transaction',
    },
    800,
  );

let counter = 0;
const request = (mobileNumber: string, overrides: Partial<WalletPaymentRequest> = {}): WalletPaymentRequest => ({
  txnRef: `T2026091312000${String((counter += 1)).padStart(5, '0')}`.slice(0, 20),
  amount: 680000,
  mobileNumber,
  cnicLast6: '123456',
  manifestId: 'TT-ABC123',
  email: 'buyer@example.com',
  expiresAt: new Date(Date.now() + 30 * 60_000),
  ...overrides,
});

describe('JazzCash secure hash', () => {
  it('is HMAC-SHA256 of salt & sorted non-empty pp values, uppercase', () => {
    const fields = { pp_TxnRefNo: 'T1', pp_Amount: '100', pp_Language: 'EN', pp_BankID: '', pp_SecureHash: 'ignored', other: 'x' };
    const expected = createHmac('sha256', 'SALT').update('SALT&100&EN&T1').digest('hex').toUpperCase();
    assert.equal(secureHash(fields, 'SALT'), expected);
  });

  it('changes when any value changes', () => {
    const base = { pp_Amount: '100', pp_TxnRefNo: 'T1' };
    assert.notEqual(secureHash(base, 'S'), secureHash({ ...base, pp_Amount: '101' }, 'S'));
  });
});

describe('JazzCash wallet', () => {
  it('approved payment is PAID with a reference', async () => {
    const result = await jazz().pay(request('03001234561'));
    assert.equal(result.outcome, 'PAID');
    assert.ok(result.providerRef);
  });

  it('sends a signed request with amount in paisa, CNIC, Karachi timestamps and alphanumeric references', async () => {
    const txn = request('03001234561');
    await jazz().pay(txn);
    const sent = mock.log.findLast((entry) => entry.body.pp_TxnRefNo === txn.txnRef)?.body ?? {};
    assert.equal(sent.pp_Amount, '680000');
    assert.equal(sent.pp_CNIC, '123456');
    assert.equal(sent.pp_BillReference, 'TTABC123');
    assert.match(String(sent.pp_TxnDateTime), /^\d{14}$/);
    assert.equal(sent.pp_TxnCurrency, 'PKR');
  });

  it('declined payment is FAILED with a customer-friendly message', async () => {
    const result = await jazz().pay(request('03001234562'));
    assert.equal(result.outcome, 'FAILED');
    assert.equal(result.message, 'JazzCash declined the payment.');
  });

  it('"pending" answer is PENDING, and a later inquiry confirms PAID', async () => {
    const gateway = jazz();
    const txn = request('03001234563');
    assert.equal((await gateway.pay(txn)).outcome, 'PENDING');
    assert.equal((await gateway.inquire(txn.txnRef, txn.amount)).outcome, 'PENDING');
    assert.equal((await gateway.inquire(txn.txnRef, txn.amount)).outcome, 'PAID');
  });

  it('no answer in time is PENDING, never FAILED or PAID', async () => {
    const result = await jazz().pay(request('03001234564'));
    assert.equal(result.outcome, 'PENDING');
    assert.equal(result.code, 'TIMEOUT');
  });

  it('paid for the wrong amount goes to REVIEW', async () => {
    const result = await jazz().pay(request('03001234565'));
    assert.equal(result.outcome, 'REVIEW');
  });

  it('a wrong integrity salt is refused by the gateway', async () => {
    const gateway = createJazzCash(
      { merchantId: 'MC1', password: 'p', integritySalt: 'WRONG', baseUrl: mock.url, walletPath: '/ApplicationAPI/API/2.0/Purchase/DoMWalletTransaction', inquiryPath: '/x' },
      800,
    );
    const result = await gateway.pay(request('03001234561'));
    // The mock signs its reply with the real salt, which this client can't verify.
    assert.equal(result.outcome, 'PENDING');
    assert.equal(result.code, 'BAD_HASH');
  });
});

describe('Easypaisa wallet', () => {
  it('approved payment is PAID', async () => {
    const result = await easy().pay(request('03451234561'));
    assert.equal(result.outcome, 'PAID');
    assert.ok(result.providerRef);
  });

  it('sends rupees with two decimals, MA type and the Credentials header', async () => {
    const txn = request('03451234561');
    await easy().pay(txn);
    const sent = mock.log.findLast((entry) => entry.body.orderId === txn.txnRef);
    assert.equal(sent?.body.transactionAmount, '6800.00');
    assert.equal(sent?.body.transactionType, 'MA');
    assert.equal(sent?.body.storeId, '12345');
    assert.ok(sent?.headers.credentials);
  });

  it('declined payment is FAILED with Easypaisa\'s description', async () => {
    const result = await easy().pay(request('03451234562'));
    assert.equal(result.outcome, 'FAILED');
    assert.match(result.message, /declined/i);
  });

  it('system error is PENDING, then inquiry confirms PAID', async () => {
    const gateway = easy();
    const txn = request('03451234563');
    assert.equal((await gateway.pay(txn)).outcome, 'PENDING');
    assert.equal((await gateway.inquire(txn.txnRef, txn.amount)).outcome, 'PENDING');
    assert.equal((await gateway.inquire(txn.txnRef, txn.amount)).outcome, 'PAID');
  });

  it('inquiry reporting a different amount goes to REVIEW', async () => {
    const gateway = easy();
    const txn = request('03451234565');
    await gateway.pay(txn);
    assert.equal((await gateway.inquire(txn.txnRef, txn.amount)).outcome, 'REVIEW');
  });

  it('wrong credentials are refused', async () => {
    const result = await easy('bad').pay(request('03451234561'));
    assert.equal(result.outcome, 'FAILED');
  });
});

describe('helpers', () => {
  it('formats rupee amounts', () => {
    assert.equal(toRupeeAmount(680000), '6800.00');
    assert.equal(toRupeeAmount(12345), '123.45');
  });

  it('stamps times in Pakistan time', () => {
    assert.equal(karachiStamp(new Date('2026-09-13T19:30:05Z')), '20260914003005');
  });
});
