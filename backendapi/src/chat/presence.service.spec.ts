import { PresenceService } from './presence.service';

describe('PresenceService', () => {
  let service: PresenceService;

  beforeEach(() => {
    service = new PresenceService();
  });

  afterEach(() => jest.clearAllMocks());

  describe('registerSocket', () => {
    it('should register a socket for a user', () => {
      service.registerSocket('u1', 'socket-1');
      expect(service.isUserOnline('u1')).toBe(true);
    });

    it('should allow multiple sockets per user', () => {
      service.registerSocket('u1', 'socket-1');
      service.registerSocket('u1', 'socket-2');
      expect(service.getSocketIds('u1')).toEqual(['socket-1', 'socket-2']);
    });
  });

  describe('unregisterSocket', () => {
    it('should remove the socket and mark user offline when last socket removed', () => {
      service.registerSocket('u1', 'socket-1');
      service.unregisterSocket('u1', 'socket-1');
      expect(service.isUserOnline('u1')).toBe(false);
    });

    it('should keep user online when other sockets remain', () => {
      service.registerSocket('u1', 'socket-1');
      service.registerSocket('u1', 'socket-2');
      service.unregisterSocket('u1', 'socket-1');
      expect(service.isUserOnline('u1')).toBe(true);
      expect(service.getSocketIds('u1')).toEqual(['socket-2']);
    });

    it('should not throw for unknown user', () => {
      expect(() => service.unregisterSocket('unknown', 'socket-1')).not.toThrow();
    });
  });

  describe('isUserOnline', () => {
    it('should return false for unknown user', () => {
      expect(service.isUserOnline('unknown')).toBe(false);
    });

    it('should return true after registration', () => {
      service.registerSocket('u1', 's1');
      expect(service.isUserOnline('u1')).toBe(true);
    });
  });

  describe('isAnySocketOnline', () => {
    it('should return false for unknown user', () => {
      expect(service.isAnySocketOnline('unknown')).toBe(false);
    });

    it('should return true when user has sockets', () => {
      service.registerSocket('u1', 's1');
      expect(service.isAnySocketOnline('u1')).toBe(true);
    });
  });

  describe('getSocketIds', () => {
    it('should return empty array for unknown user', () => {
      expect(service.getSocketIds('unknown')).toEqual([]);
    });

    it('should return all socket IDs', () => {
      service.registerSocket('u1', 's1');
      service.registerSocket('u1', 's2');
      expect(service.getSocketIds('u1')).toEqual(['s1', 's2']);
    });
  });

  describe('getOnlineUserIds', () => {
    it('should return empty when no users', () => {
      expect(service.getOnlineUserIds()).toEqual([]);
    });

    it('should return all online user IDs', () => {
      service.registerSocket('u1', 's1');
      service.registerSocket('u2', 's2');
      expect(service.getOnlineUserIds()).toEqual(['u1', 'u2']);
    });
  });
});
