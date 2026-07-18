import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { WebhookEvent } from './entities/webhook-event.entity';
import { PaymentGatewayFactory } from './gateways/payment-gateway.factory';
import { PaymentGatewayType } from '../common/enums/payment-gateway-type.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { PaymentsService } from './payments.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(WebhookEvent)
    private readonly webhookEventRepository: Repository<WebhookEvent>,
    private readonly paymentGatewayFactory: PaymentGatewayFactory,
    private readonly paymentsService: PaymentsService,
  ) {}

  async processWebhook(
    gateway: PaymentGatewayType,
    rawBody: Buffer,
    signature: string | undefined,
  ): Promise<{ received: boolean; eventId?: string }> {
    const gw = await this.paymentGatewayFactory.getByType(gateway);

    const signatureValid = signature
      ? gw.verifyWebhookSignature(rawBody, signature)
      : false;

    if (!signatureValid && gateway !== PaymentGatewayType.CASH) {
      this.logger.warn(`Webhook signature verification failed for ${gateway}`);
      return { received: false };
    }

    let parsedEvent: import('./gateways/payment-gateway.interface').WebhookEvent;
    try {
      parsedEvent = gw.parseWebhookEvent(rawBody);
    } catch (err) {
      this.logger.warn(
        `Failed to parse webhook payload for ${gateway}: ${(err as Error).message}`,
      );
      return { received: false };
    }

    if (!parsedEvent.eventId) {
      this.logger.warn(`Webhook event missing eventId for ${gateway}`);
      return { received: false };
    }

    const existing = await this.webhookEventRepository.findOne({
      where: { gateway: parsedEvent.gateway, eventId: parsedEvent.eventId },
    });
    if (existing) {
      this.logger.debug(
        `Duplicate webhook event ignored: ${parsedEvent.eventId}`,
      );
      return { received: true, eventId: parsedEvent.eventId };
    }

    const eventRecord = this.webhookEventRepository.create({
      gateway: parsedEvent.gateway,
      eventId: parsedEvent.eventId,
      payload: parsedEvent.rawPayload,
      processedAt: null,
    });
    try {
      await this.webhookEventRepository.save(eventRecord);
    } catch (err) {
      if (this.isDuplicateWebhookEvent(err)) {
        this.logger.debug(
          `Duplicate webhook event ignored: ${parsedEvent.eventId}`,
        );
        return { received: true, eventId: parsedEvent.eventId };
      }
      throw err;
    }

    try {
      if (parsedEvent.status === 'success' && parsedEvent.gatewayOrderId) {
        await this.handleSuccessfulPayment(parsedEvent);
      }
    } catch (err) {
      this.logger.error(
        `Error processing webhook event ${parsedEvent.eventId}: ${(err as Error).message}`,
      );
    }

    eventRecord.processedAt = new Date();
    await this.webhookEventRepository.save(eventRecord);

    return { received: true, eventId: parsedEvent.eventId };
  }

  private isDuplicateWebhookEvent(err: unknown): boolean {
    if (!(err instanceof QueryFailedError)) return false;
    const driverError = err.driverError as { code?: string } | undefined;
    return driverError?.code === '23505';
  }

  private async handleSuccessfulPayment(
    event: import('./gateways/payment-gateway.interface').WebhookEvent,
  ) {
    const payment = await this.paymentRepository.findOne({
      where: { gatewayOrderId: event.gatewayOrderId },
      relations: { booking: true },
    });
    if (!payment) {
      this.logger.warn(
        `No payment found for gatewayOrderId: ${event.gatewayOrderId}`,
      );
      return;
    }
    if (payment.status === PaymentStatus.SUCCESS) {
      return;
    }

    payment.status = PaymentStatus.SUCCESS;
    payment.transactionId = event.gatewayPaymentId || payment.transactionId;
    payment.gatewayResponse = JSON.stringify(event.rawPayload);
    await this.paymentRepository.save(payment);

    await this.paymentsService.creditProviderWallet(payment);

    this.logger.log(`Payment ${payment.id} marked as SUCCESS via webhook`);
  }
}
