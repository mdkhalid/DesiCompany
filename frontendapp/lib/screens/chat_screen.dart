import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:emoji_picker_flutter/emoji_picker_flutter.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:http/http.dart' as http;
import 'dart:async';
import 'dart:convert';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../l10n/strings.dart';
import '../models/chat_message.dart';
import '../models/hive_chat_message.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/location_service.dart';
import '../widgets/price_breakdown_card.dart';

import 'package:desicompany/services/app_logger.dart';
class ChatScreen extends StatefulWidget {
  final String? bookingId;
  final String? providerId;
  final String mode;
  final String? providerName;
  const ChatScreen({
    super.key,
    this.bookingId,
    this.providerId,
    this.mode = 'booking',
    this.providerName,
  });
  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  late io.Socket _socket;
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  final List<ChatMessage> _messages = [];
  String? _directRoomId;
  bool _isTyping = false;
  final Set<String> _typingUsers = {};
  String? _currentUserId;
  String? _userRole;
  bool _partnerOnline = false;
  final Set<String> _knownOnlineUserIds = {};
  String _targetLang = 'en';
  bool _translating = false;
  bool _showEmojiPicker = false;

  // Booking info for header card
  Map<String, dynamic>? _bookingInfo;
  bool _loadingBooking = false;

  // Hive box names
  String get _messagesBoxName => 'chat_messages_${widget.bookingId ?? _directRoomId ?? 'direct_${widget.providerId}'}';
  String get _pendingBoxName => 'pending_messages_${widget.bookingId ?? _directRoomId ?? 'direct_${widget.providerId}'}';

  // Hive boxes - nullable until initialized
  Box<HiveChatMessage>? _messagesBox;
  Box<HiveChatMessage>? _pendingBox;

  // Retry timer
  Timer? _retryTimer;

  @override
  void initState() {
    super.initState();
    _loadUserId();
    _initHive();
    _connectSocket();
    if (!_isDirect && widget.bookingId != null) {
      _fetchBookingInfo();
    }
    _startRetryTimer();
  }

  Future<void> _initHive() async {
    _messagesBox = await Hive.openBox<HiveChatMessage>(_messagesBoxName);
    _pendingBox = await Hive.openBox<HiveChatMessage>(_pendingBoxName);
    _loadCachedMessages();
  }

  void _startRetryTimer() {
    _retryTimer = Timer.periodic(const Duration(seconds: 5), (timer) {
      _retryPendingMessages();
    });
  }

  Future<void> _retryPendingMessages() async {
    if (_pendingBox == null || _pendingBox!.isEmpty || !_socket.connected) return;

    final pendingMessages = _pendingBox!.values.toList();
    for (final hiveMsg in pendingMessages) {
      final msg = hiveMsg.toChatMessage();
      if (_isDirect && _directRoomId != null) {
        _socket.emit('send_direct_message', {
          'roomId': _directRoomId,
          'content': msg.content,
        });
      } else if (widget.bookingId != null) {
        _socket.emit('send_message', {
          'bookingId': widget.bookingId,
          'content': msg.content,
        });
      }
    }
  }

  final Set<String> _acceptingQuotes = {};

  Future<void> _loadUserId() async {
    final uid = await AuthService.getUserId();
    final role = await AuthService.getUserRole();
    if (mounted) setState(() { _currentUserId = uid; _userRole = role; });
  }

  bool get _isDirect => widget.mode == 'direct' || widget.mode == 'direct_chat';
  bool get _isProvider => _userRole == 'provider';

  // ==================== MESSAGE CACHING ====================

  String? _resolvePartnerUserId() {
    if (_isDirect) {
      return widget.providerId;
    }
    final info = _bookingInfo;
    if (info == null || _currentUserId == null) return null;
    String? customerUserId;
    String? providerUserId;
    if (info['customer'] is Map) {
      final cu = info['customer']['user'];
      if (cu is Map) customerUserId = cu['id'] as String?;
    }
    if (info['provider'] is Map) {
      final pu = info['provider']['user'];
      if (pu is Map) providerUserId = pu['id'] as String?;
    }
    if (customerUserId == null) return providerUserId;
    if (customerUserId == _currentUserId) return providerUserId;
    return customerUserId;
  }

  Future<void> _fetchHistoricalMessages() async {
    try {
      final type = _isDirect ? 'direct' : 'booking';
      final targetId = _isDirect ? _directRoomId : widget.bookingId;
      if (targetId == null) return;

      final data = await ApiService.get('/chat/messages/$type/$targetId?limit=100');
      final messagesList = data is Map ? data['messages'] : data;
      if (messagesList is List && messagesList.isNotEmpty) {

        final msgs = messagesList.map((m) => ChatMessage.fromJson(Map<String, dynamic>.from(m))).toList();

        // Merge with existing messages (avoid duplicates by ID)
        final existingIds = _messages.map((m) => m.id).toSet();
        for (final m in msgs) {
          if (!existingIds.contains(m.id)) {
            _messages.add(m);
          }
        }
        _messages.sort((a, b) => a.createdAt.compareTo(b.createdAt));
        if (mounted) setState(() {});
        _scrollToBottom();
      } else {

      }
    } catch (e) {

    }
  }

  Future<void> _loadCachedMessages() async {
    try {
      if (_messagesBox != null && _messagesBox!.isNotEmpty) {
        final msgs = _messagesBox!.values.map((hiveMsg) => hiveMsg.toChatMessage()).toList();
        if (mounted) {
          setState(() => _messages.addAll(msgs));
        }
      }
    } catch (e, st) { AppLogger.e('chat_screen', 'Operation failed', e, st); }
  }

  Future<void> _saveMessagesToCache() async {
    try {
      if (_messagesBox == null) return;
      await _messagesBox!.clear();
      for (final msg in _messages) {
        await _messagesBox!.add(HiveChatMessage.fromChatMessage(msg));
      }
    } catch (e, st) { AppLogger.e('chat_screen', 'Operation failed', e, st); }
  }

  Future<void> _addPendingMessage(ChatMessage msg) async {
    try {
      if (_pendingBox == null) return;
      await _pendingBox!.add(HiveChatMessage.fromChatMessage(msg, isPending: true));
    } catch (e, st) { AppLogger.e('chat_screen', 'Operation failed', e, st); }
  }

