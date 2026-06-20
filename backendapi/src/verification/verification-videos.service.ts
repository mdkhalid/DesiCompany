import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VerificationVideo, VerificationVideoStatus } from './entities/verification-video.entity';
import { Provider } from '../users/entities/provider.entity';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class VerificationVideosService {
  constructor(
    @InjectRepository(VerificationVideo)
    private readonly videoRepository: Repository<VerificationVideo>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
  ) {}

  async uploadVideo(userId: string, videoUrl: string, durationSeconds: number, thumbnailUrl?: string) {
    if (durationSeconds > 60 || durationSeconds < 5) {
      throw new BadRequestException('Video must be between 5 and 60 seconds');
    }

    const provider = await this.providerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    const existing = await this.videoRepository.findOne({
      where: { provider: { id: provider.id } },
    });
    if (existing && existing.status === VerificationVideoStatus.PENDING) {
      throw new BadRequestException('You already have a pending verification video');
    }

    const video = this.videoRepository.create({
      provider,
      videoUrl,
      thumbnailUrl: thumbnailUrl ?? undefined,
      durationSeconds,
      status: VerificationVideoStatus.PENDING,
    });
    return this.videoRepository.save(video);
  }

  async getProviderVideo(providerId: string) {
    return this.videoRepository.findOne({
      where: { provider: { id: providerId } },
      relations: { provider: { user: true } },
    });
  }

  async getPendingVideos() {
    return this.videoRepository.find({
      where: { status: VerificationVideoStatus.PENDING },
      relations: { provider: { user: true } },
      order: { createdAt: 'ASC' },
    });
  }

  async reviewVideo(id: string, status: VerificationVideoStatus, reviewerNotes?: string) {
    const video = await this.videoRepository.findOne({ where: { id } });
    if (!video) throw new NotFoundException('Video not found');
    video.status = status;
    video.reviewerNotes = reviewerNotes ?? null;
    video.reviewedAt = new Date();
    return this.videoRepository.save(video);
  }
}