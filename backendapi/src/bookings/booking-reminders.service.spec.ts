import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BookingRemindersService } from './booking-reminders.service';
import { Booking } from './entities/booking.entity';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { NotificationsService } from '../notifications/notifications.service';

type MockRepo = {
  find: jest.Mock;
};

describe('BookingRemindersService', () => {
  let service: BookingRemindersService;
  let bookingRepo: MockRepo;
  let pushService: { sendToUser: jest.Mock };
  let notifService: { create: jest.Mock };

  beforeEach(async () => {
    bookingRepo = { find: jest.fn().mockResolvedValue([]) };
    pushService = { sendToUser: jest.fn().mockResolvedValue(undefined) };
    notifService = { create: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingRemindersService,
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: PushNotificationsService, useValue: pushService },
        { provide: NotificationsService, useValue: notifService },
      ],
    }).compile();

    service = module.get<BookingRemindersService>(BookingRemindersService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('sendUpcomingBookingReminders', () => {
    it('should return zero reminders when no bookings match', async () => {
      const result = await service.sendUpcomingBookingReminders();
      expect(result.remindersSent).toBe(0);
      expect(result.checkedBookings).toBe(0);
    });

    it('should send reminders for bookings within 60 minutes', async () => {
      const now = new Date();
      const in30min = new Date(now.getTime() + 30 * 60 * 1000);

      bookingRepo.find.mockResolvedValue([
        {
          id: 'b1',
          scheduledDate: in30min,
          provider: { firstName: 'Ravi', lastName: 'Kumar', user: { id: 'pu1' } },
          customer: { user: { id: 'cu1', email: null, phone: '9876543210' } },
          providerService: { category: { nameEn: 'Plumbing' } },
        },
      ]);

      const result = await service.sendUpcomingBookingReminders();

      expect(result.remindersSent).toBe(1);
      expect(notifService.create).toHaveBeenCalledTimes(2);
      expect(pushService.sendToUser).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendCompletionReminders', () => {
    it('should return zero reminders when no bookings match', async () => {
      const result = await service.sendCompletionReminders();
      expect(result.remindersSent).toBe(0);
    });

    it('should send review reminders for recent completions', async () => {
      bookingRepo.find.mockResolvedValue([
        {
          id: 'b1',
          scheduledDate: new Date(),
          provider: { firstName: 'Ravi', lastName: 'Kumar' },
          customer: { user: { id: 'cu1' } },
          providerService: { category: { nameEn: 'Plumbing' } },
        },
      ]);

      const result = await service.sendCompletionReminders();

      expect(result.remindersSent).toBe(1);
      expect(notifService.create).toHaveBeenCalledWith(
        'cu1',
        'Rate Your Experience',
        expect.stringContaining('Plumbing'),
        'review_reminder',
        { bookingId: 'b1' },
        expect.anything(),
      );
    });
  });
});
