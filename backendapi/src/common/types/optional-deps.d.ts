// Type declarations for optional dependencies loaded via dynamic import
// These are caught with .catch(() => null) at runtime
declare module 'firebase-admin' {
  interface App {
    name: string;
    options: Record<string, any>;
  }
  interface FirebaseAdmin {
    credential: {
      applicationDefault(): any;
      cert(serviceAccountPathOrObject: string | object): any;
    };
    initializeApp(options?: Record<string, any>, appName?: string): App;
    messaging(app?: App): {
      send(message: any, dryRun?: boolean): Promise<string>;
      sendEach(messages: any[], dryRun?: boolean): Promise<any>;
      sendEachForMulticast(messages: any, dryRun?: boolean): Promise<any>;
    };
    firestore(app?: App): any;
  }
  const admin: FirebaseAdmin;
  export default admin;
}

declare module 'twilio' {
  interface TwilioClient {
    messages: {
      create(params: { body: string; from: string; to: string }): Promise<any>;
    };
    verify: {
      services: (sid: string) => {
        verifications: {
          create(params: { to: string; channel: string }): Promise<any>;
        };
        verificationChecks: {
          create(params: { to: string; code: string }): Promise<any>;
        };
      };
    };
  }
  interface Twilio {
    (accountSid: string, authToken: string, opts?: any): TwilioClient;
  }
  const twilio: Twilio;
  export default twilio;
}
