import 'package:flutter_test/flutter_test.dart';
import 'package:desicompany/main.dart';

void main() {
  testWidgets('App renders login screen', (WidgetTester tester) async {
    await tester.pumpWidget(const DesiCompanyApp());
    expect(find.text('DesiCompany'), findsOneWidget);
    expect(find.text('Send OTP'), findsOneWidget);
  });
}
