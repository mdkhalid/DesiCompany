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
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly userSockets = new Map<string, Set<string>>();
  private readonly messageCounts = new Map<string, number[]>();

  private isRateLimited(userId: string): boolean {
    const now = Date.now();
    const windowMs = 60000;
    const maxMessages = 30;
    const timestamps = this.messageCounts.get(userId) || [];
    const recent = timestamps.filter(t => now - t < windowMs);
    if (recent.length >= maxMessages) return true;
    recent.push(now);
    this.messageCounts.set(userId, recent);
    return false;
  }

  private registerSocket(userId: string, socketId: string) {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);
  }

  private unregisterSocket(userId: string, socketId: string) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }

  private emitToUser(
    userId: string,
    event: string,
    data: Record<string, unknown>,
  ) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      for (const socketId of sockets) {
        this.server.to(socketId).emit(event, data);
      }
    }
  }

  private isUserOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return !!sockets && sockets.size > 0;
  }

  private async sendPushIfOffline(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    if (!this.isUserOnline(userId)) {
      await this.pushNotificationsService.sendToUser(userId, title, body, data);
    }
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
        if (!senderName) senderName = sender.phone;
      }
      return {
        id: m.id,
        content: (m as unknown as Record<string, unknown>)['deleted'] ? 'This message was deleted' : m.content,
        senderId: sender?.id,
        senderName,
        senderRole: sender?.role || '',
        messageType: (m as unknown as Record<string, unknown>)['deleted'] ? 'text' : m.messageType,
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
  ) {}

  /**
   * Socket.IO middleware — verifies JWT before any events are processed.
   * Runs before `handleConnection`, preventing the race condition where
   * client events (like `join`) could arrive before auth completes.
   */
  afterInit(server: Server) {
    server.use((socket, next) => {
      const auth = socket.handshake.auth as Record<string, unknown>;
      const token =
        (auth?.token as string) ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('No token provided'));
      }

      const payload = this.jwtService.verify<{
        sub: string;
        phone: string;
        role: string;
      }>(token);

      this.userRepository
        .findOne({
          where: { id: payload.sub },
          relations: { customer: true, provider: true },
        })
        .then((user) => {
          if (!user) {
            return next(new Error('User not found'));
          }

          // Set auth data BEFORE connection event — handlers can rely on it immediately
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

  handleConnection(client: AuthenticatedSocket) {
    // Auth already verified by middleware in afterInit — just register and log
    if (client.data.userId) {
      this.registerSocket(client.data.userId, client.id);
      this.logger.log(
        `Client connected: ${client.id} (user: ${client.data.userId})`,
      );
    } else {
      this.logger.warn(
        `Client ${client.id} rejected: auth middleware did not set userId`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.data.userId) {
      this.unregisterSocket(client.data.userId, client.id);
    }
    this.logger.log(`Client disconnected: ${client.id}`);
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

      const room = `booking_${payload.bookingId}`;
      void client.join(room);

      // Get unread IDs before marking as read
      const unreadMessages = await this.messageRepository.find({
        where: { booking: { id: payload.bookingId }, isRead: false },
        select: { id: true },
      });
      const unreadIds = unreadMessages.map((m) => m.id);

      if (unreadIds.length > 0) {
        await this.messageRepository.update(
          { booking: { id: payload.bookingId }, isRead: false },
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

      client.emit('history', this.formatHistoryMessages(filteredMessages));
      client.emit('messages_read', {
        bookingId: payload.bookingId,
        messageIds: unreadIds,
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
      client.emit('error', { message: 'Rate limit exceeded. Please slow down.' });
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
      await this.sendPushIfOffline(
        otherUserId,
        'New message',
        content,
        { bookingId, type: 'chat_message' },
      );
      this.logger.log(
        `[MSG] Sent to room=${room} + direct to user=${otherUserId}`,
      );
    } else {
      this.logger.log(`[MSG] Sent to room=${room} (no other user found)`);
    }

    this.logger.log(
      `Message saved in booking ${bookingId} by user ${client.data.userId}`,
    );
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
      await this.sendPushIfOffline(
        otherUserId,
        'New image',
        'Sent an image',
        { bookingId: payload.bookingId, type: 'chat_image' },
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
      await this.sendPushIfOffline(
        otherUserId,
        'New file',
        content,
        { bookingId: payload.bookingId, type: 'chat_file' },
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
        await this.sendPushIfOffline(
          directNotifyUserId,
          'New quote',
          content,
          { roomId: targetId, type: 'chat_quote' },
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
          await this.sendPushIfOffline(
            quoteOtherUserId,
            'New quote',
            content,
            { bookingId: targetId, type: 'chat_quote' },
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

    const quickReplyMessages: Record<string, string> = {
      accept_quote: 'I accept this quote',
      decline_quote: 'I decline this quote',
      need_discount: 'Can you give a discount?',
      confirm_booking: 'Please confirm the booking',
      need_more_info: 'I need more information',
      price_negotiate: 'Can we negotiate on price?',
      reschedule: 'Can we reschedule?',
    };

    const content = quickReplyMessages[payload.quickReplyType] || payload.value;
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
        await this.sendPushIfOffline(
          qrNotifyUserId,
          'Quick reply',
          content,
          { roomId: targetId, type: 'chat_quick_reply' },
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
          await this.sendPushIfOffline(
            qrOtherUserId,
            'Quick reply',
            content,
            { bookingId: targetId, type: 'chat_quick_reply' },
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
        const customerId = parts[1];
        const providerId = parts[2];
        const unreadDms = await this.directMessageRepository.find({
          where: {
            customer: { id: customerId },
            provider: { id: providerId },
            isRead: false,
          },
          select: { id: true },
        });
        const unreadIds = unreadDms.map((m) => m.id);
        if (unreadIds.length > 0) {
          await this.directMessageRepository.update(
            {
              customer: { id: customerId },
              provider: { id: providerId },
              isRead: false,
            },
            { isRead: true },
          );
        }
        this.server.to(payload.roomId).emit('messages_read', {
          roomId: payload.roomId,
          messageIds: unreadIds,
        });
      }
      return;
    }

    // Handle booking chat read receipts
    if (payload.bookingId) {
      const unreadBookingMessages = await this.messageRepository.find({
        where: { booking: { id: payload.bookingId }, isRead: false },
        select: { id: true },
      });
      const unreadIds = unreadBookingMessages.map((m) => m.id);
      if (unreadIds.length > 0) {
        await this.messageRepository.update(
          { booking: { id: payload.bookingId }, isRead: false },
          { isRead: true },
        );
      }
      const room = `booking_${payload.bookingId}`;
      this.server.to(room).emit('messages_read', {
        bookingId: payload.bookingId,
        messageIds: unreadIds,
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

    this.logger.log(
      `[SYSTEM_MSG] Role-specific messages for booking ${bookingId}: customer="${customerContent.substring(0, 50)}" provider="${providerContent.substring(0, 50)}"`,
    );
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

    this.logger.debug(
      `User ${client.data.userId} typing: ${payload.isTyping} in room ${room}`,
    );
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
      client.emit('error', { message: 'Rate limit exceeded. Please slow down.' });
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
      await this.sendPushIfOffline(
        dmNotifyUserId,
        'New message',
        content,
        { roomId, type: 'direct_message' },
      );
    }

    this.logger.log(
      `[DIRECT_MSG] Sent to room=${roomId} by user ${client.data.userId}`,
    );
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
      await this.sendPushIfOffline(
        imgNotifyUserId,
        'New image',
        'Sent an image',
        { roomId: payload.roomId, type: 'direct_image' },
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
      await this.sendPushIfOffline(
        fileNotifyUserId,
        'New file',
        content,
        { roomId: payload.roomId, type: 'direct_file' },
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
      await this.sendPushIfOffline(
        quoteNotifyUserId,
        'New quote',
        payload.message || `Quote: ₹${payload.amount}`,
        { roomId: payload.roomId, type: 'direct_quote' },
      );
    }
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

    // Get unread IDs before marking as read
    const unreadDirectMessages = await this.directMessageRepository.find({
      where: {
        customer: { id: customerId },
        provider: { id: providerId },
        isRead: false,
      },
      select: { id: true },
    });
    const unreadIds = unreadDirectMessages.map((m) => m.id);

    if (unreadIds.length > 0) {
      await this.directMessageRepository.update(
        {
          customer: { id: customerId },
          provider: { id: providerId },
          isRead: false,
        },
        { isRead: true },
      );
    }

    const messages = await this.directMessageRepository.find({
      where: [{ customer: { id: customerId }, provider: { id: providerId } }],
      relations: { sender: true },
      order: { createdAt: 'ASC' },
      take: 50,
    });

    client.emit('direct_chat_history', this.formatHistoryMessages(messages));
    this.server
      .to(room)
      .emit('messages_read', { roomId: room, messageIds: unreadIds });
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
      client.emit('error', { message: 'Rate limit exceeded. Please slow down.' });
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
      client.emit('error', { message: 'Rate limit exceeded. Please slow down.' });
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
