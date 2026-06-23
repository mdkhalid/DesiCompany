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
import { Message, MessageType } from './entities/message.entity';
import { DirectMessage, DirectMessageType } from './entities/direct-message.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from '../users/entities/user.entity';
import { Provider } from '../users/entities/provider.entity';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    user: User;
    userName: string;
  };
}

interface TypingPayload {
  bookingId?: string;
  roomId?: string;
  isTyping: boolean;
}

interface ImageMessagePayload {
  bookingId?: string;
  roomId?: string;
  imageUrl: string;
  caption?: string;
}

interface QuoteMessagePayload {
  bookingId?: string;
  roomId?: string;
  amount: number;
  message?: string;
}

interface QuickReplyPayload {
  bookingId?: string;
  roomId?: string;
  quickReplyType: string;
  value: string;
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
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
        relations: { customer: true, provider: true },
      });

      if (!user) {
        this.logger.warn(`Client ${client.id} rejected: user not found`);
        client.disconnect();
        return;
      }

      client.data.userId = user.id;
      client.data.user = user;
      
      // Get display name from customer or provider entity
      let displayName = user.phone;
      if (user.customer) {
        displayName = `${user.customer.firstName || ''} ${user.customer.lastName || ''}`.trim();
      } else if (user.provider) {
        displayName = `${user.provider.firstName || ''} ${user.provider.lastName || ''}`.trim();
      }
      client.data.userName = displayName || user.phone;
      
      this.logger.log(`Client connected: ${client.id} (user: ${user.id})`);
    } catch {
      this.logger.warn(`Client ${client.id} rejected: invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ==================== BOOKING-BASED CHAT ====================

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { bookingId: string },
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

    // Mark messages as read
    await this.messageRepository.update(
      { booking: { id: payload.bookingId }, isRead: false },
      { isRead: true }
    );

    const messages = await this.messageRepository.find({
      where: { booking: { id: payload.bookingId } },
      relations: { sender: true },
      order: { createdAt: 'ASC' },
      take: 50,
    });

    client.emit('history', messages);
    client.emit('messages_read', { bookingId: payload.bookingId });
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { bookingId: string; content: string; messageType?: string; metadata?: Record<string, any> },
  ) {
    if (!client.data.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const { bookingId, content, messageType = MessageType.TEXT, metadata } = payload;
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
      messageType: messageType as MessageType,
      metadata,
    });
    const saved = await this.messageRepository.save(message);

    // Include sender info in the emitted message
    const room = `booking_${bookingId}`;
    this.server.to(room).emit('new_message', {
      id: saved.id,
      content: saved.content,
      senderId: client.data.userId,
      senderName: client.data.userName,
      senderRole: client.data.user.role,
      messageType: saved.messageType,
      metadata: saved.metadata,
      createdAt: saved.createdAt,
      status: 'delivered',
    });

    this.logger.log(`Message sent in booking ${bookingId} by user ${client.data.userId}`);
  }

  @SubscribeMessage('send_image')
  async handleImageMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ImageMessagePayload,
  ) {
    if (!client.data.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    if (!payload.bookingId || !payload.imageUrl) {
      client.emit('error', { message: 'bookingId and imageUrl are required' });
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

    const message = this.messageRepository.create({
      booking: { id: payload.bookingId } as Booking,
      sender: { id: client.data.userId } as User,
      content: payload.caption || 'Sent an image',
      messageType: MessageType.IMAGE,
      metadata: { imageUrl: payload.imageUrl },
    });
    const saved = await this.messageRepository.save(message);

    const room = `booking_${payload.bookingId}`;
    this.server.to(room).emit('new_message', {
      id: saved.id,
      content: saved.content,
      senderId: client.data.userId,
      senderName: client.data.userName,
      senderRole: client.data.user.role,
      messageType: MessageType.IMAGE,
      metadata: saved.metadata,
      createdAt: saved.createdAt,
      status: 'delivered',
    });
  }

  @SubscribeMessage('send_quote_message')
  async handleQuoteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: QuoteMessagePayload,
  ) {
    if (!client.data.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const targetId = payload.bookingId || payload.roomId;
    if (!targetId) {
      client.emit('error', { message: 'bookingId or roomId is required' });
      return;
    }

    const message = this.messageRepository.create({
      booking: { id: targetId } as Booking,
      sender: { id: client.data.userId } as User,
      content: payload.message || `Quote: ₹${payload.amount}`,
      messageType: MessageType.QUOTE,
      metadata: { quoteAmount: payload.amount, accepted: false },
    });
    const saved = await this.messageRepository.save(message);

    const room = `booking_${targetId}`;
    this.server.to(room).emit('new_message', {
      id: saved.id,
      content: saved.content,
      senderId: client.data.userId,
      senderName: client.data.userName,
      senderRole: client.data.user.role,
      messageType: MessageType.QUOTE,
      metadata: saved.metadata,
      createdAt: saved.createdAt,
      status: 'delivered',
    });
  }

  @SubscribeMessage('send_quick_reply')
  async handleQuickReply(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: QuickReplyPayload,
  ) {
    if (!client.data.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const targetId = payload.bookingId || payload.roomId;
    if (!targetId) {
      client.emit('error', { message: 'bookingId or roomId is required' });
      return;
    }

    const quickReplyMessages: Record<string, string> = {
      'accept_quote': 'I accept this quote',
      'decline_quote': 'I decline this quote',
      'need_discount': 'Can you give a discount?',
      'confirm_booking': 'Please confirm the booking',
      'need_more_info': 'I need more information',
      'price_negotiate': 'Can we negotiate on price?',
      'reschedule': 'Can we reschedule?',
    };

    const content = quickReplyMessages[payload.quickReplyType] || payload.value;

    const message = this.messageRepository.create({
      booking: { id: targetId } as Booking,
      sender: { id: client.data.userId } as User,
      content,
      messageType: MessageType.QUICK_REPLY,
      metadata: { quickReplyType: payload.quickReplyType, value: payload.value },
    });
    const saved = await this.messageRepository.save(message);

    const room = `booking_${targetId}`;
    this.server.to(room).emit('new_message', {
      id: saved.id,
      content: saved.content,
      senderId: client.data.userId,
      senderName: client.data.userName,
      senderRole: client.data.user.role,
      messageType: MessageType.QUICK_REPLY,
      metadata: saved.metadata,
      createdAt: saved.createdAt,
      status: 'delivered',
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
      { isRead: true }
    );

    const room = `booking_${payload.bookingId}`;
    this.server.to(room).emit('messages_read', { bookingId: payload.bookingId });
  }

  // ==================== TYPING INDICATORS ====================

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: TypingPayload,
  ) {
    if (!client.data.userId) return;

    const room = payload.bookingId
      ? `booking_${payload.bookingId}`
      : payload.roomId;

    if (!room) return;

    this.server.to(room).emit('user_typing', {
      userId: client.data.userId,
      userName: client.data.userName,
      isTyping: payload.isTyping,
      bookingId: payload.bookingId,
      roomId: payload.roomId,
    });

    this.logger.debug(`User ${client.data.userId} typing: ${payload.isTyping} in room ${room}`);
  }

  // ==================== DIRECT CHAT ====================

  @SubscribeMessage('start_direct_chat')
  async handleStartDirectChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { providerId: string },
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
      providerName: `${provider.firstName || ''} ${provider.lastName || ''}`.trim(),
    });

    client.emit('direct_chat_started', {
      roomId: room,
      customerId: client.data.userId,
      providerId: provider.id,
      providerName: `${provider.firstName || ''} ${provider.lastName || ''}`.trim(),
    });
  }

  @SubscribeMessage('send_direct_message')
  async handleSendDirectMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { roomId: string; content: string; messageType?: string; metadata?: Record<string, any> },
  ) {
    if (!client.data.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const { roomId, content, messageType = DirectMessageType.TEXT, metadata } = payload;
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
      messageType: messageType as DirectMessageType,
      metadata,
    });
    const saved = await this.directMessageRepository.save(message);

    this.server.to(roomId).emit('new_direct_message', {
      id: saved.id,
      content: saved.content,
      senderId: client.data.userId,
      senderName: client.data.userName,
      senderRole: client.data.user.role,
      messageType: saved.messageType,
      metadata: saved.metadata,
      createdAt: saved.createdAt,
      status: 'delivered',
    });
  }

  @SubscribeMessage('send_direct_image')
  async handleSendDirectImage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { roomId: string; imageUrl: string; caption?: string },
  ) {
    if (!client.data.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const parts = payload.roomId.split('_');
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
      content: payload.caption || 'Sent an image',
      messageType: DirectMessageType.IMAGE,
      metadata: { imageUrl: payload.imageUrl },
    });
    const saved = await this.directMessageRepository.save(message);

    this.server.to(payload.roomId).emit('new_direct_message', {
      id: saved.id,
      content: saved.content,
      senderId: client.data.userId,
      senderName: client.data.userName,
      senderRole: client.data.user.role,
      messageType: DirectMessageType.IMAGE,
      metadata: saved.metadata,
      createdAt: saved.createdAt,
      status: 'delivered',
    });
  }

  @SubscribeMessage('send_direct_quote')
  async handleSendDirectQuote(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { roomId: string; amount: number; message?: string },
  ) {
    if (!client.data.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const parts = payload.roomId.split('_');
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
      content: payload.message || `Quote: ₹${payload.amount}`,
      messageType: DirectMessageType.QUOTE,
      metadata: { quoteAmount: payload.amount, accepted: false },
    });
    const saved = await this.directMessageRepository.save(message);

    this.server.to(payload.roomId).emit('new_direct_message', {
      id: saved.id,
      content: saved.content,
      senderId: client.data.userId,
      senderName: client.data.userName,
      senderRole: client.data.user.role,
      messageType: DirectMessageType.QUOTE,
      metadata: saved.metadata,
      createdAt: saved.createdAt,
      status: 'delivered',
    });
  }

  @SubscribeMessage('join_direct_chat')
  async handleJoinDirectChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { roomId: string },
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

    // Mark as read
    await this.directMessageRepository.update(
      { customer: { id: customerId }, provider: { id: providerId }, isRead: false },
      { isRead: true }
    );

    const messages = await this.directMessageRepository.find({
      where: [{ customer: { id: customerId }, provider: { id: providerId } }],
      relations: { sender: true },
      order: { createdAt: 'ASC' },
      take: 50,
    });

    client.emit('direct_chat_history', messages);
    this.server.to(room).emit('messages_read', { roomId: room });
  }

  // ==================== LOCATION SHARING ====================

  @SubscribeMessage('share_location')
  handleShareLocation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { bookingId: string; latitude: number; longitude: number },
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
    @MessageBody() payload: { bookingId: string; latitude: number; longitude: number },
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