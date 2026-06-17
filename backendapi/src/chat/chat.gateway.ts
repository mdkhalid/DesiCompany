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
import { Injectable, Logger, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { Booking } from '../bookings/entities/booking.entity';

interface JoinRoomPayload {
  bookingId: string;
  token: string;
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
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    const room = `booking_${payload.bookingId}`;
    client.join(room);
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
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    const { bookingId, content } = payload;
    if (!content?.trim()) return;

    const message = this.messageRepository.create({
      booking: { id: bookingId } as Booking,
      sender: { id: client.data.userId } as any,
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
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { bookingId: string },
  ) {
    await this.messageRepository.update(
      { booking: { id: payload.bookingId }, isRead: false },
      { isRead: true },
    );

    const room = `booking_${payload.bookingId}`;
    this.server.to(room).emit('messages_read', { bookingId: payload.bookingId });
  }
}
