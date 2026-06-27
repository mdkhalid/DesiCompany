import 'package:flutter_test/flutter_test.dart';
import 'package:desicompany/utils/id_helpers.dart';

void main() {
  group('shortId', () {
    test('returns full id when shorter than requested length', () {
      expect(shortId('abc', length: 8), 'abc');
      expect(shortId('', length: 8), '');
      expect(shortId(null, length: 8), '');
    });

    test('returns 8-char prefix when id is long enough', () {
      expect(shortId('1234567890abcdef'), '12345678');
    });

    test('returns empty for null and empty input', () {
      expect(shortId(null), '');
      expect(shortId(''), '');
    });
  });
}