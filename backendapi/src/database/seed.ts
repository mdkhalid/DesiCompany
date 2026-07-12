import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Customer } from '../users/entities/customer.entity';
import { Provider } from '../users/entities/provider.entity';
import { ServiceCategory } from '../services/entities/service-category.entity';
import { ProviderService } from '../services/entities/provider-service.entity';
import { ProviderAvailability } from '../services/entities/provider-availability.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { PlatformFeeConfig } from '../platform-fees/entities/platform-fee-config.entity';
import { City } from '../locations/entities/city.entity';
import { JobRequest } from '../quotes/entities/job-request.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Setting } from '../settings/entities/setting.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { CommissionType } from '../common/enums/commission-type.enum';
import { PricingModel } from '../common/enums/pricing-model.enum';
import * as dotenv from 'dotenv';

dotenv.config();

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5433,
    username: process.env.DB_USERNAME || 'desicompany',
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME || 'desicompany',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
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
    console.log(
      'Admin user created with phone: ' +
        (process.env.ADMIN_PHONE || '9999999999'),
    );
    console.log('  → Login OTP:');
    console.log(
      '     - In mock mode (OTP_MOCK=true in .env): Use "123456" for any phone',
    );
    console.log(
      '     - In production: Check backend terminal logs for the OTP',
    );
    console.log('     - Or set OTP_MOCK=true in backend/.env for development');
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
      latitude: 28.61,
      longitude: 77.23,
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
      latitude: 28.61,
      longitude: 77.23,
      isVerified: true,
      averageRating: 4.2,
      totalReviews: 8,
    });
    await providerRepository.save(dualProvider);

    // Add services for the provider part
    const cleaningCat = await categoryRepository.findOne({
      where: { nameEn: 'Cleaning' },
    });
    const laundryCat = await categoryRepository.findOne({
      where: { nameEn: 'Laundry' },
    });

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
      pricingModels: [
        PricingModel.HOURLY,
        PricingModel.DAILY,
        PricingModel.FIXED,
      ],
      defaultPricingModel: PricingModel.HOURLY,
    },
    {
      nameEn: 'Electrician',
      nameHi: 'इलेक्ट्रीशियन',
      icon: 'electrical',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
      pricingModels: [PricingModel.HOURLY, PricingModel.FIXED],
      defaultPricingModel: PricingModel.HOURLY,
    },
    {
      nameEn: 'Carpenter',
      nameHi: 'बढ़ई',
      icon: 'carpentry',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
      pricingModels: [
        PricingModel.HOURLY,
        PricingModel.DAILY,
        PricingModel.FIXED,
      ],
      defaultPricingModel: PricingModel.DAILY,
    },
    {
      nameEn: 'Painter',
      nameHi: 'पेंटर',
      icon: 'painting',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
      pricingModels: [PricingModel.DAILY, PricingModel.FIXED],
      defaultPricingModel: PricingModel.DAILY,
    },
    {
      nameEn: 'Cleaning',
      nameHi: 'सफाई',
      icon: 'cleaning',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
      pricingModels: [
        PricingModel.HOURLY,
        PricingModel.FIXED,
        PricingModel.PER_UNIT,
      ],
      defaultPricingModel: PricingModel.HOURLY,
    },
    {
      nameEn: 'Driver',
      nameHi: 'चालक',
      icon: 'driving',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
      pricingModels: [PricingModel.HOURLY, PricingModel.DAILY],
      defaultPricingModel: PricingModel.HOURLY,
    },
    {
      nameEn: 'AC Repair',
      nameHi: 'एसी रिपेयर',
      icon: 'ac repair',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
      pricingModels: [PricingModel.FIXED, PricingModel.HOURLY],
      defaultPricingModel: PricingModel.FIXED,
    },
    {
      nameEn: 'Pest Control',
      nameHi: 'कीट नियंत्रण',
      icon: 'pest control',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
      pricingModels: [PricingModel.QUOTE_BASED, PricingModel.FIXED],
      defaultPricingModel: PricingModel.QUOTE_BASED,
    },
    {
      nameEn: 'Shifting',
      nameHi: 'शिफ्टिंग',
      icon: 'shifting',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
      pricingModels: [PricingModel.QUOTE_BASED],
      defaultPricingModel: PricingModel.QUOTE_BASED,
    },
    {
      nameEn: 'Laundry',
      nameHi: 'लॉन्ड्री',
      icon: 'laundry',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
      pricingModels: [PricingModel.PER_UNIT, PricingModel.FIXED],
      defaultPricingModel: PricingModel.PER_UNIT,
    },
    {
      nameEn: 'Appliance Repair',
      nameHi: 'उपकरण मरम्मत',
      icon: 'appliance',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
      pricingModels: [PricingModel.FIXED, PricingModel.HOURLY],
      defaultPricingModel: PricingModel.FIXED,
    },
    {
      nameEn: 'Salon',
      nameHi: 'सैलून',
      icon: 'salon',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
      pricingModels: [PricingModel.FIXED, PricingModel.HOURLY],
      defaultPricingModel: PricingModel.FIXED,
    },
    {
      nameEn: 'Photography',
      nameHi: 'फोटोग्राफी',
      icon: 'photography',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
      pricingModels: [
        PricingModel.HOURLY,
        PricingModel.FIXED,
        PricingModel.DAILY,
      ],
      defaultPricingModel: PricingModel.HOURLY,
    },
    {
      nameEn: 'Tutoring',
      nameHi: 'ट्यूशन',
      icon: 'tutoring',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
      pricingModels: [PricingModel.HOURLY, PricingModel.FIXED],
      defaultPricingModel: PricingModel.HOURLY,
    },
    {
      nameEn: 'Fitness Trainer',
      nameHi: 'फिटनेस ट्रेनर',
      icon: 'fitness',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
      pricingModels: [PricingModel.HOURLY, PricingModel.FIXED],
      defaultPricingModel: PricingModel.HOURLY,
    },
    {
      nameEn: 'Computer Repair',
      nameHi: 'कंप्यूटर रिपेयर',
      icon: 'computer',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
      pricingModels: [PricingModel.FIXED, PricingModel.HOURLY],
      defaultPricingModel: PricingModel.FIXED,
    },
    {
      nameEn: 'Transporter',
      nameHi: 'ट्रांसपोर्टर',
      icon: 'transport',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
      pricingModels: [PricingModel.QUOTE_BASED],
      defaultPricingModel: PricingModel.QUOTE_BASED,
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

  // Seed subcategories
  const subcategories = [
    {
      parent: 'Plumber',
      nameEn: 'Pipe Repair',
      nameHi: 'पाइप मरम्मत',
      icon: 'pipe repair',
    },
    {
      parent: 'Plumber',
      nameEn: 'Water Tank Cleaning',
      nameHi: 'वॉटर टैंक क्लीनिंग',
      icon: 'water tank',
    },
    {
      parent: 'Plumber',
      nameEn: 'Bathroom Fitting',
      nameHi: 'बाथरूम फिटिंग',
      icon: 'bathroom',
    },
    {
      parent: 'Electrician',
      nameEn: 'Wiring',
      nameHi: 'वायरिंग',
      icon: 'wiring',
    },
    {
      parent: 'Electrician',
      nameEn: 'Fan Installation',
      nameHi: 'फैन इंस्टॉलेशन',
      icon: 'fan',
    },
    {
      parent: 'Electrician',
      nameEn: 'Switch Board Repair',
      nameHi: 'स्विच बोर्ड मरम्मत',
      icon: 'switch',
    },
    {
      parent: 'Cleaning',
      nameEn: 'Deep Cleaning',
      nameHi: 'डीप क्लीनिंग',
      icon: 'deep cleaning',
    },
    {
      parent: 'Cleaning',
      nameEn: 'Sofa Cleaning',
      nameHi: 'सोफा क्लीनिंग',
      icon: 'sofa',
    },
    {
      parent: 'Cleaning',
      nameEn: 'Carpet Cleaning',
      nameHi: 'कार्पेट क्लीनिंग',
      icon: 'carpet',
    },
    {
      parent: 'AC Repair',
      nameEn: 'AC Installation',
      nameHi: 'एसी इंस्टॉलेशन',
      icon: 'ac install',
    },
    {
      parent: 'AC Repair',
      nameEn: 'AC Gas Refill',
      nameHi: 'एसी गैस रीफिल',
      icon: 'gas refill',
    },
    {
      parent: 'AC Repair',
      nameEn: 'AC Servicing',
      nameHi: 'एसी सर्विसिंग',
      icon: 'ac service',
    },
  ];

  for (const sub of subcategories) {
    const parentCat = await categoryRepository.findOne({
      where: { nameEn: sub.parent },
    });
    if (parentCat) {
      const exists = await categoryRepository.findOne({
        where: { nameEn: sub.nameEn },
      });
      if (!exists) {
        await categoryRepository.save(
          categoryRepository.create({
            nameEn: sub.nameEn,
            nameHi: sub.nameHi,
            icon: sub.icon,
            parent: parentCat,
            commissionType: CommissionType.PERCENTAGE,
            commissionValue: 10,
          }),
        );
        console.log(`Subcategory created: ${sub.nameEn} under ${sub.parent}`);
      }
    }
  }

  // ─── Fee Configs & Feature Toggles ───────────────────────────
  const feeConfigRepo = dataSource.getRepository(PlatformFeeConfig);
  const defaultConfigs = [
    {
      configKey: 'convenience_fee',
      configValue: {
        type: 'percentage',
        value: 5,
        minAmount: 10,
        maxAmount: 200,
      },
      isActive: true,
      description: 'Convenience fee on all bookings',
    },
    {
      configKey: 'instant_payout_fee',
      configValue: { type: 'fixed', value: 10, minAmount: 0, maxAmount: 0 },
      isActive: false,
      description: 'Fee for instant payout requests',
    },
    {
      configKey: 'lead_quote_fee',
      configValue: { type: 'fixed', value: 20, minAmount: 0, maxAmount: 0 },
      isActive: false,
      description: 'Fee for lead/quote submissions',
    },
    {
      configKey: 'feature_convenience_fee',
      configValue: { enabled: true },
      isActive: true,
      description: 'Feature toggle: convenience fee',
    },
    {
      configKey: 'feature_provider_subscriptions',
      configValue: { enabled: false },
      isActive: true,
      description: 'Feature toggle: provider subscriptions',
    },
    {
      configKey: 'feature_promo_codes',
      configValue: { enabled: true },
      isActive: true,
      description: 'Feature toggle: promo codes',
    },
    {
      configKey: 'feature_instant_payout',
      configValue: { enabled: false },
      isActive: true,
      description: 'Feature toggle: instant payout',
    },
    {
      configKey: 'feature_lead_quote_fee',
      configValue: { enabled: false },
      isActive: true,
      description: 'Feature toggle: lead/quote fee',
    },
    {
      configKey: 'feature_customer_memberships',
      configValue: { enabled: false },
      isActive: true,
      description: 'Feature toggle: customer memberships',
    },
  ];
  for (const cfg of defaultConfigs) {
    const exists = await feeConfigRepo.findOne({
      where: { configKey: cfg.configKey },
    });
    if (!exists) {
      await feeConfigRepo.save(feeConfigRepo.create(cfg));
      console.log(`Fee config created: ${cfg.configKey}`);
    }
  }

  const cityRepository = dataSource.getRepository(City);
  const defaultCities = [
    { nameEn: 'Delhi', nameHi: 'दिल्ली', state: 'Delhi', sortOrder: 1 },
    { nameEn: 'Bangalore', nameHi: 'बेंगलुरु', state: 'Karnataka', sortOrder: 2 },
    { nameEn: 'Mumbai', nameHi: 'मुंबई', state: 'Maharashtra', sortOrder: 3 },
  ];
  const cityMap = new Map<string, City>();
  for (const c of defaultCities) {
    const existing = await cityRepository.findOne({
      where: { nameEn: c.nameEn },
    });
    if (!existing) {
      const saved = await cityRepository.save(cityRepository.create(c));
      cityMap.set(c.nameEn, saved);
      console.log(`City created: ${c.nameEn}`);
    } else {
      cityMap.set(c.nameEn, existing);
    }
  }

  const backfillCityRef = async (
    repo: any,
    cityColumn: string,
  ): Promise<void> => {
    const rows = await repo.find();
    for (const row of rows) {
      const textCity = (row as any)[cityColumn] as string | undefined;
      const city = textCity ? cityMap.get(textCity) : undefined;
      if (city && !(row as any).cityRef) {
        (row as any).cityRef = city;
        await repo.save(row);
      }
    }
  };

  if (cityMap.size > 0) {
    await backfillCityRef(customerRepository, 'city');
    await backfillCityRef(providerRepository, 'city');
    await backfillCityRef(
      dataSource.getRepository(JobRequest),
      'city',
    );
    await backfillCityRef(dataSource.getRepository(Booking), 'serviceCity');
    console.log('City backfill complete');
  }

  const settingsRepo = dataSource.getRepository(Setting);
  const defaultSettings = [
    { key: 'platform_redis_required', value: 'false' },
  ];
  for (const s of defaultSettings) {
    const existing = await settingsRepo.findOne({ where: { key: s.key } });
    if (!existing) {
      await settingsRepo.save(settingsRepo.create(s));
      console.log(`Setting created: ${s.key}`);
    }
  }

  await dataSource.destroy();
  console.log('Seed completed successfully');
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
