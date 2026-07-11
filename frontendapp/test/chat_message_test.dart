import 'package:flutter_test/flutter_test.dart';
import 'package:desicompany/models/chat_message.dart';

void main() {
  group('ChatMessage', () {
    group('fromJson', () {
      test('parses all fields from JSON', () {
        final json = {
          'id': 'msg1',
          'content': 'Hello!',
          'senderId': 'u1',
          'senderName': 'Rahul',
          'senderRole': 'customer',
          'messageType': 'text',
          'metadata': {'key': 'value'},
          'createdAt': '2026-07-10T12:00:00.000Z',
          'status': 'delivered',
          'isRead': true,
          'edited': false,
          'deleted': false,
        };

        final msg = ChatMessage.fromJson(json);

        expect(msg.id, 'msg1');
        expect(msg.content, 'Hello!');
        expect(msg.senderId, 'u1');
        expect(msg.senderName, 'Rahul');
        expect(msg.senderRole, 'customer');
        expect(msg.messageType, 'text');
        expect(msg.metadata, {'key': 'value'});
        expect(msg.createdAt, DateTime.parse('2026-07-10T12:00:00.000Z'));
        expect(msg.status, 'delivered');
        expect(msg.isRead, isTrue);
        expect(msg.edited, isFalse);
        expect(msg.deleted, isFalse);
      });

      test('handles missing optional fields with defaults', () {
        final json = <String, dynamic>{
          'id': 'msg2',
          'content': 'Hi',
          'senderId': 'u2',
          'senderName': 'Amit',
        };

        final msg = ChatMessage.fromJson(json);

        expect(msg.senderRole, '');
        expect(msg.messageType, 'text');
        expect(msg.metadata, isNull);
        expect(msg.status, 'sent');
        expect(msg.isRead, isFalse);
        expect(msg.edited, isFalse);
        expect(msg.deleted, isFalse);
      });

      test('defaults createdAt to null which triggers DateTime.now()', () {
        final msg = ChatMessage.fromJson({
          'id': 'msg3',
          'content': 'test',
          'senderId': 'u1',
          'senderName': 'Test',
        });

        expect(msg.createdAt, isNotNull);
        expect(msg.createdAt, isA<DateTime>());
      });

      test('handles non-String content by converting to string', () {
        final msg = ChatMessage.fromJson({
          'id': 123,
          'content': 456,
          'senderId': 789,
          'senderName': 101,
          'senderRole': 202,
          'messageType': 303,
        });

        expect(msg.id, '123');
        expect(msg.content, '456');
        expect(msg.senderId, '789');
        expect(msg.senderName, '101');
        expect(msg.senderRole, '202');
        expect(msg.messageType, '303');
      });

      test('parses metadata with nested data', () {
        final msg = ChatMessage.fromJson({
          'id': 'msg4',
          'content': '',
          'senderId': 'u1',
          'senderName': 'User',
          'messageType': 'quote',
          'metadata': {
            'quoteAmount': 2500,
            'accepted': true,
          },
        });

        expect(msg.metadata!['quoteAmount'], 2500);
        expect(msg.metadata!['accepted'], true);
      });

      test('ignores non-Map metadata', () {
        final msg = ChatMessage.fromJson({
          'id': 'msg5',
          'content': '',
          'senderId': 'u1',
          'senderName': 'User',
          'metadata': 'not a map',
        });

        expect(msg.metadata, isNull);
      });

      test('handles null createdAt string gracefully', () {
        final msg = ChatMessage.fromJson({
          'id': 'msg6',
          'content': '',
          'senderId': 'u1',
          'senderName': 'User',
          'createdAt': null,
        });

        expect(msg.createdAt, isA<DateTime>());
      });

      test('handles invalid createdAt string', () {
        final msg = ChatMessage.fromJson({
          'id': 'msg7',
          'content': '',
          'senderId': 'u1',
          'senderName': 'User',
          'createdAt': 'not-a-date',
        });

        expect(msg.createdAt, isA<DateTime>());
      });

      test('boolean fields only true when explicitly true', () {
        final msg = ChatMessage.fromJson({
          'id': 'msg8',
          'content': '',
          'senderId': 'u1',
          'senderName': 'User',
          'isRead': false,
          'edited': 'yes',
          'deleted': 1,
        });

        expect(msg.isRead, isFalse);
        expect(msg.edited, isFalse);
        expect(msg.deleted, isFalse);
      });
    });

    group('toJson', () {
      test('serializes all fields', () {
        final msg = ChatMessage(
          id: 'msg1',
          content: 'Hello!',
          senderId: 'u1',
          senderName: 'Rahul',
          senderRole: 'customer',
          messageType: 'text',
          metadata: {'key': 'val'},
          createdAt: DateTime.utc(2026, 7, 10, 12, 0, 0),
          status: 'delivered',
          isRead: true,
          edited: false,
          deleted: false,
        );

        final json = msg.toJson();

        expect(json['id'], 'msg1');
        expect(json['content'], 'Hello!');
        expect(json['senderId'], 'u1');
        expect(json['senderName'], 'Rahul');
        expect(json['senderRole'], 'customer');
        expect(json['messageType'], 'text');
        expect(json['metadata'], {'key': 'val'});
        expect(json['status'], 'delivered');
        expect(json['isRead'], true);
        expect(json['edited'], false);
        expect(json['deleted'], false);
      });

      test('createdAt is serialized as ISO 8601 string', () {
        final dt = DateTime.utc(2026, 7, 10, 12, 0, 0);
        final msg = ChatMessage(
          id: 'msg1',
          content: '',
          senderId: 'u1',
          senderName: 'User',
          createdAt: dt,
        );

        expect(msg.toJson()['createdAt'], dt.toIso8601String());
      });
    });

    group('fromJson -> toJson round-trip', () {
      test('preserves data through round-trip', () {
        final original = {
          'id': 'msg_rt',
          'content': 'Round trip test',
          'senderId': 'u1',
          'senderName': 'Tester',
          'senderRole': 'provider',
          'messageType': 'image',
          'metadata': {'imageUrl': 'https://example.com/img.png', 'fileSize': 1024},
          'createdAt': '2026-07-10T15:30:00.000Z',
          'status': 'read',
          'isRead': true,
          'edited': true,
          'deleted': false,
        };

        final msg = ChatMessage.fromJson(original);
        final serialized = msg.toJson();

        expect(serialized['id'], original['id']);
        expect(serialized['content'], original['content']);
        expect(serialized['senderId'], original['senderId']);
        expect(serialized['senderName'], original['senderName']);
        expect(serialized['senderRole'], original['senderRole']);
        expect(serialized['messageType'], original['messageType']);
        expect(serialized['status'], original['status']);
        expect(serialized['isRead'], original['isRead']);
        expect(serialized['edited'], original['edited']);
        expect(serialized['deleted'], original['deleted']);
      });
    });

    group('copyWith', () {
      test('returns copy with updated fields', () {
        final msg = ChatMessage(
          id: 'msg1',
          content: 'Original',
          senderId: 'u1',
          senderName: 'User',
        );

        final copy = msg.copyWith(
          content: 'Updated',
          status: 'delivered',
          isRead: true,
        );

        expect(copy.id, 'msg1');
        expect(copy.content, 'Updated');
        expect(copy.status, 'delivered');
        expect(copy.isRead, isTrue);
        expect(copy.senderName, 'User');
      });

      test('returns identical copy when no args provided', () {
        final msg = ChatMessage(
          id: 'msg1',
          content: 'Same',
          senderId: 'u1',
          senderName: 'User',
        );

        final copy = msg.copyWith();

        expect(copy.id, msg.id);
        expect(copy.content, msg.content);
        expect(copy.senderId, msg.senderId);
        expect(copy.status, msg.status);
      });
    });

    group('message type helpers', () {
      test('isText, isImage, isQuote etc.', () {
        expect(
          ChatMessage(id: '1', content: '', senderId: 'u', senderName: 'U', messageType: 'text').isText,
          isTrue,
        );
        expect(
          ChatMessage(id: '1', content: '', senderId: 'u', senderName: 'U', messageType: 'image').isImage,
          isTrue,
        );
        expect(
          ChatMessage(id: '1', content: '', senderId: 'u', senderName: 'U', messageType: 'quote').isQuote,
          isTrue,
        );
        expect(
          ChatMessage(id: '1', content: '', senderId: 'u', senderName: 'U', messageType: 'quick_reply').isQuickReply,
          isTrue,
        );
        expect(
          ChatMessage(id: '1', content: '', senderId: 'u', senderName: 'U', messageType: 'location').isLocation,
          isTrue,
        );
        expect(
          ChatMessage(id: '1', content: '', senderId: 'u', senderName: 'U', messageType: 'document').isDocument,
          isTrue,
        );
      });

      test('non-matching type returns false for all', () {
        final msg = ChatMessage(
          id: '1',
          content: '',
          senderId: 'u',
          senderName: 'U',
          messageType: 'unknown',
        );

        expect(msg.isText, isFalse);
        expect(msg.isImage, isFalse);
        expect(msg.isQuote, isFalse);
        expect(msg.isQuickReply, isFalse);
        expect(msg.isLocation, isFalse);
        expect(msg.isDocument, isFalse);
      });
    });

    group('metadata accessors', () {
      test('document metadata', () {
        final msg = ChatMessage(
          id: '1',
          content: '',
          senderId: 'u',
          senderName: 'U',
          metadata: {
            'fileUrl': 'https://example.com/file.pdf',
            'fileName': 'report.pdf',
            'fileType': 'application/pdf',
            'fileSize': 2048,
          },
        );

        expect(msg.documentUrl, 'https://example.com/file.pdf');
        expect(msg.documentName, 'report.pdf');
        expect(msg.documentType, 'application/pdf');
        expect(msg.fileSize, 2048);
      });

      test('fileSize as string', () {
        final msg = ChatMessage(
          id: '1',
          content: '',
          senderId: 'u',
          senderName: 'U',
          metadata: {'fileSize': '1024'},
        );

        expect(msg.fileSize, 1024);
      });

      test('fileSize null when metadata absent', () {
        final msg = ChatMessage(id: '1', content: '', senderId: 'u', senderName: 'U');
        expect(msg.fileSize, isNull);
      });

      test('imageUrl accessor', () {
        final msg = ChatMessage(
          id: '1',
          content: '',
          senderId: 'u',
          senderName: 'U',
          metadata: {'imageUrl': 'https://example.com/photo.jpg'},
        );

        expect(msg.imageUrl, 'https://example.com/photo.jpg');
      });

      test('quote metadata', () {
        final msg = ChatMessage(
          id: '1',
          content: '',
          senderId: 'u',
          senderName: 'U',
          metadata: {'quoteAmount': 1500, 'accepted': true},
        );

        expect(msg.quoteAmount, 1500.0);
        expect(msg.quoteAccepted, isTrue);
      });

      test('quoteAmount as string', () {
        final msg = ChatMessage(
          id: '1',
          content: '',
          senderId: 'u',
          senderName: 'U',
          metadata: {'quoteAmount': '2000'},
        );

        expect(msg.quoteAmount, 2000.0);
      });

      test('quickReplyType accessor', () {
        final msg = ChatMessage(
          id: '1',
          content: '',
          senderId: 'u',
          senderName: 'U',
          metadata: {'quickReplyType': 'confirm'},
        );

        expect(msg.quickReplyType, 'confirm');
      });

      test('location metadata', () {
        final msg = ChatMessage(
          id: '1',
          content: '',
          senderId: 'u',
          senderName: 'U',
          metadata: {'latitude': 28.61, 'longitude': 77.21},
        );

        expect(msg.latitude, 28.61);
        expect(msg.longitude, 77.21);
      });

      test('latitude/longitude as strings', () {
        final msg = ChatMessage(
          id: '1',
          content: '',
          senderId: 'u',
          senderName: 'U',
          metadata: {'latitude': '30.0', 'longitude': '77.0'},
        );

        expect(msg.latitude, 30.0);
        expect(msg.longitude, 77.0);
      });

      test('metadata accessors return null when metadata is null', () {
        final msg = ChatMessage(id: '1', content: '', senderId: 'u', senderName: 'U');

        expect(msg.documentUrl, isNull);
        expect(msg.documentName, isNull);
        expect(msg.documentType, isNull);
        expect(msg.imageUrl, isNull);
        expect(msg.quoteAmount, isNull);
        expect(msg.quoteAccepted, isFalse);
        expect(msg.quickReplyType, isNull);
        expect(msg.latitude, isNull);
        expect(msg.longitude, isNull);
      });
    });
  });

  group('MessageStatus', () {
    test('constants have expected values', () {
      expect(MessageStatus.sent, 'sent');
      expect(MessageStatus.delivered, 'delivered');
      expect(MessageStatus.read, 'read');
    });
  });

  group('MessageType', () {
    test('constants have expected values', () {
      expect(MessageType.text, 'text');
      expect(MessageType.image, 'image');
      expect(MessageType.quote, 'quote');
      expect(MessageType.quickReply, 'quick_reply');
      expect(MessageType.location, 'location');
      expect(MessageType.document, 'document');
    });
  });
}
