import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Provider } from '../users/entities/provider.entity';

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface MapProvider {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  serviceRadiusKm: number;
  city: string;
  isVerified: boolean;
  averageRating: number;
}

@Injectable()
export class ServiceAreaMapService {
  constructor(
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
  ) {}

  async getProvidersInBoundingBox(bounds: BoundingBox): Promise<MapProvider[]> {
    const providers = await this.providerRepository
      .createQueryBuilder('provider')
      .leftJoinAndSelect('provider.user', 'user')
      .where('provider.isVerified = :verified', { verified: true })
      .andWhere('provider.latitude IS NOT NULL')
      .andWhere('provider.longitude IS NOT NULL')
      .andWhere('provider.latitude BETWEEN :minLat AND :maxLat', {
        minLat: bounds.minLat,
        maxLat: bounds.maxLat,
      })
      .andWhere('provider.longitude BETWEEN :minLng AND :maxLng', {
        minLng: bounds.minLng,
        maxLng: bounds.maxLng,
      })
      .getMany();

    return providers.map((p) => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName || ''}`.trim(),
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      serviceRadiusKm: Number(p.serviceRadiusKm),
      city: p.city || '',
      isVerified: p.isVerified,
      averageRating: Number(p.averageRating),
    }));
  }

  async getServiceAreaCoverage(centerLat: number, centerLng: number) {
    const radius = 10; // 10km radius for coverage
    const providers = await this.providerRepository
      .createQueryBuilder('provider')
      .where('provider.isVerified = :verified', { verified: true })
      .andWhere('provider.latitude IS NOT NULL')
      .andWhere(
        `6371000 * acos(
          cos(radians(:lat)) * cos(radians(provider.latitude)) *
          cos(radians(provider.longitude) - radians(:lng)) +
          sin(radians(:lat)) * sin(radians(provider.latitude))
        ) <= :radius`,
        { lat: centerLat, lng: centerLng, radius: radius * 1000 },
      )
      .getCount();

    return {
      centerLat,
      centerLng,
      searchRadiusKm: radius,
      providersInArea: providers,
    };
  }

  calculateBoundingBox(
    centerLat: number,
    centerLng: number,
    radiusKm: number,
  ): BoundingBox {
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos((centerLat * Math.PI) / 180));

    return {
      minLat: centerLat - latDelta,
      maxLat: centerLat + latDelta,
      minLng: centerLng - lngDelta,
      maxLng: centerLng + lngDelta,
    };
  }

  async getProvidersAroundLocation(
    centerLat: number,
    centerLng: number,
    radiusKm: number,
  ) {
    const bounds = this.calculateBoundingBox(centerLat, centerLng, radiusKm);
    return this.getProvidersInBoundingBox(bounds);
  }
}