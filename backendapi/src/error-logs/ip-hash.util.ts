import { createHash } from 'crypto';

export function hashIp(ip: string | null | undefined): string | undefined {
  if (!ip) return undefined;
  return createHash('sha256').update(ip).digest('hex');
}
