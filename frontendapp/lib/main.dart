import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'l10n/strings.dart';
import 'theme.dart';
import 'services/cache_service.dart';
import 'services/push_notification_service.dart';
import 'services/error_handler.dart';
import 'screens/login_screen.dart';
import 'screens/app_shell.dart';
import 'screens/admin_home_screen.dart';
import 'screens/admin_bookings_screen.dart';
import 'screens/admin_reviews_screen.dart';
import 'screens/admin_customer_feedbacks_screen.dart';
import 'screens/admin_users_screen.dart';
import 'screens/admin_kyc_screen.dart';
import 'screens/admin_gateways_screen.dart';
import 'screens/admin_revenue_screen.dart';
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize error handler (includes Sentry)
  await ErrorHandler.initialize();
  
  // Initialize Hive cache
  await CacheService.init();
  
  // Initialize push notifications
  await PushNotificationService.initialize();
  
  final prefs = await SharedPreferences.getInstance();
  final savedLanguage = prefs.getString('app_language') ?? 'en';
  
  runApp(
    ProviderScope(
      child: DesiCompanyApp(initialLanguage: savedLanguage),
    ),
  );
}

class DesiCompanyApp extends StatefulWidget {
  const DesiCompanyApp({super.key, this.initialLanguage = 'en'});

  final String initialLanguage;

  static LocalizationProvider? _localeProvider;

  static LocalizationProvider? get localeProvider => _localeProvider;

  @override
  State<DesiCompanyApp> createState() => _DesiCompanyAppState();
}

class _DesiCompanyAppState extends State<DesiCompanyApp> {
  late final _localeProvider = LocalizationProvider(initialLocale: widget.initialLanguage);

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
            '/customer-home': (_) => const AppShell(role: 'customer'),
            '/provider-home': (_) => const AppShell(role: 'provider'),
            '/admin-home': (_) => const AdminHomeScreen(),
            '/admin-users': (_) => const AdminUsersScreen(),
            '/admin-kyc': (_) => const AdminKycScreen(),
            '/admin-gateways': (_) => const AdminGatewaysScreen(),
            '/admin-bookings': (_) => const AdminBookingsScreen(),
            '/admin-reviews': (_) => const AdminReviewsScreen(),
            '/admin-customer-feedbacks': (_) => const AdminCustomerFeedbacksScreen(),
            '/admin-revenue': (_) => const AdminRevenueScreen(),
          },
        ),
        );
      },
    );
  }
}
