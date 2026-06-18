import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatGateway } from './chat.gateway';
import { Message } from './entities/message.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Message, Booking, User]), AuthModule],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class ChatModule {}
