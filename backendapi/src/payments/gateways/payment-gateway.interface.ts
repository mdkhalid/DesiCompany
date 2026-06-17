export interface CreateOrderRequest {
  amount: number;                          // smallest currency unit (paise for INR)
  currency: string;                        // 'INR'
  bookingId: string;                       // internal reference for reconciliation
  customerEmail?: string;
  customerPhone?: string;
  notes?: Record<string, string>;
}

export interface CreateOrderResponse {
  gatewayOrderId: string;                  // order/payment-intent id from gateway
  keyId: string;                           // public key for client-side checkout (Razorpay keyId, Stripe publishable key)
  amount: number;
  currency: string;
}

export type PaymentEventStatus = 'success' | 'failed' | 'pending';

export interface WebhookEvent {
  gateway: string;
  eventId: string;
  eventType: string;                       // 'payment.captured', 'payment_intent.succeeded', etc.
  gatewayPaymentId?: string;
  gatewayOrderId?: string;
  amount?: number;
  status: PaymentEventStatus;
  rawPayload: Record<string, unknown>;
}

export interface PaymentStatusResult {
  gatewayPaymentId: string;
  gatewayOrderId: string;
  status: PaymentEventStatus;
  amount: number;
  method?: string;
  capturedAt?: Date;
}

export interface RefundRequest {
  gatewayPaymentId: string;
  amount?: number;                         // undefined → full refund
  reason?: string;
}

export interface RefundResult {
  refundId: string;
  gatewayPaymentId: string;
  amount: number;
  status: 'pending' | 'processed' | 'failed';
}

export interface PaymentGateway {
  getName(): string;                                              // 'razorpay' | 'stripe' | 'cash'
  createOrder(req: CreateOrderRequest): Promise<CreateOrderResponse>;
  verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean;
  parseWebhookEvent(rawBody: Buffer | string): WebhookEvent;
  getStatus(gatewayPaymentId: string): Promise<PaymentStatusResult>;
  refund(req: RefundRequest): Promise<RefundResult>;
}