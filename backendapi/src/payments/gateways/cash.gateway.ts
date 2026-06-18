import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PaymentGatewayType } from '../../common/enums/payment-gateway-type.enum';
import {
  CreateOrderRequest,
  CreateOrderResponse,
  PaymentGateway,
  PaymentEventStatus,
  PaymentStatusResult,
  RefundRequest,
  RefundResult,
  WebhookEvent,
} from './payment-gateway.interface';

@Injectable()
export class CashGateway implements PaymentGateway {
  // Cash payments are off-platform; credentials is reserved for future use (e.g. receipt templates)
  // and is accepted but ignored.
  constructor(private readonly credentials: Record<string, string> = {}) {}

  getName(): string {
    return PaymentGatewayType.CASH;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async createOrder(req: CreateOrderRequest): Promise<CreateOrderResponse> {
    // Cash has no remote order; createOrder synthesizes an order id so callers
    // can persist a Payment row immediately and reference it during the
    // customer → provider handshake.
    const gatewayOrderId = `cash_${randomUUID()}`;
    return {
      gatewayOrderId,
      keyId: '', // No public key — front-end renders no checkout widget
      amount: req.amount, // already in smallest currency unit
      currency: req.currency,
    };
  }

  verifyWebhookSignature(
    _rawBody: Buffer | string,
    _signature: string,
  ): boolean {
    // Cash flow has no signature concept — verification is always passing.
    // Real authorization happens at the application layer (provider confirms
    // receipt via /bookings/:id/mark-cash-received).
    return true;
  }

  parseWebhookEvent(rawBody: Buffer | string): WebhookEvent {
    // Identity: caller passes the canonical event shape and we just normalize.
    const body = this.normalizeBody(rawBody);
    return {
      gateway: 'cash',
      eventId: (body.eventId ??
        body.id ??
        `cash_event_${randomUUID()}`) as string,
      eventType: (body.eventType ?? body.type ?? 'payment.captured') as string,
      gatewayPaymentId: (body.gatewayPaymentId ??
        body.paymentId ??
        '') as string,
      gatewayOrderId: (body.gatewayOrderId ?? body.orderId ?? '') as string,
      amount: (body.amount ?? 0) as number,
      status: (body.status ?? 'success') as PaymentEventStatus,
      rawPayload: body,
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getStatus(gatewayPaymentId: string): Promise<PaymentStatusResult> {
    // Cash payments settle synchronously when provider confirms receipt;
    // any status query from the customer side returns 'succeeded'.
    return {
      gatewayPaymentId,
      gatewayOrderId: gatewayPaymentId,
      status: 'success',
      amount: 0, // amount unknown to the gateway; caller reads from Payment row
      method: 'cash',
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async refund(req: RefundRequest): Promise<RefundResult> {
    // Refund of a cash payment is handled off-platform (provider gives money
    // back to customer directly). This no-op records the intent for the ledger
    // so downstream services can see a reversal was issued.
    return {
      refundId: `cash_refund_${randomUUID()}`,
      gatewayPaymentId: req.gatewayPaymentId,
      amount: req.amount ?? 0,
      status: 'processed', // off-platform, treat as done
    };
  }

  private normalizeBody(rawBody: Buffer | string): Record<string, unknown> {
    if (typeof rawBody === 'string') {
      try {
        return JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    if (Buffer.isBuffer(rawBody)) {
      try {
        return JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return {};
  }
}
