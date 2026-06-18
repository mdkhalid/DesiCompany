import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from '../users/entities/user.entity';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    user: User;
  };
}

interface JoinRoomPayload {
  bookingId: string;
}

interface SendMessagePayload {
  bookingId: string;
  content: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const auth = client.handshake.auth as Record<string, unknown>;
      const token =
        (auth?.token as string) ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} rejected: no token provided`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<{
        sub: string;
        phone: string;
        role: string;
      }>(token);
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        this.logger.warn(`Client ${client.id} rejected: user not found`);
        client.disconnect();
        return;
      }

      client.data.userId = user.id;
      client.data.user = user;
      this.logger.log(`Client connected: ${client.id} (user: ${user.id})`);
    } catch {
      this.logger.warn(`Client ${client.id} rejected: invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    if (!client.data.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const booking = await this.bookingRepository.findOne({
      where: { id: payload.bookingId },
      relations: { customer: { user: true }, provider: { user: true } },
    });

    if (!booking) {
      client.emit('error', { message: 'Booking not found' });
      return;
    }

    const isParticipant =
      booking.customer?.user?.id === client.data.userId ||
      booking.provider?.user?.id === client.data.userId;

    if (!isParticipant) {
      client.emit('error', { message: 'Not a participant of this booking' });
      return;
    }

    const room = `booking_${payload.bookingId}`;
    void client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);

    const messages = await this.messageRepository.find({
      where: { booking: { id: payload.bookingId }, isRead: false },
      relations: { sender: true },
      order: { createdAt: 'ASC' },
      take: 50,
    });

    client.emit('history', messages);
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    if (!client.data.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const { bookingId, content } = payload;
    if (!content?.trim()) return;

    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: { customer: { user: true }, provider: { user: true } },
    });

    if (!booking) {
      client.emit('error', { message: 'Booking not found' });
      return;
    }

    const isParticipant =
      booking.customer?.user?.id === client.data.userId ||
      booking.provider?.user?.id === client.data.userId;

    if (!isParticipant) {
      client.emit('error', { message: 'Not a participant of this booking' });
      return;
    }

    const message = this.messageRepository.create({
      booking: { id: bookingId } as Booking,
      sender: { id: client.data.userId } as User,
      content,
    });
    const saved = await this.messageRepository.save(message);

    const room = `booking_${bookingId}`;
    this.server.to(room).emit('new_message', {
      id: saved.id,
      content: saved.content,
      senderId: client.data.userId,
      createdAt: saved.createdAt,
    });
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { bookingId: string },
  ) {
    if (!client.data.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    await this.messageRepository.update(
      { booking: { id: payload.bookingId }, isRead: false },
      { isRead: true },
    );

    const room = `booking_${payload.bookingId}`;
    this.server
      .to(room)
      .emit('messages_read', { bookingId: payload.bookingId });
  }
}
