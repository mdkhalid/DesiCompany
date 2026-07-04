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
import 'screens/customer_home_screen.dart';
import 'screens/provider_home_screen.dart';
import 'screens/provider_detail_screen.dart';
import 'screens/provider_services_screen.dart';
import 'screens/wallet_screen.dart';
import 'screens/chat_screen.dart';
import 'screens/conversation_list_screen.dart';
import 'screens/customer_requests_screen.dart';
import 'screens/provider_requests_screen.dart';
import 'screens/my_bookings_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/my_account_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/write_review_screen.dart';
import 'screens/provider_reviews_screen.dart';
import 'screens/provider_customer_feedback_screen.dart';
import 'screens/admin_home_screen.dart';
import 'screens/admin_bookings_screen.dart';
import 'screens/admin_reviews_screen.dart';
import 'screens/admin_customer_feedbacks_screen.dart';
import 'screens/admin_users_screen.dart';
import 'screens/admin_kyc_screen.dart';
import 'screens/admin_gateways_screen.dart';
import 'screens/provider_kyc_upload_screen.dart';
import 'screens/customer_jobs_screen.dart';
import 'screens/customer_post_job_screen.dart';
import 'screens/customer_job_detail_screen.dart';
import 'screens/provider_open_jobs_screen.dart';
import 'screens/provider_submit_quote_screen.dart';
import 'screens/provider_my_quotes_screen.dart';
import 'screens/provider_job_detail_screen.dart';
import 'screens/provider_subscription_screen.dart';
import 'screens/provider_schedule_screen.dart';
import 'screens/customer_membership_screen.dart';
import 'screens/admin_revenue_screen.dart';
import 'screens/grievance_chat_screen.dart';
import 'screens/support_tickets_screen.dart';
import 'screens/disputes_screen.dart';
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
            '/customer-home': (_) => const CustomerHomeScreen(),
            '/provider-home': (_) => const ProviderHomeScreen(),
            '/admin-home': (_) => const AdminHomeScreen(),
            '/admin-users': (_) => const AdminUsersScreen(),
            '/admin-kyc': (_) => const AdminKycScreen(),
            '/admin-gateways': (_) => const AdminGatewaysScreen(),
            '/wallet': (_) => const WalletScreen(),
            '/profile': (_) => const ProfileScreen(),
            '/my-account': (_) => const MyAccountScreen(),
            '/notifications': (_) => const NotificationsScreen(),
            '/provider-reviews': (_) => const ProviderReviewsScreen(),
            '/provider-services': (_) => const ProviderServicesScreen(),
            '/provider-kyc-upload': (_) => const ProviderKycUploadScreen(),
            '/admin-bookings': (_) => const AdminBookingsScreen(),
            '/admin-reviews': (_) => const AdminReviewsScreen(),
            '/admin-customer-feedbacks': (_) => const AdminCustomerFeedbacksScreen(),
            '/customer-jobs': (_) => const CustomerJobsScreen(),
            '/customer-post-job': (_) => const CustomerPostJobScreen(),
          '/provider-open-jobs': (_) => const ProviderOpenJobsScreen(),
          '/provider-my-quotes': (_) => const ProviderMyQuotesScreen(),
          '/provider-subscriptions': (_) => const ProviderSubscriptionScreen(),
          '/customer-memberships': (_) => const CustomerMembershipScreen(),
          '/admin-revenue': (_) => const AdminRevenueScreen(),
          '/conversations': (_) => const ConversationListScreen(),
          '/customer-requests': (_) => const CustomerRequestsScreen(),
          '/provider-requests': (_) => const ProviderRequestsScreen(),
          '/provider-schedule': (_) => const ProviderScheduleScreen(),
          '/support-tickets': (_) => const SupportTicketsScreen(),
          '/disputes': (_) => const DisputesScreen(),
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
            if (settings.name == '/provider-customer-feedback') {
              final args = settings.arguments as Map<String, String>;
              return MaterialPageRoute(
                builder: (_) => ProviderCustomerFeedbackScreen(
                  bookingId: args['bookingId']!,
                  customerName: args['customerName']!,
                  providerName: args['providerName']!,
                ),
              );
            }
            if (settings.name == '/grievance') {
              final args = settings.arguments as Map<String, dynamic>;
              return MaterialPageRoute(
                builder: (_) => GrievanceChatScreen(
                  bookingId: args['bookingId'] as String,
                  grievanceId: args['grievanceId'] as String?,
                ),
              );
            }
            if (settings.name == '/customer-job-detail') {
              final args = settings.arguments as Map<String, dynamic>;
              return MaterialPageRoute(
                builder: (_) => CustomerJobDetailScreen(
                  jobRequestId: args['jobRequestId'] as String,
                ),
              );
            }
            if (settings.name == '/provider-submit-quote') {
              final args = settings.arguments as Map<String, dynamic>;
              return MaterialPageRoute(
                builder: (_) => ProviderSubmitQuoteScreen(
                  jobRequestId: args['jobRequestId'] as String,
                ),
              );
            }
            if (settings.name == '/provider-job-detail') {
              final args = settings.arguments as Map<String, dynamic>;
              return MaterialPageRoute(
                builder: (_) => ProviderJobDetailScreen(
                  jobRequestId: args['jobRequestId'] as String,
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
