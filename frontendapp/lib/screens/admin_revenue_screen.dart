import 'package:flutter/material.dart';
import '../l10n/strings.dart';
import '../main.dart';
import '../services/api_service.dart';
import '../theme.dart';

class AdminRevenueScreen extends StatefulWidget {
  const AdminRevenueScreen({super.key});

  @override
  State<AdminRevenueScreen> createState() => _AdminRevenueScreenState();
}

class _AdminRevenueScreenState extends State<AdminRevenueScreen> {
  bool _loading = true;
  Map<String, dynamic>? _stats;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService.get('/admin/revenue-stats');
      if (!mounted) return;
      setState(() {
        _stats = data as Map<String, dynamic>?;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final loc = DesiCompanyApp.localeProvider!;
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF6C3FB4), Color(0xFF5E35B1), Color(0xFF7C4DFF)],
          ),
        ),
        child: SafeArea(
          child: Column(children: [
            _buildHeader(loc),
            Expanded(
              child: Container(
                margin: const EdgeInsets.only(top: 16),
                decoration: const BoxDecoration(
                  color: Color(0xFFF8F9FA),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
                ),
                child: _loading
                    ? const Center(child: CircularProgressIndicator())
                    : RefreshIndicator(
                        onRefresh: _loadStats,
                        child: _buildContent(loc),
                      ),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _buildHeader(LocalizationProvider loc) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 16, 20, 0),
      child: Row(children: [
        IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        const SizedBox(width: 4),
        Text(
          loc.tr('admin_revenue'),
          style: const TextStyle(
            color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold,
          ),
        ),
        const Spacer(),
        IconButton(
          icon: const Icon(Icons.refresh, color: Colors.white),
          onPressed: _loadStats,
        ),
      ]),
    );
  }

  Widget _buildContent(LocalizationProvider loc) {
    final cFees = (_stats?['totalConvenienceFees'] ?? 0).toDouble();
    final sRevenue = (_stats?['totalSubscriptionRevenue'] ?? 0).toDouble();
    final discounts = (_stats?['totalDiscounts'] ?? 0).toDouble();
    final netRevenue = cFees + sRevenue - discounts;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
      children: [
        Text(
          loc.tr('revenue_stats'),
          style: const TextStyle(
            fontSize: 20, fontWeight: FontWeight.bold, color: AppTheme.textPrimary,
          ),
        ),
        const SizedBox(height: 16),
        _buildStatCard(
          icon: Icons.receipt_long,
          label: loc.tr('convenience_fees'),
          amount: cFees,
          color: const Color(0xFF2E7D32),
          bgColor: const Color(0xFFE8F5E9),
        ),
        const SizedBox(height: 12),
        _buildStatCard(
          icon: Icons.subscriptions,
          label: loc.tr('subscription_revenue'),
          amount: sRevenue,
          color: const Color(0xFF1565C0),
          bgColor: const Color(0xFFE3F2FD),
          subtitle: loc.tr('revenue_auto_billing'),
        ),
        const SizedBox(height: 12),
        _buildStatCard(
          icon: Icons.local_offer,
          label: loc.tr('discounts_given'),
          amount: discounts,
          color: const Color(0xFFE65100),
          bgColor: const Color(0xFFFFF3E0),
          negative: true,
        ),
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF6C3FB4), Color(0xFF00BFA5)],
              begin: Alignment.topLeft, end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: AppTheme.primary.withValues(alpha: 0.3),
                blurRadius: 16,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                loc.tr('net_revenue'),
                style: const TextStyle(
                  color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '₹${netRevenue.toStringAsFixed(0)}',
                style: const TextStyle(
                  color: Colors.white, fontSize: 36, fontWeight: FontWeight.bold,
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '${cFees.toStringAsFixed(0)} + ${sRevenue.toStringAsFixed(0)} - ${discounts.toStringAsFixed(0)}',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.6), fontSize: 12,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Center(
          child: Text(
            loc.tr('last_30_days'),
            style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
          ),
        ),
      ],
    );
  }

  Widget _buildStatCard({
    required IconData icon,
    required String label,
    required double amount,
    required Color color,
    required Color bgColor,
    String? subtitle,
    bool negative = false,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(icon, color: color, size: 24),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppTheme.textPrimary),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 2),
                Text(subtitle, style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
              ],
            ],
          ),
        ),
        Text(
          '${negative ? '-' : ''}₹${amount.toStringAsFixed(0)}',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: negative ? AppTheme.error : color,
          ),
        ),
      ]),
    );
  }
}
