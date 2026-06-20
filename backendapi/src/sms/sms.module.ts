import { Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { TwilioSmsProvider } from './twilio-sms.provider';
import { SMS_PROVIDER } from './sms.constants';

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
