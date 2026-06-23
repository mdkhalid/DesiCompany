class ChatMessage {
  final String id;
  final String content;
  final String senderId;
  final String senderName;
  final String senderRole;
  final String messageType;
  final Map<String, dynamic>? metadata;
  final DateTime createdAt;
  final String status;
  final bool isRead;

  ChatMessage({
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
  }) : createdAt = createdAt ?? DateTime.now();

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id']?.toString() ?? '',
      content: json['content']?.toString() ?? '',
      senderId: json['senderId']?.toString() ?? '',
      senderName: json['senderName']?.toString() ?? '',
      senderRole: json['senderRole']?.toString() ?? '',
      messageType: json['messageType']?.toString() ?? 'text',
      metadata: json['metadata'] is Map ? Map<String, dynamic>.from(json['metadata']) : null,
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
      status: json['status']?.toString() ?? 'sent',
      isRead: json['isRead'] == true,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'content': content,
    'senderId': senderId,
    'senderName': senderName,
    'senderRole': senderRole,
    'messageType': messageType,
    'metadata': metadata,
    'createdAt': createdAt.toIso8601String(),
    'status': status,
    'isRead': isRead,
  };

  bool get isText => messageType == 'text';
  bool get isImage => messageType == 'image';
  bool get isQuote => messageType == 'quote';
  bool get isQuickReply => messageType == 'quick_reply';

  String? get imageUrl => metadata?['imageUrl'] as String?;
  double? get quoteAmount {
    final v = metadata?['quoteAmount'];
    if (v is num) return v.toDouble();
    return double.tryParse(v?.toString() ?? '');
  }
  bool get quoteAccepted => metadata?['accepted'] == true;
  String? get quickReplyType => metadata?['quickReplyType'] as String?;

  ChatMessage copyWith({
    String? status,
    bool? isRead,
    String? content,
    Map<String, dynamic>? metadata,
  }) {
    return ChatMessage(
      id: id,
      content: content ?? this.content,
      senderId: senderId,
      senderName: senderName,
      senderRole: senderRole,
      messageType: messageType,
      metadata: metadata ?? this.metadata,
      createdAt: createdAt,
      status: status ?? this.status,
      isRead: isRead ?? this.isRead,
    );
  }
}

class MessageStatus {
  static const String sent = 'sent';
  static const String delivered = 'delivered';
  static const String read = 'read';
}

class MessageType {
  static const String text = 'text';
  static const String image = 'image';
  static const String quote = 'quote';
  static const String quickReply = 'quick_reply';
}
