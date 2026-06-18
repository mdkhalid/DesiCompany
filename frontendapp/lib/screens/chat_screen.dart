import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

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
  final List<Map<String, dynamic>> _messages = [];

  @override
  void initState() {
    super.initState();
    _connectSocket();
  }

  bool get _isDirect => widget.mode == 'direct';

  void _connectSocket() {
    _socket = io.io('http://localhost:3000/chat', <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': true,
    });
    _socket.onConnect((_) {
      if (_isDirect) {
        _socket.emit('join_direct_chat', {'providerId': widget.providerId});
      } else {
        _socket.emit('join', {'bookingId': widget.bookingId, 'token': ''});
      }
    });
    _socket.on(_isDirect ? 'direct_chat_history' : 'history', (data) {
      setState(() => _messages.addAll(List<Map<String, dynamic>>.from(data)));
    });
    _socket.on(_isDirect ? 'new_direct_message' : 'new_message', (data) {
      setState(() => _messages.add(Map<String, dynamic>.from(data)));
    });
  }

  void _sendMessage() {
    if (_controller.text.trim().isEmpty) return;
    final event = _isDirect ? 'send_direct_message' : 'send_message';
    final payload = _isDirect
        ? {'providerId': widget.providerId, 'content': _controller.text}
        : {'bookingId': widget.bookingId, 'content': _controller.text};
    _socket.emit(event, payload);
    _controller.clear();
  }

  @override
  void dispose() {
    _socket.disconnect();
    _socket.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isDirect && widget.providerName != null
            ? widget.providerName!
            : 'Chat'),
      ),
      body: Column(children: [
        if (_isDirect)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: Colors.blue.shade50,
            child: Text(
              'Ask about availability, pricing, or timing',
              style: TextStyle(color: Colors.blue.shade700, fontSize: 13),
              textAlign: TextAlign.center,
            ),
          ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: _messages.length,
            itemBuilder: (_, i) {
              final msg = _messages[i];
              return Align(
                alignment: Alignment.centerLeft,
                child: Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(12)),
                  child: Text(msg['content'] ?? ''),
                ),
              );
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(8),
          child: Row(children: [
            Expanded(child: TextField(controller: _controller, decoration: const InputDecoration(hintText: 'Type a message...', border: OutlineInputBorder()))),
            IconButton(onPressed: _sendMessage, icon: const Icon(Icons.send)),
          ]),
        ),
      ]),
    );
  }
}
