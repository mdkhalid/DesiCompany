import * as crypto from 'crypto';
import { RazorpayGateway } from './razorpay.gateway';
import { PaymentGatewayType } from '../../common/enums/payment-gateway-type.enum';

// ---------------------------------------------------------------------------
// Razorpay mock helpers
// ---------------------------------------------------------------------------

const mockOrdersCreate = jest.fn();
const mockOrdersFetchPayments = jest.fn();
const mockPaymentsFetch = jest.fn();
const mockPaymentsRefund = jest.fn();

jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: mockOrdersCreate,
      fetchPayments: mockOrdersFetchPayments,
    },
    payments: {
      fetch: mockPaymentsFetch,
      refund: mockPaymentsRefund,
    },
  }));
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute a valid Razorpay HMAC-SHA256 signature for the given body. */
function makeSignature(body: string | Buffer, secret: string): string {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  return crypto.createHmac('sha256', secret).update(buf).digest('hex');
}

describe('RazorpayGateway', () => {
  const VALID_KEY_ID = 'rzp_test_abc123';
  const VALID_KEY_SECRET = 'test_secret_key';

  function validCredentials() {
    return { key_id: VALID_KEY_ID, key_secret: VALID_KEY_SECRET };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. constructor
  // =========================================================================
  describe('constructor', () => {
    it('throws when key_id is missing', () => {
      expect(() => new RazorpayGateway({ key_secret: 's' })).toThrow(
        /key_id and key_secret/,
      );
    });

    it('throws when key_secret is missing', () => {
      expect(() => new RazorpayGateway({ key_id: 'k' })).toThrow(
        /key_id and key_secret/,
      );
    });

    it('does not throw when both credentials are provided', () => {
      expect(() => new RazorpayGateway(validCredentials())).not.toThrow();
    });
  });

  // =========================================================================
  // 2. getName
  // =========================================================================
  describe('getName', () => {
    it('returns PaymentGatewayType.RAZORPAY', () => {
      const gateway = new RazorpayGateway(validCredentials());
      expect(gateway.getName()).toBe(PaymentGatewayType.RAZORPAY);
    });
  });

  // =========================================================================
  // 3. createOrder
  // =========================================================================
  describe('createOrder', () => {
    it('calls rzp.orders.create with amount in paise and correct fields', async () => {
      const gateway = new RazorpayGateway(validCredentials());
      mockOrdersCreate.mockResolvedValue({
        id: 'order_xyz',
        amount: 10000,
        currency: 'INR',
      });

      const result = await gateway.createOrder({
        amount: 10000, // already in paise
        currency: 'INR',
        bookingId: 'book_123',
        notes: { foo: 'bar' },
      });

      expect(mockOrdersCreate).toHaveBeenCalledWith({
        amount: 10000,
        currency: 'INR',
        receipt: 'book_123',
        notes: { foo: 'bar' },
      });
      expect(result).toEqual({
        gatewayOrderId: 'order_xyz',
        keyId: VALID_KEY_ID,
        amount: 10000,
        currency: 'INR',
      });
    });

    it('forwards receipt from bookingId', async () => {
      const gateway = new RazorpayGateway(validCredentials());
      mockOrdersCreate.mockResolvedValue({
        id: 'order_1',
        amount: 5000,
        currency: 'INR',
      });

      await gateway.createOrder({
        amount: 5000,
        currency: 'INR',
        bookingId: 'ref_abc',
      });

      expect(mockOrdersCreate).toHaveBeenCalledWith(
        expect.objectContaining({ receipt: 'ref_abc' }),
      );
    });
  });

  // =========================================================================
  // 4. verifyWebhookSignature
  // =========================================================================
  describe('verifyWebhookSignature', () => {
    it('returns true for a correct HMAC-SHA256 signature', () => {
      const gateway = new RazorpayGateway(validCredentials());
      const payload = JSON.stringify({ event: 'payment.captured' });
      const sig = makeSignature(payload, VALID_KEY_SECRET);

      expect(gateway.verifyWebhookSignature(payload, sig)).toBe(true);
    });

    it('returns false for a wrong signature', () => {
      const gateway = new RazorpayGateway(validCredentials());
      const payload = JSON.stringify({ event: 'payment.captured' });
      const wrongSig = 'a'.repeat(64); // invalid hex

      expect(gateway.verifyWebhookSignature(payload, wrongSig)).toBe(false);
    });

    it('returns false when signature is empty', () => {
      const gateway = new RazorpayGateway(validCredentials());
      const payload = JSON.stringify({ event: 'payment.captured' });

      expect(gateway.verifyWebhookSignature(payload, '')).toBe(false);
    });

    it('returns false when signature is missing/null', () => {
      const gateway = new RazorpayGateway(validCredentials());
      const payload = JSON.stringify({ event: 'payment.captured' });

      // @ts-expect-error testing runtime behavior
      expect(gateway.verifyWebhookSignature(payload, null)).toBe(false);
      // @ts-expect-error testing runtime behavior
      expect(gateway.verifyWebhookSignature(payload, undefined)).toBe(false);
    });

    it('returns false when signature and expected lengths differ', () => {
      const gateway = new RazorpayGateway(validCredentials());
      const payload = JSON.stringify({ event: 'payment.captured' });
      // signature with wrong length (not a valid HMAC hex)
      const shortSig = 'abcd';

      expect(gateway.verifyWebhookSignature(payload, shortSig)).toBe(false);
    });

    it('accepts Buffer body', () => {
      const gateway = new RazorpayGateway(validCredentials());
      const payload = Buffer.from(
        JSON.stringify({ event: 'payment.captured' }),
      );
      const sig = makeSignature(payload, VALID_KEY_SECRET);

      expect(gateway.verifyWebhookSignature(payload, sig)).toBe(true);
    });

    it('uses timingSafeEqual (no exception on mismatched lengths)', () => {
      const gateway = new RazorpayGateway(validCredentials());
      const payload = JSON.stringify({ event: 'payment.captured' });
      // length mismatch triggers early return before timingSafeEqual
      expect(gateway.verifyWebhookSignature(payload, 'too_short')).toBe(false);
    });
  });

  // =========================================================================
  // 5. parseWebhookEvent
  // =========================================================================
  describe('parseWebhookEvent', () => {
    const razorpayPayload = {
      entity: 'event',
      account_id: 'acc_123',
      event: 'payment.captured',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: 'pay_abcdef',
            order_id: 'order_xyz',
            status: 'captured',
            amount: 20000,
            method: 'upi',
          },
        },
      },
    };

    it('parses string JSON', () => {
      const gateway = new RazorpayGateway(validCredentials());
      const result = gateway.parseWebhookEvent(JSON.stringify(razorpayPayload));

      expect(result.eventId).toBe('payment.captured:pay_abcdef');
      expect(result.gatewayPaymentId).toBe('pay_abcdef');
      expect(result.gatewayOrderId).toBe('order_xyz');
      expect(result.amount).toBe(20000);
      expect(result.gateway).toBe(PaymentGatewayType.RAZORPAY);
      expect(result.eventType).toBe('payment.captured');
    });

    it('parses Buffer JSON', () => {
      const gateway = new RazorpayGateway(validCredentials());
      const buf = Buffer.from(JSON.stringify(razorpayPayload));
      const result = gateway.parseWebhookEvent(buf);

      expect(result.eventId).toBe('payment.captured:pay_abcdef');
      expect(result.gatewayPaymentId).toBe('pay_abcdef');
    });

    it('handles object input directly', () => {
      const gateway = new RazorpayGateway(validCredentials());
      const result = gateway.parseWebhookEvent(razorpayPayload);

      expect(result.eventId).toBe('payment.captured:pay_abcdef');
      expect(result.gatewayPaymentId).toBe('pay_abcdef');
    });

    it('maps captured status to success', () => {
      const gateway = new RazorpayGateway(validCredentials());
      const result = gateway.parseWebhookEvent(JSON.stringify(razorpayPayload));

      expect(result.status).toBe('success');
    });

    it('maps failed status to failed', () => {
      const gateway = new RazorpayGateway(validCredentials());
      const failedPayload = {
        ...razorpayPayload,
        payload: {
          payment: {
            entity: {
              ...razorpayPayload.payload.payment.entity,
              status: 'failed',
            },
          },
        },
      };
      const result = gateway.parseWebhookEvent(JSON.stringify(failedPayload));

      expect(result.status).toBe('failed');
    });

    it('maps authorized status to success', () => {
      const gateway = new RazorpayGateway(validCredentials());
      const authPayload = {
        ...razorpayPayload,
        payload: {
          payment: {
            entity: {
              ...razorpayPayload.payload.payment.entity,
              status: 'authorized',
            },
          },
        },
      };
      const result = gateway.parseWebhookEvent(JSON.stringify(authPayload));

      expect(result.status).toBe('success');
    });

    it('maps unknown status to pending', () => {
      const gateway = new RazorpayGateway(validCredentials());
      const unknownPayload = {
        ...razorpayPayload,
        payload: {
          payment: {
            entity: {
              ...razorpayPayload.payload.payment.entity,
              status: 'unknown_status',
            },
          },
        },
      };
      const result = gateway.parseWebhookEvent(JSON.stringify(unknownPayload));

      expect(result.status).toBe('pending');
    });

    it('derives eventId as event:paymentId', () => {
      const gateway = new RazorpayGateway(validCredentials());
      const result = gateway.parseWebhookEvent(JSON.stringify(razorpayPayload));

      expect(result.eventId).toBe('payment.captured:pay_abcdef');
    });

    it('returns rawPayload as the parsed object', () => {
      const gateway = new RazorpayGateway(validCredentials());
      const result = gateway.parseWebhookEvent(JSON.stringify(razorpayPayload));

      expect(result.rawPayload).toEqual(razorpayPayload);
    });
  });

  // =========================================================================
  // 6. getStatus
  // =========================================================================
  describe('getStatus', () => {
    it('maps Razorpay payment status captured to success', async () => {
      const gateway = new RazorpayGateway(validCredentials());
      mockPaymentsFetch.mockResolvedValue({
        id: 'pay_abc123',
        order_id: 'order_xyz',
        status: 'captured',
        amount: 10000,
        currency: 'INR',
      });

      const result = await gateway.getStatus('pay_abc123');

      expect(result.status).toBe('success');
      expect(result.gatewayOrderId).toBe('order_xyz');
      expect(result.gatewayPaymentId).toBe('pay_abc123');
      expect(result.amount).toBe(10000);
    });

    it('maps Razorpay payment status authorized to success', async () => {
      const gateway = new RazorpayGateway(validCredentials());
      mockPaymentsFetch.mockResolvedValue({
        id: 'pay_authorized',
        order_id: 'order_auth',
        status: 'authorized',
        amount: 5000,
        currency: 'INR',
      });

      const result = await gateway.getStatus('pay_authorized');

      expect(result.status).toBe('success');
    });

    it('maps Razorpay payment status failed to failed', async () => {
      const gateway = new RazorpayGateway(validCredentials());
      mockPaymentsFetch.mockResolvedValue({
        id: 'pay_failed',
        order_id: 'order_fail',
        status: 'failed',
        amount: 3000,
        currency: 'INR',
      });

      const result = await gateway.getStatus('pay_failed');

      expect(result.status).toBe('failed');
    });

    it('maps unknown payment status to pending', async () => {
      const gateway = new RazorpayGateway(validCredentials());
      mockPaymentsFetch.mockResolvedValue({
        id: 'pay_pending',
        order_id: 'order_pend',
        status: 'created',
        amount: 7500,
        currency: 'INR',
      });

      const result = await gateway.getStatus('pay_pending');

      expect(result.status).toBe('pending');
    });

    it('returns raw payment data', async () => {
      const gateway = new RazorpayGateway(validCredentials());
      const rawPayment = {
        id: 'pay_raw',
        order_id: 'order_raw',
        status: 'captured',
        amount: 9000,
        currency: 'INR',
      };
      mockPaymentsFetch.mockResolvedValue(rawPayment);

      const result = await gateway.getStatus('pay_raw');

      expect(result).toEqual(
        expect.objectContaining({
          gatewayOrderId: 'order_raw',
          gatewayPaymentId: 'pay_raw',
          status: 'success',
          amount: 9000,
        }),
      );
    });

    it('fetches payment status by order id', async () => {
      const gateway = new RazorpayGateway(validCredentials());
      mockOrdersFetchPayments.mockResolvedValue({
        items: [
          {
            id: 'pay_order_1',
            order_id: 'order_abc',
            status: 'captured',
            amount: 12000,
            method: 'upi',
          },
        ],
      });

      const result = await gateway.getStatus('order_abc');

      expect(mockOrdersFetchPayments).toHaveBeenCalledWith('order_abc');
      expect(result).toEqual({
        gatewayPaymentId: 'pay_order_1',
        gatewayOrderId: 'order_abc',
        status: 'success',
        amount: 12000,
        method: 'upi',
      });
    });

    it('returns pending when an order has no payments yet', async () => {
      const gateway = new RazorpayGateway(validCredentials());
      mockOrdersFetchPayments.mockResolvedValue({ items: [] });

      const result = await gateway.getStatus('order_empty');

      expect(result.status).toBe('pending');
      expect(result.gatewayOrderId).toBe('order_empty');
      expect(result.gatewayPaymentId).toBe('');
    });
  });

  // =========================================================================
  // 7. refund
  // =========================================================================
  describe('refund', () => {
    it('calls rzp.payments.refund with amount in paise', async () => {
      const gateway = new RazorpayGateway(validCredentials());
      mockPaymentsRefund.mockResolvedValue({
        id: 'rfnd_abc',
        payment_id: 'pay_xyz',
        amount: 5000,
        status: 'processed',
      });

      const result = await gateway.refund({
        gatewayPaymentId: 'pay_xyz',
        amount: 5000,
        reason: 'customer request',
      });

      expect(mockPaymentsRefund).toHaveBeenCalledWith('pay_xyz', {
        amount: 5000,
      });
      expect(result).toEqual({
        refundId: 'rfnd_abc',
        gatewayPaymentId: 'pay_xyz',
        amount: 5000,
        status: 'processed',
      });
    });

    it('omits amount when not provided (full refund)', async () => {
      const gateway = new RazorpayGateway(validCredentials());
      mockPaymentsRefund.mockResolvedValue({
        id: 'rfnd_full',
        payment_id: 'pay_full',
        amount: 10000,
        status: 'processed',
      });

      await gateway.refund({ gatewayPaymentId: 'pay_full' });

      expect(mockPaymentsRefund).toHaveBeenCalledWith('pay_full', {
        amount: undefined,
      });
    });

    it('maps refund status processed to processed', async () => {
      const gateway = new RazorpayGateway(validCredentials());
      mockPaymentsRefund.mockResolvedValue({
        id: 'rfnd_1',
        payment_id: 'pay_1',
        amount: 2000,
        status: 'processed',
      });

      const result = await gateway.refund({
        gatewayPaymentId: 'pay_1',
        amount: 2000,
      });

      expect(result.status).toBe('processed');
    });

    it('maps refund status failed to failed', async () => {
      const gateway = new RazorpayGateway(validCredentials());
      mockPaymentsRefund.mockResolvedValue({
        id: 'rfnd_2',
        payment_id: 'pay_2',
        amount: 1500,
        status: 'failed',
      });

      const result = await gateway.refund({
        gatewayPaymentId: 'pay_2',
        amount: 1500,
      });

      expect(result.status).toBe('failed');
    });

    it('maps undefined refund status to pending', async () => {
      const gateway = new RazorpayGateway(validCredentials());
      mockPaymentsRefund.mockResolvedValue({
        id: 'rfnd_3',
        payment_id: 'pay_3',
        amount: 3000,
        // status undefined (Razorpay can return this during processing)
      });

      const result = await gateway.refund({
        gatewayPaymentId: 'pay_3',
        amount: 3000,
      });

      expect(result.status).toBe('pending');
    });

    it('returns raw refund object', async () => {
      const gateway = new RazorpayGateway(validCredentials());
      const rawRefund = {
        id: 'rfnd_raw',
        payment_id: 'pay_raw',
        amount: 4000,
        status: 'processed',
      };
      mockPaymentsRefund.mockResolvedValue(rawRefund);

      const result = await gateway.refund({
        gatewayPaymentId: 'pay_raw',
        amount: 4000,
      });

      expect(result.refundId).toBe('rfnd_raw');
      expect(result.gatewayPaymentId).toBe('pay_raw');
      expect(result.amount).toBe(4000);
    });
  });
});
