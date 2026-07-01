import 'package:hive/hive.dart';
import 'chat_message.dart';

part 'hive_chat_message.g.dart';

@HiveType(typeId: 0)
class HiveChatMessage {
  @HiveField(0)
  final String id;

  @HiveField(1)
  final String content;

  @HiveField(2)
  final String senderId;

  @HiveField(3)
  final String senderName;

  @HiveField(4)
  final String senderRole;

  @HiveField(5)
  final String messageType;

  @HiveField(6)
  final Map<String, dynamic>? metadata;

  @HiveField(7)
  final DateTime createdAt;

  @HiveField(8)
  final String status;

  @HiveField(9)
  final bool isRead;

  @HiveField(10)
  final bool isPending;

  @HiveField(11)
  final bool edited;

  @HiveField(12)
  final bool deleted;

  HiveChatMessage({
    required this.id,
    required this.content,
    required this.senderId,
    required this.senderName,
    this.senderRole = '',
    this.messageType = 'text',
    this.metadata,
    DateTime? createdAt,
    this.status = 'sent',
    this.isRead = false,
    this.isPending = false,
    this.edited = false,
    this.deleted = false,
  }) : createdAt = createdAt ?? DateTime.now();

  factory HiveChatMessage.fromChatMessage(ChatMessage message, {bool isPending = false}) {
    return HiveChatMessage(
      id: message.id,
      content: message.content,
      senderId: message.senderId,
      senderName: message.senderName,
      senderRole: message.senderRole,
      messageType: message.messageType,
      metadata: message.metadata,
      createdAt: message.createdAt,
      status: message.status,
      isRead: message.isRead,
      isPending: isPending,
      edited: message.edited,
      deleted: message.deleted,
    );
  }

  ChatMessage toChatMessage() {
    return ChatMessage(
      id: id,
      content: content,
      senderId: senderId,
      senderName: senderName,
      senderRole: senderRole,
      messageType: messageType,
      metadata: metadata,
      createdAt: createdAt,
      status: status,
      isRead: isRead,
      edited: edited,
      deleted: deleted,
    );
  }
}