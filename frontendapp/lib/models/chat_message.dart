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
  final bool edited;
  final bool deleted;

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
    this.edited = false,
    this.deleted = false,
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
      edited: json['edited'] == true,
      deleted: json['deleted'] == true,
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
    'edited': edited,
    'deleted': deleted,
  };

  bool get isText => messageType == 'text';
  bool get isImage => messageType == 'image';
  bool get isQuote => messageType == 'quote';
  bool get isQuickReply => messageType == 'quick_reply';
  bool get isLocation => messageType == 'location';
  bool get isDocument => messageType == 'document';

  String? get documentUrl => metadata?['fileUrl'] as String?;
  String? get documentName => metadata?['fileName'] as String?;
  String? get documentType => metadata?['fileType'] as String?;
  int? get fileSize {
    final v = metadata?['fileSize'];
    if (v is num) return v.toInt();
    return int.tryParse(v?.toString() ?? '');
  }

  String? get imageUrl => metadata?['imageUrl'] as String?;
  double? get quoteAmount {
    final v = metadata?['quoteAmount'];
    if (v is num) return v.toDouble();
    return double.tryParse(v?.toString() ?? '');
  }
  bool get quoteAccepted => metadata?['accepted'] == true;
  String? get quickReplyType => metadata?['quickReplyType'] as String?;
  double? get latitude {
    final v = metadata?['latitude'];
    if (v is num) return v.toDouble();
    return double.tryParse(v?.toString() ?? '');
  }
  double? get longitude {
    final v = metadata?['longitude'];
    if (v is num) return v.toDouble();
    return double.tryParse(v?.toString() ?? '');
  }

  ChatMessage copyWith({
    String? status,
    bool? isRead,
    String? content,
    Map<String, dynamic>? metadata,
    bool? edited,
    bool? deleted,
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
      edited: edited ?? this.edited,
      deleted: deleted ?? this.deleted,
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
  static const String location = 'location';
  static const String document = 'document';
}
