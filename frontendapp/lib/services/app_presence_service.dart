import 'dart:async';

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

  static Stream<PresenceUpdate> get updates => _controller.stream;

  static Future<void> connect() async {
    if (_socket != null && _socket!.connected) return;
    final token = await AuthService.getToken();
    if (token == null) return;

    _socket?.disconnect();
    _socket?.dispose();

    final url = '${ApiService.socketBaseUrl}/chat';
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

    _socket!.on('presence_update', (data) {
      if (data is! Map) return;
      final userId = data['userId']?.toString();
      final online = data['online'] == true;
      if (userId == null) return;
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
