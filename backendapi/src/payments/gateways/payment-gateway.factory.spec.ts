import { Repository } from 'typeorm';
import { PaymentGatewayConfig } from '../entities/payment-gateway-config.entity';
import { PaymentGatewayType } from '../../common/enums/payment-gateway-type.enum';
import { PaymentGatewayFactory } from './payment-gateway.factory';
import { encryptCredentials } from '../crypto/credential-cipher';
import { RazorpayGateway } from './razorpay.gateway';
import { StripeGateway } from './stripe.gateway';
import { CashGateway } from './cash.gateway';
import { __resetCache } from '../crypto/credential-cipher';

const ENCRYPTION_KEY = '0'.repeat(64); // 32 bytes of '0' in hex

const mockRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
};

let factory: PaymentGatewayFactory;

beforeAll(() => {
  process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY = ENCRYPTION_KEY;
  factory = new PaymentGatewayFactory(mockRepo as unknown as Repository<PaymentGatewayConfig>);
});

afterAll(() => {
  delete process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY;
  __resetCache();
  jest.resetAllMocks();
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function buildConfig(overrides: Partial<PaymentGatewayConfig> & { type: PaymentGatewayType }): PaymentGatewayConfig {
  return {
    id: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    displayName: 'Cash',
    encryptedCredentials: '',
    iv: '',
    authTag: '',
    isActive: true,
    isDefault: false,
    ...overrides,
  } as PaymentGatewayConfig;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PaymentGatewayFactory', () => {

  describe('getDefault()', () => {

    it('1 — empty table → returns CashGateway', async () => {
      mockRepo.find.mockResolvedValue([]);
      const gateway = await factory.getDefault();
      expect(gateway).toBeInstanceOf(CashGateway);
      expect(gateway.getName()).toBe('cash');
    });

    it('2 — rows exist but no default → throws', async () => {
      mockRepo.find.mockResolvedValue([
        buildConfig({ type: PaymentGatewayType.RAZORPAY, isDefault: false }),
        buildConfig({ type: PaymentGatewayType.STRIPE, isDefault: false }),
      ]);
      await expect(factory.getDefault()).rejects.toThrow(/No default payment gateway/);
    });

    it('3 — default set → returns RazorpayGateway with decrypted credentials', async () => {
      const creds = { key_id: 'rzp_test_123', key_secret: 'secret456' };
      const encrypted = encryptCredentials(JSON.stringify(creds));
      mockRepo.find.mockResolvedValue([
        buildConfig({
          type: PaymentGatewayType.RAZORPAY,
          isDefault: true,
          isActive: true,
          encryptedCredentials: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
        }),
      ]);
      const gateway = await factory.getDefault();
      expect(gateway).toBeInstanceOf(RazorpayGateway);
      // credentials is a public field on the stub
      expect((gateway as unknown as { credentials: Record<string, string> }).credentials).toEqual(creds);
    });

    it('4 — default set but inactive → throws', async () => {
      const encrypted = encryptCredentials(JSON.stringify({ key_id: 'x', key_secret: 'y' }));
      mockRepo.find.mockResolvedValue([
        buildConfig({
          type: PaymentGatewayType.RAZORPAY,
          isDefault: true,
          isActive: false,
          encryptedCredentials: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
        }),
      ]);
      await expect(factory.getDefault()).rejects.toThrow(/marked inactive/);
    });

    it('9 — unknown type in DB → throws', async () => {
      const encrypted = encryptCredentials(JSON.stringify({}));
      // Cast to PaymentGatewayConfig with a nonsense type to simulate DB corruption
      const badConfig = buildConfig({
        type: 'unknown_type' as unknown as PaymentGatewayType,
        isDefault: true,
        isActive: true,
        encryptedCredentials: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
      });
      mockRepo.find.mockResolvedValue([badConfig]);
      await expect(factory.getDefault()).rejects.toThrow(/No gateway class registered/);
    });

  });

  describe('getByType()', () => {

    it('5 — no row for type → returns CashGateway', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const gateway = await factory.getByType(PaymentGatewayType.RAZORPAY);
      expect(gateway).toBeInstanceOf(CashGateway);
    });

    it('6 — row found → returns matching RazorpayGateway with decrypted credentials', async () => {
      const creds = { key_id: 'rzp_bytype_999', key_secret: 'bytype_secret' };
      const encrypted = encryptCredentials(JSON.stringify(creds));
      mockRepo.findOne.mockResolvedValue(
        buildConfig({
          type: PaymentGatewayType.RAZORPAY,
          isActive: true,
          isDefault: false,
          encryptedCredentials: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
        }),
      );
      const gateway = await factory.getByType(PaymentGatewayType.RAZORPAY);
      expect(gateway).toBeInstanceOf(RazorpayGateway);
      expect((gateway as unknown as { credentials: Record<string, string> }).credentials).toEqual(creds);
    });

    it('8 — Stripe default → returns StripeGateway with decrypted credentials', async () => {
      const creds = { secret_key: 'sk_test_stripe', publishable_key: 'pk_test_stripe', webhook_secret: 'whsec_test' };
      const encrypted = encryptCredentials(JSON.stringify(creds));
      mockRepo.find.mockResolvedValue([
        buildConfig({
          type: PaymentGatewayType.STRIPE,
          isDefault: true,
          isActive: true,
          encryptedCredentials: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
        }),
      ]);
      const gateway = await factory.getDefault();
      expect(gateway).toBeInstanceOf(StripeGateway);
      expect((gateway as unknown as { credentials: Record<string, string> }).credentials).toEqual(creds);
    });

  });

  describe('instantiate() — tampered credentials', () => {

    it('7 — tampered authTag → throws on decrypt', async () => {
      const encrypted = encryptCredentials(JSON.stringify({ key_id: 'x', key_secret: 'y' }));
      // Corrupt the authTag by flipping a character
      const tamperedAuthTag = encrypted.authTag.replace(/^./, (c) => (c === 'a' ? 'b' : 'a'));
      mockRepo.find.mockResolvedValue([
        buildConfig({
          type: PaymentGatewayType.RAZORPAY,
          isDefault: true,
          isActive: true,
          encryptedCredentials: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: tamperedAuthTag,
        }),
      ]);
      await expect(factory.getDefault()).rejects.toThrow();
    });

  });

  describe('Integration — toggle default gateway', () => {

    // Helper: keep a mutable in-memory list of configs; mock find/findOne to read it.
    let configs: PaymentGatewayConfig[];

    function encrypt(obj: Record<string, string>) {
      return encryptCredentials(JSON.stringify(obj));
    }

    beforeEach(() => {
      configs = [];
      mockRepo.find.mockImplementation(() => Promise.resolve([...configs]));
      mockRepo.findOne.mockImplementation(({ where }: any) => {
        if (where?.type) {
          return Promise.resolve(configs.find((c) => c.type === where.type) ?? null);
        }
        return Promise.resolve(null);
      });
    });

    it('10 — seeds two configs (Razorpay default, Stripe non-default) → returns RazorpayGateway', async () => {
      const razorpayEnc = encrypt({ key_id: 'rzp_int_aaa', key_secret: 'rzp_secret_a' });
      const stripeEnc = encrypt({ secret_key: 'sk_test_int_bbb', publishable_key: 'pk_test_int_bbb', webhook_secret: 'whsec_int_bbb' });
      configs.push(
        buildConfig({
          type: PaymentGatewayType.RAZORPAY,
          isDefault: true,
          isActive: true,
          encryptedCredentials: razorpayEnc.ciphertext,
          iv: razorpayEnc.iv,
          authTag: razorpayEnc.authTag,
        }),
        buildConfig({
          type: PaymentGatewayType.STRIPE,
          isDefault: false,
          isActive: true,
          encryptedCredentials: stripeEnc.ciphertext,
          iv: stripeEnc.iv,
          authTag: stripeEnc.authTag,
        }),
      );
      const gateway = await factory.getDefault();
      expect(gateway).toBeInstanceOf(RazorpayGateway);
      expect(gateway.getName()).toBe('razorpay');
      expect((gateway as unknown as { credentials: Record<string, string> }).credentials).toEqual({
        key_id: 'rzp_int_aaa',
        key_secret: 'rzp_secret_a',
      });
    });

    it('11 — toggles isDefault to Stripe → factory now returns StripeGateway', async () => {
      const razorpayEnc = encrypt({ key_id: 'rzp_int_aaa', key_secret: 'rzp_secret_a' });
      const stripeEnc = encrypt({ secret_key: 'sk_test_int_bbb', publishable_key: 'pk_test_int_bbb', webhook_secret: 'whsec_int_bbb' });
      const razorpayCfg = buildConfig({
        type: PaymentGatewayType.RAZORPAY,
        isDefault: true,
        isActive: true,
        encryptedCredentials: razorpayEnc.ciphertext,
        iv: razorpayEnc.iv,
        authTag: razorpayEnc.authTag,
      });
      const stripeCfg = buildConfig({
        type: PaymentGatewayType.STRIPE,
        isDefault: false,
        isActive: true,
        encryptedCredentials: stripeEnc.ciphertext,
        iv: stripeEnc.iv,
        authTag: stripeEnc.authTag,
      });
      configs.push(razorpayCfg, stripeCfg);

      // Before toggle
      const before = await factory.getDefault();
      expect(before).toBeInstanceOf(RazorpayGateway);

      // Toggle
      razorpayCfg.isDefault = false;
      stripeCfg.isDefault = true;

      // After toggle — different class
      const after = await factory.getDefault();
      expect(after).toBeInstanceOf(StripeGateway);
      expect(after.getName()).toBe('stripe');
      expect(after).not.toBeInstanceOf(RazorpayGateway);
      expect((after as unknown as { credentials: Record<string, string> }).credentials).toEqual({
        secret_key: 'sk_test_int_bbb',
        publishable_key: 'pk_test_int_bbb',
        webhook_secret: 'whsec_int_bbb',
      });
    });

    it('12 — toggles default back to Razorpay → returns RazorpayGateway again (round-trip)', async () => {
      const razorpayEnc = encrypt({ key_id: 'rzp_int_ccc', key_secret: 'rzp_secret_c' });
      const stripeEnc = encrypt({ secret_key: 'sk_test_int_ddd', publishable_key: 'pk_test_int_ddd', webhook_secret: 'whsec_int_ddd' });
      const razorpayCfg = buildConfig({
        type: PaymentGatewayType.RAZORPAY,
        isDefault: false,
        isActive: true,
        encryptedCredentials: razorpayEnc.ciphertext,
        iv: razorpayEnc.iv,
        authTag: razorpayEnc.authTag,
      });
      const stripeCfg = buildConfig({
        type: PaymentGatewayType.STRIPE,
        isDefault: true,
        isActive: true,
        encryptedCredentials: stripeEnc.ciphertext,
        iv: stripeEnc.iv,
        authTag: stripeEnc.authTag,
      });
      configs.push(razorpayCfg, stripeCfg);

      expect((await factory.getDefault())).toBeInstanceOf(StripeGateway);

      stripeCfg.isDefault = false;
      razorpayCfg.isDefault = true;
      expect((await factory.getDefault())).toBeInstanceOf(RazorpayGateway);
    });

    it('13 — getByType returns the correct gateway class for each registered type', async () => {
      const razorpayEnc = encrypt({ key_id: 'rzp_get_by', key_secret: 'razorpay_secret' });
      const stripeEnc = encrypt({ secret_key: 'sk_get_by', publishable_key: 'pk_get_by', webhook_secret: 'whsec_get_by' });
      const cashEnc = encrypt({ note: 'cash has no creds' });
      configs.push(
        buildConfig({
          type: PaymentGatewayType.RAZORPAY,
          isDefault: false,
          isActive: true,
          encryptedCredentials: razorpayEnc.ciphertext,
          iv: razorpayEnc.iv,
          authTag: razorpayEnc.authTag,
        }),
        buildConfig({
          type: PaymentGatewayType.STRIPE,
          isDefault: true,
          isActive: true,
          encryptedCredentials: stripeEnc.ciphertext,
          iv: stripeEnc.iv,
          authTag: stripeEnc.authTag,
        }),
        buildConfig({
          type: PaymentGatewayType.CASH,
          isDefault: false,
          isActive: true,
          encryptedCredentials: cashEnc.ciphertext,
          iv: cashEnc.iv,
          authTag: cashEnc.authTag,
        }),
      );

      const rzp = await factory.getByType(PaymentGatewayType.RAZORPAY);
      expect(rzp).toBeInstanceOf(RazorpayGateway);
      expect(rzp.getName()).toBe('razorpay');

      const stripe = await factory.getByType(PaymentGatewayType.STRIPE);
      expect(stripe).toBeInstanceOf(StripeGateway);
      expect(stripe.getName()).toBe('stripe');

      const cash = await factory.getByType(PaymentGatewayType.CASH);
      expect(cash).toBeInstanceOf(CashGateway);
      expect(cash.getName()).toBe('cash');
    });

  });

});