import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:desicompany/l10n/strings.dart';
import 'package:desicompany/models/user.dart';
import 'package:desicompany/screens/role_selection_screen.dart';
import 'package:desicompany/screens/profile_picker_screen.dart';

Widget wrap(Widget child) => LocalizationProviderScope(
      provider: LocalizationProvider(initialLocale: 'en'),
      child: MaterialApp(home: child),
    );

void main() {
  testWidgets('RoleSelectionScreen shows customer and provider tiles', (tester) async {
    await tester.pumpWidget(wrap(const RoleSelectionScreen(phone: '9999999999', otp: '123456')));
    await tester.pumpAndSettle();
    expect(find.text('I need a service'), findsWidgets);
    expect(find.text('I offer services'), findsWidgets);
  });

  testWidgets('ProfilePickerScreen shows tiles for null new user', (tester) async {
    final user = User(id: '1', phone: '9999999999', role: 'customer', roles: ['customer']);
    await tester.pumpWidget(wrap(ProfilePickerScreen(user: user)));
    await tester.pumpAndSettle();
    expect(find.text('I need a service'), findsWidgets);
    expect(find.text('I offer services'), findsWidgets);
  });

  testWidgets('ProfilePickerScreen with null role does not crash', (tester) async {
    final user = User(id: '1', phone: '9999999999', role: '', roles: const []);
    await tester.pumpWidget(wrap(ProfilePickerScreen(user: user)));
    await tester.pumpAndSettle();
    expect(find.text('I need a service'), findsWidgets);
  });
}
