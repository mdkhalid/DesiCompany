import { Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { TwilioSmsProvider } from './twilio-sms.provider';

export const SMS_PROVIDER = 'SMS_PROVIDER';

@Module({
  providers: [
    SmsService,
    {
      provide: SMS_PROVIDER,
      useClass: TwilioSmsProvider,
    },
  ],
  exports: [SmsService],
})
export class SmsModule {}
