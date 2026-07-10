import 'package:flutter/material.dart';
import '../l10n/strings.dart';
import '../main.dart';
import '../services/api_service.dart';
import '../theme.dart';
import '../widgets/payment_method_selector.dart';

import 'package:desicompany/services/app_logger.dart';
class ProviderSubscriptionScreen extends StatefulWidget {
  const ProviderSubscriptionScreen({super.key});

  @override
  State<ProviderSubscriptionScreen> createState() => _ProviderSubscriptionScreenState();
}

class _ProviderSubscriptionScreenState extends State<ProviderSubscriptionScreen> {
  List<dynamic> _plans = [];
  Map<String, dynamic>? _activeSub;
  bool _loading = true;
  bool _subscribingId = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final plans = await ApiService.get('/subscription-plans');
      Map<String, dynamic>? activeSub;
      try {
        activeSub = await ApiService.get('/subscription-plans/my') as Map<String, dynamic>?;
      } catch (e, st) { AppLogger.e('provider_subscription_screen', 'Operation failed', e, st); }
      if (!mounted) return;
      setState(() {
        _plans = plans as List;
        _activeSub = activeSub;
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _subscribe(String planId) async {
    final loc = DesiCompanyApp.localeProvider!;
    setState(() => _subscribingId = true);
    try {
      final order = await ApiService.post('/payments/subscription-order', body: {
        'planId': planId,
      }) as Map<String, dynamic>;

      if (!mounted) return;
      setState(() => _subscribingId = false);

      final status = order['status'] as String?;

      if (status == 'free') {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(loc.tr('subscription_active'))),
        );
        _load();
        return;
      }

      if (status == 'chargeable') {
        final result = await showModalBottomSheet<Map<String, dynamic>>(
          context: context,
          isScrollControlled: true,
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          builder: (ctx) => PaymentMethodSelector(
            keyId: order['keyId'] as String,
            orderId: order['gatewayOrderId'] as String,
            amountPaise: order['amount'] as int,
            amount: (order['amount'] as int) / 100,
            planId: planId,
            preferredMethod: order['preferredMethod'] as String?,
          ),
        );

        if (result == null) return;

        final paymentStatus = result['status'] as String?;
        if (paymentStatus == 'success') {
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(loc.tr('subscription_active'))),
          );
          _load();
        } else if (paymentStatus == 'pending') {
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Payment received. Activating subscription...')),
          );
          _load();
        }
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Unexpected response from server')),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _subscribingId = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    }
  }

  Future<void> _cancelSubscription() async {
    final loc = DesiCompanyApp.localeProvider!;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(loc.tr('cancel_subscription')),
        content: Text(loc.tr('subscription_details')),
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
    setState(() => _subscribingId = true);
    try {
      await ApiService.delete('/subscription-plans/cancel');
      if (!mounted) return;
      setState(() => _subscribingId = false);
      _load();
    } catch (e, st) { AppLogger.e('provider_subscription_screen', 'Operation failed', e, st);
      if (mounted) setState(() => _subscribingId = false);
    }
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
        color: const Color(0xFF66A3FF),
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
                              if (_activeSub != null)
                                _buildActiveBanner(loc),
                              if (_activeSub != null)
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
          loc.tr('subscription_plans'),
          style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
        ),
      ]),
    );
  }

  Widget _buildActiveBanner(LocalizationProvider loc) {
    final plan = _activeSub!['plan'] as Map<String, dynamic>?;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF43A047),
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
                '${plan?['name'] ?? ''} — ${loc.tr('subscription_active')}',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
              ),
              const SizedBox(height: 4),
              Text(
                loc.tr('billing_monthly'),
                style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 12),
              ),
            ],
          ),
        ),                        TextButton(
                          onPressed: _cancelSubscription,
                          child: Text(loc.tr('cancel_subscription'), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        ),
      ]),
    );
  }

  Widget _buildPlanCard(Map<String, dynamic> plan, LocalizationProvider loc) {
    final name = plan['name'] ?? '';
    final price = (plan['price'] ?? 0).toDouble();
    final durationMonths = plan['durationMonths'] ?? 1;
    final extraDays = plan['extraDays'] ?? 0;
    final benefits = plan['benefits'] as Map<String, dynamic>? ?? {};
    final isActive = plan['isActive'] ?? true;
    final isCurrentPlan = _activeSub?['plan']?['id'] == plan['id'];

    if (!isActive) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: isCurrentPlan ? Border.all(color: const Color(0xFF43A047), width: 2) : null,
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
                      const SizedBox(height: 4),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '₹${price.toStringAsFixed(0)}',
                            style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: AppTheme.primary),
                          ),
                          if (durationMonths > 1 || extraDays > 0)
                            Text(
                              ' / ${durationMonths}mo${extraDays > 0 ? "+$extraDays" : ""}',
                              style: const TextStyle(fontSize: 14, color: AppTheme.textSecondary),
                            )
                          else
                            Text(
                              loc.tr('billing_monthly'),
                              style: const TextStyle(fontSize: 14, color: AppTheme.textSecondary),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (isCurrentPlan)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF43A047).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text(
                      'Active',
                      style: TextStyle(color: Color(0xFF43A047), fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ),
              ],
            ),
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
                        color: const Color(0xFF43A047).withValues(alpha: 0.1),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.check, size: 14, color: Color(0xFF43A047)),
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
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: isCurrentPlan || _subscribingId ? null : () => _subscribe(plan['id']),
                style: ElevatedButton.styleFrom(
                  backgroundColor: isCurrentPlan ? Colors.grey.shade300 : AppTheme.primary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: Text(
                  isCurrentPlan ? loc.tr('subscription_active') : loc.tr('subscribe'),
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                ),
              ),
            ),
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
          Icon(Icons.card_membership_outlined, size: 80, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          Text(loc.tr('no_subscriptions'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
          const SizedBox(height: 8),
          Text(loc.tr('subscription_details'), style: const TextStyle(fontSize: 14, color: AppTheme.textSecondary)),
        ]),
      ),
    );
  }
}
