import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
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

  // Infrastructure metrics
  public readonly wsConnections: Gauge<string>;
  public readonly queueDepth: Gauge<string>;
  public readonly cacheHits: Counter<string>;
  public readonly cacheMisses: Counter<string>;
  public readonly dbPoolConnections: Gauge<string>;

  private dbPoolInterval: NodeJS.Timeout | null = null;

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

    // WebSocket connections gauge
    this.wsConnections = new Gauge({
      name: 'ws_connections',
      help: 'Current number of WebSocket connections',
      registers: [this.registry],
    });

    // Queue depth gauge
    this.queueDepth = new Gauge({
      name: 'queue_depth',
      help: 'Current number of jobs waiting in the queue',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    // Cache hit/miss counters
    this.cacheHits = new Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      registers: [this.registry],
    });

    this.cacheMisses = new Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      registers: [this.registry],
    });

    // DB pool connections gauge
    this.dbPoolConnections = new Gauge({
      name: 'db_pool_connections',
      help: 'Current number of active DB pool connections',
      labelNames: ['state'],
      registers: [this.registry],
    });
  }

  onModuleInit() {
    this.activeBookings.set(0);
    this.activeUsers.set(0);
    this.wsConnections.set(0);
    this.queueDepth.set(0);
    this.dbPoolConnections.set({ state: 'idle' }, 0);
    this.dbPoolConnections.set({ state: 'waiting' }, 0);
    this.dbPoolConnections.set({ state: 'active' }, 0);
  }

  onModuleDestroy() {
    if (this.dbPoolInterval) {
      clearInterval(this.dbPoolInterval);
    }
  }

  updateDbPoolMetrics(dataSource: any): void {
    // Best-effort DB pool probe; suppress unsafe-access for private TypeORM internals.
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const pool = dataSource?.driver?.master?.pool;
      // Best-effort DB pool probe; suppress unsafe-access for private TypeORM internals.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (pool && typeof pool.totalCount === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
        const total = pool.totalCount();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const idle = pool.idleCount ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const waiting = pool.waitingCount ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.dbPoolConnections.set({ state: 'idle' }, idle);
        this.dbPoolConnections.set({ state: 'waiting' }, waiting);
        this.dbPoolConnections.set(
          { state: 'active' },
          Math.max(0, total - idle),
        );
      }
    } catch {
      // best-effort
    }
  }

  startDbPoolPolling(dataSource: any, intervalMs = 5000): void {
    this.updateDbPoolMetrics(dataSource);
    this.dbPoolInterval = setInterval(() => {
      this.updateDbPoolMetrics(dataSource);
    }, intervalMs);
  }

  recordCacheHit(): void {
    this.cacheHits.inc();
  }

  recordCacheMiss(): void {
    this.cacheMisses.inc();
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
