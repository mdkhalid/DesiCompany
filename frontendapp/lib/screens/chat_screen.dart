import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

class ChatScreen extends StatefulWidget {
  final String bookingId;
  const ChatScreen({super.key, required this.bookingId});
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

  void _connectSocket() {
    _socket = io.io('http://localhost:3000/chat', <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': true,
    });
    _socket.onConnect((_) {
      _socket.emit('join', {'bookingId': widget.bookingId, 'token': ''});
    });
    _socket.on('history', (data) {
      setState(() => _messages.addAll(List<Map<String, dynamic>>.from(data)));
    });
    _socket.on('new_message', (data) {
      setState(() => _messages.add(Map<String, dynamic>.from(data)));
    });
  }

  void _sendMessage() {
    if (_controller.text.trim().isEmpty) return;
    _socket.emit('send_message', {'bookingId': widget.bookingId, 'content': _controller.text});
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
      appBar: AppBar(title: const Text('Chat')),
      body: Column(children: [
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
