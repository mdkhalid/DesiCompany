import 'package:flutter/material.dart';
import '../l10n/strings.dart';
import '../main.dart';
import '../services/api_service.dart';
import '../theme.dart';

class CustomerMembershipScreen extends StatefulWidget {
  const CustomerMembershipScreen({super.key});

  @override
  State<CustomerMembershipScreen> createState() => _CustomerMembershipScreenState();
}

class _CustomerMembershipScreenState extends State<CustomerMembershipScreen> {
  List<dynamic> _plans = [];
  Map<String, dynamic>? _activeMembership;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final plans = await ApiService.get('/membership-plans');
      Map<String, dynamic>? active;
      try {
        final result = await ApiService.get('/membership-plans/my');
        if (result is Map && result['membership'] != null) {
          active = result['membership'] as Map<String, dynamic>?;
        }
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _plans = plans as List;
        _activeMembership = active;
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _join(String planId, String billingCycle) async {
    final loc = DesiCompanyApp.localeProvider!;
    try {
      await ApiService.post(
        '/membership-plans/$planId/join',
        body: {'billingCycle': billingCycle},
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(loc.tr('join_membership'))),
      );
      _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    }
  }

  Future<void> _cancel(String membershipId) async {
    final loc = DesiCompanyApp.localeProvider!;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(loc.tr('cancel')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(loc.tr('back'))),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(loc.tr('subscription_cancelled'), style: const TextStyle(color: AppTheme.error)),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await ApiService.delete('/membership-plans/cancel');
      if (!mounted) return;
      _load();
    } catch (_) {}
  }

  String _formatBenefit(String key, dynamic value) {
    final loc = DesiCompanyApp.localeProvider!;
    final keyStr = 'benefit_$key';
    if (value is num) {
      return loc.tr(keyStr, params: {'value': '$value'});
    }
    return loc.tr(keyStr);
  }

  @override
  Widget build(BuildContext context) {
    final loc = DesiCompanyApp.localeProvider!;
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: LinearGradient(
          begin: Alignment.topLeft, end: Alignment.bottomRight,
          colors: [Color(0xFF6C3FB4), Color(0xFF5E35B1), Color(0xFF7C4DFF)],
        )),
        child: SafeArea(
          child: Column(children: [
            _buildAppBar(loc),
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
                      onRefresh: _load,
                      child: _plans.isEmpty
                        ? ListView(children: [
                            const SizedBox(height: 80),
                            _buildEmptyState(loc),
                          ])
                        : ListView(
                            padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
                            children: [
                              if (_activeMembership != null)
                                _buildActiveBanner(loc),
                              if (_activeMembership != null)
                                const SizedBox(height: 16),
                              ..._plans.map((p) => _buildPlanCard(p, loc)),
                            ],
                          ),
                    ),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _buildAppBar(LocalizationProvider loc) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 20, 0),
      child: Row(children: [
        IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        const SizedBox(width: 4),
        Text(
          loc.tr('membership_plans'),
          style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
        ),
      ]),
    );
  }

  Widget _buildActiveBanner(LocalizationProvider loc) {
    final plan = _activeMembership!['plan'] as Map<String, dynamic>?;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF6C3FB4), Color(0xFF9C6ADE)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(children: [
        const Icon(Icons.verified, color: Colors.white, size: 28),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${plan?['name'] ?? ''} ${loc.tr('subscription_active')}',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
              ),
              const SizedBox(height: 4),
              Row(children: [
                Icon(Icons.check_circle, size: 14, color: Colors.white.withValues(alpha: 0.8)),
                const SizedBox(width: 4),
                Text(loc.tr('fee_waived'), style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 12)),
              ]),
            ],
          ),
        ),
        TextButton(
          onPressed: () => _cancel(_activeMembership!['id']),
          child: Text(loc.tr('subscription_cancelled'), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        ),
      ]),
    );
  }

  Widget _buildPlanCard(Map<String, dynamic> plan, LocalizationProvider loc) {
    final name = plan['name'] ?? '';
    final monthly = (plan['monthlyPrice'] ?? 0).toDouble();
    final yearly = (plan['yearlyPrice'] ?? 0).toDouble();
    final benefits = plan['benefits'] as Map<String, dynamic>? ?? {};
    final isActive = plan['isActive'] ?? true;
    final isCurrentPlan = _activeMembership?['plan']?['id'] == plan['id'];
    final hasFeeWaiver = benefits['feeWaiverPercent'] != null;

    if (!isActive) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: isCurrentPlan ? Border.all(color: const Color(0xFF6C3FB4), width: 2) : null,
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 12, offset: const Offset(0, 4))],
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                      ),
                      const SizedBox(height: 8),
                      if (monthly > 0) ...[
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              '₹${monthly.toStringAsFixed(0)}',
                              style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: AppTheme.primary),
                            ),
                            Text(loc.tr('billing_monthly'), style: const TextStyle(fontSize: 14, color: AppTheme.textSecondary)),
                          ],
                        ),
                      ],
                      if (yearly > 0) ...[
                        const SizedBox(height: 4),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              '₹${yearly.toStringAsFixed(0)}',
                              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.teal),
                            ),
                            Text(loc.tr('billing_yearly'), style: const TextStyle(fontSize: 14, color: AppTheme.textSecondary)),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                if (isCurrentPlan)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppTheme.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      loc.tr('subscription_active'),
                      style: const TextStyle(color: AppTheme.primary, fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ),
              ],
            ),

            // Fee waiver highlight
            if (hasFeeWaiver && !isCurrentPlan) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFF43A047).withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(children: [
                  const Icon(Icons.check_circle, size: 16, color: Color(0xFF43A047)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      loc.tr('fee_waived'),
                      style: const TextStyle(fontSize: 13, color: Color(0xFF43A047), fontWeight: FontWeight.w600),
                    ),
                  ),
                ]),
              ),
            ],

            if (benefits.isNotEmpty) ...[
              const SizedBox(height: 16),
              const Divider(height: 1),
              const SizedBox(height: 12),
              ...benefits.entries.map((e) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      margin: const EdgeInsets.only(top: 2),
                      width: 20, height: 20,
                      decoration: BoxDecoration(
                        color: AppTheme.primary.withValues(alpha: 0.1),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Icons.check, size: 14, color: AppTheme.primary),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _formatBenefit(e.key, e.value),
                        style: const TextStyle(fontSize: 13, color: AppTheme.textPrimary, height: 1.3),
                      ),
                    ),
                  ],
                ),
              )),
            ],
            const SizedBox(height: 16),

            // Join buttons
            if (!isCurrentPlan) ...[
              Row(children: [
                if (monthly > 0) ...[
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => _join(plan['id'], 'monthly'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primary,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: Text('${loc.tr('join_membership')} ${loc.tr('monthly')}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    ),
                  ),
                ],
                if (monthly > 0 && yearly > 0)
                  const SizedBox(width: 8),
                if (yearly > 0) ...[
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _join(plan['id'], 'yearly'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.teal,
                        side: const BorderSide(color: Colors.teal),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: Text('${loc.tr('join_membership')} ${loc.tr('yearly')}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    ),
                  ),
                ],
              ]),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState(LocalizationProvider loc) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(children: [
          Icon(Icons.card_giftcard_outlined, size: 80, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          Text(loc.tr('no_memberships'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
          const SizedBox(height: 8),
          Text(loc.tr('membership_details'), style: const TextStyle(fontSize: 14, color: AppTheme.textSecondary)),
        ]),
      ),
    );
  }
}
