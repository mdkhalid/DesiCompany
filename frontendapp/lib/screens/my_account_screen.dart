import 'package:flutter/material.dart';
import '../l10n/strings.dart';
import '../services/api_service.dart';
import '../services/app_presence_service.dart';
import '../services/auth_service.dart';
import '../theme.dart';
import 'app_shell.dart';
import 'profile_screen.dart';
import 'wallet_screen.dart';
import 'support_tickets_screen.dart';
import 'disputes_screen.dart';
import 'provider_busy_slots_screen.dart';
import 'conversation_list_screen.dart';

class MyAccountScreen extends StatefulWidget {
  const MyAccountScreen({super.key});

  @override
  State<MyAccountScreen> createState() => _MyAccountScreenState();
}

class _MyAccountScreenState extends State<MyAccountScreen> {
  Map<String, dynamic>? _profile;
  bool _loading = true;
  int _completedJobs = 0;
  double _totalEarnings = 0;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final data = await ApiService.get('/users/profile');
      if (!mounted) return;
      setState(() {
        _profile = data;
        _loading = false;
      });
      if (data['role'] == 'provider') _loadProviderStats();
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadProviderStats() async {
    try {
      final bookings = await ApiService.get('/bookings/provider/me');
      if (!mounted) return;
      final list = bookings is List ? bookings : [];
      int completed = 0;
      double earnings = 0;
      for (final b in list) {
        if (b['status'] == 'completed') {
          completed++;
          earnings += double.tryParse('${b['providerAmount']}') ?? 0;
        }
      }
      if (mounted) setState(() { _completedJobs = completed; _totalEarnings = earnings; });
    } catch (_) {}
  }

  String _getInitials() {
    if (_profile == null) return '?';
    final role = _profile!['role'];
    Map<String, dynamic>? userData;
    if (role == 'customer') {
      userData = _profile!['customer'];
    } else {
      userData = _profile!['provider'];
    }
    if (userData == null) return '?';
    final firstName = userData['firstName'] ?? '';
    if (firstName.isNotEmpty) return firstName[0].toUpperCase();
    return '?';
  }

  String _getFullName() {
    if (_profile == null) return '';
    final role = _profile!['role'];
    Map<String, dynamic>? userData;
    if (role == 'customer') {
      userData = _profile!['customer'];
    } else {
      userData = _profile!['provider'];
    }
    if (userData == null) return '';
    final first = userData['firstName'] ?? '';
    final last = userData['lastName'] ?? '';
    return '$first $last'.trim();
  }

  String _getEmail() {
    return _profile?['email'] ?? '';
  }

  String _getRole() {
    return _profile?['role']?.toString().toUpperCase() ?? '';
  }

