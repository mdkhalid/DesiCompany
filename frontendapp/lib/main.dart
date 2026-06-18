import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'l10n/strings.dart';
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

class DesiCompanyApp extends StatefulWidget {
  const DesiCompanyApp({super.key});

  static LocalizationProvider? _localeProvider;

  static LocalizationProvider? get localeProvider => _localeProvider;

  @override
  State<DesiCompanyApp> createState() => _DesiCompanyAppState();
}

class _DesiCompanyAppState extends State<DesiCompanyApp> {
  final _localeProvider = LocalizationProvider();

  @override
  void initState() {
    super.initState();
    DesiCompanyApp._localeProvider = _localeProvider;
    _localeProvider.addListener(_onLocaleChanged);
  }

  @override
  void dispose() {
    _localeProvider.removeListener(_onLocaleChanged);
    _localeProvider.dispose();
    super.dispose();
  }

  void _onLocaleChanged() {
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _localeProvider,
      builder: (context, _) {
        final locale = _localeProvider.locale == 'hi'
            ? const Locale('hi', 'IN')
            : const Locale('en', 'US');
        return LocalizationProviderScope(
          provider: _localeProvider,
          child: MaterialApp(
          title: 'DesiCompany',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.theme,
          locale: locale,
          supportedLocales: const [
            Locale('en', 'US'),
            Locale('hi', 'IN'),
          ],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
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
        ),
        );
      },
    );
  }
}
