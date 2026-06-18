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
import { CustomerFeedback } from '../feedbacks/entities/customer-feedback.entity';
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
  CustomerFeedback,
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
      roles: [UserRole.ADMIN],
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
      roles: [UserRole.CUSTOMER],
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
      latitude: 28.6139,
      longitude: 77.209,
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
      roles: [UserRole.PROVIDER],
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
      latitude: 28.628,
      longitude: 77.2195,
      isVerified: true,
      averageRating: 4.5,
      totalReviews: 12,
    });
    await providerRepository.save(provider);
    console.log('Sample provider created');
  }

  const providerServiceRepository = dataSource.getRepository(ProviderService);
  const availabilityRepository = dataSource.getRepository(ProviderAvailability);

  const provider = await providerRepository.findOne({
    where: { user: { phone: '9876543211' } },
    relations: { user: true },
  });
  if (provider) {
    const plumberCategory = await categoryRepository.findOne({
      where: { nameEn: 'Plumber' },
    });
    const electricianCategory = await categoryRepository.findOne({
      where: { nameEn: 'Electrician' },
    });

    if (plumberCategory) {
      const exists = await providerServiceRepository.findOne({
        where: {
          provider: { id: provider.id },
          category: { id: plumberCategory.id },
        },
      });
      if (!exists) {
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
      const exists = await providerServiceRepository.findOne({
        where: {
          provider: { id: provider.id },
          category: { id: electricianCategory.id },
        },
      });
      if (!exists) {
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
      for (const day of [1, 2, 3, 4, 5]) {
        await availabilityRepository.save(
          availabilityRepository.create({
            provider,
            dayOfWeek: day,
            startTime: '09:00',
            endTime: '18:00',
          }),
        );
      }
      console.log('Availability slots created for sample provider');
    }
  }

  // === Dual-role user (customer AND provider) for testing profile switching ===
  const dualRoleExists = await userRepository.findOne({
    where: { phone: '9876543218' },
  });
  if (!dualRoleExists) {
    const dualUser = userRepository.create({
      phone: '9876543218',
      email: 'dualrole@example.com',
      role: UserRole.CUSTOMER,
      roles: [UserRole.CUSTOMER, UserRole.PROVIDER],
      status: UserStatus.ACTIVE,
    });
    const savedDualUser = await userRepository.save(dualUser);

    // Customer profile
    const dualCustomer = customerRepository.create({
      user: savedDualUser,
      firstName: 'Priya',
      lastName: 'Agarwal',
      city: 'Delhi',
      state: 'Delhi',
      latitude: 28.6100,
      longitude: 77.2300,
    });
    await customerRepository.save(dualCustomer);

    // Provider profile
    const dualProvider = providerRepository.create({
      user: savedDualUser,
      firstName: 'Priya',
      lastName: 'Agarwal',
      bio: 'Home cleaning and laundry specialist',
      experienceYears: 3,
      city: 'Delhi',
      state: 'Delhi',
      latitude: 28.6100,
      longitude: 77.2300,
      isVerified: true,
      averageRating: 4.2,
      totalReviews: 8,
    });
    await providerRepository.save(dualProvider);

    // Add services for the provider part
    const cleaningCat = await categoryRepository.findOne({ where: { nameEn: 'Cleaning' } });
    const laundryCat = await categoryRepository.findOne({ where: { nameEn: 'Laundry' } });

    if (cleaningCat) {
      await providerServiceRepository.save(
        providerServiceRepository.create({
          provider: dualProvider,
          category: cleaningCat,
          fixedRate: 400,
          hourlyRate: 200,
        }),
      );
    }
    if (laundryCat) {
      await providerServiceRepository.save(
        providerServiceRepository.create({
          provider: dualProvider,
          category: laundryCat,
          fixedRate: 300,
          hourlyRate: 150,
        }),
      );
    }

    // Availability for the provider part
    for (const day of [1, 2, 3, 4, 5, 6]) {
      await availabilityRepository.save(
        availabilityRepository.create({
          provider: dualProvider,
          dayOfWeek: day,
          startTime: '10:00',
          endTime: '19:00',
        }),
      );
    }
    console.log('Dual-role user created: Priya Agarwal (9876543218)');
  }

  const moreProviders = [
    {
      phone: '9876543212',
      firstName: 'Suresh',
      lastName: 'Singh',
      bio: 'Professional carpenter with 8 years experience',
      category: 'Carpenter',
      fixedRate: 600,
      hourlyRate: 300,
      city: 'Delhi',
      latitude: 28.6507,
      longitude: 77.2334,
    },
    {
      phone: '9876543213',
      firstName: 'Priya',
      lastName: 'Verma',
      bio: 'Expert in home cleaning services',
      category: 'Cleaning',
      fixedRate: 350,
      hourlyRate: 180,
      city: 'Delhi',
      latitude: 28.58,
      longitude: 77.31,
    },
    {
      phone: '9876543214',
      firstName: 'Rajesh',
      lastName: 'Gupta',
      bio: 'AC repair and maintenance specialist',
      category: 'AC Repair',
      fixedRate: 800,
      hourlyRate: 400,
      city: 'Delhi',
      latitude: 28.7041,
      longitude: 77.1025,
    },
    {
      phone: '9876543215',
      firstName: 'Vikram',
      lastName: 'Yadav',
      bio: 'Skilled painter for residential and commercial',
      category: 'Painter',
      fixedRate: 450,
      hourlyRate: 220,
      city: 'Delhi',
      latitude: 28.5494,
      longitude: 77.2676,
    },
    {
      phone: '9876543216',
      firstName: 'Neha',
      lastName: 'Patel',
      bio: 'Professional salon services at home',
      category: 'Salon',
      fixedRate: 500,
      hourlyRate: 250,
      city: 'Mumbai',
      latitude: 19.076,
      longitude: 72.8777,
    },
    {
      phone: '9876543217',
      firstName: 'Mohit',
      lastName: 'Joshi',
      bio: 'Expert pest control services',
      category: 'Pest Control',
      fixedRate: 700,
      hourlyRate: 350,
      city: 'Mumbai',
      latitude: 19.0596,
      longitude: 72.8295,
    },
  ];

  for (const pData of moreProviders) {
    const userExists = await userRepository.findOne({
      where: { phone: pData.phone },
    });
    if (!userExists) {
      const pUser = userRepository.create({
        phone: pData.phone,
        email: `${pData.firstName.toLowerCase()}@example.com`,
        role: UserRole.PROVIDER,
        roles: [UserRole.PROVIDER],
        status: UserStatus.ACTIVE,
      });
      const savedPUser = await userRepository.save(pUser);
      const p = providerRepository.create({
        user: savedPUser,
        firstName: pData.firstName,
        lastName: pData.lastName,
        bio: pData.bio,
        experienceYears: Math.floor(Math.random() * 10) + 1,
        city: pData.city,
        state: 'India',
        pincode: '110001',
        latitude: pData.latitude,
        longitude: pData.longitude,
        isVerified: true,
        averageRating: +(Math.random() * 2 + 3).toFixed(1),
        totalReviews: Math.floor(Math.random() * 30),
      });
      const savedProvider = await providerRepository.save(p);
      const cat = await categoryRepository.findOne({
        where: { nameEn: pData.category },
      });
      if (cat) {
        await providerServiceRepository.save(
          providerServiceRepository.create({
            provider: savedProvider,
            category: cat,
            fixedRate: pData.fixedRate,
            hourlyRate: pData.hourlyRate,
          }),
        );
        for (const day of [1, 2, 3, 4, 5]) {
          await availabilityRepository.save(
            availabilityRepository.create({
              provider: savedProvider,
              dayOfWeek: day,
              startTime: '09:00',
              endTime: '18:00',
            }),
          );
        }
      }
      console.log(`Provider created: ${pData.firstName} ${pData.lastName}`);
    }
  }

  const categories = [
    {
      nameEn: 'Plumber',
      nameHi: 'प्लंबर',
      icon: 'plumbing',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
    },
    {
      nameEn: 'Electrician',
      nameHi: 'इलेक्ट्रीशियन',
      icon: 'electrical',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
    },
    {
      nameEn: 'Carpenter',
      nameHi: 'बढ़ई',
      icon: 'carpentry',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
    },
    {
      nameEn: 'Painter',
      nameHi: 'पेंटर',
      icon: 'painting',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
    },
    {
      nameEn: 'Cleaning',
      nameHi: 'सफाई',
      icon: 'cleaning',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
    },
    {
      nameEn: 'Driver',
      nameHi: 'चालक',
      icon: 'driving',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
    },
    {
      nameEn: 'AC Repair',
      nameHi: 'एसी रिपेयर',
      icon: 'ac repair',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
    },
    {
      nameEn: 'Pest Control',
      nameHi: 'कीट नियंत्रण',
      icon: 'pest control',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
    },
    {
      nameEn: 'Shifting',
      nameHi: 'शिफ्टिंग',
      icon: 'shifting',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
    },
    {
      nameEn: 'Laundry',
      nameHi: 'लॉन्ड्री',
      icon: 'laundry',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
    },
    {
      nameEn: 'Appliance Repair',
      nameHi: 'उपकरण मरम्मत',
      icon: 'appliance',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
    },
    {
      nameEn: 'Salon',
      nameHi: 'सैलून',
      icon: 'salon',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
    },
    {
      nameEn: 'Photography',
      nameHi: 'फोटोग्राफी',
      icon: 'photography',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
    },
    {
      nameEn: 'Tutoring',
      nameHi: 'ट्यूशन',
      icon: 'tutoring',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
    },
    {
      nameEn: 'Fitness Trainer',
      nameHi: 'फिटनेस ट्रेनर',
      icon: 'fitness',
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
