import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { City } from './entities/city.entity';

@Injectable()
export class CityService {
  constructor(
    @InjectRepository(City)
    private readonly cityRepository: Repository<City>,
  ) {}

  async create(dto: {
    nameEn: string;
    nameHi: string;
    state?: string;
    isActive?: boolean;
    sortOrder?: number;
  }) {
    const city = this.cityRepository.create({
      nameEn: dto.nameEn.trim() as any,
      nameHi: dto.nameHi.trim() as any,
      state: dto.state?.trim() || (null as any),
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    } as any);
    return this.cityRepository.save(city);
  }

  async findAll() {
    return this.cityRepository.find({
      order: { sortOrder: 'ASC', nameEn: 'ASC' },
    });
  }

  async findOne(id: string) {
    const city = await this.cityRepository.findOne({ where: { id } });
    if (!city) {
      throw new NotFoundException('City not found');
    }
    return city;
  }

  async update(
    id: string,
    dto: Partial<{
      nameEn: string;
      nameHi: string;
      state: string;
      isActive: boolean;
      sortOrder: number;
    }>,
  ) {
    const city = await this.findOne(id);
    if (dto.nameEn !== undefined) (city as any).nameEn = dto.nameEn.trim();
    if (dto.nameHi !== undefined) (city as any).nameHi = dto.nameHi.trim();
    if (dto.state !== undefined)
      (city as any).state = dto.state?.trim() || (null as any);
    if (dto.isActive !== undefined) city.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) city.sortOrder = dto.sortOrder;
    return this.cityRepository.save(city);
  }

  async remove(id: string) {
    const city = await this.findOne(id);
    return this.cityRepository.remove(city);
  }
}