  Future<void> _removePendingMessage(String id) async {
    try {
      if (_pendingBox == null) return;
      final key = _pendingBox!.keys.firstWhere(
        (key) => _pendingBox!.get(key)?.id == id,
        orElse: () => null,
      );
      if (key != null) {
        await _pendingBox!.delete(key);
      }
    } catch (e, st) { AppLogger.e('chat_screen', 'Operation failed', e, st); }
  }

  // ==================== BOOKING INFO ====================

  Future<void> _fetchBookingInfo() async {
    if (widget.bookingId == null) return;
    setState(() => _loadingBooking = true);
    try {
      final data = await ApiService.get('/bookings/${widget.bookingId}');
      if (mounted) {
        setState(() {
          _bookingInfo = data as Map<String, dynamic>;
          _loadingBooking = false;
          _partnerOnline = _knownOnlineUserIds.contains(_resolvePartnerUserId() ?? '');
        });
      }
    } catch (e, st) { AppLogger.e('chat_screen', 'Operation failed', e, st);
      if (mounted) setState(() => _loadingBooking = false);
    }
  }

  String _bookingStatusLabel(String? status) {
    switch (status) {
      case 'requested': return 'Requested';
      case 'accepted': return 'Accepted';
      case 'on_the_way': return 'On The Way';
      case 'working': return 'Working';
      case 'completed': return 'Completed';
      case 'rejected': return 'Rejected';
      case 'cancelled': return 'Cancelled';
      default: return status ?? '';
    }
  }

  Color _bookingStatusColor(String? status) {
    switch (status) {
      case 'requested': return Colors.orange;
      case 'accepted': return Colors.blue;
      case 'on_the_way': return Colors.purple;
      case 'working': return Colors.teal;
      case 'completed': return Colors.green;
      case 'rejected': return Colors.red;
      case 'cancelled': return Colors.grey;
      default: return Colors.grey;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    _socket.disconnect();
    _socket.dispose();
    _retryTimer?.cancel();
    _messagesBox?.close();
    _pendingBox?.close();
    super.dispose();
  }

  Future<String?> _getToken() => ApiService.getToken();

  Future<void> _connectSocket() async {
    final token = await _getToken();
    final baseWsUrl = ApiService.socketBaseUrl;

    _socket = io.io('$baseWsUrl/chat', <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': true,
      'auth': {'token': token},
    });

    _socket.onConnect((_) {
      if (_isDirect) {
        _socket.emit('start_direct_chat', {'providerId': widget.providerId});
      } else if (widget.bookingId != null) {
        _socket.emit('join', {'bookingId': widget.bookingId});
      }
      _fetchHistoricalMessages();
    });

    _socket.onConnectError((err) async {
      final msg = err.toString().toLowerCase();
      if (msg.contains('unauthorized') || msg.contains('invalid token') || msg.contains('401')) {
        final refreshed = await AuthService.refreshAccessToken();
        if (refreshed != null && mounted) {
          _socket.disconnect();
          _socket.dispose();
          _connectSocket();
        }
      }
    });

    _socket.onDisconnect((_) {
      if (mounted) setState(() => _partnerOnline = false);
    });

    _socket.on('direct_chat_started', (data) {
      final roomId = data['roomId'] as String;
      _directRoomId = roomId;
      if (mounted) {
        setState(() {
          _partnerOnline = _knownOnlineUserIds.contains(_resolvePartnerUserId() ?? '');
        });
      }
      _loadCachedMessages();
      _fetchHistoricalMessages();
      _socket.emit('join_direct_chat', {'roomId': roomId});
    });

    _socket.on('online_status', (data) {
      final raw = data is Map ? data['onlineUserIds'] : null;
      if (raw is List) {
        _knownOnlineUserIds
          ..clear()
          ..addAll(raw.map((id) => id.toString()));
        final partnerId = _resolvePartnerUserId();
        if (mounted) {
          setState(() {
            if (partnerId != null) {
              _partnerOnline = _knownOnlineUserIds.contains(partnerId);
            }
          });
        }
      }
    });

    _socket.on('user_online', (data) {
      final raw = data is Map ? data['userId'] : null;
      if (raw == null) return;
      final userId = raw.toString();
      _knownOnlineUserIds.add(userId);
      final partnerId = _resolvePartnerUserId();
      if (partnerId != null && userId == partnerId && mounted) {
        setState(() => _partnerOnline = true);
      }
    });

    _socket.on('user_offline', (data) {
      final raw = data is Map ? data['userId'] : null;
      if (raw == null) return;
      final userId = raw.toString();
      _knownOnlineUserIds.remove(userId);
      final partnerId = _resolvePartnerUserId();
      if (partnerId != null && userId == partnerId && mounted) {
        setState(() => _partnerOnline = false);
      }
    });

    _socket.on('direct_chat_history', (data) {
      final msgs = data.map((m) => ChatMessage.fromJson(Map<String, dynamic>.from(m))).toList();
      setState(() {
        _messages.clear();
        _messages.addAll(msgs);
      });
      _saveMessagesToCache();
      _scrollToBottom();
    });

    _socket.on('history', (data) {
      final msgs = data.map((m) => ChatMessage.fromJson(Map<String, dynamic>.from(m))).toList();
      setState(() {
        _messages.clear();
        _messages.addAll(msgs);
      });
      _saveMessagesToCache();
      _scrollToBottom();
    });

    _socket.on('new_direct_message', (data) {
      final msg = ChatMessage.fromJson(Map<String, dynamic>.from(data));
      _replaceOrAdd(msg);
      _saveMessagesToCache();
    });

    _socket.on('new_message', (data) {
      final msg = ChatMessage.fromJson(Map<String, dynamic>.from(data));
      _replaceOrAdd(msg);
      _saveMessagesToCache();
    });

    _socket.on('user_typing', (data) {
      final userId = data['userId'] as String;
      final isTyping = data['isTyping'] as bool;
      if (userId == _currentUserId) return;
      setState(() {
        if (isTyping) {
          _typingUsers.add(userId);
        } else {
          _typingUsers.remove(userId);
        }
      });
    });

    _socket.on('messages_read', (data) {
      final messageIds = data['messageIds'] as List<dynamic>?;
      setState(() {
        if (messageIds != null) {
          final ids = messageIds.cast<String>().toSet();
          for (var i = 0; i < _messages.length; i++) {
            if (ids.contains(_messages[i].id)) {
              _messages[i] = _messages[i].copyWith(status: MessageStatus.read, isRead: true);
            }
          }
        } else {
          for (var i = 0; i < _messages.length; i++) {
            if (_messages[i].senderId != _currentUserId) {
              _messages[i] = _messages[i].copyWith(status: MessageStatus.read, isRead: true);
            }
          }
        }
      });
      _saveMessagesToCache();
    });

    _socket.on('message_edited', (data) {
      final id = data['id'] as String?;
      final content = data['content'] as String?;
      if (id != null && content != null) {
        final idx = _messages.indexWhere((m) => m.id == id);
        if (idx != -1) {
          setState(() {
            _messages[idx] = _messages[idx].copyWith(content: content, edited: true);
          });
          _saveMessagesToCache();
        }
      }
    });

    _socket.on('message_deleted', (data) {
      final id = data['id'] as String?;
      if (id != null) {
        final idx = _messages.indexWhere((m) => m.id == id);
        if (idx != -1) {
          setState(() {
            _messages[idx] = _messages[idx].copyWith(
              content: 'This message was deleted',
              deleted: true,
              messageType: MessageType.text,
            );
          });
          _saveMessagesToCache();
        }
      }
    });
  }

