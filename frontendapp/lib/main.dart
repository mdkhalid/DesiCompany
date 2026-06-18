import 'package:flutter/material.dart';
import 'theme.dart';
import 'screens/login_screen.dart';
import 'screens/customer_home_screen.dart';
import 'screens/provider_home_screen.dart';
import 'screens/provider_detail_screen.dart';
import 'screens/wallet_screen.dart';
import 'screens/chat_screen.dart';
import 'screens/my_bookings_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/write_review_screen.dart';
import 'screens/provider_reviews_screen.dart';

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
        '/profile': (_) => const ProfileScreen(),
        '/notifications': (_) => const NotificationsScreen(),
        '/provider-reviews': (_) => const ProviderReviewsScreen(),
      },
      onGenerateRoute: (settings) {
        if (settings.name == '/provider-detail') {
          return MaterialPageRoute(
            builder: (_) => ProviderDetailScreen(provider: settings.arguments as Map),
          );
        }
        if (settings.name == '/chat') {
          final args = settings.arguments as Map<String, dynamic>?;
          return MaterialPageRoute(
            builder: (_) => ChatScreen(
              bookingId: args?['bookingId'] as String?,
              providerId: args?['providerId'] as String?,
              mode: args?['mode'] as String? ?? 'booking',
              providerName: args?['providerName'] as String?,
            ),
          );
        }
        if (settings.name == '/my-bookings') {
          return MaterialPageRoute(
            builder: (_) => const MyBookingsScreen(),
          );
        }
        if (settings.name == '/write-review') {
          final args = settings.arguments as Map<String, String>;
          return MaterialPageRoute(
            builder: (_) => WriteReviewScreen(
              bookingId: args['bookingId']!,
              providerName: args['providerName']!,
              providerId: args['providerId']!,
            ),
          );
        }
        return null;
      },
    );
  }
}
