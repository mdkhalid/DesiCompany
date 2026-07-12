export enum JobType {
  LOYALTY_AWARD = 'loyalty.award',
  PUSH_NOTIFICATION = 'notification.push',
  SMS = 'notification.sms',
  BOOKING_REMINDER = 'reminder.booking',
  RECURRING_GENERATE = 'recurring.generate',
}

export interface JobPayload {
  [key: string]: any;
}

export interface JobOptions {
  id?: string;
  attempts?: number;
  backoff?: { type: 'exponential'; delay: number };
  delay?: number;
}
