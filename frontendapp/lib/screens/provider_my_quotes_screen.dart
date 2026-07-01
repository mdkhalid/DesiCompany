import 'package:flutter/material.dart';
import 'package:intl/intl.dart' as intl;
import '../l10n/strings.dart';
import '../main.dart';
import '../services/api_service.dart';
import '../theme.dart';
import 'provider_job_detail_screen.dart';

import 'package:desicompany/services/app_logger.dart';
class ProviderMyQuotesScreen extends StatefulWidget {
  const ProviderMyQuotesScreen({super.key});

  @override
  State<ProviderMyQuotesScreen> createState() => _ProviderMyQuotesScreenState();
}

class _ProviderMyQuotesScreenState extends State<ProviderMyQuotesScreen> {
  List<dynamic> _quotes = [];
  bool _loading = true;
  String? _withdrawingId;

  @override
  void initState() {
    super.initState();
    _loadQuotes();
  }

  Future<void> _loadQuotes() async {
    try {
      final data = await ApiService.get('/quotes/provider/me');
      if (!mounted) return;
      setState(() {
        _quotes = data as List;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _withdrawQuote(String quoteId) async {
    final loc = DesiCompanyApp.localeProvider!;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(loc.tr('withdraw_quote')),
        content: const Text(''),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(loc.tr('cancel')),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(loc.tr('withdraw_quote'), style: const TextStyle(color: AppTheme.error)),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    setState(() => _withdrawingId = quoteId);
    try {
      await ApiService.delete('/quotes/$quoteId');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(loc.tr('quote_withdrawn'))),
      );
      _loadQuotes();
    } catch (e) {
      if (!mounted) return;
      setState(() => _withdrawingId = null);
      final msg = e.toString().replaceFirst('Exception: ', '');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(loc.tr('quote_withdraw_failed', params: {'error': msg}))),
      );
    }
  }

  Color _statusColor(String status) {
    return switch (status) {
      'pending' => const Color(0xFFFF6F00),
      'accepted' => const Color(0xFF43A047),
      'rejected' => const Color(0xFFE53935),
      'withdrawn' => Colors.grey,
      _ => Colors.grey,
    };
  }

  String _statusLabel(String status, LocalizationProvider loc) {
    return switch (status) {
      'pending' => loc.tr('quote_status_pending'),
      'accepted' => loc.tr('quote_status_accepted'),
      'rejected' => loc.tr('quote_status_rejected'),
      'withdrawn' => loc.tr('quote_status_withdrawn'),
      _ => status,
    };
  }

  String _formatDate(String? iso) {
    if (iso == null) return '';
    try {
      final dt = DateTime.parse(iso);
      return intl.DateFormat('d MMM yyyy').format(dt);
    } catch (e, st) { AppLogger.e('provider_my_quotes_screen', 'Operation failed', e, st);
      return '';
    }
  }

  String _customerName(Map<String, dynamic>? job) {
    if (job == null) return '';
    final customer = job['customer'] as Map<String, dynamic>?;
    if (customer == null) return '';
    final user = customer['user'] is Map ? customer['user'] as Map<String, dynamic> : null;
    if (user != null) {
      return '${user['firstName'] ?? ''} ${user['lastName'] ?? ''}'.trim();
    }
    return '${customer['firstName'] ?? ''} ${customer['lastName'] ?? ''}'.trim();
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
                child: RefreshIndicator(
                  onRefresh: _loadQuotes,
                  child: _loading
                    ? const Center(child: CircularProgressIndicator())
                    : _quotes.isEmpty
                      ? ListView(
                          children: [
                            const SizedBox(height: 80),
                            _buildEmptyState(loc),
                          ],
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
                          itemCount: _quotes.length,
                          itemBuilder: (_, i) => _buildQuoteCard(_quotes[i], loc),
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
          onPressed: () => Navigator.of(context).pop(),
        ),
        const SizedBox(width: 4),
        Text(
          loc.tr('my_quotes'),
          style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
        ),
      ]),
    );
  }

  Widget _buildEmptyState(LocalizationProvider loc) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(children: [
          Icon(Icons.format_quote_outlined, size: 80, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          Text(
            loc.tr('no_quotes_submitted'),
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: Colors.grey.shade600,
            ),
          ),
        ]),
      ),
    );
  }

  Widget _buildQuoteCard(Map<String, dynamic> quote, LocalizationProvider loc) {
    final status = (quote['status'] ?? 'pending') as String;
    final statusColor = _statusColor(status);
    final amount = quote['amount'];
    final job = quote['jobRequest'] as Map<String, dynamic>?;
    final jobTitle = (job?['title'] ?? '').toString();
    final category = job?['category'] as Map<String, dynamic>?;
    final categoryName = category?['nameEn'] ?? '';
    final customerName = _customerName(job);
    final customerCity = (job?['customer']?['city'] ?? '').toString();
    final createdAt = quote['createdAt'] as String?;
    final isWithdrawing = _withdrawingId == quote['id'];

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () async {
            if (job == null) return;
            await Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => ProviderJobDetailScreen(jobRequestId: job['id']),
              ),
            );
            if (mounted) _loadQuotes();
          },
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        jobTitle,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textPrimary,
                          fontSize: 15,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        _statusLabel(status, loc),
                        style: TextStyle(
                          color: statusColor,
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                if (categoryName.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Row(children: [
                    const Icon(Icons.category_outlined, size: 14, color: AppTheme.textSecondary),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        categoryName,
                        style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ]),
                ],
                if (customerName.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Row(children: [
                    const Icon(Icons.person_outline, size: 14, color: AppTheme.textSecondary),
                    const SizedBox(width: 4),
                    Text(
                      customerName,
                      style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                    ),
                    if (customerCity.isNotEmpty) ...[
                      const SizedBox(width: 8),
                      const Icon(Icons.place_outlined, size: 14, color: AppTheme.textSecondary),
                      const SizedBox(width: 4),
                      Text(
                        customerCity,
                        style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                      ),
                    ],
                  ]),
                ],
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Icon(Icons.currency_rupee, color: AppTheme.primary, size: 22),
                    Text(
                      '$amount',
                      style: const TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.primary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(children: [
                  const Icon(Icons.access_time, size: 14, color: AppTheme.textSecondary),
                  const SizedBox(width: 4),
                  Text(
                    _formatDate(createdAt),
                    style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                  ),
                ]),
                if (status == 'pending') ...[
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: isWithdrawing ? null : () => _withdrawQuote(quote['id']),
                      icon: isWithdrawing
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.cancel_outlined, size: 16),
                      label: Text(loc.tr('withdraw_quote'), style: const TextStyle(fontSize: 13)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppTheme.error,
                        side: const BorderSide(color: AppTheme.error),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
