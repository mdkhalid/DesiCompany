import 'dart:async';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'app_logger.dart';
import 'notification_websocket_service.dart';

class PushNotificationService {
  static FlutterLocalNotificationsPlugin? _localNotifications;
  static StreamSubscription<Map<String, dynamic>>? _notificationSub;
  static StreamSubscription<int>? _unreadCountSub;
  static bool _initialized = false;

  static Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;

    try {
      _localNotifications = FlutterLocalNotificationsPlugin();
      await _initializeLocalNotifications();
      _startWebSocketListener();
    } catch (e, st) {
      AppLogger.e('PushNotification', 'Failed to initialize', e, st);
    }
  }

  static Future<void> _initializeLocalNotifications() async {
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications!.initialize(
      settings: initSettings,
      onDidReceiveNotificationResponse: (details) {
        _handleNotificationTap(details.payload);
      },
    );

    const channel = AndroidNotificationChannel(
      'desicompany_channel',
      'DesiCompany Notifications',
      description: 'Notifications for bookings, messages, and updates',
      importance: Importance.high,
      playSound: true,
      enableVibration: true,
    );

    await _localNotifications!
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);
  }

  static void _startWebSocketListener() {
    _notificationSub = NotificationWebSocketService.notificationStream.listen(
      (notification) {
        _showLocalNotification(
          title: notification['title'] as String? ?? 'New Notification',
          body: notification['message'] as String? ?? '',
          payload: notification['id'] as String?,
        );
      },
    );

    NotificationWebSocketService.connect();
  }

  static void _handleNotificationTap(String? payload) {
    if (payload != null) {}
  }

  static Future<void> _showLocalNotification({
    required String title,
    required String body,
    String? payload,
  }) async {
    if (_localNotifications == null) return;

    const androidDetails = AndroidNotificationDetails(
      'desicompany_channel',
      'DesiCompany Notifications',
      channelDescription: 'Notifications for bookings, messages, and updates',
      importance: Importance.high,
      priority: Priority.high,
      showWhen: true,
      enableVibration: true,
      playSound: true,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _localNotifications!.show(
      id: DateTime.now().millisecondsSinceEpoch.remainder(100000),
      title: title,
      body: body,
      notificationDetails: details,
      payload: payload,
    );
  }

  static void reconnect() {
    NotificationWebSocketService.connect();
  }

  static void dispose() {
    _notificationSub?.cancel();
    _unreadCountSub?.cancel();
    NotificationWebSocketService.dispose();
  }
}
