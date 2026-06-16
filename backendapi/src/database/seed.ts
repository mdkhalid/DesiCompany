import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Customer } from '../users/entities/customer.entity';
import { Provider } from '../users/entities/provider.entity';
import { KycDocument } from '../kyc/entities/kyc-document.entity';
import { ServiceCategory } from '../services/entities/service-category.entity';
import { ProviderService } from '../services/entities/provider-service.entity';
import { ProviderAvailability } from '../services/entities/provider-availability.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingCharge } from '../bookings/entities/booking-charge.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Wallet } from '../payments/entities/wallet.entity';
import { Transaction } from '../payments/entities/transaction.entity';
import { CommissionConfig } from '../commissions/entities/commission-config.entity';
import { Review } from '../reviews/entities/review.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { CommissionType } from '../common/enums/commission-type.enum';
import * as dotenv from 'dotenv';

dotenv.config();

const entities = [
  User,
  Customer,
  Provider,
  KycDocument,
  ServiceCategory,
  ProviderService,
  ProviderAvailability,
  Booking,
  BookingCharge,
  Payment,
  Wallet,
  Transaction,
  CommissionConfig,
  Review,
  Notification,
];

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5433,
    username: process.env.DB_USERNAME || 'desicompany',
    password: process.env.DB_PASSWORD || 'desicompany123',
    database: process.env.DB_NAME || 'desicompany',
    entities,
    synchronize: true,
  });

  await dataSource.initialize();

  const userRepository = dataSource.getRepository(User);
  const customerRepository = dataSource.getRepository(Customer);
  const providerRepository = dataSource.getRepository(Provider);
  const categoryRepository = dataSource.getRepository(ServiceCategory);

  const adminExists = await userRepository.findOne({
    where: { role: UserRole.ADMIN },
  });
  if (!adminExists) {
    const admin = userRepository.create({
      phone: process.env.ADMIN_PHONE || '9999999999',
      email: process.env.ADMIN_EMAIL || 'admin@desicompany.com',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });
    await userRepository.save(admin);
    console.log('Admin user created');
  }

  const customerExists = await userRepository.findOne({
    where: { phone: '9876543210' },
  });
  if (!customerExists) {
    const customerUser = userRepository.create({
      phone: '9876543210',
      email: 'customer@example.com',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    });
    const savedCustomerUser = await userRepository.save(customerUser);

    const customer = customerRepository.create({
      user: savedCustomerUser,
      firstName: 'Rahul',
      lastName: 'Sharma',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
    });
    await customerRepository.save(customer);
    console.log('Sample customer created');
  }

  const providerExists = await userRepository.findOne({
    where: { phone: '9876543211' },
  });
  if (!providerExists) {
    const providerUser = userRepository.create({
      phone: '9876543211',
      email: 'provider@example.com',
      role: UserRole.PROVIDER,
      status: UserStatus.ACTIVE,
    });
    const savedProviderUser = await userRepository.save(providerUser);

    const provider = providerRepository.create({
      user: savedProviderUser,
      firstName: 'Amit',
      lastName: 'Kumar',
      bio: 'Experienced plumber and electrician',
      experienceYears: 5,
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      isVerified: true,
      averageRating: 4.5,
      totalReviews: 12,
    });
    await providerRepository.save(provider);
    console.log('Sample provider created');
  }

  const provider = await providerRepository.findOne({
    where: { user: { phone: '9876543211' } },
    relations: { user: true },
  });
  if (provider) {
    const providerServiceRepository = dataSource.getRepository(ProviderService);
    const availabilityRepository =
      dataSource.getRepository(ProviderAvailability);

    const plumberCategory = await categoryRepository.findOne({
      where: { nameEn: 'Plumber' },
    });
    const electricianCategory = await categoryRepository.findOne({
      where: { nameEn: 'Electrician' },
    });

    if (plumberCategory) {
      const plumberServiceExists = await providerServiceRepository.findOne({
        where: {
          provider: { id: provider.id },
          category: { id: plumberCategory.id },
        },
      });
      if (!plumberServiceExists) {
        await providerServiceRepository.save(
          providerServiceRepository.create({
            provider,
            category: plumberCategory,
            fixedRate: 500,
            hourlyRate: 250,
          }),
        );
        console.log('Plumber service created for sample provider');
      }
    }

    if (electricianCategory) {
      const electricianServiceExists = await providerServiceRepository.findOne({
        where: {
          provider: { id: provider.id },
          category: { id: electricianCategory.id },
        },
      });
      if (!electricianServiceExists) {
        await providerServiceRepository.save(
          providerServiceRepository.create({
            provider,
            category: electricianCategory,
            fixedRate: 400,
            hourlyRate: 200,
          }),
        );
        console.log('Electrician service created for sample provider');
      }
    }

    const existingAvailability = await availabilityRepository.findOne({
      where: { provider: { id: provider.id } },
    });
    if (!existingAvailability) {
      const availabilitySlots = [
        { dayOfWeek: 1, startTime: '09:00', endTime: '18:00' },
        { dayOfWeek: 2, startTime: '09:00', endTime: '18:00' },
        { dayOfWeek: 3, startTime: '09:00', endTime: '18:00' },
        { dayOfWeek: 4, startTime: '09:00', endTime: '18:00' },
        { dayOfWeek: 5, startTime: '09:00', endTime: '18:00' },
      ];
      for (const slot of availabilitySlots) {
        await availabilityRepository.save(
          availabilityRepository.create({ provider, ...slot }),
        );
      }
      console.log('Availability slots created for sample provider');
    }
  }

  const categories = [
    {
      nameEn: 'Plumber',
      nameHi: 'प्लंबर',
      icon: 'plumber',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
    },
    {
      nameEn: 'Electrician',
      nameHi: 'इलेक्ट्रीशियन',
      icon: 'electrician',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
    },
    {
      nameEn: 'Computer Repair',
      nameHi: 'कंप्यूटर रिपेयर',
      icon: 'computer',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
    },
    {
      nameEn: 'Electronics Service',
      nameHi: 'इलेक्ट्रॉनिक्स सर्विस',
      icon: 'electronics',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
    },
    {
      nameEn: 'Daily Wage Labour',
      nameHi: 'दैनिक मजदूर',
      icon: 'labour',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 5,
    },
  ];

  for (const category of categories) {
    const exists = await categoryRepository.findOne({
      where: { nameEn: category.nameEn },
    });
    if (!exists) {
      await categoryRepository.save(categoryRepository.create(category));
      console.log(`Category created: ${category.nameEn}`);
    }
  }

  await dataSource.destroy();
  console.log('Seed completed successfully');
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
