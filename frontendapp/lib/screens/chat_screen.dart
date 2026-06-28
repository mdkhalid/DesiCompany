import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import 'dart:async';
import 'dart:convert';
import 'package:hive_flutter/hive_flutter.dart';
import '../l10n/strings.dart';
import '../models/chat_message.dart';
import '../models/hive_chat_message.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

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
  String _targetLang = 'en';
  bool _translating = false;

  // Booking info for header card
  Map<String, dynamic>? _bookingInfo;
  bool _loadingBooking = false;

  // Hive box names
  String get _messagesBoxName => 'chat_messages_${widget.bookingId ?? _directRoomId ?? 'direct_${widget.providerId}'}';
  String get _pendingBoxName => 'pending_messages_${widget.bookingId ?? _directRoomId ?? 'direct_${widget.providerId}'}';

  // Hive boxes
  late Box<HiveChatMessage> _messagesBox;
  late Box<HiveChatMessage> _pendingBox;

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
    if (_pendingBox.isEmpty || !_socket.connected) return;

    final pendingMessages = _pendingBox.values.toList();
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

  Future<void> _loadUserId() async {
    final uid = await AuthService.getUserId();
    if (mounted) setState(() => _currentUserId = uid);
  }

  bool get _isDirect => widget.mode == 'direct' || widget.mode == 'direct_chat';

  // ==================== MESSAGE CACHING ====================

  Future<void> _loadCachedMessages() async {
    try {
      if (_messagesBox.isNotEmpty) {
        final msgs = _messagesBox.values.map((hiveMsg) => hiveMsg.toChatMessage()).toList();
        if (mounted) {
          setState(() => _messages.addAll(msgs));
        }
      }
    } catch (_) {}
  }

  Future<void> _saveMessagesToCache() async {
    try {
      await _messagesBox.clear();
      for (final msg in _messages) {
        await _messagesBox.add(HiveChatMessage.fromChatMessage(msg));
      }
    } catch (_) {}
  }

  Future<void> _addPendingMessage(ChatMessage msg) async {
    try {
      await _pendingBox.add(HiveChatMessage.fromChatMessage(msg, isPending: true));
    } catch (_) {}
  }

  Future<void> _removePendingMessage(String id) async {
    try {
      final key = _pendingBox.keys.firstWhere(
        (key) => _pendingBox.get(key)?.id == id,
        orElse: () => null,
      );
      if (key != null) {
        await _pendingBox.delete(key);
      }
    } catch (_) {}
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
        });
      }
    } catch (_) {
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
    _messagesBox.close();
    _pendingBox.close();
    super.dispose();
  }

  Future<String?> _getToken() => ApiService.getToken();

  Future<void> _connectSocket() async {
    final token = await _getToken();
    final baseWsUrl = ApiService.baseUrl
        .replaceFirst('http://', 'ws://')
        .replaceFirst('https://', 'wss://')
        .replaceFirst('/api/v1', '');

    _socket = io.io('$baseWsUrl/chat', <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': true,
      'auth': {'token': token},
    });

    _socket.onConnect((_) {
      debugPrint('[CHAT] Socket connected');
      if (_isDirect) {
        debugPrint('[CHAT] Starting direct chat with providerId: ${widget.providerId}');
        _socket.emit('start_direct_chat', {'providerId': widget.providerId});
      } else if (widget.bookingId != null) {
        debugPrint('[CHAT] Joining booking: ${widget.bookingId}');
        _socket.emit('join', {'bookingId': widget.bookingId});
      } else {
        debugPrint('[CHAT] No bookingId or providerId - cannot join');
      }
    });

    _socket.onConnectError((err) async {
      debugPrint('[CHAT] Connection error: $err');      final msg = err.toString().toLowerCase();
      if (msg.contains('unauthorized') || msg.contains('invalid token') || msg.contains('401')) {
        final refreshed = await AuthService.refreshAccessToken();
        if (refreshed != null && mounted) {
          _socket.disconnect();
          _socket.dispose();
          _connectSocket();
        }
      }
    });

    _socket.on('direct_chat_started', (data) {
      final roomId = data['roomId'] as String;
      debugPrint('[CHAT] direct_chat_started: roomId=$roomId');
      _directRoomId = roomId;
      _loadCachedMessages(); // reload from new cache key (now based on _directRoomId)
      _socket.emit('join_direct_chat', {'roomId': roomId});
    });

    _socket.on('direct_chat_history', (data) {
      debugPrint('[CHAT] Got direct_chat_history: ${(data as List).length} messages');
      final msgs = data.map((m) => ChatMessage.fromJson(Map<String, dynamic>.from(m))).toList();
      setState(() {
        _messages.clear();
        _messages.addAll(msgs);
      });
      _saveMessagesToCache();
      _scrollToBottom();
    });

    _socket.on('history', (data) {
      debugPrint('[CHAT] Got history: ${(data as List).length} messages');
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
        debugPrint('[CHAT] Sending direct_message to room $_directRoomId');
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
      debugPrint('[CHAT] Offline: Adding message to pending queue');
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
      final token = await _getToken();
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('${ApiService.baseUrl}/uploads/chat-image'),
      );
      request.headers['Authorization'] = 'Bearer $token';
      final bytes = await picked.readAsBytes();
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
    } catch (_) {}
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
    } catch (_) {
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

  @override
  Widget build(BuildContext context) {
    final loc = LocalizationProvider.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(_isDirect && widget.providerName != null
            ? widget.providerName!
            : loc.tr('chat')),
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
                          children: [
                            ActionChip(
                              label: const Text('Hello'),
                              onPressed: () => _sendQuickReply('need_more_info'),
                            ),
                            ActionChip(
                              label: const Text('Price?'),
                              onPressed: () => _sendQuickReply('price_negotiate'),
                            ),
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
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _buildTypingDots(),
                            const SizedBox(width: 6),
                            Text('typing...', style: TextStyle(color: Colors.grey.shade500, fontSize: 12, fontStyle: FontStyle.italic)),
                          ],
                        ),
                      );
                    }

                    final msg = _messages[i];
                    final isMe = msg.senderId == _currentUserId;
                    final isSystem = msg.metadata?['system'] == true;

                    if (isSystem) {
                      return _buildSystemMessage(msg);
                    }

                    return Column(
                      crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                      children: [
                        if (!isMe)
                          Padding(
                            padding: const EdgeInsets.only(left: 4, bottom: 2),
                            child: Text(
                              msg.senderName,
                              style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                            ),
                          ),
                        Row(
                          mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
                          children: [
                            if (msg.isImage)
                              _buildImageMessage(msg, isMe)
                            else if (msg.isQuote)
                              _buildQuoteMessage(msg, isMe)
                            else if (msg.isQuickReply)
                              _buildQuickReplyMessage(msg, isMe)
                            else
                              _buildTextMessage(msg, isMe),
                          ],
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
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
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
          ),
        ),
      ]),
    );
  }

  Widget _buildReadStatusIcon(ChatMessage msg) {
    final isRead = msg.status == 'read' || msg.isRead;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          _formatTime(msg.createdAt),
          style: TextStyle(fontSize: 10, color: Colors.grey.shade600),
        ),
        const SizedBox(width: 3),
        Icon(
          isRead ? Icons.done_all : Icons.done,
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(msg.content, style: const TextStyle(fontSize: 15)),
          const SizedBox(height: 2),
          if (isMe)
            _buildReadStatusIcon(msg)
          else
            Text(
              _formatTime(msg.createdAt),
              style: TextStyle(fontSize: 10, color: Colors.grey.shade600),
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
          ClipRRect(
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
          if (isMe)
            Padding(
              padding: const EdgeInsets.only(top: 2, right: 4),
              child: _buildReadStatusIcon(msg),
            ),
        ],
      ),
    );
  }

  Widget _buildQuoteMessage(ChatMessage msg, bool isMe) {
    final amount = msg.quoteAmount?.toStringAsFixed(0) ?? '';
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
          if (msg.quoteAccepted)
            Text('Accepted', style: TextStyle(fontSize: 12, color: Colors.green.shade700)),
          const SizedBox(height: 4),
          if (isMe)
            _buildReadStatusIcon(msg),
        ],
      ),
    );
  }

  Widget _buildQuickReplyMessage(ChatMessage msg, bool isMe) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
      decoration: BoxDecoration(
        color: isMe ? Colors.blue.shade100 : Colors.grey.shade200,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.blue.shade200, width: 0.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            msg.content,
            style: TextStyle(fontSize: 14, fontStyle: FontStyle.italic, color: isMe ? Colors.black87 : Colors.black54),
          ),
          const SizedBox(height: 2),
          if (isMe)
            _buildReadStatusIcon(msg)
          else
            Text(
              _formatTime(msg.createdAt),
              style: TextStyle(fontSize: 10, color: Colors.grey.shade600),
            ),
        ],
      ),
    );
  }

  // ==================== TYPING DOTS ====================

  Widget _buildTypingDots() {
    return SizedBox(
      width: 28,
      height: 12,
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
            const Color(0xFF7C4DFF).withValues(alpha: 0.04),
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
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.image),
              title: const Text('Send Image'),
              onTap: () {
                Navigator.pop(ctx);
                _pickImage();
              },
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.currency_rupee),
              title: const Text('Send Quote'),
              onTap: () {
                Navigator.pop(ctx);
                _showQuoteDialog();
              },
            ),
            const Divider(height: 1),
            ExpansionTile(
              leading: const Icon(Icons.quickreply),
              title: const Text('Quick Reply'),
              children: [
                ListTile(title: const Text('Can you give a discount?'), onTap: () { Navigator.pop(ctx); _sendQuickReply('need_discount'); }),
                ListTile(title: const Text('Confirm booking'), onTap: () { Navigator.pop(ctx); _sendQuickReply('confirm_booking'); }),
                ListTile(title: const Text('Can we negotiate on price?'), onTap: () { Navigator.pop(ctx); _sendQuickReply('price_negotiate'); }),
                ListTile(title: const Text('I need more information'), onTap: () { Navigator.pop(ctx); _sendQuickReply('need_more_info'); }),
              ],
            ),
          ],
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