  void _addMessage(ChatMessage msg) {
    if (_messages.any((m) => m.id == msg.id)) return;
    setState(() => _messages.add(msg));
    _saveMessagesToCache();
    _scrollToBottom();
    if (msg.senderId != _currentUserId) {
      _sendReadReceipt();
    }
  }

  void _replaceOrAdd(ChatMessage msg) {
    final tempIndex = _messages.indexWhere(
      (m) => m.id.startsWith('temp_') && m.senderId == msg.senderId && m.content == msg.content,
    );
    if (tempIndex != -1) {
      setState(() => _messages[tempIndex] = msg);
      _removePendingMessage(_messages[tempIndex].id);
      _scrollToBottom();
    } else {
      _addMessage(msg);
    }
  }

  void _sendReadReceipt() {
    if (_isDirect && _directRoomId != null) {
      _socket.emit('mark_read', {'roomId': _directRoomId});
    } else if (widget.bookingId != null) {
      _socket.emit('mark_read', {'bookingId': widget.bookingId});
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _sendMessage() {
    if (_controller.text.trim().isEmpty) return;
    final content = _controller.text.trim();
    final tempMsg = ChatMessage(
      id: 'temp_${DateTime.now().millisecondsSinceEpoch}',
      content: content,
      senderId: _currentUserId ?? '',
      senderName: 'You',
      messageType: MessageType.text,
      createdAt: DateTime.now(),
      status: MessageStatus.sent,
    );
    _addMessage(tempMsg);
    
    if (_socket.connected) {
      if (_isDirect && _directRoomId != null) {

        _socket.emit('send_direct_message', {
          'roomId': _directRoomId,
          'content': content,
        });
      } else if (widget.bookingId != null) {
        _socket.emit('send_message', {
          'bookingId': widget.bookingId,
          'content': content,
        });
      }
    } else {

      _addPendingMessage(tempMsg);
    }
    _controller.clear();
  }

  void _sendTyping(bool typing) {
    if (_isDirect && _directRoomId != null) {
      _socket.emit('typing', {
        'isTyping': typing,
        'roomId': _directRoomId,
      });
    } else if (widget.bookingId != null) {
      _socket.emit('typing', {
        'isTyping': typing,
        'bookingId': widget.bookingId,
      });
    }
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1200);
    if (picked == null) return;

    try {
      // Compress image before upload
      final compressedBytes = await FlutterImageCompress.compressWithFile(
        picked.path,
        quality: 75,
        minWidth: 1024,
        minHeight: 1024,
      );
      final bytes = compressedBytes ?? await picked.readAsBytes();

      final token = await _getToken();
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('${ApiService.baseUrl}/uploads/chat-image'),
      );
      request.headers['Authorization'] = 'Bearer $token';
      request.files.add(http.MultipartFile.fromBytes('file', bytes, filename: picked.name, contentType: http.MediaType.parse(picked.mimeType ?? 'image/jpeg')));
      final response = await request.send();
      if (response.statusCode == 201) {
        final body = await response.stream.bytesToString();
        final json = jsonDecode(body);
        final imageUrl = json['url'] as String;

        if (_isDirect && _directRoomId != null) {
          _socket.emit('send_direct_image', {
            'roomId': _directRoomId,
            'imageUrl': imageUrl,
            'caption': null,
          });
        } else {
          _socket.emit('send_image', {
            'bookingId': widget.bookingId,
            'imageUrl': imageUrl,
          });
        }
      }
    } catch (e, st) { AppLogger.e('chat_screen', 'Operation failed', e, st); }
  }

