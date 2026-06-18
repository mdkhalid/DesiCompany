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
import { DirectMessage } from './entities/direct-message.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from '../users/entities/user.entity';
import { Provider } from '../users/entities/provider.entity';

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

interface StartDirectChatPayload {
  providerId: string;
}

interface SendDirectMessagePayload {
  roomId: string;
  content: string;
}

interface JoinDirectChatPayload {
  roomId: string;
}

interface ShareLocationPayload {
  bookingId: string;
  latitude: number;
  longitude: number;
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
    @InjectRepository(DirectMessage)
    private readonly directMessageRepository: Repository<DirectMessage>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
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

  @SubscribeMessage('start_direct_chat')
  async handleStartDirectChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: StartDirectChatPayload,
  ) {
    if (!client.data.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const provider = await this.providerRepository.findOne({
      where: { id: payload.providerId },
      relations: { user: true },
    });

    if (!provider) {
      client.emit('error', { message: 'Provider not found' });
      return;
    }

    const room = `direct_${client.data.userId}_${provider.id}`;
    void client.join(room);

    this.server.to(room).emit('direct_chat_started', {
      roomId: room,
      customerId: client.data.userId,
      providerId: provider.id,
    });

    client.emit('direct_chat_started', {
      roomId: room,
      customerId: client.data.userId,
      providerId: provider.id,
    });
  }

  @SubscribeMessage('send_direct_message')
  async handleSendDirectMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SendDirectMessagePayload,
  ) {
    if (!client.data.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const { roomId, content } = payload;
    if (!content?.trim()) return;

    const parts = roomId.split('_');
    if (parts.length !== 3 || parts[0] !== 'direct') {
      client.emit('error', { message: 'Invalid room ID format' });
      return;
    }
    const customerId = parts[1];
    const providerId = parts[2];

    const message = this.directMessageRepository.create({
      customer: { id: customerId } as User,
      provider: { id: providerId } as Provider,
      sender: { id: client.data.userId } as User,
      content,
    });
    const saved = await this.directMessageRepository.save(message);

    this.server.to(roomId).emit('new_direct_message', {
      id: saved.id,
      content: saved.content,
      senderId: client.data.userId,
      createdAt: saved.createdAt,
    });
  }

  @SubscribeMessage('join_direct_chat')
  async handleJoinDirectChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinDirectChatPayload,
  ) {
    if (!client.data.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const room = payload.roomId;
    const parts = room.split('_');
    if (parts.length !== 3 || parts[0] !== 'direct') {
      client.emit('error', { message: 'Invalid room ID format' });
      return;
    }
    const customerId = parts[1];
    const providerId = parts[2];

    void client.join(room);

    const messages = await this.directMessageRepository.find({
      where: [{ customer: { id: customerId }, provider: { id: providerId } }],
      relations: { sender: true },
      order: { createdAt: 'ASC' },
      take: 50,
    });

    client.emit('direct_chat_history', messages);
  }

  @SubscribeMessage('share_location')
  handleShareLocation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ShareLocationPayload,
  ) {
    if (!client.data.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const room = `booking_${payload.bookingId}`;
    this.server.to(room).emit('provider_location', {
      bookingId: payload.bookingId,
      providerId: client.data.userId,
      latitude: payload.latitude,
      longitude: payload.longitude,
    });
  }

  @SubscribeMessage('customer_share_location')
  handleCustomerShareLocation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ShareLocationPayload,
  ) {
    if (!client.data.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const room = `booking_${payload.bookingId}`;
    this.server.to(room).emit('customer_location', {
      bookingId: payload.bookingId,
      customerId: client.data.userId,
      latitude: payload.latitude,
      longitude: payload.longitude,
    });
  }
}
