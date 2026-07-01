import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  Grievance,
  GrievanceStatus,
  GrievancePriority,
  ResolutionType,
} from './entities/grievance.entity';
import {
  GrievanceMessage,
  MessageSender,
} from './entities/grievance-message.entity';

@Injectable()
export class GrievancesService {
  constructor(
    @InjectRepository(Grievance)
    private readonly grievanceRepository: Repository<Grievance>,
    @InjectRepository(GrievanceMessage)
    private readonly messageRepository: Repository<GrievanceMessage>,
  ) {}

  async getAllGrievances(filters?: {
    status?: GrievanceStatus;
    priority?: GrievancePriority;
  }): Promise<Grievance[]> {
    const where: Record<string, unknown> = {};

    if (filters?.status) where.status = filters.status;
    if (filters?.priority) where.priority = filters.priority;

    return this.grievanceRepository.find({
      where,
      relations: {
        booking: { provider: { user: true } },
        customer: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getEscalatedGrievances(): Promise<Grievance[]> {
    return this.grievanceRepository.find({
      where: {
        status: In([GrievanceStatus.ESCALATED, GrievanceStatus.ADMIN_REVIEW]),
      },
      relations: {
        booking: { provider: { user: true } },
        customer: true,
        messages: true,
      },
      order: { priority: 'DESC', createdAt: 'ASC' },
    });
  }

  async getGrievanceById(grievanceId: string): Promise<Grievance> {
    const grievance = await this.grievanceRepository.findOne({
      where: { id: grievanceId },
      relations: {
        booking: { provider: { user: true } },
        customer: true,
        messages: true,
      },
    });

    if (!grievance) {
      throw new NotFoundException('Grievance not found');
    }

    return grievance;
  }

  async assignToAdmin(
    grievanceId: string,
    adminId: string,
  ): Promise<Grievance> {
    const grievance = await this.getGrievanceById(grievanceId);
    grievance.status = GrievanceStatus.ADMIN_REVIEW;
    await this.grievanceRepository.save(grievance);

    await this.addMessage(
      grievanceId,
      MessageSender.SYSTEM,
      'Assigned to admin for review',
      {
        adminId,
      },
    );

    return grievance;
  }

  async resolveGrievance(
    grievanceId: string,
    adminId: string,
    data: {
      resolutionType: ResolutionType;
      resolutionDetails: string;
      adminNotes?: string;
    },
  ): Promise<Grievance> {
    const grievance = await this.getGrievanceById(grievanceId);

    grievance.status = GrievanceStatus.RESOLVED;
    grievance.resolutionType = data.resolutionType;
    grievance.resolutionDetails = data.resolutionDetails;
    grievance.adminNotes = data.adminNotes || null;
    grievance.resolvedAt = new Date();
    grievance.resolvedBy = adminId;

    await this.grievanceRepository.save(grievance);

    await this.addMessage(
      grievanceId,
      MessageSender.ADMIN,
      `Your grievance has been resolved.\n\nResolution: ${data.resolutionDetails}`,
      { resolutionType: data.resolutionType },
    );

    return grievance;
  }

  async recordCall(
    grievanceId: string,
    adminId: string,
    callNotes: string,
  ): Promise<Grievance> {
    const grievance = await this.getGrievanceById(grievanceId);

    grievance.adminCallInitiated = true;
    grievance.adminCallNotes = callNotes;

    await this.grievanceRepository.save(grievance);

    await this.addMessage(
      grievanceId,
      MessageSender.SYSTEM,
      'Admin call initiated',
      {
        adminId,
        callNotes,
      },
    );

    return grievance;
  }

  async addAdminMessage(
    grievanceId: string,
    content: string,
  ): Promise<GrievanceMessage> {
    return this.addMessage(grievanceId, MessageSender.ADMIN, content);
  }

  async getDashboardStats(): Promise<{
    total: number;
    open: number;
    escalated: number;
    resolved: number;
    avgResolutionTime: number;
  }> {
    const [total, open, escalated, resolved] = await Promise.all([
      this.grievanceRepository.count(),
      this.grievanceRepository.count({
        where: { status: GrievanceStatus.OPEN },
      }),
      this.grievanceRepository.count({
        where: {
          status: In([GrievanceStatus.ESCALATED, GrievanceStatus.ADMIN_REVIEW]),
        },
      }),
      this.grievanceRepository.count({
        where: { status: GrievanceStatus.RESOLVED },
      }),
    ]);

    // Calculate average resolution time
    const resolvedGrievances = await this.grievanceRepository.find({
      where: { status: GrievanceStatus.RESOLVED },
      select: { createdAt: true, resolvedAt: true },
    });

    let avgResolutionTime = 0;
    if (resolvedGrievances.length > 0) {
      const totalTime = resolvedGrievances.reduce((sum, g) => {
        if (!g.resolvedAt) return sum;
        const created = new Date(g.createdAt).getTime();
        const resolved = new Date(g.resolvedAt).getTime();
        return sum + (resolved - created);
      }, 0);
      avgResolutionTime = Math.round(
        totalTime / resolvedGrievances.length / (1000 * 60 * 60),
      ); // hours
    }

    return { total, open, escalated, resolved, avgResolutionTime };
  }

  private async addMessage(
    grievanceId: string,
    sender: MessageSender,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<GrievanceMessage> {
    const message = this.messageRepository.create({
      grievance: { id: grievanceId } as Grievance,
      sender,
      content,
      metadata,
    });
    return this.messageRepository.save(message);
  }
}
