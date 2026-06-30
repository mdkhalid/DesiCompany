import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../services/api_service.dart';
import '../models/chat_message.dart';
import 'auth_provider.dart';

// Chat state
class ChatState {
  final List<ChatMessage> messages;
  final bool isLoading;
  final bool isConnected;
  final String? error;
  final bool hasMore;
  final int page;

  const ChatState({
    this.messages = const [],
    this.isLoading = false,
    this.isConnected = false,
    this.error,
    this.hasMore = true,
    this.page = 1,
  });

  ChatState copyWith({
    List<ChatMessage>? messages,
    bool? isLoading,
    bool? isConnected,
    String? error,
    bool? hasMore,
    int? page,
  }) {
    return ChatState(
      messages: messages ?? this.messages,
      isLoading: isLoading ?? this.isLoading,
      isConnected: isConnected ?? this.isConnected,
      error: error,
      hasMore: hasMore ?? this.hasMore,
      page: page ?? this.page,
    );
  }
}

// Chat notifier
class ChatNotifier extends StateNotifier<ChatState> {
  final Ref ref;
  io.Socket? _socket;
  Timer? _reconnectTimer;
  Timer? _heartbeatTimer;
  String? _currentBookingId;
  String? _currentProviderId;
  static const int _pageSize = 50;
  static const Duration _reconnectDelay = Duration(seconds: 3);
  static const Duration _heartbeatInterval = Duration(seconds: 30);

  ChatNotifier(this.ref) : super(const ChatState());

  void connect(String? bookingId, String? providerId, {String mode = 'booking'}) {
    _currentBookingId = bookingId;
    _currentProviderId = providerId;
    
    _disconnect();
    _initSocket(bookingId, providerId, mode: mode);
  }

  void _initSocket(String? bookingId, String? providerId, {String mode = 'booking'}) {
    final user = ref.read(currentUserProvider);
    if (user == null) return;

    _socket = io.io(
      ApiService.baseUrl.replaceAll('/api/v1', ''),
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setAuth({'token': user.token})
          .build(),
    );

    _socket!.onConnect((_) {
      state = state.copyWith(isConnected: true, error: null);
      _startHeartbeat();
      
      // Join appropriate room
      if (mode == 'booking' && bookingId != null) {
        _socket!.emit('join_booking', {'bookingId': bookingId});
      } else if (mode == 'direct' && providerId != null) {
        _socket!.emit('join_direct', {'providerId': providerId});
      }
    });

    _socket!.onDisconnect((_) {
      state = state.copyWith(isConnected: false);
      _stopHeartbeat();
      _scheduleReconnect();
    });

    _socket!.onConnectError((error) {
      state = state.copyWith(isConnected: false, error: 'Connection failed');
      _scheduleReconnect();
    });

    _socket!.onError((error) {
      state = state.copyWith(error: 'Socket error');
    });

    // Listen for new messages
    _socket!.on('new_message', (data) {
      if (data is Map<String, dynamic>) {
        final message = ChatMessage.fromJson(data);
        state = state.copyWith(
          messages: [...state.messages, message],
        );
      }
    });

    // Listen for direct messages
    _socket!.on('new_direct_message', (data) {
      if (data is Map<String, dynamic>) {
        final message = ChatMessage.fromJson(data);
        state = state.copyWith(
          messages: [...state.messages, message],
        );
      }
    });

    // Listen for typing indicators
    _socket!.on('user_typing', (data) {
      // Handle typing indicator
    });

    _socket!.connect();
  }

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(_reconnectDelay, () {
      if (!state.isConnected) {
        _initSocket(_currentBookingId, _currentProviderId);
      }
    });
  }

  void _startHeartbeat() {
    _stopHeartbeat();
    _heartbeatTimer = Timer.periodic(_heartbeatInterval, (_) {
      _socket?.emit('ping');
    });
  }

  void _stopHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
  }

  void _disconnect() {
    _reconnectTimer?.cancel();
    _stopHeartbeat();
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }

  Future<void> loadMessages({
    String? bookingId,
    String? providerId,
    String mode = 'booking',
    bool refresh = false,
  }) async {
    if (refresh) {
      state = state.copyWith(page: 1, hasMore: true);
    }

    if (!state.hasMore && !refresh) return;

    state = state.copyWith(isLoading: true, error: null);
    try {
      String endpoint;
      if (mode == 'booking' && bookingId != null) {
        endpoint = '/chat/$bookingId/messages?page=${state.page}&limit=$_pageSize';
      } else if (mode == 'direct' && providerId != null) {
        endpoint = '/chat/direct/$providerId/messages?page=${state.page}&limit=$_pageSize';
      } else {
        return;
      }

      final data = await ApiService.get(endpoint);
      final messages = (data as List)
          .map((json) => ChatMessage.fromJson(json as Map<String, dynamic>))
          .toList();

      if (refresh) {
        state = state.copyWith(
          messages: messages,
          isLoading: false,
          page: 2,
          hasMore: messages.length >= _pageSize,
        );
      } else {
        state = state.copyWith(
          messages: [...state.messages, ...messages],
          isLoading: false,
          page: state.page + 1,
          hasMore: messages.length >= _pageSize,
        );
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void sendMessage(String content, {String? bookingId, String? providerId, String mode = 'booking'}) {
    if (_socket == null || !state.isConnected) {
      state = state.copyWith(error: 'Not connected');
      return;
    }

    if (mode == 'booking' && bookingId != null) {
      _socket!.emit('send_message', {
        'bookingId': bookingId,
        'content': content,
        'type': 'text',
      });
    } else if (mode == 'direct' && providerId != null) {
      _socket!.emit('send_direct_message', {
        'receiverId': providerId,
        'content': content,
        'type': 'text',
      });
    }
  }

  void sendImage(String imageUrl, {String? bookingId, String? providerId, String mode = 'booking'}) {
    if (_socket == null || !state.isConnected) return;

    if (mode == 'booking' && bookingId != null) {
      _socket!.emit('send_message', {
        'bookingId': bookingId,
        'content': imageUrl,
        'type': 'image',
      });
    } else if (mode == 'direct' && providerId != null) {
      _socket!.emit('send_direct_message', {
        'receiverId': providerId,
        'content': imageUrl,
        'type': 'image',
      });
    }
  }

  void startTyping({String? bookingId, String? providerId, String mode = 'booking'}) {
    if (_socket == null) return;
    if (mode == 'booking' && bookingId != null) {
      _socket!.emit('typing_start', {'bookingId': bookingId});
    } else if (mode == 'direct' && providerId != null) {
      _socket!.emit('typing_start', {'receiverId': providerId});
    }
  }

  void stopTyping({String? bookingId, String? providerId, String mode = 'booking'}) {
    if (_socket == null) return;
    if (mode == 'booking' && bookingId != null) {
      _socket!.emit('typing_stop', {'bookingId': bookingId});
    } else if (mode == 'direct' && providerId != null) {
      _socket!.emit('typing_stop', {'receiverId': providerId});
    }
  }

  void clearMessages() {
    state = const ChatState();
  }

  void clearError() {
    state = state.copyWith(error: null);
  }

  @override
  void dispose() {
    _disconnect();
    super.dispose();
  }
}

// Chat provider
final chatProvider = StateNotifierProvider<ChatNotifier, ChatState>((ref) {
  return ChatNotifier(ref);
});

// Convenience providers
final isChatConnectedProvider = Provider<bool>((ref) {
  return ref.watch(chatProvider).isConnected;
});

final chatMessagesProvider = Provider<List<ChatMessage>>((ref) {
  return ref.watch(chatProvider).messages;
});