  Future<void> _pickFile() async {
    try {
      final result = await FilePicker.platform.pickFiles();
      if (result == null || result.files.isEmpty) return;

      final file = result.files.first;
      final filePath = file.path;
      if (filePath == null) return;

      final token = await _getToken();
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('${ApiService.baseUrl}/uploads/chat-image'),
      );
      request.headers['Authorization'] = 'Bearer $token';
      request.files.add(
        await http.MultipartFile.fromPath('file', filePath, filename: file.name),
      );

      final response = await request.send();
      if (response.statusCode == 201) {
        final body = await response.stream.bytesToString();
        final json = jsonDecode(body);
        final fileUrl = json['url'] as String;

        if (_isDirect && _directRoomId != null) {
          _socket.emit('send_direct_file', {
            'roomId': _directRoomId,
            'fileUrl': fileUrl,
            'fileName': file.name,
            'fileSize': file.size,
            'fileType': file.extension ?? '',
          });
        } else if (widget.bookingId != null) {
          _socket.emit('send_file', {
            'bookingId': widget.bookingId,
            'fileUrl': fileUrl,
            'fileName': file.name,
            'fileSize': file.size,
            'fileType': file.extension ?? '',
          });
        }

        final tempMsg = ChatMessage(
          id: 'temp_${DateTime.now().millisecondsSinceEpoch}',
          content: file.name,
          senderId: _currentUserId ?? '',
          senderName: 'You',
          messageType: MessageType.document,
          metadata: {
            'fileUrl': fileUrl,
            'fileName': file.name,
            'fileSize': file.size,
            'fileType': file.extension ?? '',
          },
          createdAt: DateTime.now(),
          status: MessageStatus.sent,
        );
        _addMessage(tempMsg);
      }
    } catch (e, st) {
      AppLogger.e('chat_screen', 'File pick failed', e, st);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to send file')),
        );
      }
    }
  }

  Future<void> _sendQuote(double amount) async {
    final message = 'Quote: ₹${amount.toStringAsFixed(0)}';
    if (_isDirect && _directRoomId != null) {
      _socket.emit('send_direct_quote', {
        'roomId': _directRoomId,
        'amount': amount,
        'message': message,
      });
    } else {
      _socket.emit('send_quote_message', {
        'bookingId': widget.bookingId,
        'amount': amount,
        'message': message,
      });
    }
  }

  void _sendQuickReply(String type) {

    if (_isDirect && _directRoomId != null) {
      _socket.emit('send_quick_reply', {
        'roomId': _directRoomId,
        'quickReplyType': type,
      });
    } else {
      _socket.emit('send_quick_reply', {
        'bookingId': widget.bookingId,
        'quickReplyType': type,
      });
    }
  }

  Future<void> _shareLocation() async {
    try {
      final position = await LocationService.getCurrentLocation();
      if (position == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not get location. Please check permissions.')),
          );
        }
        return;
      }

      final address = await LocationService.getAddressFromCoordinates(
        position.latitude,
        position.longitude,
      );

      final content = '📍 $address';
      final metadata = {
        'latitude': position.latitude,
        'longitude': position.longitude,
        'address': address,
      };

      // Send as a regular message with location metadata
      if (_isDirect && _directRoomId != null) {
        _socket.emit('send_direct_message', {
          'roomId': _directRoomId,
          'content': content,
          'messageType': 'location',
          'metadata': metadata,
        });
      } else if (widget.bookingId != null) {
        _socket.emit('send_message', {
          'bookingId': widget.bookingId,
          'content': content,
          'messageType': 'location',
          'metadata': metadata,
        });
      }

      // Add locally
      final tempMsg = ChatMessage(
        id: 'temp_${DateTime.now().millisecondsSinceEpoch}',
        content: content,
        senderId: _currentUserId ?? '',
        senderName: 'You',
        messageType: MessageType.location,
        metadata: metadata,
        createdAt: DateTime.now(),
        status: MessageStatus.sent,
      );
      _addMessage(tempMsg);
    } catch (e, st) {
      AppLogger.e('chat_screen', 'Location share failed', e, st);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to share location')),
        );
      }
    }
  }

  Future<void> _translate() async {
    final visibleMessages = _messages.where((m) => m.isText && (m.senderId != _currentUserId)).toList();
    if (visibleMessages.isEmpty) return;

    setState(() => _translating = true);
    try {
      _targetLang = _targetLang == 'en' ? 'hi' : 'en';
      final lastMsg = visibleMessages.last;
      final body = await ApiService.post('/chat/translate', body: {
        'text': lastMsg.content,
        'targetLang': _targetLang,
      });
      final translated = body['translated'] as String? ?? body['text'] as String?;
      if (translated != null && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(translated),
            duration: const Duration(seconds: 4),
          ),
        );
      }
    } catch (e, st) { AppLogger.e('chat_screen', 'Operation failed', e, st);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Translation failed')),
        );
      }
    } finally {
      if (mounted) setState(() => _translating = false);
    }
  }

  String _formatTime(DateTime? dt) {
    if (dt == null) return '';
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  String _formatDateHeader(DateTime dt) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final messageDate = DateTime(dt.year, dt.month, dt.day);
    final diff = today.difference(messageDate).inDays;

    if (diff == 0) return 'Today';
    if (diff == 1) return 'Yesterday';
    if (diff < 7) {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      return days[dt.weekday - 1];
    }
    if (dt.year == now.year) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return '${months[dt.month - 1]} ${dt.day}';
    }
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${months[dt.month - 1]} ${dt.day}, ${dt.year}';
  }

  bool _shouldShowDateHeader(int index) {
    if (index == 0) return true;
    final current = _messages[index].createdAt;
    final previous = _messages[index - 1].createdAt;
    return current.year != previous.year ||
        current.month != previous.month ||
        current.day != previous.day;
  }

  // Returns true if the current message is from the same sender as the
  // previous message (used to reduce spacing between consecutive messages
  // from the same person, like WhatsApp does).
  bool _isSameSenderAsPrevious(int index) {
    if (index == 0) return false;
    return _messages[index].senderId == _messages[index - 1].senderId;
  }

  @override
  Widget build(BuildContext context) {
    final loc = LocalizationProvider.of(context);
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF66A3FF),
        title: widget.providerName != null
            ? FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      widget.providerName!,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                    ),
                    if (_partnerOnline)
                      Text(
                        'online',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.greenAccent.shade100,
                          fontWeight: FontWeight.w400,
                        ),
                      ),
                  ],
                ),
              )
            : Text(loc.tr('chat')),
        actions: [
          IconButton(
            icon: _targetLang == 'en'
                ? const Icon(Icons.translate)
                : const Icon(Icons.translate, color: Colors.amberAccent),
            onPressed: _translating ? null : _translate,
            tooltip: _targetLang == 'en' ? 'Translate to Hindi' : 'Translate to English',
          ),
        ],
      ),
      body: Column(children: [
        // Booking info header card
        if (!_isDirect && _bookingInfo != null)
          _buildBookingHeader(),
        if (_loadingBooking)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))),
          ),
        // Direct chat banner
        if (_isDirect)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: Colors.blue.shade50,
            child: Text(
              loc.tr('ask_about'),
              style: TextStyle(color: Colors.blue.shade700, fontSize: 13),
              textAlign: TextAlign.center,
            ),
          ),
        Expanded(
          child: _messages.isEmpty
              ? Center(
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.chat_bubble_outline, size: 48, color: Colors.grey.shade400),
                        const SizedBox(height: 12),
                        Text('No messages yet', style: TextStyle(color: Colors.grey.shade600)),
                        const SizedBox(height: 16),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          alignment: WrapAlignment.center,
                          children: _isProvider
                              ? [
                                  ActionChip(label: const Text('Hello'), onPressed: () => _sendQuickReply('need_more_info')),
                                  ActionChip(label: const Text('Confirm booking'), onPressed: () => _sendQuickReply('confirm_booking')),
                                  ActionChip(label: const Text('On my way'), onPressed: () => _sendQuickReply('on_my_way')),
                                ]
                              : [
                                  ActionChip(label: const Text('Hello'), onPressed: () => _sendQuickReply('need_more_info')),
                                  ActionChip(label: const Text('Price?'), onPressed: () => _sendQuickReply('price_negotiate')),
                                  ActionChip(label: const Text('Discount?'), onPressed: () => _sendQuickReply('need_discount')),
                                ],
                        ),
                      ],
                    ),
                  ),
                )
              : ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.all(12),
                  itemCount: _messages.length + (_typingUsers.isNotEmpty ? 1 : 0),
                  itemBuilder: (_, i) {
                    if (i == _messages.length) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8, left: 4),
                        child: Row(
                          mainAxisSize: MainAxisSize.max,
                          mainAxisAlignment: MainAxisAlignment.start,
                          children: [
                            _buildTypingDots(),
                            const SizedBox(width: 6),
                            Text(
                              'typing...',
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: Colors.grey.shade500,
                                fontSize: 12,
                                fontStyle: FontStyle.italic,
                              ),
                            ),
                          ],
                        ),
                      );
                    }

                    final msg = _messages[i];
                    final isMe = msg.senderId == _currentUserId;
                    final isSystem = msg.metadata?['system'] == true;

                    return Column(
                      children: [
                        if (_shouldShowDateHeader(i))
                          _buildDateSeparator(msg.createdAt),
                        if (isSystem)
                          _buildSystemMessage(msg)
                        else
                          Padding(
                            padding: EdgeInsets.only(
                              top: _isSameSenderAsPrevious(i) ? 2 : 8,
                            ),
                            child: GestureDetector(
                              onLongPress: () => _showMessageOptions(msg),
                              child: Row(
                                mainAxisSize: MainAxisSize.max,
                                mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
                                children: [
                                  if (msg.deleted)
                                    _buildDeletedMessage(msg, isMe)
                                  else if (msg.isImage)
                                    _buildImageMessage(msg, isMe)
                                  else if (msg.isDocument)
                                    _buildDocumentMessage(msg, isMe)
                                  else if (msg.isQuote)
                                    _buildQuoteMessage(msg, isMe)
                                  else if (msg.isQuickReply)
                                    _buildQuickReplyMessage(msg, isMe)
                                  else if (msg.isLocation)
                                    _buildLocationMessage(msg, isMe)
                                  else
                                    _buildTextMessage(msg, isMe),
                                ],
                              ),
                            ),
                          ),
                      ],
                    );
                  },
                ),
        ),
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Theme.of(context).scaffoldBackgroundColor,
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 4, offset: const Offset(0, -2))],
          ),
          child: SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_showEmojiPicker)
                  SizedBox(
                    height: 280,
                    child: EmojiPicker(
                      onEmojiSelected: (category, emoji) {
                        _controller
                          ..text += emoji.emoji
                          ..selection = TextSelection.fromPosition(
                            TextPosition(offset: _controller.text.length),
                          );
                      },
                      onCategoryChanged: (category) {},
                      onBackspacePressed: () {
                        final text = _controller.text;
                        if (text.isNotEmpty) {
                          _controller.text = text.substring(0, text.length - 1);
                          _controller.selection = TextSelection.fromPosition(
                            TextPosition(offset: _controller.text.length),
                          );
                        }
                      },
                      config: Config(
                        height: 280,
                        checkPlatformCompatibility: true,
                        emojiViewConfig: EmojiViewConfig(
                          columns: 7,
                          emojiSizeMax: 32,
                          backgroundColor: Theme.of(context).scaffoldBackgroundColor,
                        ),
                        categoryViewConfig: const CategoryViewConfig(
                          initCategory: Category.RECENT,
                        ),
                        bottomActionBarConfig: const BottomActionBarConfig(enabled: false),
                        searchViewConfig: const SearchViewConfig(
                          hintText: 'Search emoji...',
                        ),
                      ),
                    ),
                  ),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    IconButton(
                      icon: Icon(
                        _showEmojiPicker ? Icons.keyboard : Icons.emoji_emotions_outlined,
                        color: _showEmojiPicker ? Colors.blue : null,
                      ),
                      onPressed: () {
                        setState(() => _showEmojiPicker = !_showEmojiPicker);
                      },
                    ),
                    IconButton(
                      icon: const Icon(Icons.add_circle_outline),
                      onPressed: () => _showMoreOptions(loc),
                    ),
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        textInputAction: TextInputAction.send,
                        minLines: 1,
                        maxLines: 4,
                        decoration: InputDecoration(
                          hintText: loc.tr('type_message'),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(24)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        ),
                        onChanged: (v) {
                          if (v.isNotEmpty != _isTyping) {
                            _isTyping = v.isNotEmpty;
                            _sendTyping(v.isNotEmpty);
                          }
                        },
                        onSubmitted: (_) => _sendMessage(),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.send, color: Colors.blue),
                      onPressed: _sendMessage,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ]),
    );
  }

  Widget _buildReadStatusIcon(ChatMessage msg) {
    // WhatsApp-style ticks:
    //   sent     -> single grey tick
    //   delivered -> double grey tick
    //   read     -> double blue tick
    final st = msg.status;
    final isRead = st == 'read' || msg.isRead;
    final isDelivered = st == 'delivered' || isRead;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          _formatTime(msg.createdAt),
          style: TextStyle(fontSize: 10, color: Colors.grey.shade600),
        ),
        const SizedBox(width: 3),
        Icon(
          isDelivered ? Icons.done_all : Icons.done,
          size: 14,
          color: isRead ? Colors.blue : Colors.grey.shade600,
        ),
      ],
    );
  }

  Widget _buildTextMessage(ChatMessage msg, bool isMe) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
      decoration: BoxDecoration(
        color: isMe ? Colors.blue.shade100 : Colors.grey.shade100,
        borderRadius: BorderRadius.only(
          topLeft: const Radius.circular(16),
          topRight: const Radius.circular(16),
          bottomLeft: Radius.circular(isMe ? 16 : 4),
          bottomRight: Radius.circular(isMe ? 4 : 16),
        ),
      ),
      child: IntrinsicWidth(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              msg.content,
              style: const TextStyle(fontSize: 15),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (msg.edited)
                    Text(
                      'edited',
                      style: TextStyle(fontSize: 10, color: Colors.grey.shade500, fontStyle: FontStyle.italic),
                    ),
                  if (msg.edited) const SizedBox(width: 4),
                  _buildReadStatusIcon(msg),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDeletedMessage(ChatMessage msg, bool isMe) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
      decoration: BoxDecoration(
        color: Colors.grey.shade200,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.block, size: 14, color: Colors.grey.shade500),
          const SizedBox(width: 6),
          Text(
            'This message was deleted',
            style: TextStyle(fontSize: 13, color: Colors.grey.shade500, fontStyle: FontStyle.italic),
          ),
        ],
      ),
    );
  }

  Widget _buildImageMessage(ChatMessage msg, bool isMe) {
    final imageUrl = msg.imageUrl ?? msg.content;
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      constraints: BoxConstraints(
        maxWidth: MediaQuery.of(context).size.width * 0.65,
        maxHeight: 300,
      ),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          GestureDetector(
            onTap: () => _openImagePreview(imageUrl),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.network(
                imageUrl,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  height: 100,
                  color: Colors.grey.shade300,
                  child: const Center(child: Icon(Icons.broken_image, size: 40)),
                ),
                loadingBuilder: (_, child, progress) {
                  if (progress == null) return child;
                  return Container(
                    height: 100,
                    color: Colors.grey.shade200,
                    child: const Center(child: CircularProgressIndicator()),
                  );
                },
              ),
            ),
          ),
          if (isMe)
            Padding(
              padding: const EdgeInsets.only(top: 2, right: 4),
              child: _buildReadStatusIcon(msg),
            ),
        ],
      ),
    );
  }

  void _openImagePreview(String imageUrl) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => _ImagePreviewScreen(imageUrl: imageUrl),
      ),
    );
  }

  Widget _buildDocumentMessage(ChatMessage msg, bool isMe) {
    final fileName = msg.documentName ?? 'Document';
    final fileSizeBytes = msg.fileSize;
    final fileType = msg.documentType ?? '';
    final fileUrl = msg.documentUrl ?? '';

    String sizeText = '';
    if (fileSizeBytes != null) {
      if (fileSizeBytes > 1048576) {
        sizeText = '${(fileSizeBytes / 1048576).toStringAsFixed(1)} MB';
      } else if (fileSizeBytes > 1024) {
        sizeText = '${(fileSizeBytes / 1024).toStringAsFixed(1)} KB';
      } else {
        sizeText = '$fileSizeBytes B';
      }
    }

    IconData icon;
    Color iconColor;
    switch (fileType.toLowerCase()) {
      case 'pdf':
        icon = Icons.picture_as_pdf;
        iconColor = Colors.red.shade600;
        break;
      case 'doc':
      case 'docx':
        icon = Icons.description;
        iconColor = Colors.blue.shade600;
        break;
      case 'xls':
      case 'xlsx':
        icon = Icons.table_chart;
        iconColor = Colors.green.shade600;
        break;
      case 'ppt':
      case 'pptx':
        icon = Icons.slideshow;
        iconColor = Colors.orange.shade600;
        break;
      case 'zip':
      case 'rar':
        icon = Icons.folder_zip;
        iconColor = Colors.amber.shade700;
        break;
      default:
        icon = Icons.insert_drive_file;
        iconColor = Colors.grey.shade600;
    }

    return GestureDetector(
      onTap: fileUrl.isNotEmpty ? () => _openFile(fileUrl) : null,
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.all(12),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        decoration: BoxDecoration(
          color: isMe ? Colors.blue.shade50 : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isMe ? Colors.blue.shade200 : Colors.grey.shade300),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 28, color: iconColor),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        fileName,
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (sizeText.isNotEmpty || fileType.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(
                            [if (fileType.isNotEmpty) fileType.toUpperCase(), sizeText]
                                .where((s) => s.isNotEmpty)
                                .join(' - '),
                            style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildReadStatusIcon(msg),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _openFile(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  void _editMessage(ChatMessage msg) {
    final ctrl = TextEditingController(text: msg.content);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Edit Message'),
        content: TextField(
          controller: ctrl,
          maxLines: 3,
          decoration: const InputDecoration(
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(
            onPressed: () {
              final newContent = ctrl.text.trim();
              if (newContent.isNotEmpty && newContent != msg.content) {
                if (_isDirect && _directRoomId != null) {
                  _socket.emit('edit_message', {
                    'messageId': msg.id,
                    'content': newContent,
                    'roomId': _directRoomId,
                  });
                } else if (widget.bookingId != null) {
                  _socket.emit('edit_message', {
                    'messageId': msg.id,
                    'content': newContent,
                    'bookingId': widget.bookingId,
                  });
                }
                // Update locally
                final idx = _messages.indexWhere((m) => m.id == msg.id);
                if (idx != -1) {
                  setState(() {
                    _messages[idx] = _messages[idx].copyWith(content: newContent, edited: true);
                  });
                  _saveMessagesToCache();
                }
              }
              Navigator.pop(ctx);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _deleteMessage(ChatMessage msg) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Message'),
        content: const Text('Are you sure you want to delete this message?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(
            onPressed: () {
              if (_isDirect && _directRoomId != null) {
                _socket.emit('delete_message', {
                  'messageId': msg.id,
                  'roomId': _directRoomId,
                });
              } else if (widget.bookingId != null) {
                _socket.emit('delete_message', {
                  'messageId': msg.id,
                  'bookingId': widget.bookingId,
                });
              }
              // Update locally
              final idx = _messages.indexWhere((m) => m.id == msg.id);
              if (idx != -1) {
                setState(() {
                  _messages[idx] = _messages[idx].copyWith(
                    content: 'This message was deleted',
                    deleted: true,
                    messageType: MessageType.text,
                  );
                });
                _saveMessagesToCache();
              }
              Navigator.pop(ctx);
            },
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  void _showMessageOptions(ChatMessage msg) {
    final isMe = msg.senderId == _currentUserId;
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isMe && msg.isText && !msg.deleted)
              ListTile(
                leading: const Icon(Icons.edit),
                title: const Text('Edit'),
                onTap: () {
                  Navigator.pop(ctx);
                  _editMessage(msg);
                },
              ),
            if (isMe && !msg.deleted)
              ListTile(
                leading: const Icon(Icons.delete, color: Colors.red),
                title: const Text('Delete', style: TextStyle(color: Colors.red)),
                onTap: () {
                  Navigator.pop(ctx);
                  _deleteMessage(msg);
                },
              ),
            if (!isMe || msg.deleted || !msg.isText)
              ListTile(
                leading: const Icon(Icons.info_outline),
                title: const Text('Message Info'),
                subtitle: Text(
                  'Sent at ${_formatTime(msg.createdAt)}',
                ),
                onTap: () => Navigator.pop(ctx),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuoteMessage(ChatMessage msg, bool isMe) {
    final amount = msg.quoteAmount?.toStringAsFixed(0) ?? '';
    final isAccepted = msg.quoteAccepted;
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
      decoration: BoxDecoration(
        color: isMe ? Colors.green.shade50 : Colors.orange.shade50,
        border: Border.all(color: isMe ? Colors.green.shade300 : Colors.orange.shade300),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Quote', style: TextStyle(fontSize: 11, color: isMe ? Colors.green.shade700 : Colors.orange.shade700, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text('₹$amount', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          if (msg.quoteAmount != null && msg.quoteAmount! > 0)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: QuotePriceBreakdown(amount: msg.quoteAmount!),
            ),
          if (isAccepted)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check_circle, size: 14, color: Colors.green.shade700),
                  const SizedBox(width: 4),
                  Text('Accepted', style: TextStyle(fontSize: 12, color: Colors.green.shade700, fontWeight: FontWeight.w500)),
                ],
              ),
            ),
          if (!isMe && !isAccepted)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    height: 32,
                    child: ElevatedButton(
                      onPressed: () => _acceptQuote(msg),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.green,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        textStyle: const TextStyle(fontSize: 12),
                      ),
                      child: const Text('Accept'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    height: 32,
                    child: OutlinedButton(
                      onPressed: () => _declineQuote(msg),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.red,
                        side: const BorderSide(color: Colors.red),
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        textStyle: const TextStyle(fontSize: 12),
                      ),
                      child: const Text('Decline'),
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 4),
          if (isMe)
            _buildReadStatusIcon(msg),
        ],
      ),
    );
  }

  void _acceptQuote(ChatMessage msg) {
    if (_acceptingQuotes.contains(msg.id)) return;
    _acceptingQuotes.add(msg.id);

    if (_isDirect && _directRoomId != null) {
      _socket.emit('send_quick_reply', {
        'roomId': _directRoomId,
        'quickReplyType': 'accept_quote',
        'quoteId': msg.id,
      });
    } else if (widget.bookingId != null) {
      _socket.emit('send_quick_reply', {
        'bookingId': widget.bookingId,
        'quickReplyType': 'accept_quote',
        'quoteId': msg.id,
      });
    }

    // Update local message state
    final idx = _messages.indexWhere((m) => m.id == msg.id);
    if (idx != -1) {
      setState(() {
        _messages[idx] = _messages[idx].copyWith(
          metadata: {...?_messages[idx].metadata, 'accepted': true},
        );
      });
      _saveMessagesToCache();
    }
  }

  void _declineQuote(ChatMessage msg) {
    if (_isDirect && _directRoomId != null) {
      _socket.emit('send_quick_reply', {
        'roomId': _directRoomId,
        'quickReplyType': 'decline_quote',
      });
    } else if (widget.bookingId != null) {
      _socket.emit('send_quick_reply', {
        'bookingId': widget.bookingId,
        'quickReplyType': 'decline_quote',
      });
    }
  }

  Widget _buildQuickReplyMessage(ChatMessage msg, bool isMe) {
    final type = msg.quickReplyType ?? '';
    final label = _quickReplyLabel(type);
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
      decoration: BoxDecoration(
        color: isMe ? Colors.blue.shade50 : Colors.grey.shade100,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isMe ? Colors.blue.shade200 : Colors.grey.shade300,
          width: 0.5,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.quickreply, size: 12, color: Colors.blue.shade400),
              const SizedBox(width: 4),
              Text(
                label,
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.blue.shade400),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            msg.content,
            style: TextStyle(fontSize: 14, color: isMe ? Colors.black87 : Colors.black54),
          ),
          const SizedBox(height: 2),
          _buildReadStatusIcon(msg),
        ],
      ),
    );
  }

  String _quickReplyLabel(String type) {
    switch (type) {
      case 'need_more_info': return 'Quick Reply';
      case 'price_negotiate': return 'Price Negotiation';
      case 'need_discount': return 'Discount Request';
      case 'confirm_booking': return 'Booking Confirmation';
      case 'on_my_way': return 'On My Way';
      case 'work_started': return 'Work Started';
      case 'when_available': return 'Availability Request';
      case 'accept_quote': return 'Quote Accepted';
      case 'decline_quote': return 'Quote Declined';
      default: return 'Quick Reply';
    }
  }

  Widget _buildLocationMessage(ChatMessage msg, bool isMe) {
    final lat = msg.latitude;
    final lng = msg.longitude;
    final address = msg.metadata?['address'] as String? ?? msg.content;
    return GestureDetector(
      onTap: () {
        if (lat != null && lng != null) {
          _openMap(lat, lng);
        }
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        decoration: BoxDecoration(
          color: isMe ? Colors.teal.shade50 : Colors.grey.shade100,
          border: Border.all(color: Colors.teal.shade300),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.location_on, size: 16, color: Colors.teal.shade700),
                const SizedBox(width: 4),
                Text('Location', style: TextStyle(fontSize: 11, color: Colors.teal.shade700, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 6),
            Container(
              height: 120,
              width: 200,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: Colors.grey.shade300,
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Stack(
                  children: [
                    Center(
                      child: Icon(Icons.map, size: 48, color: Colors.grey.shade500),
                    ),
                    Center(
                      child: Icon(Icons.location_pin, size: 32, color: Colors.red.shade700),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              address,
              style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.open_in_new, size: 12, color: Colors.teal.shade600),
                const SizedBox(width: 4),
                Text('Open in Maps', style: TextStyle(fontSize: 11, color: Colors.teal.shade600, decoration: TextDecoration.underline)),
              ],
            ),
            const SizedBox(height: 4),
            _buildReadStatusIcon(msg),
          ],
        ),
      ),
    );
  }

  void _openMap(double lat, double lng) async {
    final url = Uri.parse('https://www.google.com/maps/search/?api=1&query=$lat,$lng');
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  // ==================== DATE SEPARATOR ====================

  Widget _buildDateSeparator(DateTime date) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.grey.shade300.withValues(alpha: 0.6),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            _formatDateHeader(date),
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey.shade800,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }

  // ==================== TYPING DOTS ====================

  Widget _buildTypingDots() {
    return SizedBox(
      width: 36,
      height: 14,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(3, (i) {
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0.3, end: 1.0),
              duration: Duration(milliseconds: 600 + i * 200),
              curve: Curves.easeInOut,
              builder: (context, value, child) {
                return Opacity(
                  opacity: value,
                  child: Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(
                      color: Color(0xFF9E9E9E),
                      shape: BoxShape.circle,
                    ),
                  ),
                );
              },
              onEnd: () => setState(() {}),
            ),
          );
        }),
      ),
    );
  }

  // ==================== BOOKING HEADER CARD ====================

  Widget _buildBookingHeader() {
    final info = _bookingInfo!;
    final status = info['status'] as String? ?? '';
    final statusColor = _bookingStatusColor(status);
    final amount = info['totalAmount'] ?? info['amount'] ?? 0;
    final description = info['description'] as String? ?? info['title'] as String? ?? '';
    final bookingId = info['id'] as String? ?? '';
    final shortId = bookingId.length > 8 ? bookingId.substring(0, 8) : bookingId;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            const Color(0xFF6C3FB4).withValues(alpha: 0.08),
            const Color(0xFF66A3FF).withValues(alpha: 0.04),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF6C3FB4).withValues(alpha: 0.15)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF6C3FB4).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.assignment, size: 20, color: Color(0xFF6C3FB4)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        description.isNotEmpty ? description : 'Booking #$shortId',
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        _bookingStatusLabel(status),
                        style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.currency_rupee, size: 13, color: Color(0xFF6C3FB4)),
                    const SizedBox(width: 2),
                    Text(
                      '₹$amount',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF6C3FB4)),
                    ),
                    const Spacer(),
                    Text(
                      '#$shortId',
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ==================== SYSTEM MESSAGES ====================

  Widget _buildSystemMessage(ChatMessage msg) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 24),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFF43A047).withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF43A047).withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            const Icon(Icons.check_circle, size: 18, color: Color(0xFF43A047)),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                msg.content,
                style: const TextStyle(
                  fontSize: 13,
                  color: Color(0xFF2E7D32),
                  fontWeight: FontWeight.w500,
                  height: 1.3,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showMoreOptions(LocalizationProvider loc) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => SafeArea(
        child: DraggableScrollableSheet(
          initialChildSize: 0.5,
          minChildSize: 0.3,
          maxChildSize: 0.8,
          expand: false,
          builder: (ctx, scrollController) => ListView(
            controller: scrollController,
            children: [
              ListTile(
                leading: const Icon(Icons.image),
                title: const Text('Send Image'),
                onTap: () { Navigator.pop(ctx); _pickImage(); },
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.attach_file),
                title: const Text('Document'),
                onTap: () { Navigator.pop(ctx); _pickFile(); },
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.location_on, color: Colors.teal),
                title: const Text('Share Location'),
                onTap: () { Navigator.pop(ctx); _shareLocation(); },
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.currency_rupee),
                title: const Text('Send Quote'),
                onTap: () { Navigator.pop(ctx); _showQuoteDialog(); },
              ),
              const Divider(height: 1),
              ExpansionTile(
                leading: const Icon(Icons.quickreply),
                title: const Text('Quick Reply'),
                children: _isProvider
                    ? [
                        ListTile(title: const Text('Confirm booking'), onTap: () { Navigator.pop(ctx); _sendQuickReply('confirm_booking'); }),
                        ListTile(title: const Text('On my way'), onTap: () { Navigator.pop(ctx); _sendQuickReply('on_my_way'); }),
                        ListTile(title: const Text('I need more information'), onTap: () { Navigator.pop(ctx); _sendQuickReply('need_more_info'); }),
                        ListTile(title: const Text('Work started'), onTap: () { Navigator.pop(ctx); _sendQuickReply('work_started'); }),
                      ]
                    : [
                        ListTile(title: const Text('Can you give a discount?'), onTap: () { Navigator.pop(ctx); _sendQuickReply('need_discount'); }),
                        ListTile(title: const Text('Can we negotiate on price?'), onTap: () { Navigator.pop(ctx); _sendQuickReply('price_negotiate'); }),
                        ListTile(title: const Text('I need more information'), onTap: () { Navigator.pop(ctx); _sendQuickReply('need_more_info'); }),
                        ListTile(title: const Text('When can you come?'), onTap: () { Navigator.pop(ctx); _sendQuickReply('when_available'); }),
                      ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showQuoteDialog() {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Send Quote'),
        content: TextField(
          controller: ctrl,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
            labelText: 'Amount (₹)',
            border: OutlineInputBorder(),
            prefixText: '₹ ',
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(
            onPressed: () {
              final amt = double.tryParse(ctrl.text);
              if (amt != null && amt > 0) {
                _sendQuote(amt);
                Navigator.pop(ctx);
              }
            },
            child: const Text('Send'),
          ),
        ],
      ),
    );
  }
}

class _ImagePreviewScreen extends StatelessWidget {
  final String imageUrl;
  const _ImagePreviewScreen({required this.imageUrl});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        iconTheme: const IconThemeData(color: Colors.white),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Center(
        child: InteractiveViewer(
          minScale: 0.5,
          maxScale: 4.0,
          child: Image.network(
            imageUrl,
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => const Center(
              child: Icon(Icons.broken_image, size: 64, color: Colors.white54),
            ),
            loadingBuilder: (_, child, progress) {
              if (progress == null) return child;
              return const Center(child: CircularProgressIndicator(color: Colors.white));
            },
          ),
        ),
      ),
    );
  }
}
