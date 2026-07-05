import 'dart:async';

import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../l10n/strings.dart';
import 'chat_screen.dart';

class Conversation {
  final String id;
  final String partnerId;
  final String partnerName;
  final String? partnerImage;
  final String? bookingId;
  final String? bookingStatus;
  final String? lastMessage;
  final DateTime? lastMessageTime;
  final int unreadCount;
  final bool isDirect;
  bool isOnline;
  final List<String> bookingIds;

  Conversation({
    required this.id,
    required this.partnerId,
    required this.partnerName,
    this.partnerImage,
    this.bookingId,
    this.bookingStatus,
    this.lastMessage,
    this.lastMessageTime,
    this.unreadCount = 0,
    this.isDirect = false,
    this.isOnline = false,
    this.bookingIds = const [],
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    return Conversation(
      id: json['id'] ?? '',
      partnerId: json['partnerId'] ?? '',
      partnerName: json['partnerName'] ?? '',
      partnerImage: json['partnerImage'],
      bookingId: json['bookingId'],
      bookingStatus: json['bookingStatus'],
      lastMessage: json['lastMessage'],
      lastMessageTime: json['lastMessageTime'] != null
          ? DateTime.tryParse(json['lastMessageTime'].toString())
          : (json['lastMessageAt'] != null
              ? DateTime.tryParse(json['lastMessageAt'].toString())
              : null),
      unreadCount: json['unreadCount'] ?? 0,
      isDirect: json['type'] == 'direct',
      isOnline: json['isOnline'] == true,
      bookingIds: (json['bookingIds'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
    );
  }
}

class ConversationListScreen extends StatefulWidget {
  const ConversationListScreen({super.key});
  @override
  State<ConversationListScreen> createState() => _ConversationListScreenState();
}

class _ConversationListScreenState extends State<ConversationListScreen>
    with WidgetsBindingObserver {
  List<Conversation> _conversations = [];
  List<Conversation> _searchResults = [];
  bool _loading = true;
  bool _searching = false;
  String? _error;
  String _searchQuery = '';
  io.Socket? _socket;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadConversations();
    _connectSocket();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _searchController.dispose();
    _disconnectSocket();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _loadConversations();
      if (_socket == null || !_socket!.connected) {
        _connectSocket();
      }
    }
  }

  void _connectSocket() async {
    final token = await AuthService.getToken();
    if (token == null) return;

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

    _socket!.onConnect((_) {});

    _socket!.on('online_status', (data) {
      final raw = data is Map ? data['onlineUserIds'] : null;
      if (raw is List && mounted) {
        final onlineIds = raw.map((e) => e.toString()).toSet();
        setState(() {
          for (final c in _conversations) {
            if (onlineIds.contains(c.partnerId)) c.isOnline = true;
          }
          for (final c in _searchResults) {
            if (onlineIds.contains(c.partnerId)) c.isOnline = true;
          }
        });
      }
    });

    _socket!.on('user_online', (data) {
      final raw = data is Map ? data['userId'] : null;
      if (raw == null) return;
      final userId = raw.toString();
      if (mounted) {
        setState(() {
          for (final c in _conversations) {
            if (c.partnerId == userId) c.isOnline = true;
          }
          for (final c in _searchResults) {
            if (c.partnerId == userId) c.isOnline = true;
          }
        });
      }
    });

    _socket!.on('user_offline', (data) {
      final raw = data is Map ? data['userId'] : null;
      if (raw == null) return;
      final userId = raw.toString();
      if (mounted) {
        setState(() {
          for (final c in _conversations) {
            if (c.partnerId == userId) c.isOnline = false;
          }
          for (final c in _searchResults) {
            if (c.partnerId == userId) c.isOnline = false;
          }
        });
      }
    });

    _socket!.on('presence_update', (data) {
      if (data is! Map) return;
      final userId = data['userId']?.toString();
      final online = data['online'] == true;
      if (userId == null || !mounted) return;
      setState(() {
        for (final c in _conversations) {
          if (c.partnerId == userId) c.isOnline = online;
        }
        for (final c in _searchResults) {
          if (c.partnerId == userId) c.isOnline = online;
        }
      });
    });

    _socket!.on('new_message', (data) {
      _loadConversations();
    });

    _socket!.on('new_direct_message', (data) {
      _loadConversations();
    });

    _socket!.on('messages_read', (data) {
      _loadConversations();
    });

    _socket!.onConnectError((err) async {
      final msg = err.toString().toLowerCase();
      if (msg.contains('unauthorized') || msg.contains('invalid token') || msg.contains('jwt expired')) {
        final refreshed = await AuthService.refreshAccessToken();
        if (refreshed != null && mounted) {
          _socket?.disconnect();
          _socket?.dispose();
          _connectSocket();
        }
      }
    });

    _socket!.onDisconnect((_) {});
  }

  void _disconnectSocket() {
    _socket?.off('new_message');
    _socket?.off('new_direct_message');
    _socket?.off('messages_read');
    _socket?.off('online_status');
    _socket?.off('user_online');
    _socket?.off('user_offline');
    _socket?.off('presence_update');
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }

  Future<void> _loadConversations() async {
    try {
      setState(() {
        _loading = true;
        _error = null;
      });
      final data = await ApiService.get('/chat/conversations');
      if (!mounted) return;

      // Preserve socket-updated isOnline state from existing conversations
      final existingOnlineMap = <String, bool>{};
      for (final c in _conversations) {
        if (c.isOnline) existingOnlineMap[c.partnerId] = true;
      }
      for (final c in _searchResults) {
        if (c.isOnline) existingOnlineMap[c.partnerId] = true;
      }

      setState(() {
        final list = data is List ? data : (data['conversations'] as List);
        _conversations = list.map((c) => Conversation.fromJson(c)).toList();
        // Merge: if socket knew a partner was online, keep it online
        for (final c in _conversations) {
          if (existingOnlineMap[c.partnerId] == true) c.isOnline = true;
        }
        for (final c in _searchResults) {
          if (existingOnlineMap[c.partnerId] == true) c.isOnline = true;
        }
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _searchConversations(String query) async {
    if (query.trim().isEmpty) {
      setState(() {
        _searchResults = [];
        _searching = false;
      });
      return;
    }

    setState(() {
      _searching = true;
      _searchQuery = query;
    });

    try {
      final data = await ApiService.get('/chat/conversations/search?q=${Uri.encodeComponent(query.trim())}');
      if (!mounted) return;
      setState(() {
        final list = data is List ? data : (data['conversations'] as List? ?? []);
        _searchResults = list.map((c) => Conversation.fromJson(c)).toList();
        _searching = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _searchResults = [];
        _searching = false;
      });
    }
  }

  void _clearSearch() {
    _searchController.clear();
    setState(() {
      _searchQuery = '';
      _searchResults = [];
    });
  }

  void _openChat(Conversation conv) async {
    String? selectedBookingId = conv.bookingId;

    if (conv.bookingIds.length > 1) {
      selectedBookingId = await _showBookingSelector(conv);
      if (selectedBookingId == null) return;
    }

    if (!mounted) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => conv.isDirect
            ? ChatScreen(
                mode: 'direct',
                providerId: conv.partnerId,
                providerName: conv.partnerName,
              )
            : ChatScreen(
                bookingId: selectedBookingId,
                providerName: conv.partnerName,
              ),
      ),
    ).then((_) => _loadConversations());
  }

  Future<String?> _showBookingSelector(Conversation conv) async {
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Select Booking'),
        content: SizedBox(
          width: double.maxFinite,
          child: ListView.builder(
            shrinkWrap: true,
            itemCount: conv.bookingIds.length,
            itemBuilder: (ctx, i) {
              final bookingId = conv.bookingIds[i];
              return ListTile(
                title: Text('Booking ${bookingId.substring(0, 8)}'),
                onTap: () => Navigator.pop(ctx, bookingId),
              );
            },
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
        ],
      ),
    );
  }

  String _formatTime(DateTime? dt) {
    if (dt == null) return '';
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inDays > 0) {
      return '${diff.inDays}d ago';
    } else if (diff.inHours > 0) {
      return '${diff.inHours}h ago';
    } else if (diff.inMinutes > 0) {
      return '${diff.inMinutes}m ago';
    }
    return 'Just now';
  }

  String _getStatusLabel(String? status) {
    switch (status) {
      case 'requested':
        return 'Requested';
      case 'confirmed':
        return 'Confirmed';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status ?? '';
    }
  }

  Color _getStatusColor(String? status) {
    switch (status) {
      case 'requested':
        return Colors.orange;
      case 'confirmed':
        return Colors.blue;
      case 'in_progress':
        return Colors.green;
      case 'completed':
        return Colors.grey;
      case 'cancelled':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final loc = LocalizationProvider.of(context);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF66A3FF),
        title: Text(loc.tr('conversations')),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadConversations,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('Error: $_error', textAlign: TextAlign.center),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadConversations,
                        child: Text(loc.tr('retry')),
                      ),
                    ],
                  ),
                )
              : Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                      child: TextField(
                        controller: _searchController,
                        decoration: InputDecoration(
                          hintText: 'Search conversations...',
                          prefixIcon: const Icon(Icons.search),
                          suffixIcon: _searchQuery.isNotEmpty
                              ? IconButton(
                                  icon: const Icon(Icons.clear),
                                  onPressed: _clearSearch,
                                )
                              : null,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 12),
                          isDense: true,
                        ),
                        onChanged: _searchConversations,
                      ),
                    ),
                    Expanded(
                      child: _searchQuery.isNotEmpty
                          ? _searching
                              ? const Center(child: CircularProgressIndicator())
                              : _searchResults.isEmpty
                                  ? Center(
                                      child: Column(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(Icons.search_off,
                                              size: 48,
                                              color: Colors.grey.shade400),
                                          const SizedBox(height: 12),
                                          Text(
                                            'No results for "$_searchQuery"',
                                            style: TextStyle(
                                                color: Colors.grey.shade600),
                                          ),
                                        ],
                                      ),
                                    )
                                  : RefreshIndicator(
                                      onRefresh: _loadConversations,
                                      child: ListView.builder(
                                        itemCount: _searchResults.length,
                                        itemBuilder: (ctx, i) {
                                          final conv = _searchResults[i];
                                          return _ConversationTile(
                                            conversation: conv,
                                            isOnline: conv.isOnline,
                                            onTap: () => _openChat(conv),
                                            formatTime: _formatTime,
                                            getStatusLabel: _getStatusLabel,
                                            getStatusColor: _getStatusColor,
                                          );
                                        },
                                      ),
                                    )
                          : _conversations.isEmpty
                              ? Center(
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.chat_bubble_outline,
                                          size: 64,
                                          color: Colors.grey.shade400),
                                      const SizedBox(height: 16),
                                      Text(
                                        'No conversations yet',
                                        style: TextStyle(
                                            color: Colors.grey.shade600,
                                            fontSize: 16),
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        'Start a chat from a booking or provider profile',
                                        style: TextStyle(
                                            color: Colors.grey.shade500,
                                            fontSize: 14),
                                      ),
                                    ],
                                  ),
                                )
                              : RefreshIndicator(
                                  onRefresh: _loadConversations,
                                  child: ListView.builder(
                                    itemCount: _conversations.length,
                                    itemBuilder: (ctx, i) {
                                      final conv = _conversations[i];
                                      return _ConversationTile(
                                        conversation: conv,
                                        isOnline: conv.isOnline,
                                        onTap: () => _openChat(conv),
                                        formatTime: _formatTime,
                                        getStatusLabel: _getStatusLabel,
                                        getStatusColor: _getStatusColor,
                                      );
                                    },
                                  ),
                                ),
                    ),
                  ],
                ),
    );
  }
}

