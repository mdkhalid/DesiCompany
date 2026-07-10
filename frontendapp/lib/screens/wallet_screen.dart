import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../l10n/strings.dart';
import '../theme.dart';
import '../services/api_service.dart';

import 'package:desicompany/services/app_logger.dart';
class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});
  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  double _balance = 0;
  double _totalEarned = 0;
  double _totalSpent = 0;
  List<dynamic> _txns = [];
  bool _loading = true;
  bool _payouting = false;
  bool _hasFeeWaiver = false;
  double _commissionSaved = 0;

  @override
  void initState() {
    super.initState();
    _loadWallet();
  }

  Future<void> _loadWallet() async {
    try {
      final wallet = await ApiService.get('/wallet');
      final txns = await ApiService.get('/wallet/transactions');
      _checkFeeWaiver();
      _loadCommissionSaved();
      final list = (txns['transactions'] as List?) ?? [];
      double earned = 0;
      double spent = 0;
      for (final t in list) {
        final amt = (t['amount'] ?? 0).toDouble();
        if (t['type'] == 'credit') {
          earned += amt;
        } else if (t['type'] == 'debit') {
          spent += amt;
        }
      }
      if (!mounted) return;
      setState(() {
        _balance = (wallet['balance'] ?? 0).toDouble();
        _txns = list;
        _totalEarned = earned;
        _totalSpent = spent;
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _checkFeeWaiver() async {
    try {
      final result = await ApiService.get('/membership-plans/my');
      if (result is Map && result['membership'] != null) {
        if (mounted) setState(() => _hasFeeWaiver = true);
      }
    } catch (e, st) { AppLogger.e('wallet_screen', 'Operation failed', e, st); }
  }

  Future<void> _loadCommissionSaved() async {
    try {
      final result = await ApiService.get('/provider-grace/commission-saved');
      if (result is Map && mounted) {
        setState(() => _commissionSaved = (result['commissionSaved'] ?? 0).toDouble());
      }
    } catch (e, st) { AppLogger.e('wallet_screen', 'Commission saved load failed', e, st); }
  }

  Future<void> _requestInstantPayout() async {
    final loc = LocalizationProvider.of(context);
    if (_balance <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(loc.tr('insufficient_balance_payout'))),
      );
      return;
    }

    // Confirmation dialog first with estimated amounts
    final amount = _balance;
    final estimatedFee = amount * 0.025; // 2.5% estimate
    final estimatedNet = amount - estimatedFee;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(loc.tr('instant_payout')),
        content: Text(
          loc.tr('instant_payout_confirm', params: {
            'amount': amount.toStringAsFixed(0),
            'fee': estimatedFee.toStringAsFixed(0),
            'net': estimatedNet.toStringAsFixed(0),
          }),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(loc.tr('cancel'))),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(loc.tr('withdraw')),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    setState(() => _payouting = true);
    try {
      await ApiService.post('/wallet/instant-payout', body: {'amount': amount});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(loc.tr('instant_payout_confirmed'))),
      );
      setState(() => _payouting = false);
      _loadWallet();
    } catch (e) {
      if (!mounted) return;
      setState(() => _payouting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(loc.tr('payout_failed', params: {'error': e.toString().replaceFirst('Exception: ', '')}))),
      );
    }
  }

  String _formatDate(dynamic raw) {
    if (raw == null) return '';
    DateTime? dt;
    try {
      dt = DateTime.parse(raw.toString());
    } catch (e, st) { AppLogger.e('wallet_screen', 'Operation failed', e, st);
      return raw.toString();
    }
    return DateFormat('d MMM yyyy, h:mm a').format(dt);
  }

  @override
  Widget build(BuildContext context) {
    final loc = LocalizationProvider.of(context);
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppTheme.gradientStart, AppTheme.gradientEnd],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(loc),
              const SizedBox(height: 16),
              Expanded(
                child: Container(
                  decoration: const BoxDecoration(
                    color: AppTheme.background,
                    borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
                  ),
                  child: _loading
                      ? const Center(child: CircularProgressIndicator())
                      : _buildContent(loc),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(LocalizationProvider loc) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 16, 20, 0),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
            onPressed: () => Navigator.pop(context),
          ),
          Text(
            loc.tr('wallet'),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent(LocalizationProvider loc) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildBalanceCard(loc),
          const SizedBox(height: 20),
          _buildStatsRow(loc),
          if (_commissionSaved > 0) ...[
            const SizedBox(height: 16),
            _buildCommissionSavedCard(),
          ],
          const SizedBox(height: 28),
          Text(
            loc.tr('transactions'),
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: AppTheme.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          if (_txns.isEmpty)
            _buildEmptyState(loc)
          else
            ..._txns.map((t) => _buildTransactionTile(t)),
        ],
      ),
    );
  }

  Widget _buildBalanceCard(LocalizationProvider loc) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(24, 28, 24, 28),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF6C3FB4), Color(0xFF00BFA5)],
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: AppTheme.primary.withValues(alpha: 0.35),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.account_balance_wallet,
              color: Colors.white,
              size: 34,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            loc.tr('available_balance'),
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.9),
              fontSize: 14,
              fontWeight: FontWeight.w500,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '₹${_balance.toStringAsFixed(2)}',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 40,
              fontWeight: FontWeight.bold,
              letterSpacing: 1,
            ),
          ),
          if (_hasFeeWaiver) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.check_circle, size: 14, color: Colors.white),
                  const SizedBox(width: 4),
                  Text(
                    loc.tr('fee_waived'),
                    style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: _buildActionButton(
                  icon: Icons.add_circle_outline,
                  label: loc.tr('add_money'),
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(loc.tr('add_money'))),
                    );
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildActionButton(
                  icon: Icons.upload,
                  label: _payouting ? '...' : loc.tr('withdraw'),
                  onTap: _payouting ? null : () => _requestInstantPayout(),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    VoidCallback? onTap,
  }) {
    return Material(
      color: Colors.white.withValues(alpha: 0.2),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: Colors.white, size: 18),
              const SizedBox(width: 6),
              Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatsRow(LocalizationProvider loc) {
    return Row(
      children: [
        Expanded(
          child: _buildStatCard(
            icon: Icons.arrow_downward_rounded,
            iconColor: const Color(0xFF2E7D32),
            iconBg: const Color(0xFFE8F5E9),
            label: loc.tr('total_earned'),
            amount: '₹${_totalEarned.toStringAsFixed(2)}',
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _buildStatCard(
            icon: Icons.arrow_upward_rounded,
            iconColor: AppTheme.error,
            iconBg: const Color(0xFFFFEBEE),
            label: loc.tr('total_spent'),
            amount: '₹${_totalSpent.toStringAsFixed(2)}',
          ),
        ),
      ],
    );
  }

  Widget _buildCommissionSavedCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF43A047), Color(0xFF2E7D32)],
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.savings_outlined, color: Colors.white, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Commission saved (grace period)',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '₹${_commissionSaved.toStringAsFixed(2)}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard({
    required IconData icon,
    required Color iconColor,
    required Color iconBg,
    required String label,
    required String amount,
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: iconColor, size: 22),
          ),
          const SizedBox(height: 12),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              color: AppTheme.textSecondary,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            amount,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: AppTheme.textPrimary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(LocalizationProvider loc) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: AppTheme.primary.withValues(alpha: 0.08),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.receipt_long_outlined,
              size: 40,
              color: AppTheme.primary.withValues(alpha: 0.7),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            loc.tr('no_transactions_yet'),
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppTheme.textPrimary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTransactionTile(dynamic t) {
    final isCredit = t['type'] == 'credit';
    final amount = (t['amount'] ?? 0).toDouble();
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
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
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: isCredit ? const Color(0xFFE8F5E9) : const Color(0xFFFFEBEE),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isCredit ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded,
              color: isCredit ? const Color(0xFF2E7D32) : AppTheme.error,
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  t['description']?.toString() ?? '',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Text(
                  _formatDate(t['createdAt'] ?? t['date']),
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            '${isCredit ? '+' : '-'}₹${amount.toStringAsFixed(2)}',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: isCredit ? const Color(0xFF2E7D32) : AppTheme.error,
            ),
          ),
        ],
      ),
    );
  }
}
