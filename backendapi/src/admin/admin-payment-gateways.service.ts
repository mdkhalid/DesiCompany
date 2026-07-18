import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { PaymentGatewayConfig } from '../payments/entities/payment-gateway-config.entity';
import { PaymentGatewayType } from '../common/enums/payment-gateway-type.enum';
import { encryptCredentials } from '../payments/crypto/credential-cipher';

export interface CreateGatewayInput {
  type: PaymentGatewayType;
  displayName: string;
  credentials: Record<string, string>; // plaintext (will be encrypted)
  isActive?: boolean;
  isDefault?: boolean;
}

export interface UpdateGatewayInput {
  displayName?: string;
  credentials?: Record<string, string>; // if provided, re-encrypt
  isActive?: boolean;
  isDefault?: boolean;
}

export interface MaskedGatewayResponse {
  id: string;
  type: PaymentGatewayType;
  displayName: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  credentialFingerprint: string; // e.g. '****1234' (last 4 of sha256 of ciphertext)
}

@Injectable()
export class AdminPaymentGatewaysService {
  constructor(
    @InjectRepository(PaymentGatewayConfig)
    private readonly repo: Repository<PaymentGatewayConfig>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<MaskedGatewayResponse[]> {
    const rows = await this.repo.find({ order: { createdAt: 'ASC' } });
    return rows.map((r) => this.maskCredentials(r));
  }

  async findOne(id: string): Promise<MaskedGatewayResponse> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row)
      throw new NotFoundException(`Payment gateway config '${id}' not found`);
    return this.maskCredentials(row);
  }

  async createGateway(
    input: CreateGatewayInput,
  ): Promise<MaskedGatewayResponse> {
    const existing = await this.repo.findOne({ where: { type: input.type } });
    if (existing) {
      throw new ConflictException(
        `Gateway config for type '${input.type}' already exists`,
      );
    }

    const encrypted = encryptCredentials(JSON.stringify(input.credentials));
    const row = this.repo.create({
      type: input.type,
      displayName: input.displayName,
      encryptedCredentials: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      isActive: input.isActive ?? true,
      isDefault: false, // start false; set in transaction below if requested
    });

    if (input.isDefault) {
      await this.dataSource.transaction(async (manager) => {
        await manager.query(
          `UPDATE payment_gateway_configs SET is_default = false`,
        );
        row.isDefault = true;
        await manager.save(PaymentGatewayConfig, row);
      });
    } else {
      await this.repo.save(row);
    }

    return this.maskCredentials(row);
  }

  async updateGateway(
    id: string,
    input: UpdateGatewayInput,
  ): Promise<MaskedGatewayResponse> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row)
      throw new NotFoundException(`Payment gateway config '${id}' not found`);

    if (input.displayName !== undefined) row.displayName = input.displayName;
    if (input.isActive !== undefined) row.isActive = input.isActive;
    if (input.credentials !== undefined) {
      const encrypted = encryptCredentials(JSON.stringify(input.credentials));
      row.encryptedCredentials = encrypted.ciphertext;
      row.iv = encrypted.iv;
      row.authTag = encrypted.authTag;
    }

    if (input.isDefault !== undefined && input.isDefault !== row.isDefault) {
      // Transactional: unset all others, then set this one
      await this.dataSource.transaction(async (manager) => {
        if (input.isDefault) {
          await manager.query(
            `UPDATE payment_gateway_configs SET is_default = false`,
          );
        }
        row.isDefault = input.isDefault as boolean;
        await manager.save(PaymentGatewayConfig, row);
      });
    } else {
      await this.repo.save(row);
    }

    return this.maskCredentials(row);
  }

  async setAsDefault(id: string): Promise<MaskedGatewayResponse> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row)
      throw new NotFoundException(`Payment gateway config '${id}' not found`);
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE payment_gateway_configs SET is_default = false`,
      );
      row.isDefault = true;
      await manager.save(PaymentGatewayConfig, row);
    });
    return this.maskCredentials(row);
  }

  async deleteGateway(id: string): Promise<void> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row)
      throw new NotFoundException(`Payment gateway config '${id}' not found`);
    if (row.isDefault) {
      throw new BadRequestException(
        `Cannot delete the default gateway. Set another gateway as default first.`,
      );
    }
    await this.repo.remove(row);
  }

  private maskCredentials(row: PaymentGatewayConfig): MaskedGatewayResponse {
    return {
      id: row.id,
      type: row.type,
      displayName: row.displayName,
      isActive: row.isActive,
      isDefault: row.isDefault,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      credentialFingerprint: this.computeFingerprint(row),
    };
  }

  private computeFingerprint(row: PaymentGatewayConfig): string {
    // Hash the ciphertext to produce a stable fingerprint. Same ciphertext
    // always yields the same hash, so the UI can show a stable masked value.
    const hash = createHash('sha256')
      .update(row.encryptedCredentials)
      .digest('hex');
    return `****${hash.slice(-4)}`;
  }
}
