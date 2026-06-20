import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TwilioSmsProvider {
  private readonly logger = new Logger(TwilioSmsProvider.name);
  private client: any;

  constructor() {
    this.initTwilio();
  }

  private async initTwilio() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      this.logger.warn(
        'Twilio credentials not configured. SMS will be logged only.',
      );
      return;
    }

    try {
      // Dynamic import - twilio is optional
      const twilio = await import('twilio').catch(() => null);
      if (!twilio) {
        this.logger.warn(
          'twilio package not installed. SMS will be logged only.',
        );
        return;
      }
      this.client = twilio.default(accountSid, authToken);
      this.logger.log('Twilio SMS provider initialized');
    } catch (error) {
      this.logger.warn(
        `Failed to initialize Twilio: ${(error as Error).message}`,
      );
    }
  }

  async send(phone: string, message: string): Promise<void> {
    const from = process.env.TWILIO_PHONE_NUMBER;

    if (!this.client || !from) {
      this.logger.log(`[SMS MOCK] To: ${phone}, Message: ${message}`);
      return;
    }

    await this.client.messages.create({
      body: message,
      to: phone,
      from,
    });
  }
}
