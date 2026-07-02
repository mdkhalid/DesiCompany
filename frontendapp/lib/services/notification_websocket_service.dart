import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'auth_service.dart';
import 'api_service.dart';
import 'app_logger.dart';

class NotificationWebSocketService {
  static io.Socket? _socket;
  static Timer? _reconnectTimer;
  static Timer? _heartbeatTimer;
  static bool _isConnected = false;
  static bool _shouldReconnect = true;
  static int _reconnectAttempts = 0;
  static const int _maxReconnectAttempts = 10;

  static final StreamController<Map<String, dynamic>> _notificationController =
      StreamController<Map<String, dynamic>>.broadcast();

  static final StreamController<int> _unreadCountController =
      StreamController<int>.broadcast();

  static Stream<Map<String, dynamic>> get notificationStream =>
      _notificationController.stream;

  static Stream<int> get unreadCountStream => _unreadCountController.stream;

  static bool get isConnected => _isConnected;

  static Future<void> connect() async {
    if (_socket != null && _isConnected) return;

    _shouldReconnect = true;
    _reconnectAttempts = 0;

    final token = await AuthService.getToken();
    if (token == null || token.isEmpty) {
      AppLogger.d('NotificationWS', 'No token available, skipping connection');
      return;
    }

    _disconnect();

    final baseUrl = ApiService.baseUrl.replaceAll('/api/v1', '');
    final wsUrl = baseUrl.replaceFirst('http://', 'ws://').replaceFirst('https://', 'wss://');

    try {
      _socket = io.io('$wsUrl/notifications', {
        'transports': ['websocket'],
        'auth': {'token': token},
        'reconnection': false,
      });

      _socket!.onConnect((_) {
        _isConnected = true;
        _reconnectAttempts = 0;
        AppLogger.d('NotificationWS', 'Connected to notification server');
        _startHeartbeat();
      });

      _socket!.onDisconnect((_) {
        _isConnected = false;
        AppLogger.d('NotificationWS', 'Disconnected from notification server');
        _stopHeartbeat();
        _scheduleReconnect();
      });

      _socket!.onConnectError((error) {
        AppLogger.e('NotificationWS', 'Connection error', error as Object?);
        _isConnected = false;
        _scheduleReconnect();
      });

      _socket!.on('notification', (data) {
        if (data is Map) {
          _notificationController.add(data.cast<String, dynamic>());
        }
      });

      _socket!.on('unread_count', (data) {
        if (data is Map && data.containsKey('count')) {
          _unreadCountController.add(data['count'] as int);
        }
      });

      _socket!.on('error', (error) {
        AppLogger.e('NotificationWS', 'Server error', error as Object?);
      });

      _socket!.connect();
    } catch (e, st) {
      AppLogger.e('NotificationWS', 'Failed to connect', e, st);
      _scheduleReconnect();
    }
  }

  static void reconnect() {
    connect();
  }

  static void disconnect() {
    _shouldReconnect = false;
    _disconnect();
  }

  static void _disconnect() {
    _socket?.disconnect();
    _socket?.clearListeners();
    _socket = null;
    _isConnected = false;
    _stopHeartbeat();
  }

  static void _startHeartbeat() {
    _stopHeartbeat();
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      _socket?.emit('ping', {'timestamp': DateTime.now().toIso8601String()});
    });
  }

  static void _stopHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
  }

  static void _scheduleReconnect() {
    if (!_shouldReconnect) return;
    if (_reconnectAttempts >= _maxReconnectAttempts) {
      AppLogger.d('NotificationWS', 'Max reconnect attempts reached');
      return;
    }

    _reconnectTimer?.cancel();
    final delay = Duration(
      seconds: (_reconnectAttempts + 1) * 2,
    );
    _reconnectAttempts++;

    AppLogger.d('NotificationWS', 'Reconnecting in ${delay.inSeconds}s (attempt $_reconnectAttempts)');
    _reconnectTimer = Timer(delay, () {
      connect();
    });
  }

  static void dispose() {
    disconnect();
    _reconnectTimer?.cancel();
    _notificationController.close();
    _unreadCountController.close();
  }
}
