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
import { VerificationStatus } from '../common/enums/verification-status.enum';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class KycService {
  constructor(
    @InjectRepository(KycDocument)
    private readonly kycRepository: Repository<KycDocument>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly activityLogsService: ActivityLogsService,
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

  async findAll() {
    return this.kycRepository.find({
      relations: { provider: { user: true } },
      order: { createdAt: 'DESC' },
    });
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
      document.provider.verificationStatus = VerificationStatus.VERIFIED;
      // Only activate user if not suspended - suspended users require admin intervention
      if (document.provider.user.status !== UserStatus.SUSPENDED) {
        document.provider.user.status = UserStatus.ACTIVE;
        await this.userRepository.save(document.provider.user);
      }
      await this.providerRepository.save(document.provider);

      await this.activityLogsService.log(
        'kyc.approved',
        'KycDocument',
        id,
        undefined,
        { providerId: document.provider.id },
      );
    } else if (status === KycStatus.REJECTED) {
      document.provider.isVerified = false;
      document.provider.verificationStatus = VerificationStatus.REJECTED;
      await this.providerRepository.save(document.provider);

      await this.activityLogsService.log(
        'kyc.rejected',
        'KycDocument',
        id,
        undefined,
        { providerId: document.provider.id, remarks },
      );
    }

    return document;
  }
}
