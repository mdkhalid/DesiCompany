import { Injectable, Logger, Inject } from '@nestjs/common';
import { SMS_PROVIDER } from './sms.module';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    @Inject(SMS_PROVIDER)
    private readonly smsProvider: { send(phone: string, message: string): Promise<void> },
  ) {}

  async sendOtp(phone: string, otp: string): Promise<void> {
    const message = `Your DesiCompany verification code is: ${otp}. It expires in 5 minutes.`;
    try {
      await this.smsProvider.send(phone, message);
      this.logger.log(`OTP sent to ${phone}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP to ${phone}: ${error}`);
      throw error;
    }
  }

  async send(phone: string, message: string): Promise<void> {
    try {
      await this.smsProvider.send(phone, message);
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${phone}: ${error}`);
      throw error;
    }
  }
}
