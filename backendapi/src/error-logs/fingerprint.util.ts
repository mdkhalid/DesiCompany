import { createHash } from 'crypto';

export function generateFingerprint(
  statusCode: number,
  url: string,
  message: string,
  userId?: string,
): string {
  const input = `${statusCode}:${url}:${message}:${userId ?? ''}`;
  return createHash('sha256').update(input).digest('hex');
}
