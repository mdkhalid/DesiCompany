import { CashGateway } from './cash.gateway';

describe('CashGateway', () => {
  let gateway: CashGateway;

  beforeEach(() => {
    gateway = new CashGateway();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  // ── getName ────────────────────────────────────────────────────────────────

  describe('getName', () => {
    it('returns "cash"', () => {
      expect(gateway.getName()).toBe('cash');
    });
  });

  // ── constructor ────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('instantiates with no credentials', () => {
      expect(() => new CashGateway()).not.toThrow();
    });

    it('instantiates with credentials', () => {
      expect(
        () => new CashGateway({ receiptTemplate: 'tpl.pdf' }),
      ).not.toThrow();
    });
  });

  // ── createOrder ────────────────────────────────────────────────────────────

  describe('createOrder', () => {
    it('returns gatewayOrderId prefixed with "cash_"', () => {
      const res = gateway.createOrder({
        amount: 500,
        currency: 'INR',
        bookingId: 'b1',
      });
      expect(res.gatewayOrderId).toMatch(/^cash_[a-f0-9-]+$/);
    });

    it('returns keyId as empty string', () => {
      const res = gateway.createOrder({
        amount: 500,
        currency: 'INR',
        bookingId: 'b1',
      });
      expect(res.keyId).toBe('');
    });

    it('passes amount through as-is (already in smallest currency unit)', () => {
      const res = gateway.createOrder({
        amount: 12345,
        currency: 'INR',
        bookingId: 'b1',
      });
      expect(res.amount).toBe(12345);
    });

    it('preserves currency from request', () => {
      const res = gateway.createOrder({
        amount: 100,
        currency: 'INR',
        bookingId: 'b1',
      });
      expect(res.currency).toBe('INR');
    });

    it('produces different gatewayOrderIds on successive calls', () => {
      const a = gateway.createOrder({
        amount: 100,
        currency: 'INR',
        bookingId: 'b1',
      });
      const b = gateway.createOrder({
        amount: 200,
        currency: 'INR',
        bookingId: 'b2',
      });
      expect(a.gatewayOrderId).not.toBe(b.gatewayOrderId);
    });
  });

  // ── verifyWebhookSignature ─────────────────────────────────────────────────

  describe('verifyWebhookSignature', () => {
    it('returns true for valid input', () => {
      expect(gateway.verifyWebhookSignature('{}', 'sig')).toBe(true);
    });

    it('returns true for empty input', () => {
      expect(gateway.verifyWebhookSignature('', '')).toBe(true);
    });

    it('returns true for garbage input (no exception)', () => {
      expect(gateway.verifyWebhookSignature('not json{{', '!@#$%')).toBe(true);
    });

    it('returns true for Buffer input', () => {
      expect(gateway.verifyWebhookSignature(Buffer.from('{}'), 'sig')).toBe(
        true,
      );
    });
  });

  // ── parseWebhookEvent ──────────────────────────────────────────────────────

  describe('parseWebhookEvent', () => {
    it('parses a JSON string', () => {
      const raw = JSON.stringify({
        eventId: 'e1',
        amount: 500,
        status: 'success',
      });
      const evt = gateway.parseWebhookEvent(raw);
      expect(evt.eventId).toBe('e1');
      expect(evt.amount).toBe(500);
    });

    it('parses a Buffer containing JSON', () => {
      const raw = Buffer.from(JSON.stringify({ id: 'e2', status: 'failed' }));
      const evt = gateway.parseWebhookEvent(raw);
      expect(evt.eventId).toBe('e2');
      expect(evt.status).toBe('failed');
    });

    // Note: interface parseWebhookEvent(rawBody: Buffer | string), but the
    // implementation normalizes to {} for unrecognised input.
    it('returns empty rawPayload for a non-parseable string', () => {
      const evt = gateway.parseWebhookEvent('not json{{');
      expect(evt.rawPayload).toEqual({});
    });

    it('returns eventId from body.eventId when present', () => {
      const evt = gateway.parseWebhookEvent(
        JSON.stringify({ eventId: 'from_eventid' }),
      );
      expect(evt.eventId).toBe('from_eventid');
    });

    it('falls back to body.id when eventId absent', () => {
      const evt = gateway.parseWebhookEvent(JSON.stringify({ id: 'from_id' }));
      expect(evt.eventId).toBe('from_id');
    });

    it('generates synthetic eventId when neither eventId nor id present', () => {
      const evt = gateway.parseWebhookEvent(JSON.stringify({ amount: 0 }));
      expect(evt.eventId).toMatch(/^cash_event_[a-f0-9-]+$/);
    });

    it('defaults status to "success" when missing', () => {
      const evt = gateway.parseWebhookEvent(JSON.stringify({ eventId: 'e4' }));
      expect(evt.status).toBe('success');
    });

    it('sets gateway to "cash"', () => {
      const evt = gateway.parseWebhookEvent(JSON.stringify({ eventId: 'e5' }));
      expect(evt.gateway).toBe('cash');
    });

    it('returns rawPayload with parsed fields', () => {
      const raw = { eventId: 'e6', customField: 'abc' };
      const evt = gateway.parseWebhookEvent(JSON.stringify(raw));
      expect(evt.rawPayload).toMatchObject({
        eventId: 'e6',
        customField: 'abc',
      });
    });
  });

  // ── getStatus ──────────────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('always returns status "success"', () => {
      const res = gateway.getStatus('cash_123');
      expect(res.status).toBe('success');
    });

    it('echoes the gatewayPaymentId passed in', () => {
      const res = gateway.getStatus('cash_abc-xyz');
      expect(res.gatewayPaymentId).toBe('cash_abc-xyz');
      expect(res.gatewayOrderId).toBe('cash_abc-xyz');
    });

    it('sets method to "cash"', () => {
      const res = gateway.getStatus('cash_123');
      expect(res.method).toBe('cash');
    });

    it('sets amount to 0 (amount is caller-side knowledge)', () => {
      const res = gateway.getStatus('cash_123');
      expect(res.amount).toBe(0);
    });
  });

  // ── refund ─────────────────────────────────────────────────────────────────

  describe('refund', () => {
    it('returns refundId prefixed with "cash_refund_"', () => {
      const res = gateway.refund({
        gatewayPaymentId: 'cash_123',
        amount: 100,
      });
      expect(res.refundId).toMatch(/^cash_refund_[a-f0-9-]+$/);
    });

    it('echoes the gatewayPaymentId from request', () => {
      const res = gateway.refund({ gatewayPaymentId: 'cash_abc' });
      expect(res.gatewayPaymentId).toBe('cash_abc');
    });

    it('returns status "processed" (off-platform)', () => {
      const res = gateway.refund({ gatewayPaymentId: 'cash_123' });
      expect(res.status).toBe('processed');
    });

    it('returns amount from request', () => {
      const res = gateway.refund({
        gatewayPaymentId: 'cash_123',
        amount: 500,
      });
      expect(res.amount).toBe(500);
    });

    it('defaults amount to 0 when not provided', () => {
      const res = gateway.refund({ gatewayPaymentId: 'cash_123' });
      expect(res.amount).toBe(0);
    });

    it('produces different refundIds on successive calls', () => {
      const a = gateway.refund({ gatewayPaymentId: 'cash_123' });
      const b = gateway.refund({ gatewayPaymentId: 'cash_456' });
      expect(a.refundId).not.toBe(b.refundId);
    });
  });
});
