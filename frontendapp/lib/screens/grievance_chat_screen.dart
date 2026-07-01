import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme.dart';

class GrievanceChatScreen extends StatefulWidget {
  final String bookingId;
  final String? grievanceId;

  const GrievanceChatScreen({
    super.key,
    required this.bookingId,
    this.grievanceId,
  });

  @override
  State<GrievanceChatScreen> createState() => _GrievanceChatScreenState();
}

class _GrievanceChatScreenState extends State<GrievanceChatScreen> {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  List<Map<String, dynamic>> _messages = [];
  bool _loading = true;
  bool _sending = false;
  String? _grievanceId;
  String? _error;
  bool _isResolved = false;
  bool _isEscalated = false;

  @override
  void initState() {
    super.initState();
    _grievanceId = widget.grievanceId;
    _initGrievance();
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _initGrievance() async {
    try {
      if (_grievanceId != null) {
        await _loadGrievance();
      } else {
        await _startGrievance();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
          _loading = false;
        });
      }
    }
  }

  Future<void> _startGrievance() async {
    final data = await ApiService.post('/grievances/start/${widget.bookingId}');
    _grievanceId = data['id'] as String;
    await _loadGrievance();
  }

  Future<void> _loadGrievance() async {
    try {
      final data = await ApiService.get('/grievances/$_grievanceId');
      if (mounted) {
        setState(() {
          _messages = List<Map<String, dynamic>>.from(data['messages'] ?? []);
          _loading = false;
          _isResolved = data['status'] == 'resolved' || data['status'] == 'closed';
          _isEscalated = data['status'] == 'escalated' || data['status'] == 'admin_review';
        });
        _scrollToBottom();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
          _loading = false;
        });
      }
    }
  }

  Future<void> _sendMessage(String message) async {
    if (message.trim().isEmpty || _sending || _isResolved) return;

    setState(() {
      _sending = true;
      _messages.add({
        'id': DateTime.now().toIso8601String(),
        'sender': 'customer',
        'content': message,
        'createdAt': DateTime.now().toIso8601String(),
      });
    });

    _messageController.clear();
    _scrollToBottom();

    try {
      // Check if this is a category selection or option selection
      final isCategory = [
        'service_quality', 'delay_no_show', 'billing_overcharge',
        'damaged_property', 'rude_behavior', 'incomplete_work',
        'wrong_service', 'other'
      ].contains(message);

      final Map<String, dynamic> response;
      if (isCategory) {
        response = await ApiService.post('/grievances/$_grievanceId/message', body: {'message': message});
      } else {
        // Check if the last bot message had options
        final lastBotMessage = _messages.lastWhere(
          (m) => m['sender'] == 'bot',
          orElse: () => <String, dynamic>{},
        );
        final hasOptions = lastBotMessage['metadata']?['options'] != null;

        if (hasOptions) {
          response = await ApiService.post('/grievances/$_grievanceId/select-option', body: {'option': message});
        } else {
          response = await ApiService.post('/grievances/$_grievanceId/message', body: {'message': message});
        }
      }

      if (mounted) {
        setState(() {
          _messages.add({
            'id': DateTime.now().toIso8601String(),
            'sender': 'bot',
            'content': response['message'] ?? 'Thank you for your message.',
            'metadata': {
              if (response['options'] != null) 'options': response['options'],
            },
            'createdAt': DateTime.now().toIso8601String(),
          });
          _isResolved = response['resolution'] != null;
          _isEscalated = response['isEscalated'] == true;
          _sending = false;
        });
        _scrollToBottom();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _messages.add({
            'id': DateTime.now().toIso8601String(),
            'sender': 'system',
            'content': 'Failed to send message. Please try again.',
            'createdAt': DateTime.now().toIso8601String(),
          });
          _sending = false;
        });
      }
    }
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Raise Issue'),
        flexibleSpace: Container(decoration: AppTheme.gradientBackground),
        actions: [
          if (_isResolved)
            Container(
              margin: const EdgeInsets.only(right: 16),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.green.shade100,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Row(
                children: [
                  Icon(Icons.check_circle, size: 16, color: Colors.green),
                  SizedBox(width: 4),
                  Text('Resolved', style: TextStyle(color: Colors.green, fontSize: 12)),
                ],
              ),
            ),
          if (_isEscalated)
            Container(
              margin: const EdgeInsets.only(right: 16),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.orange.shade100,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Row(
                children: [
                  Icon(Icons.arrow_upward, size: 16, color: Colors.orange),
                  SizedBox(width: 4),
                  Text('Escalated', style: TextStyle(color: Colors.orange, fontSize: 12)),
                ],
              ),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildErrorView()
              : _buildChatView(),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 64, color: Colors.red.shade300),
            const SizedBox(height: 16),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 16),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Go Back'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildChatView() {
    return Column(
      children: [
        // Messages list
        Expanded(
          child: ListView.builder(
            controller: _scrollController,
            padding: const EdgeInsets.all(16),
            itemCount: _messages.length,
            itemBuilder: (context, index) {
              final message = _messages[index];
              return _buildMessageBubble(message);
            },
          ),
        ),

        // Input area
        if (!_isResolved && !_isEscalated)
          _buildInputArea()
        else if (_isEscalated)
          _buildEscalatedBanner(),
      ],
    );
  }

  Widget _buildMessageBubble(Map<String, dynamic> message) {
    final sender = message['sender'] as String? ?? 'bot';
    final content = message['content'] as String? ?? '';
    final metadata = message['metadata'] as Map<String, dynamic>?;
    final options = metadata?['options'] as List?;

    final isCustomer = sender == 'customer';
    final isSystem = sender == 'system';
    final isAdmin = sender == 'admin';

    return Align(
      alignment: isCustomer ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.8,
        ),
        child: Column(
          crossAxisAlignment:
              isCustomer ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            // Sender label
            if (!isCustomer)
              Padding(
                padding: const EdgeInsets.only(left: 4, bottom: 4),
                child: Text(
                  isSystem ? 'System' : isAdmin ? 'Admin' : 'Support Bot',
                  style: TextStyle(
                    fontSize: 11,
                    color: isSystem ? Colors.grey : isAdmin ? Colors.green : AppTheme.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),

            // Message bubble
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: isCustomer
                    ? AppTheme.primary
                    : isSystem
                        ? Colors.grey.shade200
                        : isAdmin
                            ? Colors.green.shade50
                            : Colors.white,
                borderRadius: BorderRadius.circular(16).copyWith(
                  bottomRight: isCustomer ? const Radius.circular(4) : null,
                  bottomLeft: !isCustomer ? const Radius.circular(4) : null,
                ),
                boxShadow: [
                  if (!isSystem)
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 5,
                      offset: const Offset(0, 2),
                    ),
                ],
              ),
              child: Text(
                content,
                style: TextStyle(
                  color: isCustomer
                      ? Colors.white
                      : isSystem
                          ? Colors.grey.shade700
                          : AppTheme.textPrimary,
                  fontSize: 14,
                ),
              ),
            ),

            // Options buttons
            if (options != null && options.isNotEmpty && !isCustomer) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: options.map((option) {
                  final label = option is Map ? (option['label'] ?? option.toString()) : option.toString();
                  return SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () => _sendMessage(label),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppTheme.primary,
                        side: const BorderSide(color: AppTheme.primary),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                      ),
                      child: Text(label, textAlign: TextAlign.center),
                    ),
                  );
                }).toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildInputArea() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _messageController,
                decoration: InputDecoration(
                  hintText: 'Type your message...',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: BorderSide.none,
                  ),
                  filled: true,
                  fillColor: Colors.grey.shade100,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                ),
                textInputAction: TextInputAction.send,
                onSubmitted: _sendMessage,
                enabled: !_sending,
              ),
            ),
            const SizedBox(width: 12),
            Container(
              decoration: const BoxDecoration(
                color: AppTheme.primary,
                shape: BoxShape.circle,
              ),
              child: IconButton(
                onPressed: _sending ? null : () => _sendMessage(_messageController.text),
                icon: _sending
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.send, color: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEscalatedBanner() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.orange.shade50,
        border: Border(top: BorderSide(color: Colors.orange.shade200)),
      ),
      child: SafeArea(
        child: Row(
          children: [
            Icon(Icons.info_outline, color: Colors.orange.shade700),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Escalated to Admin',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Colors.orange.shade700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Your issue has been escalated to our admin team. They will review and may contact you.',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.orange.shade600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
