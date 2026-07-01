import { Injectable, Logger } from '@nestjs/common';

type FirebaseMessaging = {
  send(message: {
    token: string;
    notification: { title: string; body: string };
    data?: Record<string, string>;
  }): Promise<string>;
};

@Injectable()
export class FirebasePushProvider {
  private readonly logger = new Logger(FirebasePushProvider.name);
  private messaging: FirebaseMessaging | null = null;

  constructor() {
    this.initFirebase().catch(() => {});
  }

  private async initFirebase() {
    try {
      // Dynamic import - firebase-admin is optional
      const firebaseAdmin = await import('firebase-admin').catch(() => null);
      if (!firebaseAdmin) {
        this.logger.warn(
          'firebase-admin not installed. Push notifications disabled.',
        );
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const credential = firebaseAdmin.default.credential.applicationDefault();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const app = firebaseAdmin.default.initializeApp({ credential });
      this.messaging = firebaseAdmin.default.messaging(app);
      this.logger.log('Firebase Admin initialized successfully');
    } catch (error) {
      this.logger.warn(
        `Firebase Admin not configured: ${(error as Error).message}. Push notifications disabled.`,
      );
    }
  }

  async send(payload: {
    token: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<void> {
    if (!this.messaging) {
      this.logger.debug('Firebase not configured, skipping push');
      return;
    }

    await this.messaging.send({
      token: payload.token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data,
    });
  }
}
