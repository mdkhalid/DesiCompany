import {
  Controller,
  Post,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { WebhookService } from './webhooks.service';
import { PaymentGatewayType } from '../common/enums/payment-gateway-type.enum';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhookService: WebhookService) {}

  @Post('razorpay')
  @HttpCode(HttpStatus.OK)
  async razorpayWebhook(@Req() req: RawBodyRequest, @Res() res: Response) {
    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    const rawBody = req.rawBody;

    if (!rawBody) {
      this.logger.warn('Razorpay webhook missing rawBody');
      return res.status(400).json({ error: 'Missing raw body' });
    }

    const result = await this.webhookService.processWebhook(
      PaymentGatewayType.RAZORPAY,
      rawBody,
      signature,
    );

    if (!result.received) {
      return res.status(400).json({ error: 'Webhook processing failed' });
    }

    return res.json({ received: true, eventId: result.eventId });
  }

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async stripeWebhook(@Req() req: RawBodyRequest, @Res() res: Response) {
    const signature = req.headers['stripe-signature'] as string | undefined;
    const rawBody = req.rawBody;

    if (!rawBody) {
      this.logger.warn('Stripe webhook missing rawBody');
      return res.status(400).json({ error: 'Missing raw body' });
    }

    const result = await this.webhookService.processWebhook(
      PaymentGatewayType.STRIPE,
      rawBody,
      signature,
    );

    if (!result.received) {
      return res.status(400).json({ error: 'Webhook processing failed' });
    }

    return res.json({ received: true, eventId: result.eventId });
  }
}
