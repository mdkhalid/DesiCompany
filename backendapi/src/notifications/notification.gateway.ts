import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { NotificationsService } from './notifications.service';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    user: User;
  };
}

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/notifications',
})
@Injectable()
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  afterInit(server: Server) {
    server.use((socket, next) => {
      const auth = socket.handshake.auth as Record<string, unknown>;
      const token =
        (auth?.token as string) ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('No token provided'));
      }

      try {
        const payload = this.jwtService.verify<{
          sub: string;
          phone: string;
          role: string;
        }>(token, { secret: process.env.JWT_SECRET });

        this.userRepository
          .findOne({ where: { id: payload.sub } })
          .then((user) => {
            if (!user) return next(new Error('User not found'));
            (socket as AuthenticatedSocket).data.userId = user.id;
            (socket as AuthenticatedSocket).data.user = user;
            next();
          })
          .catch((err) => {
            next(new Error(`Invalid token: ${(err as Error)?.message || err}`));
          });
      } catch {
        next(new Error('Invalid token'));
      }
    });
  }

  handleConnection(client: AuthenticatedSocket) {
    if (client.data.userId) {
      this.registerSocket(client.data.userId, client.id);
      this.logger.log(
        `Notification client connected: ${client.id} (user: ${client.data.userId})`,
      );
    } else {
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.data.userId) {
      this.unregisterSocket(client.data.userId, client.id);
    }
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

  isUserOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return !!sockets && sockets.size > 0;
  }

  sendToUser(userId: string, event: string, data: Record<string, unknown>) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      for (const socketId of sockets) {
        this.server.to(socketId).emit(event, data);
      }
    }
  }

  emitBookingStatusUpdate(userId: string, bookingId: string, status: string) {
    this.sendToUser(userId, 'booking_status_updated', { bookingId, status });
  }

  async sendNotification(
    userId: string,
    title: string,
    message: string,
    type?: string,
    metadata?: Record<string, unknown>,
    recipientRole?: UserRole,
  ): Promise<void> {
    const notification = await this.notificationsService.create(
      userId,
      title,
      message,
      type,
      metadata,
      recipientRole,
    );

    // For dual-role users, unread count should reflect only the current
    // active role's notifications. We use the recipientRole to filter
    // (or if not specified, count all).
    const unreadCount = await this.notificationsService.getUnreadCount(
      userId,
      recipientRole,
    );

    this.sendToUser(userId, 'notification', {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      metadata: notification.metadata,
      recipientRole: notification.recipientRole,
      isRead: false,
      createdAt: notification.createdAt,
    });

    this.sendToUser(userId, 'unread_count', { count: unreadCount });
  }
}
