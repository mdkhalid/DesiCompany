import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message, MessageType } from './entities/message.entity';
import { DirectMessage, DirectMessageType } from './entities/direct-message.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from '../users/entities/user.entity';
import { Provider } from '../users/entities/provider.entity';
import { Customer } from '../users/entities/customer.entity';

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
  ) {}

  private getFullName(firstName?: string, lastName?: string): string {
    return `${firstName || ''} ${lastName || ''}`.trim();
  }

  async getConversations(userId: string, page = 1, limit = 20): Promise<{ conversations: ConversationItem[]; total: number }> {
    const conversations: ConversationItem[] = [];

    // Get user info with relations
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { customer: true, provider: true },
    });
    if (!user) return { conversations: [], total: 0 };

    const isCustomer = !!user.customer;
    const isProvider = !!user.provider;

    // Get booking-based conversations
    let bookings: Booking[];
    if (isCustomer && user.customer) {
      bookings = await this.bookingRepository.find({
        where: { customer: { id: user.customer.id } },
        relations: { customer: true, provider: { user: true } },
        order: { updatedAt: 'DESC' },
      });
    } else if (isProvider && user.provider) {
      bookings = await this.bookingRepository.find({
        where: { provider: { id: user.provider.id } },
        relations: { customer: true, provider: { user: true } },
        order: { updatedAt: 'DESC' },
      });
    } else {
      return { conversations: [], total: 0 };
    }

    for (const booking of bookings) {
      let partnerId: string;
      let partnerName: string;

      if (isCustomer && booking.provider) {
        partnerId = booking.provider.user?.id || '';
        partnerName = this.getFullName(booking.provider.firstName, booking.provider.lastName);
      } else if (isProvider && booking.customer) {
        partnerId = booking.customer.user?.id || '';
        partnerName = this.getFullName(booking.customer.firstName, booking.customer.lastName);
      } else {
        continue;
      }

      if (!partnerId) continue;

      const lastMessage = await this.messageRepository.findOne({
        where: { booking: { id: booking.id } },
        order: { createdAt: 'DESC' },
      });

      const unreadCount = await this.messageRepository.count({
        where: {
          booking: { id: booking.id },
          isRead: false,
        },
      });

      conversations.push({
        id: `booking_${booking.id}`,
        type: 'booking',
        partnerId,
        partnerName,
        partnerRole: isCustomer ? 'provider' : 'customer',
        lastMessage: lastMessage?.content || 'No messages yet',
        lastMessageAt: lastMessage?.createdAt || booking.createdAt,
        unreadCount,
        bookingId: booking.id,
        bookingStatus: booking.status,
      });
    }

    // Get direct (pre-booking) conversations
    let directMessages: DirectMessage[];
    if (isCustomer && user.customer) {
      directMessages = await this.directMessageRepository.find({
        where: { customer: { id: user.customer.id } },
        relations: { customer: { user: true }, provider: { user: true }, sender: true },
        order: { createdAt: 'DESC' },
      });
    } else if (isProvider && user.provider) {
      directMessages = await this.directMessageRepository.find({
        where: { provider: { id: user.provider.id } },
        relations: { customer: { user: true }, provider: { user: true }, sender: true },
        order: { createdAt: 'DESC' },
      });
    } else {
      directMessages = [];
    }

    // Group by conversation partner
    const directMap = new Map<string, ConversationItem>();
    for (const dm of directMessages) {
      let partnerId: string;
      let partnerName: string;

      if (isCustomer && dm.provider) {
        partnerId = dm.provider.user?.id || '';
        partnerName = this.getFullName(dm.provider.firstName, dm.provider.lastName);
      } else if (isProvider && dm.customer) {
        partnerId = dm.customer.user?.id || '';
        partnerName = this.getFullName(dm.customer.firstName, dm.customer.lastName);
      } else {
        continue;
      }

      if (!partnerId) continue;

      const existing = directMap.get(partnerId);

      if (!existing) {
        directMap.set(partnerId, {
          id: `direct_${partnerId}`,
          type: 'direct',
          partnerId,
          partnerName,
          partnerRole: 'provider',
          lastMessage: dm.content,
          lastMessageAt: dm.createdAt,
          unreadCount: 0,
        });
      } else if (dm.createdAt > existing.lastMessageAt) {
        existing.lastMessage = dm.content;
        existing.lastMessageAt = dm.createdAt;
      }
    }

    for (const conv of directMap.values()) {
      conversations.push(conv);
    }

    // Sort by last message time
    conversations.sort((a, b) =>
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    // Paginate
    const total = conversations.length;
    const start = (page - 1) * limit;
    const paginated = conversations.slice(start, start + limit);

    return { conversations: paginated, total };
  }

  async getMessageHistory(
    userId: string,
    type: 'booking' | 'direct',
    targetId: string,
    page = 1,
    limit = 50
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
        { isRead: true }
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

      const [messages, total] = await this.directMessageRepository.findAndCount({
        where: [
          { customer: { id: customerId }, provider: { id: providerId } },
        ],
        relations: { sender: { customer: true, provider: true } },
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

      // Mark as read
      await this.directMessageRepository.update(
        {
          customer: { id: customerId },
          provider: { id: providerId },
          isRead: false,
        },
        { isRead: true }
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
    metadata?: Record<string, any>
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

  async markAsRead(userId: string, type: 'booking' | 'direct', targetId: string): Promise<void> {
    if (type === 'booking') {
      await this.messageRepository.update(
        { booking: { id: targetId }, isRead: false },
        { isRead: true }
      );
    } else {
      const parts = targetId.split('_');
      if (parts.length !== 3 || parts[0] !== 'direct') return;

      const customerId = parts[1];
      const providerId = parts[2];

      await this.directMessageRepository.update(
        { customer: { id: customerId }, provider: { id: providerId }, isRead: false },
        { isRead: true }
      );
    }
  }
}