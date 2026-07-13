import 'package:flutter/material.dart';
import '../l10n/strings.dart';
import '../theme.dart';
import 'customer_home_screen.dart';
import 'provider_home_screen.dart';
import 'provider_detail_screen.dart';
import 'chat_screen.dart';
import 'my_bookings_screen.dart';
import 'wallet_screen.dart';
import 'profile_screen.dart';
import 'my_account_screen.dart';
import 'notifications_screen.dart';
import 'provider_reviews_screen.dart';
import 'provider_services_screen.dart';
import 'provider_kyc_upload_screen.dart';
import 'customer_jobs_screen.dart';
import 'customer_post_job_screen.dart';
import 'customer_requests_screen.dart';
import 'provider_requests_screen.dart';
import 'provider_open_jobs_screen.dart';
import 'provider_my_quotes_screen.dart';
import 'provider_schedule_screen.dart';
import 'provider_subscription_screen.dart';
import 'customer_membership_screen.dart';
import 'conversation_list_screen.dart';
import 'customer_job_detail_screen.dart';
import 'provider_submit_quote_screen.dart';
import 'provider_charges_screen.dart';
import 'provider_job_detail_screen.dart';
import 'write_review_screen.dart';
import 'provider_customer_feedback_screen.dart';
import 'grievance_chat_screen.dart';
import 'support_tickets_screen.dart';
import 'disputes_screen.dart';

class ShellTab {
  const ShellTab({
    required this.icon,
    required this.labelKey,
    required this.initialRoute,
  });

  final IconData icon;
  final String labelKey;
  final String initialRoute;
}

/// Persistent bottom-navigation shell shared by Customer and Provider.
/// Uses a single shared Navigator so sub-screens always keep the bar visible.
class AppShell extends StatefulWidget {
  const AppShell({super.key, required this.role, this.initialIndex = 0});

  final String role;
  final int initialIndex;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _currentIndex = 0;
  late final List<ShellTab> _tabs;
  final GlobalKey<NavigatorState> _navigatorKey =
      GlobalKey<NavigatorState>();

  @override
  void initState() {
    super.initState();
    _tabs = widget.role == 'provider'
        ? const [
            ShellTab(
              icon: Icons.assignment_outlined,
              labelKey: 'nav_requests',
              initialRoute: '/provider-home',
            ),
            ShellTab(
              icon: Icons.work_outline,
              labelKey: 'open_jobs',
              initialRoute: '/provider-open-jobs',
            ),
            ShellTab(
              icon: Icons.chat,
              labelKey: 'nav_chat',
              initialRoute: '/conversations',
            ),
            ShellTab(
              icon: Icons.person,
              labelKey: 'my_account',
              initialRoute: '/my-account',
            ),
          ]
        : const [
            ShellTab(
              icon: Icons.home_rounded,
              labelKey: 'nav_home',
              initialRoute: '/customer-home',
            ),
            ShellTab(
              icon: Icons.assignment_outlined,
              labelKey: 'nav_requests',
              initialRoute: '/customer-requests',
            ),
            ShellTab(
              icon: Icons.chat,
              labelKey: 'nav_chat',
              initialRoute: '/conversations',
            ),
            ShellTab(
              icon: Icons.person,
              labelKey: 'my_account',
              initialRoute: '/my-account',
            ),
          ];
    _currentIndex =
        widget.initialIndex >= 0 && widget.initialIndex < _tabs.length
            ? widget.initialIndex
            : 0;
  }

  void _onTabTapped(int index) => goToTab(index);

  /// Switches to [index] tab. If already on it, resets that tab's stack.
  /// Exposed via [AppShellScope] so tab-root screens can navigate "back"
  /// to the home tab instead of popping a non-existent route.
  void goToTab(int index) {
    if (index < 0 || index >= _tabs.length) return;
    if (index == _currentIndex) {
      _navigatorKey.currentState?.popUntil((route) => route.isFirst);
      return;
    }
    setState(() => _currentIndex = index);
    _navigatorKey.currentState
        ?.pushNamedAndRemoveUntil(
            _tabs[index].initialRoute, (route) => false);
  }

  @override
  Widget build(BuildContext context) {
    final loc = LocalizationProvider.of(context);
    return Scaffold(
      body: AppShellScope(
        onGoToTab: goToTab,
        child: Navigator(
          key: _navigatorKey,
          initialRoute: _tabs[_currentIndex].initialRoute,
          onGenerateRoute: appRouteGenerator,
        ),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: _onTabTapped,
        selectedItemColor: AppTheme.primary,
        unselectedItemColor: AppTheme.textSecondary,
        type: BottomNavigationBarType.fixed,
        items: _tabs
            .map(
              (tab) => BottomNavigationBarItem(
                icon: Icon(tab.icon),
                label: loc.tr(tab.labelKey),
              ),
            )
            .toList(),
      ),
    );
  }
}

/// Lets descendant screens control the shell's bottom-navigation tabs.
/// Used by tab-root screens whose back button has nothing to pop, so they
/// can fall back to the home tab instead of doing nothing.
class AppShellScope extends InheritedWidget {
  const AppShellScope({
    super.key,
    required this.onGoToTab,
    required super.child,
  });

  final void Function(int index) onGoToTab;

  static AppShellScope? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<AppShellScope>();

  @override
  bool updateShouldNotify(AppShellScope oldWidget) => false;
}

