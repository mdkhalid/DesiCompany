import 'dart:async';
import 'dart:convert';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'app_logger.dart';
import 'notification_websocket_service.dart';

class PushNotificationService {
  static FlutterLocalNotificationsPlugin? _localNotifications;
  static StreamSubscription<Map<String, dynamic>>? _notificationSub;
  static StreamSubscription<int>? _unreadCountSub;
  static bool _initialized = false;

  /// Stores the payload from the last system-tray notification tap so the
  /// splash screen (or app shell) can route to the correct screen after
  /// auth state is confirmed.
  static String? pendingNotificationPayload;

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

    // Check if the app was launched by tapping a notification
    final launchDetails = await _localNotifications!.getNotificationAppLaunchDetails();
    if (launchDetails != null && launchDetails.didNotificationLaunchApp) {
      _handleNotificationTap(launchDetails.notificationResponse?.payload);
    }
  }

  static void _startWebSocketListener() {
    _notificationSub = NotificationWebSocketService.notificationStream.listen(
      (notification) {
        _showLocalNotification(
          title: notification['title'] as String? ?? 'New Notification',
          body: notification['message'] as String? ?? '',
          payload: jsonEncode({
            'id': notification['id'],
            'type': notification['type'],
            'metadata': notification['metadata'],
          }),
        );
      },
    );

    NotificationWebSocketService.connect();
  }

  static void _handleNotificationTap(String? payload) {
    if (payload != null) {
      pendingNotificationPayload = payload;
    }
  }

  /// Parses and consumes the pending notification payload, returning a
  /// route that should be opened. Returns null if no pending notification
  /// or the payload cannot be routed.
  ///
  /// Must be called from the app shell after the navigator is ready.
  static Map<String, dynamic>? consumeChatNotification() {
    if (pendingNotificationPayload == null) return null;

    try {
      final data = jsonDecode(pendingNotificationPayload!) as Map<String, dynamic>;
      final metadata = data['metadata'];
      if (metadata is! Map) return null;

      final type = metadata['type'] as String?;
      final isChatNotif = type == 'chat_quick_reply' ||
          type == 'chat_message' ||
          type == 'chat_image' ||
          type == 'chat_file' ||
          type == 'chat_quote' ||
          type == 'direct_message';

      if (!isChatNotif) return null;

      final roomId = metadata['roomId'] as String?;
      final bookingId = metadata['bookingId'] as String?;
      final senderName = metadata['senderName'] as String?;

      return {
        'roomId': roomId,
        'bookingId': bookingId,
        'senderName': senderName,
      };
    } catch (_) {
      return null;
    } finally {
      pendingNotificationPayload = null;
    }
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
