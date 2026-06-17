import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { PaymentGatewayConfig } from '../payments/entities/payment-gateway-config.entity';
import { PaymentGatewayType } from '../common/enums/payment-gateway-type.enum';
import { AdminPaymentGatewaysService } from './admin-payment-gateways.service';

// Set up the encryption key env var BEFORE requiring the service
process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY =
  process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY ||
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('AdminPaymentGatewaysService', () => {
  let service: AdminPaymentGatewaysService;
  let repo: jest.Mocked<Repository<PaymentGatewayConfig>>;
  let dataSource: jest.Mocked<DataSource>;
  let rows: PaymentGatewayConfig[];

  const now = new Date();

  function makeRow(overrides: Partial<PaymentGatewayConfig> & { id: string; type: PaymentGatewayType }): PaymentGatewayConfig {
    return {
      createdAt: now,
      updatedAt: now,
      displayName: 'Test',
      encryptedCredentials: 'encrypted',
      iv: 'iv123456789012',
      authTag: 'authTag12345678',
      isActive: true,
      isDefault: false,
      ...overrides,
    } as PaymentGatewayConfig;
  }

  beforeEach(async () => {
    rows = [];

    const repoMock: Partial<Repository<PaymentGatewayConfig>> = {
      find: jest.fn(({ where, order }: any = {}) => {
        let res = [...rows];
        if (where?.type) res = res.filter((r) => r.type === where.type);
        if (where?.id) res = res.filter((r) => r.id === where.id);
        if (where?.isDefault !== undefined) res = res.filter((r) => r.isDefault === where.isDefault);
        if (order?.createdAt === 'ASC') res.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return Promise.resolve(res);
      }),
      findOne: jest.fn(({ where }: any = {}) => {
        let res = [...rows];
        if (where?.type) res = res.filter((r) => r.type === where.type);
        if (where?.id) res = res.filter((r) => r.id === where.id);
        if (where?.isDefault !== undefined) res = res.filter((r) => r.isDefault === where.isDefault);
        return Promise.resolve(res[0] ?? null);
      }),
      create: jest.fn((data?: any) => makeRow({ id: 'new-id', ...data })) as any,
      save: jest.fn(async (entity: any) => {
        const existing = rows.findIndex((r) => r.id === entity.id);
        if (existing >= 0) rows[existing] = entity;
        else rows.push(entity);
        return entity;
      }),
      remove: jest.fn(async (entity: any) => {
        rows = rows.filter((r) => r.id !== entity.id);
        return entity;
      }),
    };

    const dataSourceMock: Partial<DataSource> = {
      transaction: jest.fn(async (cb: any) => {
        return cb({
          update: jest.fn(async (Entity: any, where: any, partial: any) => {
            // Apply partial update to all rows matching the where clause
            for (const row of rows) {
              let matches = true;
              if (where?.id && row.id !== where.id) matches = false;
              if (matches) Object.assign(row, partial);
            }
          }),
          save: jest.fn(async (Entity: any, entity: any) => {
            const existing = rows.findIndex((r) => r.id === entity.id);
            if (existing >= 0) rows[existing] = entity;
            else rows.push(entity);
            return entity;
          }),
        });
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminPaymentGatewaysService,
        { provide: getRepositoryToken(PaymentGatewayConfig), useValue: repoMock },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get(AdminPaymentGatewaysService);
    repo = module.get(getRepositoryToken(PaymentGatewayConfig)) as any;
    dataSource = module.get(DataSource) as any;
  });

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------
  describe('findAll', () => {
    it('returns empty array when no configs exist', async () => {
      const result = await service.findAll();
      expect(result).toEqual([]);
    });

    it('returns masked configs (no plaintext credentials in response)', async () => {
      rows.push(makeRow({
        id: 'gw-1',
        type: PaymentGatewayType.RAZORPAY,
        displayName: 'Razorpay Prod',
        encryptedCredentials: 'enc-ciphertext-value',
        iv: 'ivvaluestring12',
        authTag: 'authtagvalu12',
        isDefault: false,
      }));

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gw-1');
      expect(result[0].credentialFingerprint).toMatch(/^\*\*\*\*[0-9a-f]{4}$/);
      expect(JSON.stringify(result)).not.toContain('enc-ciphertext-value');
      expect(JSON.stringify(result)).not.toContain('ivvaluestring12');
    });

    it('returns configs ordered by createdAt ASC', async () => {
      rows.push(
        makeRow({ id: 'gw-older', createdAt: new Date('2024-01-01'), type: PaymentGatewayType.CASH }),
        makeRow({ id: 'gw-newer', createdAt: new Date('2024-06-01'), type: PaymentGatewayType.STRIPE }),
      );

      const result = await service.findAll();

      expect(result[0].id).toBe('gw-older');
      expect(result[1].id).toBe('gw-newer');
    });
  });

  // -------------------------------------------------------------------------
  // findOne
  // -------------------------------------------------------------------------
  describe('findOne', () => {
    it('returns masked config for valid id', async () => {
      rows.push(makeRow({
        id: 'gw-find',
        type: PaymentGatewayType.STRIPE,
        displayName: 'Stripe Test',
        encryptedCredentials: 'stripe-encrypted-data',
        iv: 'ivstripe12bytes',
        authTag: 'authtst12bytes',
        isActive: true,
        isDefault: true,
      }));

      const result = await service.findOne('gw-find');

      expect(result.id).toBe('gw-find');
      expect(result.type).toBe(PaymentGatewayType.STRIPE);
      expect(result.displayName).toBe('Stripe Test');
      expect(result.isDefault).toBe(true);
      expect(result.credentialFingerprint).toMatch(/^\*\*\*\*[0-9a-f]{4}$/);
    });

    it('throws NotFoundException for missing id', async () => {
      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        "Payment gateway config 'non-existent-id' not found",
      );
    });
  });

  // -------------------------------------------------------------------------
  // createGateway
  // -------------------------------------------------------------------------
  describe('createGateway', () => {
    it('encrypts credentials before persisting (ciphertext != plaintext)', async () => {
      const credentials = { key_id: 'rzp_test_abc123def', key_secret: 'super-secret-value' };

      const result = await service.createGateway({
        type: PaymentGatewayType.RAZORPAY,
        displayName: 'Razorpay test',
        credentials,
        isDefault: false,
      });

      const saved = rows[0];
      expect(saved.encryptedCredentials).not.toContain('super-secret-value');
      expect(saved.encryptedCredentials).not.toContain('rzp_test_abc123def');
      expect(saved.iv).toBeDefined();
      expect(saved.authTag).toBeDefined();
      // credentialFingerprint is computed on the row; verify via findAll
      const all = await service.findAll();
      expect(all[0].credentialFingerprint).toMatch(/^\*\*\*\*[0-9a-f]{4}$/);
      expect(result.id).toBeDefined();
    });

    it('rejects duplicate type with ConflictException', async () => {
      rows.push(makeRow({
        id: 'existing-gw',
        type: PaymentGatewayType.RAZORPAY,
        displayName: 'Existing Razorpay',
      }));

      await expect(
        service.createGateway({
          type: PaymentGatewayType.RAZORPAY,
          displayName: 'Duplicate',
          credentials: { api: 'key' },
        }),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.createGateway({
          type: PaymentGatewayType.RAZORPAY,
          displayName: 'Duplicate',
          credentials: { api: 'key' },
        }),
      ).rejects.toThrow("Gateway config for type 'razorpay' already exists");
    });

    it('sets isDefault=true and unsets others when requested (transactional)', async () => {
      rows.push(makeRow({
        id: 'existing-default',
        type: PaymentGatewayType.STRIPE,
        isDefault: true,
      }));

      const result = await service.createGateway({
        type: PaymentGatewayType.RAZORPAY,
        displayName: 'New Default',
        credentials: { api: 'key' },
        isDefault: true,
      });

      expect(result.isDefault).toBe(true);
      // The transaction should have unset the previous default
      const stripeRow = rows.find((r) => r.id === 'existing-default');
      expect(stripeRow?.isDefault).toBe(false);
    });

    it('defaults isActive=true and isDefault=false when not specified', async () => {
      const result = await service.createGateway({
        type: PaymentGatewayType.CASH,
        displayName: 'Cash Gateway',
        credentials: { label: 'cash' },
      });

      expect(result.isActive).toBe(true);
      expect(result.isDefault).toBe(false);

      const saved = rows[0];
      expect(saved.isActive).toBe(true);
      expect(saved.isDefault).toBe(false);
    });

    it('uses repo.save (not transaction) when isDefault is false', async () => {
      await service.createGateway({
        type: PaymentGatewayType.RAZORPAY,
        displayName: 'Non-default Gateway',
        credentials: { key: 'val' },
        isDefault: false,
      });

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // updateGateway
  // -------------------------------------------------------------------------
  describe('updateGateway', () => {
    it('updates displayName without re-encrypting', async () => {
      rows.push(makeRow({
        id: 'gw-upd',
        type: PaymentGatewayType.RAZORPAY,
        displayName: 'Old Name',
        encryptedCredentials: 'original-ciphertext',
        iv: 'original-iv-hex',
        authTag: 'original-auth-tag',
      }));

      const result = await service.updateGateway('gw-upd', { displayName: 'New Name' });

      expect(result.displayName).toBe('New Name');
      expect(JSON.stringify(result)).not.toContain('original-ciphertext');
      expect(JSON.stringify(result)).not.toContain('original-iv-hex');
    });

    it('re-encrypts when credentials change', async () => {
      rows.push(makeRow({
        id: 'gw-creds',
        type: PaymentGatewayType.RAZORPAY,
        displayName: 'With Credentials',
        encryptedCredentials: 'old-ciphertext',
        iv: 'old-iv-value-12',
        authTag: 'old-auth-tag-12',
      }));

      const result = await service.updateGateway('gw-creds', {
        credentials: { new_key: 'new-secret-plaintext' },
      });

      const saved = rows.find((r) => r.id === 'gw-creds')!;
      expect(saved.encryptedCredentials).not.toContain('new-secret-plaintext');
      expect(saved.iv).not.toBe('old-iv-value-12');
      expect(result.credentialFingerprint).toMatch(/^\*\*\*\*[0-9a-f]{4}$/);
    });

    it('transitions isDefault atomically', async () => {
      rows.push(
        makeRow({ id: 'gw-a', type: PaymentGatewayType.RAZORPAY, isDefault: true }),
        makeRow({ id: 'gw-b', type: PaymentGatewayType.STRIPE, isDefault: false }),
      );

      const result = await service.updateGateway('gw-b', { isDefault: true });

      expect(result.isDefault).toBe(true);
      const gwA = rows.find((r) => r.id === 'gw-a');
      const gwB = rows.find((r) => r.id === 'gw-b');
      expect(gwA?.isDefault).toBe(false);
      expect(gwB?.isDefault).toBe(true);
    });

    it('throws NotFoundException for missing id', async () => {
      await expect(
        service.updateGateway('missing-id', { displayName: 'Nope' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('does not use transaction when isDefault is not changed', async () => {
      rows.push(makeRow({ id: 'gw-simp', type: PaymentGatewayType.RAZORPAY, isDefault: false }));

      await service.updateGateway('gw-simp', { displayName: 'Updated' });

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });

    it('sets isActive status correctly', async () => {
      rows.push(makeRow({ id: 'gw-active', type: PaymentGatewayType.RAZORPAY, isActive: true }));

      const result = await service.updateGateway('gw-active', { isActive: false });

      expect(result.isActive).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // setAsDefault
  // -------------------------------------------------------------------------
  describe('setAsDefault', () => {
    it('transitions default in transaction', async () => {
      rows.push(
        makeRow({ id: 'gw-d1', type: PaymentGatewayType.RAZORPAY, isDefault: true }),
        makeRow({ id: 'gw-d2', type: PaymentGatewayType.STRIPE, isDefault: false }),
      );

      const result = await service.setAsDefault('gw-d2');

      expect(result.isDefault).toBe(true);
      expect(rows.find((r) => r.id === 'gw-d1')?.isDefault).toBe(false);
      expect(rows.find((r) => r.id === 'gw-d2')?.isDefault).toBe(true);
    });

    it('throws NotFoundException for missing id', async () => {
      await expect(service.setAsDefault('does-not-exist')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // deleteGateway
  // -------------------------------------------------------------------------
  describe('deleteGateway', () => {
    it('removes non-default row', async () => {
      rows.push(makeRow({ id: 'gw-del', type: PaymentGatewayType.RAZORPAY, isDefault: false }));

      await service.deleteGateway('gw-del');

      expect(rows.find((r) => r.id === 'gw-del')).toBeUndefined();
      expect(repo.remove).toHaveBeenCalled();
    });

    it('rejects default row with BadRequestException', async () => {
      rows.push(makeRow({ id: 'gw-def', type: PaymentGatewayType.RAZORPAY, isDefault: true }));

      await expect(service.deleteGateway('gw-def')).rejects.toThrow(BadRequestException);
      await expect(service.deleteGateway('gw-def')).rejects.toThrow(
        'Cannot delete the default gateway. Set another gateway as default first.',
      );
    });

    it('throws NotFoundException for missing id', async () => {
      await expect(service.deleteGateway('ghost-id')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // credential masking
  // -------------------------------------------------------------------------
  describe('credential masking', () => {
    beforeEach(async () => {
      rows.push(
        makeRow({
          id: 'gw-mask-1',
          type: PaymentGatewayType.RAZORPAY,
          displayName: 'Razorpay',
          encryptedCredentials: 'razorpay-ciphertext-data-1234567890',
          iv: 'iv-razorpay-12bytes',
          authTag: 'authtagrazorpay',
          isDefault: true,
        }),
        makeRow({
          id: 'gw-mask-2',
          type: PaymentGatewayType.STRIPE,
          displayName: 'Stripe',
          encryptedCredentials: 'stripe-ciphertext-data-abcdefghij',
          iv: 'iv-stripe-12bytes',
          authTag: 'authtagstripe',
          isDefault: false,
        }),
      );
    });

    it('same ciphertext produces same fingerprint (stable across calls)', async () => {
      const result1 = await service.findAll();
      const result2 = await service.findAll();

      const razorpayFingerprint1 = result1.find((r) => r.type === PaymentGatewayType.RAZORPAY)?.credentialFingerprint;
      const razorpayFingerprint2 = result2.find((r) => r.type === PaymentGatewayType.RAZORPAY)?.credentialFingerprint;

      expect(razorpayFingerprint1).toBe(razorpayFingerprint2);
      expect(razorpayFingerprint1).toMatch(/^\*\*\*\*[0-9a-f]{4}$/);
      expect(razorpayFingerprint2).toMatch(/^\*\*\*\*[0-9a-f]{4}$/);
    });

    it('different credentials produce different fingerprints', async () => {
      const result = await service.findAll();
      const fingerprints = result.map((r) => r.credentialFingerprint);

      const unique = new Set(fingerprints);
      expect(unique.size).toBe(result.length);
    });

    it('MaskedGatewayResponse never contains plaintext credentials', async () => {
      const credentials = { key_id: 'rzp_test_abc123def', key_secret: 'super-secret-value' };

      await service.createGateway({
        type: PaymentGatewayType.CASH,
        displayName: 'Cash test',
        credentials,
      });

      const result = await service.findAll();
      const json = JSON.stringify(result);

      expect(json).not.toContain('super-secret-value');
      expect(json).not.toContain('rzp_test_abc123def');
      expect(json).not.toContain('super-secret');
      expect(json).not.toContain('rzp_test');
      // Only the fingerprint format is allowed
      expect(json).toMatch(/\*\*\*\*[0-9a-f]{4}/);
    });

    it('credentialFingerprint format matches ****<4-hex-chars>', async () => {
      const result = await service.findAll();

      for (const gateway of result) {
        expect(gateway.credentialFingerprint).toMatch(/^\*\*\*\*[0-9a-f]{4}$/);
      }
    });
  });
});