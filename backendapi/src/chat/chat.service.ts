import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Message, MessageType } from './entities/message.entity';
import {
  DirectMessage,
  DirectMessageType,
} from './entities/direct-message.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from '../users/entities/user.entity';
import { Provider } from '../users/entities/provider.entity';
import { Customer } from '../users/entities/customer.entity';
import { PresenceService } from './presence.service';

export interface ConversationItem {
  id: string;
  type: 'booking' | 'direct';
  partnerId: string;
  partnerName: string;
  partnerRole: 'customer' | 'provider';
  partnerAvatar?: string;
  lastMessage: string;
  lastMessageAt: Date;
  unreadCount: number;
  bookingId?: string;
  bookingStatus?: string;
  isOnline?: boolean;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

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
    private readonly presenceService: PresenceService,
  ) {}

  private getFullName(firstName?: string, lastName?: string): string {
    return `${firstName || ''} ${lastName || ''}`.trim();
  }

  async getConversations(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ conversations: ConversationItem[]; total: number }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { customer: true, provider: true },
    });
    if (!user) return { conversations: [], total: 0 };

    const isCustomer = !!user.customer;
    const isProvider = !!user.provider;
    if (!isCustomer && !isProvider) return { conversations: [], total: 0 };

    // For dual-role users, use the currently active role to avoid duplicate
    // conversations appearing from both customer and provider perspectives.
    const activeRole: 'customer' | 'provider' = user.role === 'provider' ? 'provider' : 'customer';

    const conversations: ConversationItem[] = [];

    // === BOOKING CONVERSATIONS ===
    type BookingWithRelations = Booking & {
      customer: Customer;
      provider: Provider & { user: User };
    };
    let bookings: BookingWithRelations[];
    if (activeRole === 'customer' && user.customer) {
      bookings = await this.bookingRepository.find({
        where: { customer: { id: user.customer.id } },
        relations: { customer: true, provider: { user: true } },
        order: { updatedAt: 'DESC' },
      });
    } else if (activeRole === 'provider' && user.provider) {
      bookings = await this.bookingRepository.find({
        where: { provider: { id: user.provider.id } },
        relations: { customer: { user: true }, provider: true },
        order: { updatedAt: 'DESC' },
      });
    } else {
      bookings = [];
    }

    if (bookings.length > 0) {
      const bookingIds = bookings.map((b) => b.id);

      // Batch: last message per booking (single query)
      const lastMessages = await this.messageRepository
        .createQueryBuilder('msg')
        .select(['msg.id', 'msg.content', 'msg.createdAt', 'msg.booking'])
        .where('msg.booking IN (:...bookingIds)', { bookingIds })
        .orderBy('msg.createdAt', 'DESC')
        .getMany();

      const lastMessageMap = new Map<
        string,
        { content: string; createdAt: Date }
      >();
      for (const m of lastMessages) {
        const bid = m.booking?.id;
        if (bid && !lastMessageMap.has(bid)) {
          lastMessageMap.set(bid, {
            content: m.content,
            createdAt: m.createdAt,
          });
        }
      }

      // Batch: unread count per booking (single query)
      type UnreadRow = { bookingId: string; cnt: string; msg_booking: string };
      const unreadRows: UnreadRow[] = await this.messageRepository
        .createQueryBuilder('msg')
        .select('msg.booking', 'bookingId')
        .addSelect('COUNT(*)', 'cnt')
        .where('msg.booking IN (:...bookingIds)', { bookingIds })
        .andWhere('msg.isRead = false')
        .groupBy('msg.booking')
        .getRawMany();

      const unreadMap = new Map<string, number>();
      for (const r of unreadRows) {
        unreadMap.set(r.bookingId ?? r.msg_booking, parseInt(r.cnt ?? '0', 10));
      }

      for (const booking of bookings) {
        let partnerId: string;
        let partnerName: string;

        if (activeRole === 'customer' && booking.provider) {
          partnerId = booking.provider.user?.id || '';
          partnerName = this.getFullName(
            booking.provider.firstName,
            booking.provider.lastName,
          );
        } else if (activeRole === 'provider' && booking.customer) {
          partnerId = booking.customer.user?.id || '';
          partnerName = this.getFullName(
            booking.customer.firstName,
            booking.customer.lastName,
          );
        } else {
          continue;
        }

        if (!partnerId) continue;

        const lastMsg = lastMessageMap.get(booking.id);
        conversations.push({
          id: `booking_${booking.id}`,
          type: 'booking',
          partnerId,
          partnerName,
          partnerRole: activeRole === 'customer' ? 'provider' : 'customer',
          lastMessage: lastMsg?.content || 'No messages yet',
          lastMessageAt: lastMsg?.createdAt || booking.createdAt,
          unreadCount: unreadMap.get(booking.id) || 0,
          bookingId: booking.id,
          bookingStatus: booking.status,
        });
      }
    }

    // === DIRECT (PRE-BOOKING) CONVERSATIONS ===
    if (activeRole === 'customer' && user.customer) {
      await this.addDirectConversations(
        conversations,
        'customer',
        user.customer.id,
        userId,
        'provider',
      );
    } else if (activeRole === 'provider' && user.provider) {
      await this.addDirectConversations(
        conversations,
        'provider',
        user.provider.id,
        userId,
        'customer',
      );
    }

    // Sort by last message time descending
    conversations.sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime(),
    );

    // Paginate
    const total = conversations.length;
    const start = (page - 1) * limit;
    const paginated = conversations.slice(start, start + limit);

    // Populate isOnline for each conversation based on presence
    for (const conv of paginated) {
      conv.isOnline = this.presenceService.isUserOnline(conv.partnerId);
    }

    return { conversations: paginated, total };
  }

  private async addDirectConversations(
    conversations: ConversationItem[],
    userRole: 'customer' | 'provider',
    profileId: string,
    userId: string,
    partnerRole: 'customer' | 'provider',
  ): Promise<void> {
    const partnerField =
      userRole === 'customer' ? 'dm.provider' : 'dm.customer';

    const lastMessages = await this.directMessageRepository
      .createQueryBuilder('dm')
      .distinctOn([partnerField])
      .leftJoinAndSelect('dm.customer', 'dmc')
      .leftJoinAndSelect('dmc.user', 'dmcu')
      .leftJoinAndSelect('dm.provider', 'dmp')
      .leftJoinAndSelect('dmp.user', 'dmpu')
      .where(
        userRole === 'customer' ? 'dm.customer = :pid' : 'dm.provider = :pid',
        { pid: profileId },
      )
      .orderBy(partnerField)
      .addOrderBy('dm.createdAt', 'DESC')
      .getMany();

    if (lastMessages.length === 0) return;

    // Batch: get unread counts per partner
    const partnerProfileIds = lastMessages.map((m) =>
      userRole === 'customer' ? m.provider.id : m.customer.id,
    );

    const unreadWhere =
      userRole === 'customer'
        ? {
            customer: { id: profileId },
            provider: { id: In(partnerProfileIds) },
            isRead: false,
          }
        : {
            provider: { id: profileId },
            customer: { id: In(partnerProfileIds) },
            isRead: false,
          };

    // Fix: only count messages from the other person as unread
    const unreadRows = await this.directMessageRepository.find({
      where: { ...unreadWhere, sender: { id: Not(userId) } },
      select: { id: true, sender: true, customer: true, provider: true },
    });

    const unreadCountMap = new Map<string, number>();
    for (const row of unreadRows) {
      const key = userRole === 'customer' ? row.provider?.id : row.customer?.id;
      if (key) unreadCountMap.set(key, (unreadCountMap.get(key) || 0) + 1);
    }

    for (const dm of lastMessages) {
      let partnerId: string;
      let partnerName: string;

      if (userRole === 'customer' && dm.provider) {
        partnerId = dm.provider.user?.id || '';
        partnerName = this.getFullName(
          dm.provider.firstName,
          dm.provider.lastName,
        );
      } else if (userRole === 'provider' && dm.customer) {
        partnerId = dm.customer.user?.id || '';
        partnerName = this.getFullName(
          dm.customer.firstName,
          dm.customer.lastName,
        );
      } else {
        continue;
      }

      if (!partnerId) continue;

      const partnerProfileKey =
        userRole === 'customer' ? dm.provider.id : dm.customer.id;
      conversations.push({
        id: `direct_${partnerId}`,
        type: 'direct',
        partnerId,
        partnerName,
        partnerRole,
        lastMessage: dm.content,
        lastMessageAt: dm.createdAt,
        unreadCount: unreadCountMap.get(partnerProfileKey) || 0,
      });
    }
  }

  async getMessageHistory(
    userId: string,
    type: 'booking' | 'direct',
    targetId: string,
    page = 1,
    limit = 50,
  ): Promise<{ messages: Message[] | DirectMessage[]; total: number }> {
    if (type === 'booking') {
      const [messages, total] = await this.messageRepository.findAndCount({
        where: { booking: { id: targetId } },
        relations: { sender: { customer: true, provider: true } },
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

      // Mark messages as read
      await this.messageRepository.update(
        { booking: { id: targetId }, isRead: false },
        { isRead: true },
      );

      return { messages: messages.reverse(), total };
    } else {
      // Direct message - parse room ID
      const parts = targetId.split('_');
      if (parts.length !== 3 || parts[0] !== 'direct') {
        return { messages: [], total: 0 };
      }

      const customerId = parts[1];
      const providerId = parts[2];

      const [messages, total] = await this.directMessageRepository.findAndCount(
        {
          where: [
            { customer: { id: customerId }, provider: { id: providerId } },
          ],
          relations: { sender: { customer: true, provider: true } },
          order: { createdAt: 'DESC' },
          skip: (page - 1) * limit,
          take: limit,
        },
      );

      // Mark as read
      await this.directMessageRepository.update(
        {
          customer: { id: customerId },
          provider: { id: providerId },
          isRead: false,
        },
        { isRead: true },
      );

      return { messages: messages.reverse(), total };
    }
  }

  async sendMessage(
    userId: string,
    type: 'booking' | 'direct',
    targetId: string,
    content: string,
    messageType: string = 'text',
    metadata?: Record<string, unknown>,
  ): Promise<Message | DirectMessage> {
    if (type === 'booking') {
      const message = this.messageRepository.create({
        booking: { id: targetId } as Booking,
        sender: { id: userId } as User,
        content,
        messageType: messageType as MessageType,
        metadata,
      });
      return this.messageRepository.save(message);
    } else {
      const parts = targetId.split('_');
      if (parts.length !== 3 || parts[0] !== 'direct') {
        throw new Error('Invalid direct chat room ID');
      }

      const customerId = parts[1];
      const providerId = parts[2];

      const provider = await this.providerRepository.findOne({
        where: { id: providerId },
      });

      if (!provider) {
        throw new Error('Provider not found');
      }

      const message = this.directMessageRepository.create({
        customer: { id: customerId } as Customer,
        provider: { id: providerId } as Provider,
        sender: { id: userId } as User,
        content,
        messageType: messageType as DirectMessageType,
        metadata,
      });
      return this.directMessageRepository.save(message);
    }
  }

  async searchConversations(
    userId: string,
    query: string,
  ): Promise<ConversationItem[]> {
    const { conversations } = await this.getConversations(userId, 1, 10000);
    const lowerQuery = query.toLowerCase();
    return conversations.filter(
      (c) =>
        c.partnerName.toLowerCase().includes(lowerQuery) ||
        c.lastMessage.toLowerCase().includes(lowerQuery),
    );
  }

  async searchMessages(
    userId: string,
    roomId: string,
    query: string,
    page = 1,
    limit = 50,
  ): Promise<{ messages: (Message | DirectMessage)[]; total: number }> {
    const lowerQuery = query.toLowerCase();

    if (roomId.startsWith('booking_')) {
      const bookingId = roomId.replace('booking_', '');
      const [messages] = await this.messageRepository.findAndCount({
        where: { booking: { id: bookingId } },
        relations: { sender: { customer: true, provider: true } },
        order: { createdAt: 'DESC' },
      });
      const filtered = messages.filter((m) =>
        m.content.toLowerCase().includes(lowerQuery),
      );
      const start = (page - 1) * limit;
      return {
        messages: filtered.slice(start, start + limit),
        total: filtered.length,
      };
    }

    if (roomId.startsWith('direct_')) {
      const parts = roomId.split('_');
      if (parts.length !== 3) return { messages: [], total: 0 };
      const customerId = parts[1];
      const providerId = parts[2];
      const [messages] = await this.directMessageRepository.findAndCount({
        where: { customer: { id: customerId }, provider: { id: providerId } },
        relations: { sender: { customer: true, provider: true } },
        order: { createdAt: 'DESC' },
      });
      const filtered = messages.filter((m) =>
        m.content.toLowerCase().includes(lowerQuery),
      );
      const start = (page - 1) * limit;
      return {
        messages: filtered.slice(start, start + limit),
        total: filtered.length,
      };
    }

    return { messages: [], total: 0 };
  }

  async markAsRead(
    userId: string,
    type: 'booking' | 'direct',
    targetId: string,
  ): Promise<void> {
    if (type === 'booking') {
      await this.messageRepository.update(
        { booking: { id: targetId }, isRead: false },
        { isRead: true },
      );
    } else {
      const parts = targetId.split('_');
      if (parts.length !== 3 || parts[0] !== 'direct') return;

      const customerId = parts[1];
      const providerId = parts[2];

      await this.directMessageRepository.update(
        {
          customer: { id: customerId },
          provider: { id: providerId },
          isRead: false,
        },
        { isRead: true },
      );
    }
  }

  /**
   * Migrate direct messages to a booking room when a booking is created
   * between two users who already had a direct conversation.
   */
  async migrateDirectToBooking(
    customerId: string,
    providerId: string,
    bookingId: string,
  ): Promise<number> {
    const directMessages = await this.directMessageRepository.find({
      where: {
        customer: { id: customerId },
        provider: { id: providerId },
      },
      relations: { sender: true, customer: true, provider: true },
      order: { createdAt: 'ASC' },
    });

    if (directMessages.length === 0) return 0;

    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
    });
    if (!booking) return 0;

    let migrated = 0;
    for (const dm of directMessages) {
      const message = this.messageRepository.create({
        booking,
        sender: dm.sender,
        content: dm.content,
        messageType: dm.messageType as unknown as MessageType,
        metadata: dm.metadata,
        isRead: dm.isRead,
        createdAt: dm.createdAt,
      });
      await this.messageRepository.save(message);
      migrated++;
    }

    this.logger.log(
      `Migrated ${migrated} direct messages to booking ${bookingId}`,
    );
    return migrated;
  }
}
