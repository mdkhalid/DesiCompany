import { Injectable, Logger } from '@nestjs/common';
import Stripe, { Stripe as StripeClient } from 'stripe';
import * as crypto from 'crypto';
import { PaymentGatewayType } from '../../common/enums/payment-gateway-type.enum';
import {
  CreateOrderRequest,
  CreateOrderResponse,
  PaymentGateway,
  PaymentStatusResult,
  RefundRequest,
  RefundResult,
  WebhookEvent,
} from './payment-gateway.interface';

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60; // 5 minutes

@Injectable()
export class StripeGateway implements PaymentGateway {
  private readonly logger = new Logger(StripeGateway.name);
  private readonly client: StripeClient;

  constructor(private readonly credentials: Record<string, string>) {
    const secretKey = this.credentials.secret_key;
    if (!secretKey) {
      throw new Error('StripeGateway requires secret_key in credentials');
    }
    this.client = new Stripe(secretKey, { apiVersion: '2026-05-27.dahlia' });
  }

  getName(): string {
    return PaymentGatewayType.STRIPE;
  }

  async createOrder(req: CreateOrderRequest): Promise<CreateOrderResponse> {
    // req.amount is already in smallest unit (paise) per interface definition
    const intent = await this.client.paymentIntents.create({
      amount: req.amount,
      currency: req.currency.toLowerCase(),
      metadata: {
        bookingId: req.bookingId,
        ...(req.notes ?? {}),
      },
      automatic_payment_methods: { enabled: true },
    });
    return {
      gatewayOrderId: intent.id,
      keyId: this.credentials.publishable_key ?? '',
      amount: intent.amount,
      currency: intent.currency.toUpperCase(),
    };
  }

  verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
    if (!signature || typeof signature !== 'string') return false;
    const webhookSecret = this.credentials.webhook_secret;
    if (!webhookSecret) {
      this.logger.warn('Stripe webhook_secret not configured; rejecting signature');
      return false;
    }

    // Parse Stripe-Signature header: "t=1234,v1=abc,v0=def"
    const parts = signature.split(',').reduce<Record<string, string>>((acc, part) => {
      const [k, v] = part.split('=');
      if (k && v) acc[k] = v;
      return acc;
    }, {});

    const timestamp = parts.t;
    const v1 = parts.v1;
    if (!timestamp || !v1) return false;

    // Replay protection: reject if timestamp is older than tolerance
    const nowSeconds = Math.floor(Date.now() / 1000);
    const ageSeconds = Math.abs(nowSeconds - parseInt(timestamp, 10));
    if (isNaN(ageSeconds) || ageSeconds > SIGNATURE_TOLERANCE_SECONDS) return false;

    const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${body.toString('utf8')}`)
      .digest('hex');

    const expectedBuf = Buffer.from(expected, 'hex');
    const signatureBuf = Buffer.from(v1, 'hex');
    if (expectedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  }

  parseWebhookEvent(rawBody: Buffer | string): WebhookEvent {
    const body = this.normalizeBody(rawBody) as unknown as Record<string, unknown>;
    const eventId: string = (body['id'] as string) ?? '';
    const eventType: string = (body['type'] as string) ?? '';
    const data = (body['data'] as Record<string, unknown>) ?? {};
    const intent = (data['object'] as Record<string, unknown>) ?? {};
    const paymentId: string = (intent['id'] as string) ?? '';
    const status: string = (intent['status'] as string) ?? '';

    // Map Stripe PaymentIntent status to our unified status
    let unifiedStatus: 'success' | 'failed' | 'pending';
    if (status === 'succeeded') {
      unifiedStatus = 'success';
    } else if (status === 'canceled') {
      unifiedStatus = 'failed';
    } else {
      unifiedStatus = 'pending';
    }

    return {
      gateway: 'stripe',
      eventId,
      eventType,
      gatewayPaymentId: paymentId,
      gatewayOrderId: paymentId, // Stripe has no separate order concept
      amount: (intent['amount'] as number) ?? 0,
      status: unifiedStatus,
      rawPayload: body as Record<string, unknown>,
    };
  }

  async getStatus(gatewayPaymentId: string): Promise<PaymentStatusResult> {
    const intent = await this.client.paymentIntents.retrieve(gatewayPaymentId);
    const statusMap: Record<string, PaymentStatusResult['status']> = {
      succeeded: 'success',
      canceled: 'failed',
      requires_payment_method: 'pending',
      requires_confirmation: 'pending',
      requires_action: 'pending',
      processing: 'pending',
      requires_capture: 'pending',
    };
    return {
      gatewayPaymentId: intent.id,
      gatewayOrderId: intent.id,
      status: statusMap[intent.status] ?? 'pending',
      amount: intent.amount,
    };
  }

  async refund(req: RefundRequest): Promise<RefundResult> {
    const params: Record<string, unknown> = {
      payment_intent: req.gatewayPaymentId,
    };
    if (req.amount !== undefined && req.amount > 0) {
      params.amount = req.amount; // already in paise
    }
    if (req.reason) {
      params.metadata = { reason: req.reason };
    }

    const refund = await this.client.refunds.create(params);

    // Map Stripe refund status to interface status
    let status: RefundResult['status'];
    switch (refund.status) {
      case 'succeeded':
        status = 'processed';
        break;
      case 'failed':
        status = 'failed';
        break;
      case 'canceled':
        status = 'pending';
        break;
      default:
        status = 'pending';
    }

    const paymentId =
      typeof refund.payment_intent === 'string'
        ? refund.payment_intent
        : refund.payment_intent?.id ?? '';

    return {
      refundId: refund.id,
      gatewayPaymentId: paymentId,
      amount: refund.amount ?? 0,
      status,
    };
  }

  private normalizeBody(rawBody: Buffer | string): unknown {
    if (typeof rawBody === 'string') return JSON.parse(rawBody);
    return JSON.parse(Buffer.from(rawBody).toString('utf8'));
  }
}