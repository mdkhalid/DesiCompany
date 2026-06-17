import 'package:flutter/material.dart';
import 'theme.dart';
import 'screens/login_screen.dart';
import 'screens/customer_home_screen.dart';
import 'screens/provider_home_screen.dart';
import 'screens/provider_detail_screen.dart';
import 'screens/wallet_screen.dart';
import 'screens/chat_screen.dart';
import 'screens/my_bookings_screen.dart';

void main() => runApp(const DesiCompanyApp());

class DesiCompanyApp extends StatelessWidget {
  const DesiCompanyApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'DesiCompany',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.theme,
      initialRoute: '/login',
      routes: {
        '/login': (_) => const LoginScreen(),
        '/customer-home': (_) => const CustomerHomeScreen(),
        '/provider-home': (_) => const ProviderHomeScreen(),
        '/wallet': (_) => const WalletScreen(),
      },
      onGenerateRoute: (settings) {
        if (settings.name == '/provider-detail') {
          return MaterialPageRoute(
            builder: (_) => ProviderDetailScreen(provider: settings.arguments as Map),
          );
        }
        if (settings.name == '/chat') {
          return MaterialPageRoute(
            builder: (_) => const ChatScreen(bookingId: ''),
          );
        }
        if (settings.name == '/my-bookings') {
          return MaterialPageRoute(
            builder: (_) => const MyBookingsScreen(),
          );
        }
        return null;
      },
    );
  }
}
