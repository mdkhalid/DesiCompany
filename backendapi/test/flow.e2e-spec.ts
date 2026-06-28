import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { DataSource } from 'typeorm';
import { ServiceCategory } from '../src/services/entities/service-category.entity';
import { CommissionType } from '../src/common/enums/commission-type.enum';
import { User } from '../src/users/entities/user.entity';
import { Customer } from '../src/users/entities/customer.entity';
import { Provider } from '../src/users/entities/provider.entity';
import { JobRequest } from '../src/quotes/entities/job-request.entity';
import { Quote } from '../src/quotes/entities/quote.entity';
import { Booking } from '../src/bookings/entities/booking.entity';
import { Message } from '../src/chat/entities/message.entity';

describe('Complete Flow: Job Posting → Quote → Booking → Chat → Status (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  let categoryId: string;
  let customerToken: string;
  let providerToken: string;
  let jobRequestId: string;
  let quoteId: string;
  let bookingId: string;

  const customerPhone = '+5500000001';
  const providerPhone = '+5500000002';
  const testOtp = '123456';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(process.env.API_PREFIX || '/api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.enableCors({ origin: true, credentials: true });
    await app.init();

    dataSource = app.get(DataSource);

    const categoryRepo = dataSource.getRepository(ServiceCategory);
    const category = categoryRepo.create({
      nameEn: 'Plumbing',
      nameHi: 'प्लम्बिंग',
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 10,
      isActive: true,
    });
    const savedCategory = await categoryRepo.save(category);
    categoryId = savedCategory.id;
  });

  afterAll(async () => {
    const repos = [
      Message, Booking, Quote, JobRequest, Provider, Customer, User, ServiceCategory,
    ];
    for (const entity of repos) {
      await dataSource.getRepository(entity).delete({});
    }
    await app.close();
  });

  it('Customer requests OTP and registers', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({ phone: customerPhone })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        phone: customerPhone,
        otp: testOtp,
        role: 'customer',
        firstName: 'Ravi',
        lastName: 'Sharma',
      })
      .expect(201);

    customerToken = res.body.tokens.accessToken;
    expect(customerToken).toBeDefined();
  });

  it('Provider requests OTP and registers', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({ phone: providerPhone })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        phone: providerPhone,
        otp: testOtp,
        role: 'provider',
        firstName: 'Amit',
        lastName: 'Verma',
      })
      .expect(201);

    providerToken = res.body.tokens.accessToken;
    expect(providerToken).toBeDefined();
  });

  it('Customer creates a job request', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/job-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        title: 'Fix kitchen sink',
        description: 'The kitchen sink is leaking and needs urgent repair',
        categoryId,
        budgetMin: 500,
        budgetMax: 2000,
      })
      .expect(201);

    jobRequestId = res.body.id;
    expect(res.body.status).toBe('open');
  });

  it('Provider finds open job requests', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/job-requests/open')
      .set('Authorization', `Bearer ${providerToken}`)
      .expect(200);

    const match = (res.body as any[]).find(
      (jr: any) => jr.id === jobRequestId,
    );
    expect(match).toBeDefined();
  });

  it('Provider submits a quote', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/job-requests/${jobRequestId}/quotes`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({
        amount: 1200,
        message: 'I can fix this. Will bring all necessary tools.',
        estimatedHours: 2,
      })
      .expect(201);

    quoteId = res.body.id;
    expect(res.body.status).toBe('pending');
  });

  it('Customer accepts quote → Booking created', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/quotes/${quoteId}/accept`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({})
      .expect(201);

    bookingId = res.body.id;
    expect(res.body.status).toBe('requested');
    expect(res.body.totalAmount).toBeDefined();
    expect(res.body.customer).toBeDefined();
    expect(res.body.provider).toBeDefined();
  });

  it('Customer sends a chat message about the booking', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/chat/messages')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        type: 'booking',
        bookingId,
        content: 'Hi, when can you come?',
        messageType: 'text',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toBeDefined();
  });

  it('Provider sees the booking conversation', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/chat/conversations')
      .set('Authorization', `Bearer ${providerToken}`)
      .expect(200);

    expect(res.body.conversations).toBeDefined();
    const conv = res.body.conversations.find(
      (c: any) => c.bookingId === bookingId,
    );
    expect(conv).toBeDefined();
    expect(conv.bookingStatus).toBeDefined();
  });

  it('Provider reads chat messages', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/chat/messages/booking/${bookingId}`)
      .set('Authorization', `Bearer ${providerToken}`)
      .expect(200);

    expect(res.body.messages).toBeDefined();
    expect(res.body.messages.length).toBeGreaterThanOrEqual(1);
    expect(
      res.body.messages.some((m: any) =>
        m.content.includes('when can you come'),
      ),
    ).toBe(true);
  });

  it('Provider accepts the booking', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ status: 'accepted' })
      .expect(200);

    expect(res.body.status).toBe('accepted');
  });

  it('Provider marks on the way', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ status: 'on_the_way' })
      .expect(200);

    expect(res.body.status).toBe('on_the_way');
  });

  it('Provider starts working', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ status: 'working' })
      .expect(200);

    expect(res.body.status).toBe('working');
  });

  it('Provider completes the booking', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ status: 'completed' })
      .expect(200);

    expect(res.body.status).toBe('completed');
    expect(res.body.totalAmount).toBeGreaterThan(0);
    expect(res.body.commissionAmount).toBeDefined();
    expect(res.body.providerAmount).toBeDefined();
  });

  it('Customer verifies the completed booking', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    expect(res.body.status).toBe('completed');
    expect(res.body.totalAmount).toBeGreaterThan(0);
  });
});
