import * as crypto from 'crypto';
import { StripeGateway } from './stripe.gateway';

// Mocked Stripe SDK methods
const mockPaymentIntentsCreate = jest.fn();
const mockPaymentIntentsRetrieve = jest.fn();
const mockRefundsCreate = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: mockPaymentIntentsCreate,
      retrieve: mockPaymentIntentsRetrieve,
    },
    refunds: {
      create: mockRefundsCreate,
    },
  }));
});

beforeEach(() => {
  mockPaymentIntentsCreate.mockReset();
  mockPaymentIntentsRetrieve.mockReset();
  mockRefundsCreate.mockReset();
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
const WEBHOOK_SECRET = 'whsec_test_webhook_secret_32chars!!!';
const PUBLISHABLE_KEY = 'pk_test_abcdef';

function buildSignature(body: string, timestamp: number, secret = WEBHOOK_SECRET): string {
  const payload = `${timestamp}.${body}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

function makeIntent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'pi_test_123',
    client_secret: 'pi_test_123_secret_abc',
    amount: 50000,
    currency: 'inr',
    status: 'requires_payment_method',
    ...overrides,
  };
}

function makeWebhookBody(intentOverrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: 'evt_test_456',
    type: 'payment_intent.succeeded',
    data: { object: makeIntent(intentOverrides) },
  });
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------
describe('StripeGateway constructor', () => {
  it('throws when secret_key is missing', () => {
    expect(() => new StripeGateway({})).toThrow(
      'StripeGateway requires secret_key in credentials',
    );
  });

  it('does not throw when secret_key is provided', () => {
    expect(() => new StripeGateway({ secret_key: 'sk_test_x' })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getName
// ---------------------------------------------------------------------------
describe('getName', () => {
  it('returns stripe', () => {
    const gateway = new StripeGateway({ secret_key: 'sk_test_x' });
    expect(gateway.getName()).toBe('stripe');
  });
});

// ---------------------------------------------------------------------------
// createOrder
// ---------------------------------------------------------------------------
describe('createOrder', () => {
  let gateway: StripeGateway;

  beforeEach(() => {
    gateway = new StripeGateway({ secret_key: 'sk_test_x', publishable_key: PUBLISHABLE_KEY });
  });

  it('calls paymentIntents.create with amount in paise (no conversion)', async () => {
    mockPaymentIntentsCreate.mockResolvedValue(makeIntent({ amount: 50000 }));

    await gateway.createOrder({
      amount: 50000, // already paise
      currency: 'INR',
      bookingId: 'book_999',
      customerEmail: 'test@example.com',
      notes: { foo: 'bar' },
    });

    expect(mockPaymentIntentsCreate).toHaveBeenCalledTimes(1);
    const callArg = mockPaymentIntentsCreate.mock.calls[0][0];
    expect(callArg.amount).toBe(50000); // no ×100
    expect(callArg.currency).toBe('inr'); // lowercase
    expect(callArg.metadata.bookingId).toBe('book_999');
    expect(callArg.metadata.foo).toBe('bar');
    expect(callArg.automatic_payment_methods).toEqual({ enabled: true });
  });

  it('returns gatewayOrderId, keyId, amount, currency from response', async () => {
    mockPaymentIntentsCreate.mockResolvedValue(
      makeIntent({ id: 'pi_custom', amount: 100000, currency: 'inr' }),
    );

    const result = await gateway.createOrder({
      amount: 100000,
      currency: 'INR',
      bookingId: 'book_1',
    });

    expect(result).toEqual({
      gatewayOrderId: 'pi_custom',
      keyId: PUBLISHABLE_KEY,
      amount: 100000,
      currency: 'INR',
    });
  });

  it('forwards bookingId as metadata even without notes', async () => {
    mockPaymentIntentsCreate.mockResolvedValue(makeIntent());

    await gateway.createOrder({
      amount: 1000,
      currency: 'USD',
      bookingId: 'book_only',
    });

    const callArg = mockPaymentIntentsCreate.mock.calls[0][0];
    expect(callArg.metadata.bookingId).toBe('book_only');
  });
});

// ---------------------------------------------------------------------------
// verifyWebhookSignature
// ---------------------------------------------------------------------------
describe('verifyWebhookSignature', () => {
  let gateway: StripeGateway;
  const body = JSON.stringify({ id: 'evt_test', type: 'payment_intent.succeeded' });
  const now = Math.floor(Date.now() / 1000);

  beforeEach(() => {
    gateway = new StripeGateway({
      secret_key: 'sk_test_x',
      webhook_secret: WEBHOOK_SECRET,
    });
  });

  it('returns true for a correctly signed body with current timestamp', () => {
    const sig = buildSignature(body, now);
    expect(gateway.verifyWebhookSignature(body, sig)).toBe(true);
  });

  it('returns true for Buffer body with correct signature', () => {
    const sig = buildSignature(body, now);
    expect(gateway.verifyWebhookSignature(Buffer.from(body), sig)).toBe(true);
  });

  it('returns false for wrong v1 signature', () => {
    const wrong = crypto.createHmac('sha256', WEBHOOK_SECRET).update('wrong').digest('hex');
    const sig = `t=${now},v1=${wrong}`;
    expect(gateway.verifyWebhookSignature(body, sig)).toBe(false);
  });

  it('returns false when v1 is missing from header', () => {
    expect(gateway.verifyWebhookSignature(body, 't=123')).toBe(false);
  });

  it('returns false when t is missing from header', () => {
    expect(gateway.verifyWebhookSignature(body, 'v1=abc')).toBe(false);
  });

  it('returns false when timestamp is older than 5 minutes', () => {
    const oldTimestamp = now - 6 * 60;
    const sig = buildSignature(body, oldTimestamp);
    expect(gateway.verifyWebhookSignature(body, sig)).toBe(false);
  });

  it('returns false when timestamp is more than 5 minutes in the future', () => {
    const futureTimestamp = now + 6 * 60;
    const sig = buildSignature(body, futureTimestamp);
    expect(gateway.verifyWebhookSignature(body, sig)).toBe(false);
  });

  it('returns false when webhook_secret is not configured', () => {
    const noSecretGateway = new StripeGateway({ secret_key: 'sk_test_x' });
    const sig = buildSignature(body, now);
    expect(noSecretGateway.verifyWebhookSignature(body, sig)).toBe(false);
  });

  it('returns false when signature is empty', () => {
    expect(gateway.verifyWebhookSignature(body, '')).toBe(false);
  });

  it('returns false when signature is not a string', () => {
    expect(gateway.verifyWebhookSignature(body, null as unknown as string)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseWebhookEvent
// ---------------------------------------------------------------------------
describe('parseWebhookEvent', () => {
  let gateway: StripeGateway;

  beforeEach(() => {
    gateway = new StripeGateway({ secret_key: 'sk_test_x' });
  });

  it('parses string JSON body', () => {
    const body = makeWebhookBody({ id: 'pi_str', status: 'succeeded', amount: 75000 });
    const event = gateway.parseWebhookEvent(body);

    expect(event.eventId).toBe('evt_test_456');
    expect(event.gatewayPaymentId).toBe('pi_str');
    expect(event.gatewayOrderId).toBe('pi_str');
    expect(event.amount).toBe(75000);
    expect(event.status).toBe('success');
    expect(event.eventType).toBe('payment_intent.succeeded');
    expect(event.gateway).toBe('stripe');
    expect(event.rawPayload).toBeDefined();
  });

  it('parses Buffer JSON body', () => {
    const body = makeWebhookBody({ id: 'pi_buf', status: 'canceled', amount: 30000 });
    const event = gateway.parseWebhookEvent(Buffer.from(body));

    expect(event.gatewayPaymentId).toBe('pi_buf');
    expect(event.status).toBe('failed');
  });

  it('returns pending for statuses other than succeeded or canceled', () => {
    const statuses = [
      'requires_payment_method',
      'requires_confirmation',
      'requires_action',
      'processing',
      'requires_capture',
    ];
    for (const s of statuses) {
      const body = makeWebhookBody({ status: s });
      const event = gateway.parseWebhookEvent(body);
      expect(event.status).toBe('pending');
    }
  });

  it('sets gatewayOrderId equal to gatewayPaymentId (Stripe has no separate order concept)', () => {
    const body = makeWebhookBody({ id: 'pi_alias_test' });
    const event = gateway.parseWebhookEvent(body);
    expect(event.gatewayOrderId).toBe(event.gatewayPaymentId);
  });

  it('handles missing nested fields gracefully', () => {
    const body = JSON.stringify({ id: 'evt_min', type: 'payment_intent.updated' });
    const event = gateway.parseWebhookEvent(body);
    expect(event.eventId).toBe('evt_min');
    expect(event.gatewayPaymentId).toBe('');
    expect(event.status).toBe('pending');
  });
});

// ---------------------------------------------------------------------------
// getStatus
// ---------------------------------------------------------------------------
describe('getStatus', () => {
  let gateway: StripeGateway;

  beforeEach(() => {
    gateway = new StripeGateway({ secret_key: 'sk_test_x' });
  });

  it('maps succeeded to success', async () => {
    mockPaymentIntentsRetrieve.mockResolvedValue(makeIntent({ status: 'succeeded' }));

    const result = await gateway.getStatus('pi_test_123');

    expect(result.status).toBe('success');
    expect(result.gatewayPaymentId).toBe('pi_test_123');
    expect(result.gatewayOrderId).toBe('pi_test_123');
  });

  it('maps canceled to failed', async () => {
    mockPaymentIntentsRetrieve.mockResolvedValue(makeIntent({ status: 'canceled' }));

    const result = await gateway.getStatus('pi_test_123');

    expect(result.status).toBe('failed');
  });

  it('maps requires_payment_method to pending', async () => {
    mockPaymentIntentsRetrieve.mockResolvedValue(
      makeIntent({ status: 'requires_payment_method' }),
    );

    const result = await gateway.getStatus('pi_test_123');

    expect(result.status).toBe('pending');
  });

  it('maps processing to pending', async () => {
    mockPaymentIntentsRetrieve.mockResolvedValue(makeIntent({ status: 'processing' }));

    const result = await gateway.getStatus('pi_test_123');

    expect(result.status).toBe('pending');
  });

  it('maps requires_capture to pending', async () => {
    mockPaymentIntentsRetrieve.mockResolvedValue(makeIntent({ status: 'requires_capture' }));

    const result = await gateway.getStatus('pi_test_123');

    expect(result.status).toBe('pending');
  });

  it('returns raw amount and currency from intent', async () => {
    mockPaymentIntentsRetrieve.mockResolvedValue(
      makeIntent({ amount: 123456, currency: 'usd' }),
    );

    const result = await gateway.getStatus('pi_test_123');

    expect(result.amount).toBe(123456);
    // Note: PaymentStatusResult has no currency field; verified via build clean.
  });
});

// ---------------------------------------------------------------------------
// refund
// ---------------------------------------------------------------------------
describe('refund', () => {
  let gateway: StripeGateway;

  beforeEach(() => {
    gateway = new StripeGateway({ secret_key: 'sk_test_x' });
  });

  it('calls refunds.create with gatewayPaymentId as payment_intent', async () => {
    mockRefundsCreate.mockResolvedValue({
      id: 're_test_1',
      amount: 50000,
      status: 'succeeded',
      payment_intent: 'pi_abc',
    });

    await gateway.refund({ gatewayPaymentId: 'pi_abc' });

    expect(mockRefundsCreate).toHaveBeenCalledTimes(1);
    expect(mockRefundsCreate.mock.calls[0][0].payment_intent).toBe('pi_abc');
  });

  it('forwards amount in paise when provided', async () => {
    mockRefundsCreate.mockResolvedValue({
      id: 're_test_2',
      amount: 25000,
      status: 'pending',
      payment_intent: 'pi_abc',
    });

    await gateway.refund({ gatewayPaymentId: 'pi_abc', amount: 25000 });

    expect(mockRefundsCreate.mock.calls[0][0].amount).toBe(25000);
  });

  it('omits amount when not provided (full refund)', async () => {
    mockRefundsCreate.mockResolvedValue({
      id: 're_test_3',
      amount: 50000,
      status: 'succeeded',
      payment_intent: 'pi_abc',
    });

    await gateway.refund({ gatewayPaymentId: 'pi_abc' });

    expect(mockRefundsCreate.mock.calls[0][0].amount).toBeUndefined();
  });

  it('maps Stripe succeeded status to processed', async () => {
    mockRefundsCreate.mockResolvedValue({
      id: 're_test_4',
      amount: 10000,
      status: 'succeeded',
      payment_intent: 'pi_abc',
    });

    const result = await gateway.refund({ gatewayPaymentId: 'pi_abc' });

    expect(result.status).toBe('processed');
  });

  it('maps Stripe failed status to failed', async () => {
    mockRefundsCreate.mockResolvedValue({
      id: 're_test_5',
      amount: 10000,
      status: 'failed',
      payment_intent: 'pi_abc',
    });

    const result = await gateway.refund({ gatewayPaymentId: 'pi_abc' });

    expect(result.status).toBe('failed');
  });

  it('returns pending for Stripe status canceled', async () => {
    mockRefundsCreate.mockResolvedValue({
      id: 're_test_6',
      amount: 10000,
      status: 'canceled',
      payment_intent: 'pi_abc',
    });

    const result = await gateway.refund({ gatewayPaymentId: 'pi_abc' });

    expect(result.status).toBe('pending');
  });

  it('handles payment_intent as object (expand mode)', async () => {
    mockRefundsCreate.mockResolvedValue({
      id: 're_test_7',
      amount: 7777,
      status: 'succeeded',
      payment_intent: { id: 'pi_expanded' },
    });

    const result = await gateway.refund({ gatewayPaymentId: 'pi_abc' });

    expect(result.gatewayPaymentId).toBe('pi_expanded');
  });

  it('returns refundId, gatewayPaymentId, amount, status from response', async () => {
    mockRefundsCreate.mockResolvedValue({
      id: 're_final',
      amount: 33333,
      status: 'succeeded',
      payment_intent: 'pi_final',
    });

    const result = await gateway.refund({ gatewayPaymentId: 'pi_final' });

    expect(result.refundId).toBe('re_final');
    expect(result.gatewayPaymentId).toBe('pi_final');
    expect(result.amount).toBe(33333);
    expect(result.status).toBe('processed');
  });

  it('forwards reason as metadata when provided', async () => {
    mockRefundsCreate.mockResolvedValue({
      id: 're_reason',
      amount: 5000,
      status: 'pending',
      payment_intent: 'pi_reason',
    });

    await gateway.refund({ gatewayPaymentId: 'pi_reason', reason: 'duplicate' });

    expect(mockRefundsCreate.mock.calls[0][0].metadata).toEqual({ reason: 'duplicate' });
  });
});