import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Message, MessageType } from './entities/message.entity';
import {
  DirectMessage,
  DirectMessageType,
} from './entities/direct-message.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from '../users/entities/user.entity';
import { Provider } from '../users/entities/provider.entity';
import { Customer } from '../users/entities/customer.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { sanitizeText } from '../common/utils/input-sanitizer';
import { PresenceService } from './presence.service';
import { NotificationsService } from '../notifications/notifications.service';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    user: User;
    userName: string;
  };
}

interface HistoryMessage {
  id: string;
  content: string;
  sender: User;
  messageType: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  isRead: boolean;
  edited?: boolean;
  deleted?: boolean;
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
  quoteId?: string;
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/chat',
})
@Injectable()
export class ChatGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly messageCounts = new Map<string, number[]>();
  private readonly partnerIdCache = new Map<
    string,
    { ids: string[]; expiry: number }
  >();
  private static readonly PARTNER_CACHE_TTL = 60_000; // 60 seconds
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  private isRateLimited(userId: string): boolean {
    const now = Date.now();
    const windowMs = 60000;
    const maxMessages = 30;
    const timestamps = this.messageCounts.get(userId) || [];
    const recent = timestamps.filter((t) => now - t < windowMs);
    if (recent.length >= maxMessages) return true;
    recent.push(now);
    this.messageCounts.set(userId, recent);
    return false;
  }

  private registerSocket(userId: string, socketId: string) {
    this.presenceService.registerSocket(userId, socketId);
  }

  private unregisterSocket(userId: string, socketId: string) {
    this.presenceService.unregisterSocket(userId, socketId);
  }

  private emitToUser(
    userId: string,
    event: string,
    data: Record<string, unknown>,
  ) {
    const socketIds = this.presenceService.getSocketIds(userId);
    for (const socketId of socketIds) {
      this.server.to(socketId).emit(event, data);
    }
  }

  private isUserOnline(userId: string): boolean {
    return this.presenceService.isUserOnline(userId);
  }

  private async sendPushIfOffline(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
    recipientRole?: UserRole,
  ) {
    await this.pushNotificationsService.sendToUser(
      userId,
      title,
      body,
      data,
      recipientRole,
    );
  }

  private formatHistoryMessages(messages: HistoryMessage[]) {
    return messages.map((m) => {
      const sender = m.sender;
      let senderName = '';
      if (sender) {
        if (sender.customer) {
          senderName =
            `${sender.customer.firstName || ''} ${sender.customer.lastName || ''}`.trim();
        } else if (sender.provider) {
          senderName =
            `${sender.provider.firstName || ''} ${sender.provider.lastName || ''}`.trim();
        }
        // Fallback to role-based label instead of exposing phone number
        if (!senderName) {
          senderName = sender.role === 'provider' ? 'Provider' : 'Customer';
        }
      }
      return {
        id: m.id,
        content: (m as unknown as Record<string, unknown>)['deleted']
          ? 'This message was deleted'
          : m.content,
        senderId: sender?.id,
        senderName,
        senderRole: sender?.role || '',
        messageType: (m as unknown as Record<string, unknown>)['deleted']
          ? 'text'
          : m.messageType,
        metadata: m.metadata,
        createdAt: m.createdAt,
        status: m.isRead ? 'read' : 'delivered',
        isRead: m.isRead,
        edited: (m as unknown as Record<string, unknown>)['edited'] || false,
        deleted: (m as unknown as Record<string, unknown>)['deleted'] || false,
      };
    });
  }

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
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly jwtService: JwtService,
    private readonly pushNotificationsService: PushNotificationsService,
    private readonly presenceService: PresenceService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Socket.IO middleware — verifies JWT before any events are processed.
   * Runs before `handleConnection`, preventing the race condition where
   * client events (like `join`) could arrive before auth completes.
   */
  afterInit(server: Server) {
    // Clean up rate limit counters and partner cache every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [userId, timestamps] of this.messageCounts) {
        const recent = timestamps.filter((t) => now - t < 60000);
        if (recent.length === 0) {
          this.messageCounts.delete(userId);
        } else {
          this.messageCounts.set(userId, recent);
        }
      }
      for (const [key, cache] of this.partnerIdCache) {
        if (now > cache.expiry) {
          this.partnerIdCache.delete(key);
        }
      }
    }, 300_000);

    server.use((socket, next) => {
      const auth = socket.handshake.auth as Record<string, unknown>;
      const token =
        (auth?.token as string) ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('No token provided'));
      }

      let payload: { sub: string; phone: string; role: string };
      try {
        payload = this.jwtService.verify<{
          sub: string;
          phone: string;
          role: string;
        }>(token, { secret: process.env.JWT_SECRET });
      } catch (err) {
        return next(
          new Error(`Invalid token: ${(err as Error)?.message || err}`),
        );
      }

      this.userRepository
        .findOne({
          where: { id: payload.sub },
          relations: { customer: true, provider: true },
        })
        .then((user) => {
          if (!socket.connected) return;

          if (!user) {
            return next(new Error('User not found'));
          }

          (socket as AuthenticatedSocket).data.userId = user.id;
          (socket as AuthenticatedSocket).data.user = user;

          let displayName = user.phone;
          if (user.customer) {
            displayName =
              `${user.customer.firstName || ''} ${user.customer.lastName || ''}`.trim();
          } else if (user.provider) {
            displayName =
              `${user.provider.firstName || ''} ${user.provider.lastName || ''}`.trim();
          }
          (socket as AuthenticatedSocket).data.userName =
            displayName || user.phone;

          next();
        })
        .catch((err) => {
          next(new Error(`Invalid token: ${(err as Error)?.message || err}`));
        });
    });
  }

  private async markBookingNotificationsRead(
    userId: string,
    bookingId: string,
  ) {
    await this.notificationsService.markBookingNotificationsAsRead(
      userId,
      bookingId,
    );
  }

  private async getPartnerIds(userId: string): Promise<string[]> {
    const now = Date.now();
    const cached = this.partnerIdCache.get(userId);
    if (cached && now < cached.expiry) {
      return cached.ids;
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { customer: true, provider: true },
    });
    if (!user) return [];

    const partnerIds = new Set<string>();

    if (user.customer) {
      const customerBookings = await this.bookingRepository.find({
        where: { customer: { id: user.customer.id } },
        relations: { provider: { user: true } },
      });
      for (const b of customerBookings) {
        if (b.provider?.user?.id) partnerIds.add(b.provider.user.id);
      }
      const customerDms = await this.directMessageRepository.find({
        where: { customer: { id: user.customer.id } },
        relations: { provider: { user: true } },
      });
      for (const dm of customerDms) {
        if (dm.provider?.user?.id) partnerIds.add(dm.provider.user.id);
      }
    }

    if (user.provider) {
      const providerBookings = await this.bookingRepository.find({
        where: { provider: { id: user.provider.id } },
        relations: { customer: { user: true } },
      });
      for (const b of providerBookings) {
        if (b.customer?.user?.id) partnerIds.add(b.customer.user.id);
      }
      const providerDms = await this.directMessageRepository.find({
        where: { provider: { id: user.provider.id } },
        relations: { customer: { user: true } },
      });
      for (const dm of providerDms) {
        if (dm.customer?.user?.id) partnerIds.add(dm.customer.user.id);
      }
    }

    const ids = Array.from(partnerIds);
    this.partnerIdCache.set(userId, {
      ids,
      expiry: now + ChatGateway.PARTNER_CACHE_TTL,
    });
    return ids;
  }

  handleConnection(client: AuthenticatedSocket) {
    if (client.data.userId) {
      const userId = client.data.userId;
      const wasOffline = !this.isUserOnline(userId);

      this.registerSocket(userId, client.id);

      // Notify partners that this user is now online
      this.getPartnerIds(userId)
        .then((partnerIds) => {
          for (const pid of partnerIds) {
            this.emitToUser(pid, 'user_online', {
              userId,
            });
          }
          const onlinePartners = partnerIds.filter((pid) =>
            this.isUserOnline(pid),
          );
          client.emit('online_status', { onlineUserIds: onlinePartners });
        })
        .catch(() => {});

      // Global broadcast — used by provider list, customer home, etc.
      if (wasOffline) {
        this.server.emit('presence_update', { userId, online: true });
      }
    } else {
      this.logger.warn(
        `Client ${client.id} rejected: auth middleware did not set userId`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.data.userId) {
      const userId = client.data.userId;
      this.unregisterSocket(userId, client.id);

      if (!this.isUserOnline(userId)) {
        this.getPartnerIds(userId)
          .then((partnerIds) => {
            for (const pid of partnerIds) {
              this.emitToUser(pid, 'user_offline', { userId });
            }
          })
          .catch(() => {});

        // Global broadcast
        this.server.emit('presence_update', { userId, online: false });
      }
    }
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // ==================== BOOKING-BASED CHAT ====================

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { bookingId: string },
  ) {
    try {
      if (!client.data.userId) {
        client.emit('error', { message: 'Unauthorized' });
        return;
      }

      if (!payload.bookingId) return;

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

      if (!client.connected) return;

      const room = `booking_${payload.bookingId}`;
      void client.join(room);

      // Get unread IDs before marking as read (exclude own messages)
      const unreadMessages = await this.messageRepository.find({
        where: { booking: { id: payload.bookingId }, isRead: false },
        select: { id: true, sender: { id: true } },
        relations: { sender: true },
      });
      const otherUnreadIds = unreadMessages
        .filter((m) => m.sender?.id !== client.data.userId)
        .map((m) => m.id);

      if (otherUnreadIds.length > 0) {
        await this.messageRepository.update(
          { id: In(otherUnreadIds) },
          { isRead: true },
        );
      }

      const messages = await this.messageRepository.find({
        where: { booking: { id: payload.bookingId } },
        relations: { sender: { customer: true, provider: true } },
        order: { createdAt: 'ASC' },
        take: 50,
      });

      // Filter system messages by targetRole so each user only sees messages meant for their role
      const userRole = client.data.user?.role;
      const filteredMessages = userRole
        ? messages.filter((m) => {
            const targetRole = m.metadata?.targetRole;
            if (!targetRole) return true;
            return targetRole === userRole.toLowerCase();
          })
        : messages;

      // Mark related in-app notifications as read
      this.markBookingNotificationsRead(
        client.data.userId,
        payload.bookingId,
      ).catch(() => {});

      client.emit('history', this.formatHistoryMessages(filteredMessages));
      client.emit('messages_read', {
        bookingId: payload.bookingId,
        messageIds: otherUnreadIds,
      });
    } catch (err) {
      this.logger.error(
        `[JOIN] Error in handleJoin: ${(err as Error)?.message}`,
        (err as Error)?.stack,
      );
      client.emit('error', { message: 'Join failed: internal server error' });
    }
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    payload: {
      bookingId: string;
      content: string;
      messageType?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    if (!client.data.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    if (this.isRateLimited(client.data.userId)) {
      client.emit('error', {
        message: 'Rate limit exceeded. Please slow down.',
      });
      return;
    }

    const {
      bookingId,
      content: rawContent,
      messageType = MessageType.TEXT,
      metadata,
    } = payload;
    const content = sanitizeText(rawContent);
    if (!bookingId || !content) return;

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
    const messageData = {
      id: saved.id,
      content: saved.content,
      senderId: client.data.userId,
      senderName: client.data.userName,
      senderRole: client.data.user.role,
      messageType: saved.messageType,
      metadata: saved.metadata,
      createdAt: saved.createdAt,
      status: 'delivered',
    };

    const room = `booking_${bookingId}`;
    this.server.to(room).emit('new_message', messageData);

    // Also emit directly to the other participant's sockets as fallback
    const otherUserId =
      booking.customer?.user?.id === client.data.userId
        ? booking.provider?.user?.id
        : booking.customer?.user?.id;
    if (otherUserId) {
      this.emitToUser(otherUserId, 'new_message', messageData);
      const recipientRole: UserRole =
        booking.customer?.user?.id === otherUserId
          ? UserRole.CUSTOMER
          : UserRole.PROVIDER;
      await this.sendPushIfOffline(
        otherUserId,
        'New message',
        content,
        {
          bookingId,
          roomId: `booking_${bookingId}`,
          type: 'chat_message',
          senderName: client.data.userName,
        },
        recipientRole,
      );
    }
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

    const otherUserId =
      booking.customer?.user?.id === client.data.userId
        ? booking.provider?.user?.id
        : booking.customer?.user?.id;
    if (otherUserId) {
      const recipientRole: UserRole =
        booking.customer?.user?.id === otherUserId
          ? UserRole.CUSTOMER
          : UserRole.PROVIDER;
      await this.sendPushIfOffline(
        otherUserId,
        'New image',
        'Sent an image',
        {
          bookingId: payload.bookingId,
          roomId: `booking_${payload.bookingId}`,
          type: 'chat_image',
          senderName: client.data.userName,
        },
        recipientRole,
      );
    }
  }

  @SubscribeMessage('send_file')
  async handleSendFile(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    payload: {
      bookingId: string;
      fileUrl: string;
      fileName: string;
      fileType: string;
      fileSize: number;
    },
  ) {
    if (!client.data.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    if (!payload.bookingId || !payload.fileUrl) {
      client.emit('error', { message: 'bookingId and fileUrl are required' });
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

    const content = `Sent a ${payload.fileType}`;
    const message = this.messageRepository.create({
      booking: { id: payload.bookingId } as Booking,
      sender: { id: client.data.userId } as User,
      content,
      messageType: MessageType.DOCUMENT,
      metadata: {
        fileUrl: payload.fileUrl,
        fileName: payload.fileName,
        fileType: payload.fileType,
        fileSize: payload.fileSize,
      },
    });
    const saved = await this.messageRepository.save(message);

    const room = `booking_${payload.bookingId}`;
    this.server.to(room).emit('new_message', {
      id: saved.id,
      content: saved.content,
      senderId: client.data.userId,
      senderName: client.data.userName,
      senderRole: client.data.user.role,
      messageType: MessageType.DOCUMENT,
      metadata: saved.metadata,
      createdAt: saved.createdAt,
      status: 'delivered',
    });

    const otherUserId =
      booking.customer?.user?.id === client.data.userId
        ? booking.provider?.user?.id
        : booking.customer?.user?.id;
    if (otherUserId) {
      const recipientRole: UserRole =
        booking.customer?.user?.id === otherUserId
          ? UserRole.CUSTOMER
          : UserRole.PROVIDER;
      await this.sendPushIfOffline(
        otherUserId,
        'New file',
        content,
        {
          bookingId: payload.bookingId,
          roomId: `booking_${payload.bookingId}`,
          type: 'chat_file',
          senderName: client.data.userName,
        },
        recipientRole,
      );
    }
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

    const isDirect = targetId.startsWith('direct_');
    const content = payload.message || `Quote: ₹${payload.amount}`;

    if (isDirect) {
      const parts = targetId.split('_');
      const customerUserId = parts[1];
      const providerId = parts[2];

      const customerEntity = await this.customerRepository.findOne({
        where: { user: { id: customerUserId } },
      });
      if (!customerEntity) {
        client.emit('error', { message: 'Customer not found' });
        return;
      }

      const message = this.directMessageRepository.create({
        customer: { id: customerEntity.id } as Customer,
        provider: { id: providerId } as Provider,
        sender: { id: client.data.userId } as User,
        content,
        messageType: DirectMessageType.QUOTE,
        metadata: { quoteAmount: payload.amount, accepted: false },
      });
      const saved = await this.directMessageRepository.save(message);

      this.server.to(targetId).emit('new_direct_message', {
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

      let directNotifyUserId: string | null = null;
      if (customerUserId === client.data.userId) {
        const provider = await this.providerRepository.findOne({
          where: { id: providerId },
          relations: { user: true },
        });
        directNotifyUserId = provider?.user?.id ?? null;
      } else {
        directNotifyUserId = customerUserId;
      }
      if (directNotifyUserId) {
        // For direct messages, the recipient role is opposite of the sender
        const recipientRole: UserRole =
          client.data.userId === customerUserId
            ? UserRole.PROVIDER
            : UserRole.CUSTOMER;
        await this.sendPushIfOffline(
          directNotifyUserId,
          'New quote',
          content,
          {
            roomId: targetId,
            providerId,
            type: 'chat_quote',
            senderName: client.data.userName,
          },
          recipientRole,
        );
      }
    } else {
      const message = this.messageRepository.create({
        booking: { id: targetId } as Booking,
        sender: { id: client.data.userId } as User,
        content,
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

      const quoteBooking = await this.bookingRepository.findOne({
        where: { id: targetId },
        relations: { customer: { user: true }, provider: { user: true } },
      });
      if (quoteBooking) {
        const quoteOtherUserId =
          quoteBooking.customer?.user?.id === client.data.userId
            ? quoteBooking.provider?.user?.id
            : quoteBooking.customer?.user?.id;
        if (quoteOtherUserId) {
          const recipientRole: UserRole =
            quoteBooking.customer?.user?.id === quoteOtherUserId
              ? UserRole.CUSTOMER
              : UserRole.PROVIDER;
          await this.sendPushIfOffline(
            quoteOtherUserId,
            'New quote',
            content,
            {
              bookingId: targetId,
              roomId: `booking_${targetId}`,
              type: 'chat_quote',
              senderName: client.data.userName,
            },
            recipientRole,
          );
        }
      }
    }
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

    const senderRole = client.data.user?.role;

    const quickReplyMessages: Record<
      string,
      { customer: string; provider: string }
    > = {
      accept_quote: {
        customer: 'I accept this quote',
        provider: 'Quote accepted',
      },
      decline_quote: {
        customer: 'I decline this quote',
        provider: 'Quote declined',
      },
      need_discount: {
        customer: 'Can you give a discount?',
        provider: 'Discount not available',
      },
      confirm_booking: {
        customer: 'Please confirm my booking',
        provider: 'Please confirm the booking',
      },
      need_more_info: {
        customer: 'I need more information',
        provider: 'Let me know if you need more info',
      },
      price_negotiate: {
        customer: 'Can we negotiate on price?',
        provider: 'Feel free to discuss pricing',
      },
      reschedule: {
        customer: 'Can we reschedule?',
        provider: 'Can we reschedule?',
      },
      on_my_way: {
        customer: 'The provider is on the way',
        provider: "I'm on my way",
      },
      work_started: {
        customer: 'Work has been started',
        provider: 'Work has started',
      },
      when_available: {
        customer: 'When are you available?',
        provider: 'I am available now',
      },
    };

    const templates = quickReplyMessages[payload.quickReplyType];
    const content = templates
      ? senderRole === 'provider'
        ? templates.provider
        : templates.customer
      : payload.value || payload.quickReplyType;
    const isDirect = targetId.startsWith('direct_');

    if (isDirect) {
      const parts = targetId.split('_');
      const customerUserId = parts[1];
      const providerId = parts[2];

      const customerEntity = await this.customerRepository.findOne({
        where: { user: { id: customerUserId } },
      });
      if (!customerEntity) {
        client.emit('error', { message: 'Customer not found' });
        return;
      }

      const message = this.directMessageRepository.create({
        customer: { id: customerEntity.id } as Customer,
        provider: { id: providerId } as Provider,
        sender: { id: client.data.userId } as User,
        content,
        messageType: DirectMessageType.QUICK_REPLY,
        metadata: {
          quickReplyType: payload.quickReplyType,
          value: payload.value,
        },
      });
      const saved = await this.directMessageRepository.save(message);

      this.server.to(targetId).emit('new_direct_message', {
        id: saved.id,
        content: saved.content,
        senderId: client.data.userId,
        senderName: client.data.userName,
        senderRole: client.data.user.role,
        messageType: DirectMessageType.QUICK_REPLY,
        metadata: saved.metadata,
        createdAt: saved.createdAt,
        status: 'delivered',
      });

      // Mark original quote as accepted
      if (payload.quickReplyType === 'accept_quote' && payload.quoteId) {
        await this.directMessageRepository.update(
          { id: payload.quoteId },
          { metadata: { ...(saved.metadata || {}), accepted: true } },
        );
        // Re-emit the updated quote so both sides see the change
        const updatedQuote = await this.directMessageRepository.findOne({
          where: { id: payload.quoteId },
        });
        if (updatedQuote) {
          this.server.to(targetId).emit('message_updated', {
            id: updatedQuote.id,
            metadata: updatedQuote.metadata,
          });
        }
      }

      let qrNotifyUserId: string | null = null;
      if (customerUserId === client.data.userId) {
        const provider = await this.providerRepository.findOne({
          where: { id: providerId },
          relations: { user: true },
        });
        qrNotifyUserId = provider?.user?.id ?? null;
      } else {
        qrNotifyUserId = customerUserId;
      }
      if (qrNotifyUserId) {
        const recipientRole: UserRole =
          client.data.userId === customerUserId
            ? UserRole.PROVIDER
            : UserRole.CUSTOMER;
        await this.sendPushIfOffline(
          qrNotifyUserId,
          'Quick reply',
          content,
          {
            roomId: targetId,
            providerId: providerId,
            type: 'chat_quick_reply',
            senderName: client.data.userName,
          },
          recipientRole,
        );
      }
    } else {
      const message = this.messageRepository.create({
        booking: { id: targetId } as Booking,
        sender: { id: client.data.userId } as User,
        content,
        messageType: MessageType.QUICK_REPLY,
        metadata: {
          quickReplyType: payload.quickReplyType,
          value: payload.value,
        },
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

      // Mark original quote as accepted (booking path)
      if (payload.quickReplyType === 'accept_quote' && payload.quoteId) {
        await this.messageRepository.update(
          { id: payload.quoteId },
          { metadata: { ...(saved.metadata || {}), accepted: true } },
        );
        const updatedQuote = await this.messageRepository.findOne({
          where: { id: payload.quoteId },
        });
        if (updatedQuote) {
          this.server.to(room).emit('message_updated', {
            id: updatedQuote.id,
            metadata: updatedQuote.metadata,
          });
        }
      }

      const qrBooking = await this.bookingRepository.findOne({
        where: { id: targetId },
        relations: { customer: { user: true }, provider: { user: true } },
      });
      if (qrBooking) {
        const qrOtherUserId =
          qrBooking.customer?.user?.id === client.data.userId
            ? qrBooking.provider?.user?.id
            : qrBooking.customer?.user?.id;
        if (qrOtherUserId) {
          const recipientRole: UserRole =
            qrBooking.customer?.user?.id === qrOtherUserId
              ? UserRole.CUSTOMER
              : UserRole.PROVIDER;
          await this.sendPushIfOffline(
            qrOtherUserId,
            'Quick reply',
            content,
            {
              bookingId: targetId,
              roomId: `booking_${targetId}`,
              type: 'chat_quick_reply',
              senderName: client.data.userName,
            },
            recipientRole,
          );
        }
      }
    }
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { bookingId?: string; roomId?: string },
  ) {
    if (!client.data.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    // Handle direct chat read receipts
    if (payload.roomId) {
      const parts = payload.roomId.split('_');
      if (parts.length === 3 && parts[0] === 'direct') {
        const customerUserId = parts[1];
        const providerId = parts[2];

        const customerEntity = await this.customerRepository.findOne({
          where: { user: { id: customerUserId } },
        });
        if (!customerEntity) return;

        const unreadDms = await this.directMessageRepository.find({
          where: {
            customer: { id: customerEntity.id },
            provider: { id: providerId },
            isRead: false,
          },
          select: { id: true, sender: { id: true } },
          relations: { sender: true },
        });
        const otherUnreadIds = unreadDms
          .filter((m) => m.sender?.id !== client.data.userId)
          .map((m) => m.id);
        if (otherUnreadIds.length > 0) {
          await this.directMessageRepository.update(
            { id: In(otherUnreadIds) },
            { isRead: true },
          );
        }
        this.server.to(payload.roomId).emit('messages_read', {
          roomId: payload.roomId,
          messageIds: otherUnreadIds,
        });
      }
      return;
    }

    // Handle booking chat read receipts
    if (payload.bookingId) {
      const unreadBookingMessages = await this.messageRepository.find({
        where: { booking: { id: payload.bookingId }, isRead: false },
        select: { id: true, sender: { id: true } },
        relations: { sender: true },
      });
      const otherUnreadIds = unreadBookingMessages
        .filter((m) => m.sender?.id !== client.data.userId)
        .map((m) => m.id);
      if (otherUnreadIds.length > 0) {
        await this.messageRepository.update(
          { id: In(otherUnreadIds) },
          { isRead: true },
        );
      }
      const room = `booking_${payload.bookingId}`;
      this.server.to(room).emit('messages_read', {
        bookingId: payload.bookingId,
        messageIds: otherUnreadIds,
      });
    }
  }

  // ==================== PUBLIC API FOR OTHER SERVICES ====================

  /**
   * Emit role-specific system messages to each participant in a booking chat.
   * Each user (customer/provider) receives a message tailored to their perspective.
   * Saves two separate messages with targetRole metadata and emits via private user sockets.
   */
  async emitRoleSpecificSystemMessage(
    bookingId: string,
    customerUserId: string,
    providerUserId: string,
    customerContent: string,
    providerContent: string,
    metadata: Record<string, unknown> = {},
  ) {
    const baseMeta = { system: true, ...metadata };

    // Save customer-perspective message
    const customerMsg = await this.messageRepository.save(
      this.messageRepository.create({
        booking: { id: bookingId } as Booking,
        sender: { id: customerUserId } as User,
        content: customerContent,
        messageType: MessageType.TEXT,
        metadata: { ...baseMeta, targetRole: 'customer' },
      }),
    );

    // Save provider-perspective message
    const providerMsg = await this.messageRepository.save(
      this.messageRepository.create({
        booking: { id: bookingId } as Booking,
        sender: { id: providerUserId } as User,
        content: providerContent,
        messageType: MessageType.TEXT,
        metadata: { ...baseMeta, targetRole: 'provider' },
      }),
    );

    // Emit to customer privately
    this.emitToUser(customerUserId, 'new_message', {
      id: customerMsg.id,
      content: customerMsg.content,
      senderId: 'system',
      senderName: 'System',
      senderRole: 'system',
      messageType: customerMsg.messageType,
      metadata: customerMsg.metadata,
      createdAt: customerMsg.createdAt,
      status: 'delivered',
    });

    // Emit to provider privately
    this.emitToUser(providerUserId, 'new_message', {
      id: providerMsg.id,
      content: providerMsg.content,
      senderId: 'system',
      senderName: 'System',
      senderRole: 'system',
      messageType: providerMsg.messageType,
      metadata: providerMsg.metadata,
      createdAt: providerMsg.createdAt,
      status: 'delivered',
    });
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

    const callerRole = client.data.user?.role;
    const isCallerProvider = callerRole === UserRole.PROVIDER;

    let provider: Provider | null = null;
    let partnerUserId: string;

    if (isCallerProvider) {
      const partner = await this.userRepository.findOne({
        where: { id: payload.providerId },
        relations: { customer: true, provider: true },
      });
      if (!partner) {
        client.emit('error', { message: 'Chat partner not found' });
        return;
      }
      if (!partner.customer) {
        client.emit('error', { message: 'Chat partner is not a customer' });
        return;
      }
      provider = await this.providerRepository.findOne({
        where: { user: { id: client.data.userId } },
        relations: { user: true },
      });
      if (!provider) {
        client.emit('error', { message: 'Provider profile not found' });
        return;
      }
      partnerUserId = partner.id;
    } else {
      provider = await this.providerRepository.findOne({
        where: { id: payload.providerId },
        relations: { user: true },
      });
      if (!provider) {
        provider = await this.providerRepository.findOne({
          where: { user: { id: payload.providerId } },
          relations: { user: true },
        });
      }
      if (!provider) {
        client.emit('error', { message: 'Provider not found' });
        return;
      }
      partnerUserId = client.data.userId;
    }

    const customerUserId = isCallerProvider
      ? partnerUserId
      : client.data.userId;
    const providerEntityId = provider.id;
    const providerName =
      `${provider.firstName || ''} ${provider.lastName || ''}`.trim();

    const room = `direct_${customerUserId}_${providerEntityId}`;
    void client.join(room);

    const payloadOut = {
      roomId: room,
      customerId: customerUserId,
      providerId: providerEntityId,
      providerName,
    };

    this.server.to(room).emit('direct_chat_started', payloadOut);
    client.emit('direct_chat_started', payloadOut);
  }

  @SubscribeMessage('send_direct_message')
  async handleSendDirectMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    payload: {
      roomId: string;
      content: string;
      messageType?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    if (!client.data.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    if (this.isRateLimited(client.data.userId)) {
      client.emit('error', {
        message: 'Rate limit exceeded. Please slow down.',
      });
      return;
    }

    const {
      roomId,
      content: rawContent,
      messageType = DirectMessageType.TEXT,
      metadata,
    } = payload;
    const content = sanitizeText(rawContent);
    if (!content) return;

    const parts = roomId.split('_');
    if (parts.length !== 3 || parts[0] !== 'direct') {
      client.emit('error', { message: 'Invalid room ID format' });
      return;
    }
    const customerUserId = parts[1];
    const providerId = parts[2];

    const customerEntity = await this.customerRepository.findOne({
      where: { user: { id: customerUserId } },
    });
    if (!customerEntity) {
      client.emit('error', { message: 'Customer not found' });
      return;
    }

    const message = this.directMessageRepository.create({
      customer: { id: customerEntity.id } as Customer,
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

    let dmNotifyUserId: string | null = null;
    if (customerUserId === client.data.userId) {
      const provider = await this.providerRepository.findOne({
        where: { id: providerId },
        relations: { user: true },
      });
      dmNotifyUserId = provider?.user?.id ?? null;
    } else {
      dmNotifyUserId = customerUserId;
    }
    if (dmNotifyUserId) {
      const recipientRole: UserRole =
        client.data.userId === customerUserId
          ? UserRole.PROVIDER
          : UserRole.CUSTOMER;
      await this.sendPushIfOffline(
        dmNotifyUserId,
        'New message',
        content,
        {
          roomId,
          providerId,
          type: 'direct_message',
          senderName: client.data.userName,
        },
        recipientRole,
      );
    }
  }

  @SubscribeMessage('send_direct_image')
  async handleSendDirectImage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    payload: { roomId: string; imageUrl: string; caption?: string },
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
    const customerUserId = parts[1];
    const providerId = parts[2];

    const customerEntity = await this.customerRepository.findOne({
      where: { user: { id: customerUserId } },
    });
    if (!customerEntity) {
      client.emit('error', { message: 'Customer not found' });
      return;
    }

    const message = this.directMessageRepository.create({
      customer: { id: customerEntity.id } as Customer,
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

    let imgNotifyUserId: string | null = null;
    if (customerUserId === client.data.userId) {
      const provider = await this.providerRepository.findOne({
        where: { id: providerId },
        relations: { user: true },
      });
      imgNotifyUserId = provider?.user?.id ?? null;
    } else {
      imgNotifyUserId = customerUserId;
    }
    if (imgNotifyUserId) {
      const recipientRole: UserRole =
        client.data.userId === customerUserId
          ? UserRole.PROVIDER
          : UserRole.CUSTOMER;
      await this.sendPushIfOffline(
        imgNotifyUserId,
        'New image',
        'Sent an image',
        {
          roomId: payload.roomId,
          providerId,
          type: 'direct_image',
          senderName: client.data.userName,
        },
        recipientRole,
      );
    }
  }

  @SubscribeMessage('send_direct_file')
  async handleSendDirectFile(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    payload: {
      roomId: string;
      fileUrl: string;
      fileName: string;
      fileType: string;
      fileSize: number;
    },
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
    const customerUserId = parts[1];
    const providerId = parts[2];

    const customerEntity = await this.customerRepository.findOne({
      where: { user: { id: customerUserId } },
    });
    if (!customerEntity) {
      client.emit('error', { message: 'Customer not found' });
      return;
    }

    const content = `Sent a ${payload.fileType}`;
    const message = this.directMessageRepository.create({
      customer: { id: customerEntity.id } as Customer,
      provider: { id: providerId } as Provider,
      sender: { id: client.data.userId } as User,
      content,
      messageType: DirectMessageType.DOCUMENT,
      metadata: {
        fileUrl: payload.fileUrl,
        fileName: payload.fileName,
        fileType: payload.fileType,
        fileSize: payload.fileSize,
      },
    });
    const saved = await this.directMessageRepository.save(message);

    this.server.to(payload.roomId).emit('new_direct_message', {
      id: saved.id,
      content: saved.content,
      senderId: client.data.userId,
      senderName: client.data.userName,
      senderRole: client.data.user.role,
      messageType: DirectMessageType.DOCUMENT,
      metadata: saved.metadata,
      createdAt: saved.createdAt,
      status: 'delivered',
    });

    let fileNotifyUserId: string | null = null;
    if (customerUserId === client.data.userId) {
      const provider = await this.providerRepository.findOne({
        where: { id: providerId },
        relations: { user: true },
      });
      fileNotifyUserId = provider?.user?.id ?? null;
    } else {
      fileNotifyUserId = customerUserId;
    }
    if (fileNotifyUserId) {
      const recipientRole: UserRole =
        client.data.userId === customerUserId
          ? UserRole.PROVIDER
          : UserRole.CUSTOMER;
      await this.sendPushIfOffline(
        fileNotifyUserId,
        'New file',
        content,
        {
          roomId: payload.roomId,
          providerId,
          type: 'direct_file',
          senderName: client.data.userName,
        },
        recipientRole,
      );
    }
  }

  @SubscribeMessage('send_direct_quote')
  async handleSendDirectQuote(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    payload: { roomId: string; amount: number; message?: string },
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
    const customerUserId = parts[1];
    const providerId = parts[2];

    const customerEntity = await this.customerRepository.findOne({
      where: { user: { id: customerUserId } },
    });
    if (!customerEntity) {
      client.emit('error', { message: 'Customer not found' });
      return;
    }

    const message = this.directMessageRepository.create({
      customer: { id: customerEntity.id } as Customer,
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

    let quoteNotifyUserId: string | null = null;
    if (customerUserId === client.data.userId) {
      const provider = await this.providerRepository.findOne({
        where: { id: providerId },
        relations: { user: true },
      });
      quoteNotifyUserId = provider?.user?.id ?? null;
    } else {
      quoteNotifyUserId = customerUserId;
    }
    if (quoteNotifyUserId) {
      const recipientRole: UserRole =
        client.data.userId === customerUserId
          ? UserRole.PROVIDER
          : UserRole.CUSTOMER;
      await this.sendPushIfOffline(
        quoteNotifyUserId,
        'New quote',
        payload.message || `Quote: ₹${payload.amount}`,
        {
          roomId: payload.roomId,
          providerId,
          type: 'direct_quote',
          senderName: client.data.userName,
        },
        recipientRole,
      );
    }
  }

  @SubscribeMessage('join_direct_chat')
  async handleJoinDirectChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { roomId: string },
  ) {
    try {
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
      const customerUserId = parts[1];
      const providerId = parts[2];

      const customerEntity = await this.customerRepository.findOne({
        where: { user: { id: customerUserId } },
      });
      if (!customerEntity) {
        client.emit('error', { message: 'Customer not found' });
        return;
      }

      if (!client.connected) {
        return;
      }

      void client.join(room);

      // Get unread IDs before marking as read
      const unreadDirectMessages = await this.directMessageRepository.find({
        where: {
          customer: { id: customerEntity.id },
          provider: { id: providerId },
          isRead: false,
        },
        select: { id: true },
      });
      const unreadIds = unreadDirectMessages.map((m) => m.id);

      if (unreadIds.length > 0) {
        await this.directMessageRepository.update(
          {
            customer: { id: customerEntity.id },
            provider: { id: providerId },
            isRead: false,
          },
          { isRead: true },
        );
      }

      const messages = await this.directMessageRepository.find({
        where: [
          { customer: { id: customerEntity.id }, provider: { id: providerId } },
        ],
        relations: { sender: true },
        order: { createdAt: 'ASC' },
        take: 50,
      });

      client.emit('direct_chat_history', this.formatHistoryMessages(messages));
      this.server
        .to(room)
        .emit('messages_read', { roomId: room, messageIds: unreadIds });
    } catch (err) {
      this.logger.error(
        `[JOIN_DIRECT] Error in handleJoinDirectChat: ${(err as Error)?.message}`,
        (err as Error)?.stack,
      );
      client.emit('error', {
        message: 'Join direct chat failed: internal server error',
      });
    }
  }

  // ==================== EDIT & DELETE MESSAGES ====================

  @SubscribeMessage('edit_message')
  async handleEditMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    payload: {
      messageId: string;
      content: string;
      bookingId?: string;
      roomId?: string;
    },
  ) {
    if (!client.data.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    if (this.isRateLimited(client.data.userId)) {
      client.emit('error', {
        message: 'Rate limit exceeded. Please slow down.',
      });
      return;
    }

    if (!payload.content?.trim()) return;

    const content = sanitizeText(payload.content);
    if (!content) return;

    const isDirect = !!payload.roomId;

    if (isDirect) {
      const msg = await this.directMessageRepository.findOne({
        where: { id: payload.messageId },
        relations: { sender: true },
      });
      if (!msg) {
        client.emit('error', { message: 'Message not found' });
        return;
      }
      if (msg.sender.id !== client.data.userId) {
        client.emit('error', { message: 'Cannot edit other users messages' });
        return;
      }
      if (msg.messageType !== DirectMessageType.TEXT) {
        client.emit('error', { message: 'Only text messages can be edited' });
        return;
      }

      msg.content = content;
      msg.edited = true;
      await this.directMessageRepository.save(msg);

      this.server.to(payload.roomId!).emit('message_edited', {
        id: msg.id,
        content: msg.content,
        edited: true,
        roomId: payload.roomId,
      });
    } else if (payload.bookingId) {
      const msg = await this.messageRepository.findOne({
        where: { id: payload.messageId },
        relations: { sender: true },
      });
      if (!msg) {
        client.emit('error', { message: 'Message not found' });
        return;
      }
      if (msg.sender.id !== client.data.userId) {
        client.emit('error', { message: 'Cannot edit other users messages' });
        return;
      }
      if (msg.messageType !== MessageType.TEXT) {
        client.emit('error', { message: 'Only text messages can be edited' });
        return;
      }

      msg.content = content;
      msg.edited = true;
      await this.messageRepository.save(msg);

      const room = `booking_${payload.bookingId}`;
      this.server.to(room).emit('message_edited', {
        id: msg.id,
        content: msg.content,
        edited: true,
        bookingId: payload.bookingId,
      });
    }
  }

  @SubscribeMessage('delete_message')
  async handleDeleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    payload: {
      messageId: string;
      bookingId?: string;
      roomId?: string;
    },
  ) {
    if (!client.data.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    if (this.isRateLimited(client.data.userId)) {
      client.emit('error', {
        message: 'Rate limit exceeded. Please slow down.',
      });
      return;
    }

    const isDirect = !!payload.roomId;

    if (isDirect) {
      const msg = await this.directMessageRepository.findOne({
        where: { id: payload.messageId },
        relations: { sender: true },
      });
      if (!msg) {
        client.emit('error', { message: 'Message not found' });
        return;
      }
      if (msg.sender.id !== client.data.userId) {
        client.emit('error', { message: 'Cannot delete other users messages' });
        return;
      }

      msg.deleted = true;
      msg.content = 'This message was deleted';
      await this.directMessageRepository.save(msg);

      this.server.to(payload.roomId!).emit('message_deleted', {
        id: msg.id,
        roomId: payload.roomId,
      });
    } else if (payload.bookingId) {
      const msg = await this.messageRepository.findOne({
        where: { id: payload.messageId },
        relations: { sender: true },
      });
      if (!msg) {
        client.emit('error', { message: 'Message not found' });
        return;
      }
      if (msg.sender.id !== client.data.userId) {
        client.emit('error', { message: 'Cannot delete other users messages' });
        return;
      }

      msg.deleted = true;
      msg.content = 'This message was deleted';
      await this.messageRepository.save(msg);

      const room = `booking_${payload.bookingId}`;
      this.server.to(room).emit('message_deleted', {
        id: msg.id,
        bookingId: payload.bookingId,
      });
    }
  }

  // ==================== LOCATION SHARING ====================

  @SubscribeMessage('share_location')
  handleShareLocation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    payload: { bookingId: string; latitude: number; longitude: number },
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
    @MessageBody()
    payload: { bookingId: string; latitude: number; longitude: number },
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
