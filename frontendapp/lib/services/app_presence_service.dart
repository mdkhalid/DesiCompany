import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import 'api_service.dart';
import 'auth_service.dart';

class PresenceUpdate {
  final String userId;
  final bool online;
  PresenceUpdate(this.userId, this.online);
}

class AppPresenceService {
  static io.Socket? _socket;
  static final _controller = StreamController<PresenceUpdate>.broadcast();

  /// Broadcast stream of presence updates from the global /chat socket.
  static Stream<PresenceUpdate> get updates => _controller.stream;

  static Future<void> connect() async {
    if (_socket != null && _socket!.connected) return;
    final token = await AuthService.getToken();
    if (token == null) return;

    _socket?.disconnect();
    _socket?.dispose();

    final url = '${ApiService.socketBaseUrl}/chat';
    debugPrint('[PRESENCE] Connecting to $url');
    _socket = io.io(
      url,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionDelay(3000)
          .setReconnectionAttempts(100)
          .build(),
    );

    _socket!.onConnect((_) {
      debugPrint('[PRESENCE] App presence socket connected');
    });

    _socket!.onDisconnect((_) {
      debugPrint('[PRESENCE] App presence socket disconnected');
    });

    _socket!.onConnectError((err) {
      debugPrint('[PRESENCE] Connect error: $err');
    });

    _socket!.onError((err) {
      debugPrint('[PRESENCE] Socket error: $err');
    });

    _socket!.on('presence_update', (data) {
      if (data is! Map) return;
      final userId = data['userId']?.toString();
      final online = data['online'] == true;
      if (userId == null) return;
      debugPrint('[PRESENCE] presence_update userId=$userId online=$online');
      _controller.add(PresenceUpdate(userId, online));
    });
  }

  static void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }

  static bool get isConnected => _socket?.connected ?? false;
}
