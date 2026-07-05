import { Injectable } from '@nestjs/common';

@Injectable()
export class PresenceService {
  private readonly userSockets = new Map<string, Set<string>>();

  registerSocket(userId: string, socketId: string): void {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);
  }

  unregisterSocket(userId: string, socketId: string): void {
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

  isAnySocketOnline(userId: string): boolean {
    return this.isUserOnline(userId);
  }

  getSocketIds(userId: string): string[] {
    const sockets = this.userSockets.get(userId);
    return sockets ? Array.from(sockets) : [];
  }

  getOnlineUserIds(): string[] {
    return Array.from(this.userSockets.keys());
  }
}
