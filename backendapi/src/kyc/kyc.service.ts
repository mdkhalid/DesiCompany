import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KycDocument } from './entities/kyc-document.entity';
import { Provider } from '../users/entities/provider.entity';
import { User } from '../users/entities/user.entity';
import { KycStatus } from '../common/enums/kyc-status.enum';
import { UserStatus } from '../common/enums/user-status.enum';

@Injectable()
export class KycService {
  constructor(
    @InjectRepository(KycDocument)
    private readonly kycRepository: Repository<KycDocument>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async uploadDocument(
    providerId: string,
    documentType: string,
    documentUrl: string,
  ) {
    const provider = await this.providerRepository.findOne({
      where: { id: providerId },
    });
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    const document = this.kycRepository.create({
      provider,
      documentType,
      documentUrl,
      status: KycStatus.PENDING,
    });

    return this.kycRepository.save(document);
  }

  async findByProvider(providerId: string) {
    return this.kycRepository.find({
      where: { provider: { id: providerId } },
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(id: string, status: KycStatus, remarks?: string) {
    const document = await this.kycRepository.findOne({
      where: { id },
      relations: { provider: { user: true } },
    });

    if (!document) {
      throw new NotFoundException('KYC document not found');
    }

    if (status === KycStatus.REJECTED && !remarks) {
      throw new BadRequestException('Remarks are required when rejecting KYC');
    }

    document.status = status;
    document.remarks = remarks ?? null;
    document.reviewedAt = new Date();

    await this.kycRepository.save(document);

    if (status === KycStatus.APPROVED) {
      document.provider.isVerified = true;
      document.provider.user.status = UserStatus.ACTIVE;
      await this.providerRepository.save(document.provider);
      await this.userRepository.save(document.provider.user);
    } else if (status === KycStatus.REJECTED) {
      document.provider.isVerified = false;
      await this.providerRepository.save(document.provider);
    }

    return document;
  }
}