  Future<void> _logout() async {
    final loc = LocalizationProvider.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(loc.tr('header_logout')),
        content: Text(loc.tr('logout_confirm')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(loc.tr('cancel')),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(loc.tr('header_logout'), style: const TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      AppPresenceService.disconnect();
      await AuthService.logout();
      if (mounted) {
        Navigator.of(context, rootNavigator: true).pushReplacementNamed('/login');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final loc = LocalizationProvider.of(context);
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      body: Container(
        color: const Color(0xFF66A3FF),
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(loc),
              Expanded(
                child: _loading
                    ? const Center(child: CircularProgressIndicator(color: Colors.white))
                    : _buildContent(loc),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(LocalizationProvider loc) {
    final canPop = ModalRoute.of(context)?.isFirst != true;
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 16, 20, 16),
      child: Row(
        children: [
          if (canPop)
            Tooltip(
              message: loc.tr('header_back'),
              child: IconButton(
                icon: const Icon(Icons.arrow_back, color: Colors.white),
                onPressed: () => shellBack(context),
              ),
            ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              loc.tr('my_account'),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent(LocalizationProvider loc) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFFF5F0FF),
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 100),
        children: [
          _buildProfileHeader(),
          if (_profile?['role'] == 'provider') ...[
            const SizedBox(height: 20),
            _buildProviderStats(),
          ],
          const SizedBox(height: 24),
          _buildMenuSection(loc),
        ],
      ),
    );
  }

  Widget _buildProfileHeader() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: const Color(0xFF66A3FF),
              borderRadius: BorderRadius.circular(32),
            ),
            child: Center(
              child: Text(
                _getInitials(),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _getFullName(),
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                if (_getEmail().isNotEmpty)
                  Text(
                    _getEmail(),
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey.shade600,
                    ),
                  ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _getRole(),
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.primary,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProviderStats() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF43A047).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.check_circle_outline, color: Color(0xFF43A047), size: 24),
                ),
                const SizedBox(height: 8),
                Text(
                  '$_completedJobs',
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                ),
                const SizedBox(height: 2),
                Text(
                  'Jobs Done',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                ),
              ],
            ),
          ),
          Container(width: 1, height: 50, color: Colors.grey.shade200),
          Expanded(
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.currency_rupee, color: AppTheme.primary, size: 24),
                ),
                const SizedBox(height: 8),
                Text(
                  '₹${_totalEarnings.toStringAsFixed(0)}',
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                ),
                const SizedBox(height: 2),
                Text(
                  'Earned',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMenuSection(LocalizationProvider loc) {
    final isProvider = _profile?['role'] == 'provider';
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Profile Section
        Text(
          loc.tr('settings'),
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: AppTheme.textPrimary,
          ),
        ),
        const SizedBox(height: 12),
        _buildMenuItem(
          icon: Icons.person_outline,
          title: loc.tr('nav_profile'),
          subtitle: loc.tr('edit_profile_info'),
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const ProfileScreen()),
          ),
        ),
        _buildMenuItem(
          icon: Icons.account_balance_wallet_outlined,
          title: loc.tr('nav_wallet'),
          subtitle: loc.tr('manage_wallet'),
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const WalletScreen()),
          ),
        ),
        _buildMenuItem(
          icon: Icons.chat_bubble_outline,
          title: loc.tr('nav_chat'),
          subtitle: 'View conversations',
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const ConversationListScreen()),
          ),
        ),
        
        // Jobs & Services Section (for both roles)
        const SizedBox(height: 24),
        Text(
          isProvider ? 'My Services' : 'My Jobs',
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: AppTheme.textPrimary,
          ),
        ),
        const SizedBox(height: 12),
        if (isProvider) ...[
          _buildMenuItem(
            icon: Icons.work_outline,
            title: 'Jobs',
            subtitle: 'View available jobs',
            onTap: () => Navigator.pushNamed(context, '/provider-open-jobs'),
          ),
          _buildMenuItem(
            icon: Icons.schedule,
            title: 'Schedule',
            subtitle: 'Manage your schedule',
            onTap: () => Navigator.pushNamed(context, '/provider-schedule'),
          ),
          _buildMenuItem(
            icon: Icons.handyman,
            title: 'Services',
            subtitle: 'Manage your services',
            onTap: () => Navigator.pushNamed(context, '/provider-services'),
          ),
          _buildMenuItem(
            icon: Icons.star_rate,
            title: 'Reviews',
            subtitle: 'View your reviews',
            onTap: () => Navigator.pushNamed(context, '/provider-reviews'),
          ),
          _buildMenuItem(
            icon: Icons.verified_user,
            title: 'KYC',
            subtitle: 'KYC verification',
            onTap: () => Navigator.pushNamed(context, '/provider-kyc-upload'),
          ),
          _buildMenuItem(
            icon: Icons.card_membership,
            title: 'Subscriptions',
            subtitle: 'Manage subscriptions',
            onTap: () => Navigator.pushNamed(context, '/provider-subscriptions'),
          ),
          _buildMenuItem(
            icon: Icons.feedback,
            title: 'Quotes',
            subtitle: 'View your quotes',
            onTap: () => Navigator.pushNamed(context, '/provider-my-quotes'),
          ),
          _buildMenuItem(
            icon: Icons.event_busy,
            title: 'Busy Slots',
            subtitle: 'Manage busy slots',
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const ProviderBusySlotsScreen()),
            ),
          ),
        ] else ...[
          _buildMenuItem(
            icon: Icons.work_outline,
            title: 'Jobs',
            subtitle: 'View your jobs',
            onTap: () => Navigator.pushNamed(context, '/customer-jobs'),
          ),
          _buildMenuItem(
            icon: Icons.card_giftcard,
            title: 'Membership',
            subtitle: 'View membership plans',
            onTap: () => Navigator.pushNamed(context, '/customer-memberships'),
          ),
        ],
        
        // Support Section
        const SizedBox(height: 24),
        const Text(
          'Support',
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: AppTheme.textPrimary,
          ),
        ),
        const SizedBox(height: 12),
        _buildMenuItem(
          icon: Icons.support_agent,
          title: loc.tr('support'),
          subtitle: loc.tr('get_help'),
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const SupportTicketsScreen()),
          ),
        ),
        _buildMenuItem(
          icon: Icons.gavel,
          title: loc.tr('disputes'),
          subtitle: loc.tr('view_disputes'),
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const DisputesScreen()),
          ),
        ),
        
        // Account Section
        const SizedBox(height: 24),
        Text(
          loc.tr('account'),
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: AppTheme.textPrimary,
          ),
        ),
        const SizedBox(height: 12),
        _buildMenuItem(
          icon: Icons.logout,
          title: loc.tr('header_logout'),
          subtitle: loc.tr('logout_account'),
          isDestructive: true,
          onTap: _logout,
        ),
      ],
    );
  }

  Widget _buildMenuItem({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
    bool isDestructive = false,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: isDestructive
                        ? Colors.red.withValues(alpha: 0.1)
                        : AppTheme.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(
                    icon,
                    color: isDestructive ? Colors.red : AppTheme.primary,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: isDestructive ? Colors.red : AppTheme.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.grey.shade500,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  Icons.arrow_forward_ios,
                  size: 16,
                  color: Colors.grey.shade400,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
