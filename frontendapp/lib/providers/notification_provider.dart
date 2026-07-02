import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_service.dart';
import '../services/notification_websocket_service.dart';

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
      body: json['message'] as String? ?? json['body'] as String? ?? '',
      type: json['type'] as String? ?? 'general',
      data: json['metadata'] as Map<String, dynamic>? ?? json['data'] as Map<String, dynamic>?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      isRead: json['isRead'] as bool? ?? false,
    );
  }

  factory AppNotification.fromWebSocket(Map<String, dynamic> json) {
    return AppNotification(
      id: json['id'] as String,
      title: json['title'] as String,
      body: json['message'] as String? ?? '',
      type: json['type'] as String? ?? 'general',
      data: json['metadata'] as Map<String, dynamic>?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      isRead: json['isRead'] as bool? ?? false,
    );
  }
}

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

class NotificationsNotifier extends StateNotifier<NotificationsState> {
  final Ref ref;
  StreamSubscription<Map<String, dynamic>>? _notificationSubscription;
  StreamSubscription<int>? _unreadCountSubscription;

  NotificationsNotifier(this.ref) : super(const NotificationsState()) {
    _initWebSocket();
  }

  void _initWebSocket() {
    _notificationSubscription = NotificationWebSocketService.notificationStream.listen(
      (notification) {
        final appNotification = AppNotification.fromWebSocket(notification);
        if (!state.notifications.any((n) => n.id == appNotification.id)) {
          state = state.copyWith(
            notifications: [appNotification, ...state.notifications],
            unreadCount: state.unreadCount + 1,
          );
        }
      },
    );

    _unreadCountSubscription = NotificationWebSocketService.unreadCountStream.listen(
      (count) {
        state = state.copyWith(unreadCount: count);
      },
    );
  }

  Future<void> fetchNotifications() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final data = await ApiService.get('/notifications');
      final notificationsList = (data['notifications'] as List)
          .map((json) => AppNotification.fromJson(json as Map<String, dynamic>))
          .toList();

      state = NotificationsState(
        notifications: notificationsList,
        isLoading: false,
        unreadCount: state.unreadCount,
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
    } catch (e) {}
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
    } catch (e) {}
  }

  void clearError() {
    state = state.copyWith(error: null);
  }

  @override
  void dispose() {
    _notificationSubscription?.cancel();
    _unreadCountSubscription?.cancel();
    super.dispose();
  }
}

final notificationsProvider = StateNotifierProvider<NotificationsNotifier, NotificationsState>((ref) {
  return NotificationsNotifier(ref);
});

final unreadNotificationsCountProvider = Provider<int>((ref) {
  return ref.watch(notificationsProvider).unreadCount;
});
