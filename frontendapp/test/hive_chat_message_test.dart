import 'package:flutter_test/flutter_test.dart';
import 'package:desicompany/models/chat_message.dart';
import 'package:desicompany/models/hive_chat_message.dart';

void main() {
  group('HiveChatMessage', () {
    group('constructor', () {
      test('sets defaults for optional fields', () {
        final msg = HiveChatMessage(
          id: 'h1',
          content: 'Hello',
          senderId: 'u1',
          senderName: 'User',
        );

        expect(msg.senderRole, '');
        expect(msg.messageType, 'text');
        expect(msg.metadata, isNull);
        expect(msg.status, 'sent');
        expect(msg.isRead, isFalse);
        expect(msg.isPending, isFalse);
        expect(msg.edited, isFalse);
        expect(msg.deleted, isFalse);
        expect(msg.createdAt, isA<DateTime>());
      });

      test('accepts all explicit values', () {
        final dt = DateTime.utc(2026, 7, 10, 12, 0, 0);
        final msg = HiveChatMessage(
          id: 'h2',
          content: 'Hi',
          senderId: 'u2',
          senderName: 'Amit',
          senderRole: 'provider',
          messageType: 'image',
          metadata: {'imageUrl': 'https://example.com/img.png'},
          createdAt: dt,
          status: 'delivered',
          isRead: true,
          isPending: true,
          edited: true,
          deleted: true,
        );

        expect(msg.id, 'h2');
        expect(msg.senderRole, 'provider');
        expect(msg.messageType, 'image');
        expect(msg.createdAt, dt);
        expect(msg.status, 'delivered');
        expect(msg.isRead, isTrue);
        expect(msg.isPending, isTrue);
        expect(msg.edited, isTrue);
        expect(msg.deleted, isTrue);
      });
    });

    group('fromChatMessage', () {
      test('converts ChatMessage to HiveChatMessage', () {
        final chatMsg = ChatMessage(
          id: 'cm1',
          content: 'Hello',
          senderId: 'u1',
          senderName: 'Rahul',
          senderRole: 'customer',
          messageType: 'text',
          metadata: {'key': 'val'},
          createdAt: DateTime.utc(2026, 7, 10),
          status: 'delivered',
          isRead: true,
          edited: true,
          deleted: false,
        );

        final hiveMsg = HiveChatMessage.fromChatMessage(chatMsg);

        expect(hiveMsg.id, chatMsg.id);
        expect(hiveMsg.content, chatMsg.content);
        expect(hiveMsg.senderId, chatMsg.senderId);
        expect(hiveMsg.senderName, chatMsg.senderName);
        expect(hiveMsg.senderRole, chatMsg.senderRole);
        expect(hiveMsg.messageType, chatMsg.messageType);
        expect(hiveMsg.metadata, chatMsg.metadata);
        expect(hiveMsg.createdAt, chatMsg.createdAt);
        expect(hiveMsg.status, chatMsg.status);
        expect(hiveMsg.isRead, chatMsg.isRead);
        expect(hiveMsg.edited, chatMsg.edited);
        expect(hiveMsg.deleted, chatMsg.deleted);
      });

      test('defaults isPending to false', () {
        final chatMsg = ChatMessage(
          id: 'cm2',
          content: 'Hi',
          senderId: 'u1',
          senderName: 'User',
        );

        final hiveMsg = HiveChatMessage.fromChatMessage(chatMsg);

        expect(hiveMsg.isPending, isFalse);
      });

      test('respects isPending parameter when true', () {
        final chatMsg = ChatMessage(
          id: 'cm3',
          content: 'Pending msg',
          senderId: 'u1',
          senderName: 'User',
        );

        final hiveMsg = HiveChatMessage.fromChatMessage(chatMsg, isPending: true);

        expect(hiveMsg.isPending, isTrue);
      });
    });

    group('toChatMessage', () {
      test('converts HiveChatMessage back to ChatMessage', () {
        final dt = DateTime.utc(2026, 7, 10, 12, 0, 0);
        final hiveMsg = HiveChatMessage(
          id: 'hm1',
          content: 'Hello back',
          senderId: 'u2',
          senderName: 'Amit',
          senderRole: 'provider',
          messageType: 'quote',
          metadata: {'quoteAmount': 500},
          createdAt: dt,
          status: 'read',
          isRead: true,
          edited: false,
          deleted: false,
        );

        final chatMsg = hiveMsg.toChatMessage();

        expect(chatMsg.id, 'hm1');
        expect(chatMsg.content, 'Hello back');
        expect(chatMsg.senderId, 'u2');
        expect(chatMsg.senderName, 'Amit');
        expect(chatMsg.senderRole, 'provider');
        expect(chatMsg.messageType, 'quote');
        expect(chatMsg.metadata, {'quoteAmount': 500});
        expect(chatMsg.createdAt, dt);
        expect(chatMsg.status, 'read');
        expect(chatMsg.isRead, isTrue);
        expect(chatMsg.edited, isFalse);
        expect(chatMsg.deleted, isFalse);
      });
    });

    group('round-trip', () {
      test('ChatMessage -> HiveChatMessage -> ChatMessage preserves data', () {
        final original = ChatMessage(
          id: 'rt1',
          content: 'Round trip!',
          senderId: 'u1',
          senderName: 'Tester',
          senderRole: 'customer',
          messageType: 'image',
          metadata: {'imageUrl': 'https://example.com/photo.jpg', 'fileSize': 4096},
          createdAt: DateTime.utc(2026, 7, 10, 14, 30, 0),
          status: 'delivered',
          isRead: false,
          edited: true,
          deleted: false,
        );

        final hiveMsg = HiveChatMessage.fromChatMessage(original);
        final restored = hiveMsg.toChatMessage();

        expect(restored.id, original.id);
        expect(restored.content, original.content);
        expect(restored.senderId, original.senderId);
        expect(restored.senderName, original.senderName);
        expect(restored.senderRole, original.senderRole);
        expect(restored.messageType, original.messageType);
        expect(restored.metadata, original.metadata);
        expect(restored.createdAt, original.createdAt);
        expect(restored.status, original.status);
        expect(restored.isRead, original.isRead);
        expect(restored.edited, original.edited);
        expect(restored.deleted, original.deleted);
      });
    });
  });
}
