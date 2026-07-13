import { Injectable, Logger } from '@nestjs/common';
import { PaymentGateway } from './payment-gateway.interface';
import { PaymentGatewayType } from '../../common/enums/payment-gateway-type.enum';
import { PaymentGatewayFactory } from './payment-gateway.factory';
import { CircuitBreaker } from '../../common/resilience/circuit-breaker.service';
import { CashGateway } from './cash.gateway';

@Injectable()
export class ResilientPaymentGatewayFactory {
  private readonly logger = new Logger(ResilientPaymentGatewayFactory.name);
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();

  constructor(private readonly paymentGatewayFactory: PaymentGatewayFactory) {}

  async getDefault(): Promise<PaymentGateway> {
    try {
      const gateway = await this.paymentGatewayFactory.getDefault();
      return this.wrap(gateway);
    } catch (err) {
      this.logger.error(
        `Failed to load default gateway, falling back to CashGateway: ${(err as Error).message}`,
      );
      return new CashGateway({});
    }
  }

  async getByType(type: PaymentGatewayType): Promise<PaymentGateway> {
    try {
      const gateway = await this.paymentGatewayFactory.getByType(type);
      return this.wrap(gateway);
    } catch (err) {
      this.logger.warn(
        `Failed to load gateway type '${type}', falling back to CashGateway: ${(err as Error).message}`,
      );
      return new CashGateway({});
    }
  }

  private getBreakerKey(type: string): string {
    return type.toLowerCase();
  }

  private getBreaker(type: string): CircuitBreaker {
    const key = this.getBreakerKey(type);
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(
        key,
        new CircuitBreaker({
          failureThreshold: 5,
          resetTimeoutMs: 30_000,
          halfOpenMaxCalls: 1,
        }),
      );
    }
    return this.circuitBreakers.get(key)!;
  }
  private wrap(gateway: PaymentGateway): PaymentGateway {
    const breaker = this.getBreaker(gateway.getName());

    return {
      getName: () => gateway.getName(),
      createOrder: (req) => breaker.execute(() => gateway.createOrder(req)),
      verifyWebhookSignature: gateway.verifyWebhookSignature.bind(gateway),
      parseWebhookEvent: gateway.parseWebhookEvent.bind(gateway),
      getStatus: (gatewayPaymentId) =>
        breaker.execute(() => gateway.getStatus(gatewayPaymentId)),
      refund: (req) => breaker.execute(() => gateway.refund(req)),
    };
  }
}
