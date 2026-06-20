export interface PushNotificationPayload {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushNotificationProvider {
  send(payload: PushNotificationPayload): Promise<void>;
}
