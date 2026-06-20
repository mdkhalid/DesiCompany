import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentGatewayConfig } from '../entities/payment-gateway-config.entity';
import { PaymentGatewayType } from '../../common/enums/payment-gateway-type.enum';
import { PaymentGateway } from './payment-gateway.interface';
import { decryptCredentials } from '../crypto/credential-cipher';
import { RazorpayGateway } from './razorpay.gateway';
import { StripeGateway } from './stripe.gateway';
import { CashGateway } from './cash.gateway';

// Static class map — stub gateways accept credentials directly.
// Real implementations (Phase 2) may need DI-based construction;
// at that point we'll switch to a provider token + dynamic module.
const GATEWAY_CLASSES: Record<
  PaymentGatewayType,
  new (creds: Record<string, string>) => PaymentGateway
> = {
  [PaymentGatewayType.RAZORPAY]: RazorpayGateway,
  [PaymentGatewayType.STRIPE]: StripeGateway,
  [PaymentGatewayType.CASH]: CashGateway,
};

@Injectable()
export class PaymentGatewayFactory {
  private readonly logger = new Logger(PaymentGatewayFactory.name);

  constructor(
    @InjectRepository(PaymentGatewayConfig)
    private readonly configRepo: Repository<PaymentGatewayConfig>,
  ) {}

  /**
   * Returns the active default gateway. Behavior:
   *  - If the config table is empty, checks env vars before falling back to CashGateway.
   *  - If rows exist but none has isDefault=true, throws an explicit error.
   *  - Otherwise decrypts credentials and instantiates the registered class.
   */
  async getDefault(): Promise<PaymentGateway> {
    const all = await this.configRepo.find();
    if (all.length === 0) {
      // Check env vars for gateway configuration
      const envGateway = process.env.PAYMENT_GATEWAY;
      if (envGateway && envGateway !== 'cash') {
        const envCreds = this.getEnvCredentials(envGateway);
        if (envCreds) {
          this.logger.log(
            `No DB config — using env-configured gateway: ${envGateway}`,
          );
          const GatewayClass =
            GATEWAY_CLASSES[envGateway as PaymentGatewayType];
          if (GatewayClass) {
            return new GatewayClass(envCreds);
          }
        }
      }
      this.logger.warn(
        'payment_gateway_configs is empty — falling back to CashGateway',
      );
      return new GATEWAY_CLASSES[PaymentGatewayType.CASH]({});
    }
    const def = all.find((c) => c.isDefault);
    if (!def) {
      throw new Error(
        'No default payment gateway configured. Set one via PUT /admin/payment-gateways/:type/default.',
      );
    }
    if (!def.isActive) {
      throw new Error(
        `Default gateway '${def.type}' is marked inactive. Activate it or set a different default.`,
      );
    }
    return this.instantiate(def);
  }

  /**
   * Returns a specific gateway by type. Falls back to CashGateway if no config
   * exists for the requested type — supports graceful degradation during partial outages.
   */
  async getByType(type: PaymentGatewayType): Promise<PaymentGateway> {
    const config = await this.configRepo.findOne({ where: { type } });
    if (!config) {
      this.logger.warn(
        `No config for gateway type '${type}' — falling back to CashGateway`,
      );
      return new GATEWAY_CLASSES[PaymentGatewayType.CASH]({});
    }
    return this.instantiate(config);
  }

  private instantiate(config: PaymentGatewayConfig): PaymentGateway {
    const plaintext = decryptCredentials({
      ciphertext: config.encryptedCredentials,
      iv: config.iv,
      authTag: config.authTag,
    });
    let credentials: Record<string, string>;
    try {
      credentials = JSON.parse(plaintext) as Record<string, string>;
    } catch (err) {
      throw new Error(
        `Failed to parse decrypted credentials for gateway '${config.type}': ${(err as Error).message}`,
      );
    }
    const GatewayClass = GATEWAY_CLASSES[config.type];
    if (!GatewayClass) {
      throw new Error(`No gateway class registered for type: ${config.type}`);
    }
    return new GatewayClass(credentials);
  }

  private getEnvCredentials(
    gatewayType: string,
  ): Record<string, string> | null {
    switch (gatewayType) {
      case PaymentGatewayType.RAZORPAY: {
        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (keyId && keySecret) {
          return { key_id: keyId, key_secret: keySecret };
        }
        break;
      }
      case PaymentGatewayType.STRIPE: {
        const secretKey = process.env.STRIPE_SECRET_KEY;
        if (secretKey) {
          return { secret_key: secretKey };
        }
        break;
      }
    }
    return null;
  }
}
