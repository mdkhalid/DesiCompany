import { Injectable, Logger } from '@nestjs/common';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';
import { PaymentGatewayType } from '../../common/enums/payment-gateway-type.enum';
import {
  CreateOrderRequest,
  CreateOrderResponse,
  PaymentGateway,
  RefundRequest,
  RefundResult,
  WebhookEvent,
  PaymentStatusResult,
} from './payment-gateway.interface';

@Injectable()
export class RazorpayGateway implements PaymentGateway {
  private readonly logger = new Logger(RazorpayGateway.name);
  private readonly client: Razorpay;

  constructor(private readonly credentials: Record<string, string>) {
    const key_id = this.credentials.key_id;
    const key_secret = this.credentials.key_secret;
    if (!key_id || !key_secret) {
      throw new Error(
        'RazorpayGateway requires key_id and key_secret in credentials',
      );
    }
    this.client = new Razorpay({ key_id, key_secret });
  }

  getName(): string {
    return PaymentGatewayType.RAZORPAY;
  }

  async createOrder(req: CreateOrderRequest): Promise<CreateOrderResponse> {
    // req.amount is already in paise (smallest currency unit per interface contract)
    const order = await this.client.orders.create({
      amount: req.amount,
      currency: req.currency,
      receipt: req.bookingId,
      notes: req.notes,
    });
    return {
      gatewayOrderId: order.id,
      keyId: this.credentials.key_id,
      amount: Number(order.amount) || req.amount,
      currency: order.currency,
    };
  }

  verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
    if (!signature || typeof signature !== 'string') return false;
    const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
    const expected = crypto
      .createHmac('sha256', this.credentials.key_secret)
      .update(body)
      .digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const signatureBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  }

  parseWebhookEvent(rawBody: Buffer | string | object): WebhookEvent {
    const body = this.normalizeBody(rawBody) as {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            amount?: number;
            status?: string;
          };
        };
      };
    };
    // Razorpay webhook payload:
    // { event: 'payment.captured', payload: { payment: { entity: { id, order_id, status, amount, ... } } } }
    const event: string = body.event ?? '';
    const paymentEntity = body.payload?.payment?.entity ?? {};
    const paymentId: string = paymentEntity.id ?? '';
    const orderId: string = paymentEntity.order_id ?? '';
    const amount: number = paymentEntity.amount ?? 0;

    const eventId = `${event}:${paymentId}`;

    // Map Razorpay payment status to PaymentEventStatus
    const razorpayStatus: string = paymentEntity.status ?? '';
    const status = this.mapPaymentStatus(razorpayStatus);

    return {
      gateway: PaymentGatewayType.RAZORPAY,
      eventId,
      eventType: event,
      gatewayPaymentId: paymentId,
      gatewayOrderId: orderId,
      amount,
      status,
      rawPayload: body,
    };
  }

  async getStatus(gatewayPaymentId: string): Promise<PaymentStatusResult> {
    // Razorpay payments.fetch returns the payment with its order_id and status
    const payment = await this.client.payments.fetch(gatewayPaymentId);
    const paymentStatus = payment.status ?? '';
    // Map Razorpay payment status to our unified status
    const status = this.mapPaymentStatus(paymentStatus);
    return {
      gatewayPaymentId: payment.id,
      gatewayOrderId: payment.order_id ?? '',
      status,
      amount: Number(payment.amount) || 0,
    };
  }

  async refund(req: RefundRequest): Promise<RefundResult> {
    const amountInPaise = req.amount ? Math.round(req.amount) : undefined;
    const refund = await this.client.payments.refund(req.gatewayPaymentId, {
      amount: amountInPaise,
    });
    return {
      refundId: refund.id,
      gatewayPaymentId: refund.payment_id,
      amount: Number(refund.amount) || 0,
      status: this.mapRefundStatus(refund.status),
    };
  }

  private normalizeBody(
    rawBody: Buffer | string | object,
  ): Record<string, unknown> {
    if (typeof rawBody === 'object' && !Buffer.isBuffer(rawBody))
      return rawBody as Record<string, unknown>;
    if (typeof rawBody === 'string')
      return JSON.parse(rawBody) as Record<string, unknown>;
    if (Buffer.isBuffer(rawBody))
      return JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    return rawBody;
  }

  private mapPaymentStatus(razorpayStatus: string): WebhookEvent['status'] {
    switch (razorpayStatus) {
      case 'captured':
      case 'authorized':
        return 'success';
      case 'failed':
        return 'failed';
      default:
        return 'pending';
    }
  }

  private mapOrderStatus(
    razorpayStatus: string,
  ): PaymentStatusResult['status'] {
    switch (razorpayStatus) {
      case 'paid':
        return 'success';
      case 'failed':
        return 'failed';
      default:
        return 'pending';
    }
  }

  private mapRefundStatus(
    razorpayStatus: string | undefined,
  ): RefundResult['status'] {
    switch (razorpayStatus) {
      case 'processed':
        return 'processed';
      case 'failed':
        return 'failed';
      default:
        return 'pending';
    }
  }
}