class _ConversationTile extends StatelessWidget {
  final Conversation conversation;
  final bool isOnline;
  final VoidCallback onTap;
  final String Function(DateTime?) formatTime;
  final String Function(String?) getStatusLabel;
  final Color Function(String?) getStatusColor;

  const _ConversationTile({
    required this.conversation,
    required this.isOnline,
    required this.onTap,
    required this.formatTime,
    required this.getStatusLabel,
    required this.getStatusColor,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      leading: SizedBox(
        width: 40,
        height: 40,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            CircleAvatar(
              backgroundColor:
                  Theme.of(context).primaryColor.withValues(alpha: 0.1),
              child: Text(
                conversation.partnerName.isNotEmpty
                    ? conversation.partnerName[0].toUpperCase()
                    : '?',
                style: TextStyle(
                  color: Theme.of(context).primaryColor,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            if (isOnline)
              Positioned(
                bottom: 2,
                right: 2,
                child: Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    color: const Color(0xFF4CAF50),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2),
                  ),
                ),
              ),
          ],
        ),
      ),
      title: Row(
        children: [
          Expanded(
            child: Text(
              conversation.partnerName,
              style: const TextStyle(fontWeight: FontWeight.w600),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (conversation.lastMessageTime != null)
            Text(
              formatTime(conversation.lastMessageTime),
              style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
            ),
        ],
      ),
      subtitle: Row(
        children: [
          if (!conversation.isDirect && conversation.bookingStatus != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              margin: const EdgeInsets.only(right: 6),
              decoration: BoxDecoration(
                color: getStatusColor(conversation.bookingStatus)
                    .withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                getStatusLabel(conversation.bookingStatus),
                style: TextStyle(
                  color: getStatusColor(conversation.bookingStatus),
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          if (conversation.isDirect)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              margin: const EdgeInsets.only(right: 6),
              decoration: BoxDecoration(
                color: Colors.purple.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text(
                'Direct',
                style: TextStyle(color: Colors.purple, fontSize: 10),
              ),
            ),
          Expanded(
            child: Text(
              conversation.lastMessage ?? 'No messages',
              style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
      trailing: conversation.unreadCount > 0
          ? Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: Theme.of(context).primaryColor,
                shape: BoxShape.circle,
              ),
              child: Text(
                conversation.unreadCount > 99
                    ? '99+'
                    : conversation.unreadCount.toString(),
                style: const TextStyle(color: Colors.white, fontSize: 12),
              ),
            )
          : const Icon(Icons.chevron_right),
    );
  }
}
