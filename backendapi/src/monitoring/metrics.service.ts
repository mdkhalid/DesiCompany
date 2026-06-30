import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: Registry;

  // HTTP request metrics
  public readonly httpRequestDuration: Histogram<string>;
  public readonly httpRequestTotal: Counter<string>;
  public readonly httpRequestErrors: Counter<string>;

  // Business metrics
  public readonly activeBookings: Gauge<string>;
  public readonly activeUsers: Gauge<string>;
  public readonly bookingsTotal: Counter<string>;
  public readonly paymentsTotal: Counter<string>;
  public readonly paymentAmount: Histogram<string>;

  constructor() {
    this.registry = new Registry();

    // Collect default Node.js metrics (CPU, memory, etc.)
    collectDefaultMetrics({ register: this.registry });

    // HTTP request duration histogram
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    // HTTP request counter
    this.httpRequestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    // HTTP error counter
    this.httpRequestErrors = new Counter({
      name: 'http_request_errors_total',
      help: 'Total number of HTTP errors',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    // Active bookings gauge
    this.activeBookings = new Gauge({
      name: 'active_bookings',
      help: 'Number of currently active bookings',
      registers: [this.registry],
    });

    // Active users gauge
    this.activeUsers = new Gauge({
      name: 'active_users',
      help: 'Number of currently active users',
      registers: [this.registry],
    });

    // Bookings counter
    this.bookingsTotal = new Counter({
      name: 'bookings_total',
      help: 'Total number of bookings created',
      labelNames: ['status', 'service_category'],
      registers: [this.registry],
    });

    // Payments counter
    this.paymentsTotal = new Counter({
      name: 'payments_total',
      help: 'Total number of payments processed',
      labelNames: ['gateway', 'status'],
      registers: [this.registry],
    });

    // Payment amount histogram
    this.paymentAmount = new Histogram({
      name: 'payment_amount_inr',
      help: 'Payment amount in INR',
      labelNames: ['gateway'],
      buckets: [100, 500, 1000, 2000, 5000, 10000, 25000, 50000],
      registers: [this.registry],
    });
  }

  onModuleInit() {
    // Initialize gauges with 0
    this.activeBookings.set(0);
    this.activeUsers.set(0);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  async getContentType(): Promise<string> {
    return this.registry.contentType;
  }
}
