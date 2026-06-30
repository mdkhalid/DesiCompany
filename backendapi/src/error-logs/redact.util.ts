const REDACTED = '[REDACTED]';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwd',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'bearer',
  'apiKey',
  'api_key',
  'secret',
  'card',
  'cvv',
  'cvc',
  'accountNumber',
  'account_number',
  'account',
  'pan',
  'pin',
  'otp',
  'oneTimePassword',
  'newPassword',
  'confirmPassword',
  'currentPassword',
  'oldPassword',
  'socialSecurityNumber',
  'ssn',
]);

export function redactObject(obj: unknown): Record<string, unknown> | null {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (typeof obj !== 'object') {
    return null;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = REDACTED;
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactObject(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
