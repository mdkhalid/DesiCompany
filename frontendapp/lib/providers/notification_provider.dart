import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../services/api_service.dart';

// Notification model
class AppNotification {
  final String id;
  final String title;
  final String body;
  final String type;
  final Map<String, dynamic>? data;
  final DateTime createdAt;
  final bool isRead;

  AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    this.data,
    required this.createdAt,
    this.isRead = false,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['id'] as String,
      title: json['title'] as String,
      body: json['body'] as String,
      type: json['type'] as String? ?? 'general',
      data: json['data'] as Map<String, dynamic>?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      isRead: json['isRead'] as bool? ?? false,
    );
  }
}

// Notifications state
class NotificationsState {
  final List<AppNotification> notifications;
  final bool isLoading;
  final String? error;
  final int unreadCount;

  const NotificationsState({
    this.notifications = const [],
    this.isLoading = false,
    this.error,
    this.unreadCount = 0,
  });

  NotificationsState copyWith({
    List<AppNotification>? notifications,
    bool? isLoading,
    String? error,
    int? unreadCount,
  }) {
    return NotificationsState(
      notifications: notifications ?? this.notifications,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      unreadCount: unreadCount ?? this.unreadCount,
    );
  }
}

// Notifications notifier
class NotificationsNotifier extends StateNotifier<NotificationsState> {
  final Ref ref;
  FirebaseMessaging? _messaging;
  StreamSubscription<RemoteMessage>? _onMessageSubscription;
  StreamSubscription<RemoteMessage>? _onMessageOpenedSubscription;

  NotificationsNotifier(this.ref) : super(const NotificationsState()) {
    _initFirebaseMessaging();
  }

  Future<void> _initFirebaseMessaging() async {
    try {
      _messaging = FirebaseMessaging.instance;

      // Request permission
      final settings = await _messaging!.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );

      if (settings.authorizationStatus == AuthorizationStatus.authorized) {
        // Get FCM token
        final token = await _messaging!.getToken();
        if (token != null) {
          await _registerToken(token);
        }

        // Listen for token refresh
        _messaging!.onTokenRefresh.listen((token) {
          _registerToken(token);
        });

        // Handle foreground messages
        _onMessageSubscription = FirebaseMessaging.onMessage.listen((message) {
          _handleForegroundMessage(message);
        });

        // Handle background messages when app is opened
        _onMessageOpenedSubscription = FirebaseMessaging.onMessageOpenedApp.listen((message) {
          _handleMessageOpenedApp(message);
        });

        // Check if app was opened from a notification
        final initialMessage = await _messaging!.getInitialMessage();
        if (initialMessage != null) {
          _handleMessageOpenedApp(initialMessage);
        }
      }
    } catch (e) {
      // Firebase not configured, skip
    }
  }

  Future<void> _registerToken(String token) async {
    try {
      await ApiService.post('/notifications/register-token', body: {
        'token': token,
        'platform': 'mobile',
      });
    } catch (e) {
      // Silently fail
    }
  }

  void _handleForegroundMessage(RemoteMessage message) {
    final notification = AppNotification(
      id: message.messageId ?? DateTime.now().toIso8601String(),
      title: message.notification?.title ?? 'New Notification',
      body: message.notification?.body ?? '',
      type: message.data['type'] ?? 'general',
      data: message.data,
      createdAt: DateTime.now(),
    );

    state = state.copyWith(
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    );
  }

  void _handleMessageOpenedApp(RemoteMessage message) {
    // Navigate to appropriate screen based on notification type
    // Navigation will be handled by the UI layer
  }

  Future<void> fetchNotifications() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final data = await ApiService.get('/notifications');
      final notifications = (data as List)
          .map((json) => AppNotification.fromJson(json as Map<String, dynamic>))
          .toList();
      
      final unreadCount = notifications.where((n) => !n.isRead).length;
      
      state = NotificationsState(
        notifications: notifications,
        isLoading: false,
        unreadCount: unreadCount,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> markAsRead(String notificationId) async {
    try {
      await ApiService.patch('/notifications/$notificationId/read');
      state = state.copyWith(
        notifications: state.notifications.map((n) {
          if (n.id == notificationId) {
            return AppNotification(
              id: n.id,
              title: n.title,
              body: n.body,
              type: n.type,
              data: n.data,
              createdAt: n.createdAt,
              isRead: true,
            );
          }
          return n;
        }).toList(),
        unreadCount: state.unreadCount > 0 ? state.unreadCount - 1 : 0,
      );
    } catch (e) {
      // Silently fail
    }
  }

  Future<void> markAllAsRead() async {
    try {
      await ApiService.patch('/notifications/read-all');
      state = state.copyWith(
        notifications: state.notifications.map((n) {
          return AppNotification(
            id: n.id,
            title: n.title,
            body: n.body,
            type: n.type,
            data: n.data,
            createdAt: n.createdAt,
            isRead: true,
          );
        }).toList(),
        unreadCount: 0,
      );
    } catch (e) {
      // Silently fail
    }
  }

  void clearError() {
    state = state.copyWith(error: null);
  }

  @override
  void dispose() {
    _onMessageSubscription?.cancel();
    _onMessageOpenedSubscription?.cancel();
    super.dispose();
  }
}

// Notifications provider
final notificationsProvider = StateNotifierProvider<NotificationsNotifier, NotificationsState>((ref) {
  return NotificationsNotifier(ref);
});

// Convenience providers
final unreadNotificationsCountProvider = Provider<int>((ref) {
  return ref.watch(notificationsProvider).unreadCount;
});