/// Pops the current route if possible, otherwise returns to the home tab.
/// Use for back buttons on screens that may be a tab root.
void shellBack(BuildContext context) {
  final nav = Navigator.of(context);
  if (nav.canPop()) {
    nav.pop();
  } else {
    AppShellScope.maybeOf(context)?.onGoToTab(0);
  }
}

/// Central route table for all Customer/Provider screens (used by the
/// nested tab navigators so the bottom bar stays visible everywhere).
Route<dynamic>? appRouteGenerator(RouteSettings settings) {
  final args = settings.arguments;
  switch (settings.name) {
    case '/customer-home':
      return MaterialPageRoute(builder: (_) => const CustomerHomeContent());
    case '/provider-home':
      return MaterialPageRoute(builder: (_) => const ProviderHomeContent());
    case '/wallet':
      return MaterialPageRoute(builder: (_) => const WalletScreen());
    case '/profile':
      return MaterialPageRoute(builder: (_) => const ProfileScreen());
    case '/my-account':
      return MaterialPageRoute(builder: (_) => const MyAccountScreen());
    case '/notifications':
      return MaterialPageRoute(builder: (_) => const NotificationsScreen());
    case '/provider-reviews':
      return MaterialPageRoute(builder: (_) => const ProviderReviewsScreen());
    case '/provider-services':
      return MaterialPageRoute(builder: (_) => const ProviderServicesScreen());
    case '/provider-kyc-upload':
      return MaterialPageRoute(builder: (_) => const ProviderKycUploadScreen());
    case '/customer-jobs':
      return MaterialPageRoute(builder: (_) => const CustomerJobsScreen());
    case '/customer-post-job':
      return MaterialPageRoute(builder: (_) => const CustomerPostJobScreen());
    case '/customer-requests':
      return MaterialPageRoute(builder: (_) => const CustomerRequestsScreen());
    case '/provider-requests':
      return MaterialPageRoute(builder: (_) => const ProviderRequestsScreen());
    case '/provider-open-jobs':
      return MaterialPageRoute(builder: (_) => const ProviderOpenJobsScreen());
    case '/provider-my-quotes':
      return MaterialPageRoute(builder: (_) => const ProviderMyQuotesScreen());
    case '/provider-schedule':
      return MaterialPageRoute(builder: (_) => const ProviderScheduleScreen());
    case '/provider-subscriptions':
      return MaterialPageRoute(builder: (_) => const ProviderSubscriptionScreen());
    case '/customer-memberships':
      return MaterialPageRoute(builder: (_) => const CustomerMembershipScreen());
    case '/conversations':
      return MaterialPageRoute(builder: (_) => const ConversationListScreen());
    case '/support-tickets':
      return MaterialPageRoute(builder: (_) => const SupportTicketsScreen());
    case '/disputes':
      return MaterialPageRoute(builder: (_) => const DisputesScreen());

    case '/provider-detail':
      return MaterialPageRoute(
        builder: (_) => ProviderDetailScreen(provider: args as Map),
      );
    case '/chat':
      final chatArgs = args as Map<String, dynamic>?;
      return MaterialPageRoute(
        builder: (_) => ChatScreen(
          bookingId: chatArgs?['bookingId'] as String?,
          providerId: chatArgs?['providerId'] as String?,
          mode: chatArgs?['mode'] as String? ?? 'booking',
          providerName: chatArgs?['providerName'] as String?,
        ),
      );
    case '/my-bookings':
      return MaterialPageRoute(builder: (_) => const MyBookingsScreen());
    case '/write-review':
      final wr = args as Map<String, String>;
      return MaterialPageRoute(
        builder: (_) => WriteReviewScreen(
          bookingId: wr['bookingId']!,
          providerName: wr['providerName']!,
          providerId: wr['providerId']!,
        ),
      );
    case '/provider-customer-feedback':
      final pf = args as Map<String, dynamic>;
      return MaterialPageRoute(
        builder: (_) => ProviderCustomerFeedbackScreen(
          bookingId: pf['bookingId'] as String,
          customerName: pf['customerName'] as String,
          providerName: pf['providerName'] as String,
        ),
      );
    case '/grievance':
      final g = args as Map<String, dynamic>;
      return MaterialPageRoute(
        builder: (_) => GrievanceChatScreen(
          bookingId: g['bookingId'] as String,
          grievanceId: g['grievanceId'] as String?,
        ),
      );
    case '/customer-job-detail':
      final cjd = args as Map<String, dynamic>;
      return MaterialPageRoute(
        builder: (_) => CustomerJobDetailScreen(
          jobRequestId: cjd['jobRequestId'] as String,
        ),
      );
    case '/provider-submit-quote':
      final psq = args as Map<String, dynamic>;
      return MaterialPageRoute(
        builder: (_) => ProviderSubmitQuoteScreen(
          jobRequestId: psq['jobRequestId'] as String,
        ),
      );
    case '/provider-charges':
      final pc = args as Map<String, dynamic>;
      return MaterialPageRoute(
        builder: (_) => ProviderChargesScreen(bookingId: pc['bookingId'] as String),
      );
    case '/provider-job-detail':
      final pjd = args as Map<String, dynamic>;
      return MaterialPageRoute(
        builder: (_) => ProviderJobDetailScreen(
          jobRequestId: pjd['jobRequestId'] as String,
        ),
      );
  }
  return null;
}
