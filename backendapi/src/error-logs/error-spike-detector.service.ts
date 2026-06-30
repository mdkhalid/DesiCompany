import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { MoreThan } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorLog } from './entities/error-log.entity';

@Injectable()
export class ErrorSpikeDetector {
  private readonly logger = new Logger(ErrorSpikeDetector.name);
  private lastAlertedAt = 0;

  private get windowMinutes(): number {
    return parseInt(process.env.ERROR_SPIKE_WINDOW_MINUTES || '5', 10);
  }

  private get threshold(): number {
    return parseInt(process.env.ERROR_SPIKE_THRESHOLD || '50', 10);
  }

  private get silenceMinutes(): number {
    return parseInt(process.env.ERROR_SPIKE_SILENCE_MINUTES || '15', 10);
  }

  private get webhookUrl(): string | undefined {
    return process.env.SLACK_WEBHOOK_URL;
  }

  constructor(
    @InjectRepository(ErrorLog)
    private readonly errorLogRepository: Repository<ErrorLog>,
  ) {}

  @Interval(60000)
  async checkSpike(): Promise<void> {
    const url = this.webhookUrl;
    if (!url) return;

    const windowMs = this.windowMinutes * 60 * 1000;
    const since = new Date(Date.now() - windowMs);
    const count = await this.errorLogRepository.count({
      where: { createdAt: MoreThan(since) },
    });

    if (count < this.threshold) return;

    const now = Date.now();
    if (now - this.lastAlertedAt < this.silenceMinutes * 60 * 1000) return;

    this.lastAlertedAt = now;

    const message = [
      `⚠️ *Error Spike Detected*`,
      `> *Count:* ${count} errors in the last ${this.windowMinutes} minutes`,
      `> *Threshold:* ${this.threshold}`,
      `> *Time:* ${new Date().toISOString()}`,
    ].join('\n');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      });
      if (!response.ok) {
        this.logger.error(`Slack alert failed: ${response.status}`);
      } else {
        this.logger.warn(
          `Slack alert sent: ${count} errors in ${this.windowMinutes}min`,
        );
      }
    } catch (err) {
      this.logger.error('Failed to send Slack alert', (err as Error).stack);
    }
  }
}
