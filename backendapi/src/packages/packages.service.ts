import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServicePackage } from './entities/service-package.entity';
import { Provider } from '../users/entities/provider.entity';
import { ProviderService } from '../services/entities/provider-service.entity';

@Injectable()
export class PackagesService {
  constructor(
    @InjectRepository(ServicePackage)
    private readonly packageRepository: Repository<ServicePackage>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    @InjectRepository(ProviderService)
    private readonly providerServiceRepository: Repository<ProviderService>,
  ) {}

  async createPackage(
    userId: string,
    name: string,
    description: string,
    serviceIds: string[],
    bundlePrice: number,
  ) {
    if (serviceIds.length < 2) {
      throw new BadRequestException('A package must include at least 2 services');
    }

    const provider = await this.providerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    const services = await this.providerServiceRepository
      .createQueryBuilder('service')
      .where('service.id IN (:...ids)', { ids: serviceIds })
      .andWhere('service.provider_id = :providerId', { providerId: provider.id })
      .getMany();

    if (services.length !== serviceIds.length) {
      throw new BadRequestException('All services must belong to the same provider');
    }

    const originalPrice = services.reduce((sum, svc) => {
      return sum + Number(svc.fixedRate || svc.hourlyRate || svc.dailyRate || 0);
    }, 0);

    const discountPercent = bundlePrice < originalPrice
      ? Math.round(((originalPrice - bundlePrice) / originalPrice) * 100)
      : 0;

    const pkg = this.packageRepository.create({
      provider,
      name,
      description: description ?? undefined,
      bundlePrice,
      originalPrice,
      discountPercent,
      services,
      isActive: true,
    });
    return this.packageRepository.save(pkg);
  }

  async getProviderPackages(providerId: string) {
    return this.packageRepository.find({
      where: { provider: { id: providerId }, isActive: true },
      relations: { services: { category: true } },
      order: { createdAt: 'DESC' },
    });
  }

  async getAllActivePackages() {
    return this.packageRepository.find({
      where: { isActive: true },
      relations: { provider: { user: true }, services: { category: true } },
      order: { discountPercent: 'DESC' },
    });
  }

  async getPackageById(id: string) {
    const pkg = await this.packageRepository.findOne({
      where: { id },
      relations: { provider: { user: true }, services: { category: true } },
    });
    if (!pkg) throw new NotFoundException('Package not found');
    return pkg;
  }

  async deactivatePackage(userId: string, id: string) {
    const pkg = await this.packageRepository.findOne({
      where: { id },
      relations: { provider: { user: true } },
    });
    if (!pkg) throw new NotFoundException('Package not found');
    if (pkg.provider.user.id !== userId) {
      throw new BadRequestException('Cannot deactivate others\' packages');
    }
    pkg.isActive = false;
    return this.packageRepository.save(pkg);
  }
}