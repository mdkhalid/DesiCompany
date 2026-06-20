import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SupportTicket,
  SupportTicketStatus,
  SupportTicketCategory,
} from './entities/support-ticket.entity';
import { SupportTicketMessage } from './entities/support-ticket-message.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepository: Repository<SupportTicket>,
    @InjectRepository(SupportTicketMessage)
    private readonly messageRepository: Repository<SupportTicketMessage>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createTicket(
    userId: string,
    subject: string,
    description: string,
    category: SupportTicketCategory,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const ticket = this.ticketRepository.create({
      user,
      subject,
      description,
      category,
      status: SupportTicketStatus.OPEN,
    });
    return this.ticketRepository.save(ticket);
  }

  async getUserTickets(userId: string) {
    return this.ticketRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async getAllTickets(status?: SupportTicketStatus) {
    const where: any = {};
    if (status) where.status = status;
    return this.ticketRepository.find({
      where,
      relations: { user: true },
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
  }

  async getTicketById(id: string) {
    const ticket = await this.ticketRepository.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async updateTicketStatus(
    ticketId: string,
    status: SupportTicketStatus,
    notes?: string,
    adminId?: string,
  ) {
    const ticket = await this.getTicketById(ticketId);
    ticket.status = status;
    if (adminId) ticket.assignedAdminId = adminId;
    if (
      status === SupportTicketStatus.RESOLVED ||
      status === SupportTicketStatus.CLOSED
    ) {
      ticket.resolvedAt = new Date();
      if (notes) ticket.resolutionNotes = notes;
    }
    return this.ticketRepository.save(ticket);
  }

  async addMessage(
    ticketId: string,
    userId: string,
    message: string,
    isAdmin: boolean,
    attachmentUrl?: string,
  ) {
    const ticket = await this.getTicketById(ticketId);
    const sender = await this.userRepository.findOne({ where: { id: userId } });
    if (!sender) throw new NotFoundException('User not found');

    const msg = this.messageRepository.create({
      ticket,
      sender,
      message,
      isAdmin,
      attachmentUrl: attachmentUrl ?? undefined,
    });
    return this.messageRepository.save(msg);
  }

  async getMessages(ticketId: string) {
    return this.messageRepository.find({
      where: { ticket: { id: ticketId } },
      relations: { sender: true },
      order: { createdAt: 'ASC' },
    });
  }

  async ensureAccess(ticketId: string, userId: string, role: UserRole) {
    const ticket = await this.getTicketById(ticketId);
    if (role === UserRole.ADMIN) return ticket;
    if (ticket.user.id !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return ticket;
  }
}
