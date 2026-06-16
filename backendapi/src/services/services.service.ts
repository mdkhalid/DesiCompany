import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceCategory } from './entities/service-category.entity';
import { CommissionType } from '../common/enums/commission-type.enum';

interface CategoryInput {
  nameEn?: string;
  nameHi?: string;
  icon?: string;
  commissionType?: CommissionType;
  commissionValue?: number;
  isActive?: boolean;
}

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(ServiceCategory)
    private readonly categoryRepository: Repository<ServiceCategory>,
  ) {}

  async findAllCategories() {
    return this.categoryRepository.find({ where: { isActive: true }, order: { nameEn: 'ASC' } });
  }

  async createCategory(input: Required<Pick<CategoryInput, 'nameEn' | 'nameHi'>> & CategoryInput) {
    const category = this.categoryRepository.create({
      nameEn: input.nameEn,
      nameHi: input.nameHi,
      icon: input.icon,
      commissionType: input.commissionType,
      commissionValue: input.commissionValue,
    });
    return this.categoryRepository.save(category);
  }

  async updateCategory(id: string, input: CategoryInput) {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    Object.assign(category, input);
    return this.categoryRepository.save(category);
  }

  async deleteCategory(id: string) {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    category.isActive = false;
    return this.categoryRepository.save(category);
  }
}
