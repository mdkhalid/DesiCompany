import 'package:flutter/material.dart';
import '../services/api_service.dart';
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
    );
  }
}

class ConversationListScreen extends StatefulWidget {
  const ConversationListScreen({super.key});
  @override
  State<ConversationListScreen> createState() => _ConversationListScreenState();
}

class _ConversationListScreenState extends State<ConversationListScreen> {
  List<Conversation> _conversations = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadConversations();
  }

  Future<void> _loadConversations() async {
    try {
      setState(() { _loading = true; _error = null; });
      final data = await ApiService.get('/chat/conversations');
      if (!mounted) return;
      setState(() {
        final list = data is List ? data : (data['conversations'] as List);
        _conversations = list.map((c) => Conversation.fromJson(c)).toList();
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

  void _openChat(Conversation conv) {
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
                bookingId: conv.bookingId,
                providerName: conv.partnerName,
              ),
      ),
    ).then((_) => _loadConversations());
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
      case 'requested': return 'Requested';
      case 'confirmed': return 'Confirmed';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status ?? '';
    }
  }

  Color _getStatusColor(String? status) {
    switch (status) {
      case 'requested': return Colors.orange;
      case 'confirmed': return Colors.blue;
      case 'in_progress': return Colors.green;
      case 'completed': return Colors.grey;
      case 'cancelled': return Colors.red;
      default: return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final loc = LocalizationProvider.of(context);
    
    return Scaffold(
      appBar: AppBar(
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
              : _conversations.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.chat_bubble_outline, size: 64, color: Colors.grey.shade400),
                          const SizedBox(height: 16),
                          Text(
                            'No conversations yet',
                            style: TextStyle(color: Colors.grey.shade600, fontSize: 16),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Start a chat from a booking or provider profile',
                            style: TextStyle(color: Colors.grey.shade500, fontSize: 14),
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
                            onTap: () => _openChat(conv),
                            formatTime: _formatTime,
                            getStatusLabel: _getStatusLabel,
                            getStatusColor: _getStatusColor,
                          );
                        },
                      ),
                    ),
    );
  }
}

class _ConversationTile extends StatelessWidget {
  final Conversation conversation;
  final VoidCallback onTap;
  final String Function(DateTime?) formatTime;
  final String Function(String?) getStatusLabel;
  final Color Function(String?) getStatusColor;

  const _ConversationTile({
    required this.conversation,
    required this.onTap,
    required this.formatTime,
    required this.getStatusLabel,
    required this.getStatusColor,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      leading: CircleAvatar(
        backgroundColor: Theme.of(context).primaryColor.withValues(alpha: 0.1),
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
                color: getStatusColor(conversation.bookingStatus).withValues(alpha: 0.1),
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