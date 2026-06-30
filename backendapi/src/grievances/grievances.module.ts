import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Grievance } from './entities/grievance.entity';
import { GrievanceMessage } from './entities/grievance-message.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from '../users/entities/user.entity';
import { GrievancesService } from './grievances.service';
import { ChatbotService } from './chatbot.service';
import { GrievancesController } from './grievances.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Grievance, GrievanceMessage, Booking, User])],
  controllers: [GrievancesController],
  providers: [GrievancesService, ChatbotService],
  exports: [GrievancesService, ChatbotService],
})
export class GrievancesModule {}
