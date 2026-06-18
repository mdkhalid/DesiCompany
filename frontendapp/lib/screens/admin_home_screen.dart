import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme.dart';
import '../l10n/strings.dart';

class AdminHomeScreen extends StatefulWidget {
  const AdminHomeScreen({super.key});

  @override
  State<AdminHomeScreen> createState() => _AdminHomeScreenState();
}

class _AdminHomeScreenState extends State<AdminHomeScreen> {
  Map<String, dynamic>? _stats;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadDashboard();
  }

  Future<void> _loadDashboard() async {
    try {
      final data = await ApiService.get('/admin/dashboard');
      if (!mounted) return;
      setState(() {
        _stats = data as Map<String, dynamic>;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF6C3FB4), Color(0xFF5E35B1), Color(0xFF7C4DFF)],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(),
              Expanded(
                child: _loading
                    ? const Center(child: CircularProgressIndicator(color: Colors.white))
                    : _buildContent(),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: _buildBottomNav(),
    );
  }

  Widget _buildHeader() {
    final loc = LocalizationProvider.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.admin_panel_settings, color: Colors.white, size: 18),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    loc.tr('admin_dashboard'),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ],
          ),
          Row(
            children: [
              _buildIconButton(Icons.refresh, _loadDashboard),
              const SizedBox(width: 8),
              _buildIconButton(Icons.logout, () => Navigator.pushReplacementNamed(context, '/login')),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildIconButton(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, color: Colors.white, size: 20),
      ),
    );
  }

  Widget _buildContent() {
    if (_error != null) {
      return _buildErrorState();
    }
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFFF8F9FA),
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
        children: [
          _buildStatsSection(),
          const SizedBox(height: 24),
          _buildQuickActionsSection(),
        ],
      ),
    );
  }

  Widget _buildErrorState() {
    final loc = LocalizationProvider.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: Colors.white.withValues(alpha: 0.7)),
            const SizedBox(height: 16),
            Text(
              loc.tr('error'),
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white.withValues(alpha: 0.8)),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _loadDashboard,
              icon: const Icon(Icons.refresh),
              label: Text(loc.tr('retry')),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: AppTheme.primary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatsSection() {
    final loc = LocalizationProvider.of(context);
    final stats = [
      {
        'key': 'totalUsers',
        'label': loc.tr('total_users'),
        'icon': Icons.people,
        'color': const Color(0xFF6C3FB4),
      },
      {
        'key': 'totalProviders',
        'label': loc.tr('total_providers'),
        'icon': Icons.handyman,
        'color': const Color(0xFF00BFA5),
      },
      {
        'key': 'totalBookings',
        'label': loc.tr('total_bookings'),
        'icon': Icons.calendar_today,
        'color': const Color(0xFFFF6F00),
      },
      {
        'key': 'totalPayments',
        'label': loc.tr('total_payments'),
        'icon': Icons.payment,
        'color': const Color(0xFFE53935),
      },
      {
        'key': 'activeUsers',
        'label': loc.tr('active_users'),
        'icon': Icons.person,
        'color': const Color(0xFF2196F3),
      },
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          loc.tr('overview'),
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: AppTheme.textPrimary,
          ),
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.4,
          ),
          itemCount: stats.length,
          itemBuilder: (context, index) {
            final stat = stats[index];
            final value = _stats?[stat['key']] ?? 0;
            return _buildStatCard(
              stat['icon'] as IconData,
              stat['label'] as String,
              value,
              stat['color'] as Color,
            );
          },
        ),
      ],
    );
  }

  Widget _buildStatCard(IconData icon, String label, dynamic value, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const Spacer(),
          Text(
            '$value',
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: AppTheme.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              color: AppTheme.textSecondary,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActionsSection() {
    final loc = LocalizationProvider.of(context);
    final actions = [
      {
        'label': loc.tr('manage_users'),
        'icon': Icons.people_alt,
        'color': const Color(0xFF6C3FB4),
        'route': '/admin-users',
      },
      {
        'label': loc.tr('kyc_approvals'),
        'icon': Icons.verified_user,
        'color': const Color(0xFF00BFA5),
        'route': '/admin-kyc',
      },
      {
        'label': loc.tr('bookings'),
        'icon': Icons.calendar_month,
        'color': const Color(0xFFFF6F00),
        'route': '/admin-bookings',
      },
      {
        'label': loc.tr('admin_reviews'),
        'icon': Icons.rate_review,
        'color': const Color(0xFFE53935),
        'route': '/admin-reviews',
      },
      {
        'label': loc.tr('customer_feedback'),
        'icon': Icons.feedback,
        'color': const Color(0xFF7B1FA2),
        'route': '/admin-customer-feedbacks',
      },
      {
        'label': loc.tr('payment_gateways'),
        'icon': Icons.account_balance,
        'color': const Color(0xFF2196F3),
        'route': '/admin-gateways',
      },
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          loc.tr('quick_actions'),
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: AppTheme.textPrimary,
          ),
        ),
        const SizedBox(height: 12),
        ...actions.map((action) => _buildActionCard(
          action['label'] as String,
          action['icon'] as IconData,
          action['color'] as Color,
          () => Navigator.pushNamed(context, action['route'] as String),
        )),
      ],
    );
  }

  Widget _buildActionCard(String label, IconData icon, Color color, VoidCallback onTap) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
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
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: color, size: 24),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(
                    label,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                ),
                Icon(Icons.arrow_forward_ios, size: 14, color: Colors.grey.shade400),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBottomNav() {
    final loc = LocalizationProvider.of(context);
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 20,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _navItem(Icons.dashboard_rounded, loc.tr('nav_dashboard'), true, () {}),
              _navItem(Icons.people_outline, loc.tr('nav_users'), false, () => Navigator.pushNamed(context, '/admin-users')),
              _navItem(Icons.verified_user_outlined, loc.tr('nav_kyc'), false, () => Navigator.pushNamed(context, '/admin-kyc')),
              _navItem(Icons.more_horiz, loc.tr('nav_more'), false, () => _showMoreMenu()),
            ],
          ),
        ),
      ),
    );
  }

  Widget _navItem(IconData icon, String label, bool active, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: active
            ? BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              )
            : null,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: active ? AppTheme.primary : AppTheme.textSecondary,
              size: 24,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: active ? FontWeight.w600 : FontWeight.normal,
                color: active ? AppTheme.primary : AppTheme.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showMoreMenu() {
    final loc = LocalizationProvider.of(context);
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            _buildMoreMenuItem(
              Icons.calendar_month,
              loc.tr('bookings'),
              () {
                Navigator.pop(context);
                Navigator.pushNamed(context, '/admin-bookings');
              },
            ),
            _buildMoreMenuItem(
              Icons.rate_review,
              loc.tr('admin_reviews'),
              () {
                Navigator.pop(context);
                Navigator.pushNamed(context, '/admin-reviews');
              },
            ),
            _buildMoreMenuItem(
              Icons.account_balance,
              loc.tr('payment_gateways'),
              () {
                Navigator.pop(context);
                Navigator.pushNamed(context, '/admin-gateways');
              },
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildMoreMenuItem(IconData icon, String label, VoidCallback onTap) {
    return ListTile(
      leading: Icon(icon, color: AppTheme.primary),
      title: Text(
        label,
        style: const TextStyle(
          fontWeight: FontWeight.w500,
          color: AppTheme.textPrimary,
        ),
      ),
      trailing: Icon(Icons.arrow_forward_ios, size: 14, color: Colors.grey.shade400),
      onTap: onTap,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    );
  }
}
