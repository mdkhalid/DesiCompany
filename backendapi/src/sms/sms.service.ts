import { Injectable, Logger, Inject } from '@nestjs/common';
import { SMS_PROVIDER } from './sms.constants';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    @Inject(SMS_PROVIDER)
    private readonly smsProvider: {
      send(phone: string, message: string): Promise<void>;
    },
  ) {}

  private maskPhone(phone: string): string {
    if (phone.length <= 4) return '****';
    return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
  }

  async sendOtp(phone: string, otp: string): Promise<void> {
    const message = `Your DesiCompany verification code is: ${otp}. It expires in 5 minutes.`;
    try {
      await this.smsProvider.send(phone, message);
      this.logger.log(`OTP sent to ${this.maskPhone(phone)}`);
    } catch (error) {
      this.logger.error(
        `Failed to send OTP to ${this.maskPhone(phone)}: ${error}`,
      );
      throw error;
    }
  }

  async send(phone: string, message: string): Promise<void> {
    try {
      await this.smsProvider.send(phone, message);
    } catch (error) {
      this.logger.error(
        `Failed to send SMS to ${this.maskPhone(phone)}: ${error}`,
      );
      throw error;
    }
  }
}
