import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { BookingPhotosService } from './booking-photos.service';
import { BookingPhoto, PhotoStage } from './entities/booking-photo.entity';
import { Booking } from './entities/booking.entity';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  remove: jest.Mock;
  count: jest.Mock;
};

function makeRepoMock(): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
    remove: jest.fn().mockResolvedValue(undefined),
    count: jest.fn().mockResolvedValue(0),
  };
}

describe('BookingPhotosService', () => {
  let service: BookingPhotosService;
  let photoRepo: MockRepo;
  let bookingRepo: MockRepo;

  beforeEach(async () => {
    photoRepo = makeRepoMock();
    bookingRepo = makeRepoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingPhotosService,
        { provide: getRepositoryToken(BookingPhoto), useValue: photoRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
      ],
    }).compile();

    service = module.get<BookingPhotosService>(BookingPhotosService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('addPhoto', () => {
    it('should throw NotFoundException when booking not found', async () => {
      bookingRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addPhoto('b1', PhotoStage.BEFORE, 'url.jpg'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create and save photo with correct display order', async () => {
      bookingRepo.findOne.mockResolvedValue({ id: 'b1' });
      photoRepo.count.mockResolvedValue(2);

      const result = await service.addPhoto(
        'b1',
        PhotoStage.DURING,
        'photo.jpg',
        'Caption',
      );

      expect(photoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: PhotoStage.DURING,
          photoUrl: 'photo.jpg',
          caption: 'Caption',
          displayOrder: 2,
        }),
      );
      expect(photoRepo.save).toHaveBeenCalled();
    });
  });

  describe('getBookingPhotos', () => {
    it('should return photos for a booking', async () => {
      const photos = [{ id: 'p1' }, { id: 'p2' }];
      photoRepo.find.mockResolvedValue(photos);

      const result = await service.getBookingPhotos('b1');
      expect(result).toEqual(photos);
    });
  });

  describe('getStagePhotos', () => {
    it('should return photos filtered by stage', async () => {
      const photos = [{ id: 'p1', stage: PhotoStage.BEFORE }];
      photoRepo.find.mockResolvedValue(photos);

      const result = await service.getStagePhotos('b1', PhotoStage.BEFORE);
      expect(result).toEqual(photos);
      expect(photoRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ stage: PhotoStage.BEFORE }),
        }),
      );
    });
  });

  describe('deletePhoto', () => {
    it('should throw NotFoundException when photo not found', async () => {
      photoRepo.findOne.mockResolvedValue(null);

      await expect(service.deletePhoto('p1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should remove photo and return message', async () => {
      photoRepo.findOne.mockResolvedValue({ id: 'p1' });

      const result = await service.deletePhoto('p1');
      expect(result.message).toBe('Photo deleted');
      expect(photoRepo.remove).toHaveBeenCalled();
    });
  });
});
