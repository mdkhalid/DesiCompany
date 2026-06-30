import 'dart:convert';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'api_service.dart';

class PushNotificationService {
  static FirebaseMessaging? _messaging;
  static FlutterLocalNotificationsPlugin? _localNotifications;
  static String? _fcmToken;

  static Future<void> initialize() async {
    try {
      // Initialize Firebase
      await Firebase.initializeApp();
      
      _messaging = FirebaseMessaging.instance;
      _localNotifications = FlutterLocalNotificationsPlugin();

      // Request permission
      final settings = await _messaging!.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
        criticalAlert: false,
        carPlay: false,
      );

      if (settings.authorizationStatus == AuthorizationStatus.authorized) {
        // Initialize local notifications
        await _initializeLocalNotifications();

        // Get FCM token
        _fcmToken = await _messaging!.getToken();
        if (_fcmToken != null) {
          await _registerToken(_fcmToken!);
        }

        // Listen for token refresh
        _messaging!.onTokenRefresh.listen((token) {
          _fcmToken = token;
          _registerToken(token);
        });

        // Handle foreground messages
        FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

        // Handle background messages when app is opened
        FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageOpenedApp);

        // Check if app was opened from a notification
        final initialMessage = await _messaging!.getInitialMessage();
        if (initialMessage != null) {
          _handleMessageOpenedApp(initialMessage);
        }
      }
    } catch (e) {
      // Firebase not configured, skip
      print('Push notifications not available: $e');
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
      initSettings,
      onDidReceiveNotificationResponse: (details) {
        // Handle notification tap
        _handleNotificationTap(details.payload);
      },
    );

    // Create notification channel for Android
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

  static Future<void> _registerToken(String token) async {
    try {
      await ApiService.post('/notifications/register-token', body: {
        'token': token,
        'platform': 'mobile',
      });
    } catch (e) {
      // Silently fail
    }
  }

  static void _handleForegroundMessage(RemoteMessage message) {
    final notification = message.notification;
    if (notification != null) {
      _showLocalNotification(
        title: notification.title ?? 'New Notification',
        body: notification.body ?? '',
        payload: jsonEncode(message.data),
      );
    }
  }

  static void _handleMessageOpenedApp(RemoteMessage message) {
    // Navigate to appropriate screen based on notification type
    // Navigation will be handled by the UI layer
  }

  static void _handleNotificationTap(String? payload) {
    if (payload != null) {
      // Navigate to appropriate screen based on notification type
    }
  }

  static Future<void> _showLocalNotification({
    required String title,
    required String body,
    String? payload,
  }) async {
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
      DateTime.now().millisecondsSinceEpoch.remainder(100000),
      title,
      body,
      details,
      payload: payload,
    );
  }

  static String? get fcmToken => _fcmToken;

  static Future<void> unsubscribeFromTopic(String topic) async {
    await _messaging?.unsubscribeFromTopic(topic);
  }

  static Future<void> subscribeToTopic(String topic) async {
    await _messaging?.subscribeToTopic(topic);
  }
}
