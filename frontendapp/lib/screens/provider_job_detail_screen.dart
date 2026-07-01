import 'package:flutter/material.dart';
import 'package:intl/intl.dart' as intl;
import '../l10n/strings.dart';
import '../main.dart';
import '../services/api_service.dart';
import '../theme.dart';
import 'provider_submit_quote_screen.dart';

import 'package:desicompany/services/app_logger.dart';
class ProviderJobDetailScreen extends StatefulWidget {
  final String jobRequestId;
  const ProviderJobDetailScreen({super.key, required this.jobRequestId});

  @override
  State<ProviderJobDetailScreen> createState() => _ProviderJobDetailScreenState();
}

class _ProviderJobDetailScreenState extends State<ProviderJobDetailScreen> {
  Map<String, dynamic>? _job;
  Map<String, dynamic>? _myQuote;
  bool _loading = true;
  bool _withdrawing = false;

  @override
  void initState() {
    super.initState();
    _loadJob();
  }

  Future<void> _loadJob() async {
    try {
      final data = await ApiService.get('/job-requests/${widget.jobRequestId}');
      final job = data as Map<String, dynamic>;
      Map<String, dynamic>? myQuote;
      final quotes = (job['quotes'] as List?) ?? [];
      for (final q in quotes) {
        if (q is Map && q['provider'] is Map) {
          myQuote = q as Map<String, dynamic>;
          break;
        }
      }
      if (!mounted) return;
      setState(() {
        _job = job;
        _myQuote = myQuote;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _withdrawQuote() async {
    final loc = DesiCompanyApp.localeProvider!;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(loc.tr('withdraw_quote')),
        content: Text(loc.tr('cancel_request_confirm')),
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
    setState(() => _withdrawing = true);
    try {
      await ApiService.delete('/quotes/${_myQuote!['id']}');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(loc.tr('quote_withdrawn'))),
      );
      _loadJob();
    } catch (e) {
      if (!mounted) return;
      setState(() => _withdrawing = false);
      final msg = e.toString().replaceFirst('Exception: ', '');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(loc.tr('quote_withdraw_failed', params: {'error': msg}))),
      );
    }
  }

  Color _statusColor(String status) {
    return switch (status) {
      'OPEN' => const Color(0xFF1E88E5),
      'QUOTED' => const Color(0xFFFF6F00),
      'ACCEPTED' => const Color(0xFF43A047),
      'CANCELLED' => const Color(0xFFE53935),
      'CLOSED' => Colors.grey,
      _ => Colors.grey,
    };
  }

  Color _quoteStatusColor(String status) {
    return switch (status) {
      'PENDING' => const Color(0xFFFF6F00),
      'ACCEPTED' => const Color(0xFF43A047),
      'REJECTED' => const Color(0xFFE53935),
      'WITHDRAWN' => Colors.grey,
      _ => Colors.grey,
    };
  }

  String _quoteStatusLabel(String status, LocalizationProvider loc) {
    return switch (status) {
      'PENDING' => loc.tr('quote_status_pending'),
      'ACCEPTED' => loc.tr('quote_status_accepted'),
      'REJECTED' => loc.tr('quote_status_rejected'),
      'WITHDRAWN' => loc.tr('quote_status_withdrawn'),
      _ => status,
    };
  }

  String _formatDate(String? iso) {
    if (iso == null) return '';
    try {
      final dt = DateTime.parse(iso);
      return intl.DateFormat('d MMM yyyy').format(dt);
    } catch (e, st) { AppLogger.e('provider_job_detail_screen', 'Operation failed', e, st);
      return '';
    }
  }

  String _customerName(Map<String, dynamic>? customer) {
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
                child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _job == null
                    ? Center(child: Text(loc.tr('error')))
                    : RefreshIndicator(
                        onRefresh: _loadJob,
                        child: _buildContent(loc),
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
          loc.tr('job_request_details'),
          style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
        ),
      ]),
    );
  }

  Widget _buildContent(LocalizationProvider loc) {
    final job = _job!;
    final status = (job['status'] ?? 'OPEN') as String;
    final statusColor = _statusColor(status);
    final category = job['category'] as Map<String, dynamic>?;
    final customer = job['customer'] as Map<String, dynamic>?;
    final customerName = _customerName(customer);

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
      children: [
        _buildJobInfo(job, category, status, statusColor, customer, customerName, loc),
        const SizedBox(height: 20),
        if (_myQuote != null) ...[
          _buildMyQuoteCard(loc),
          const SizedBox(height: 20),
        ] else if (status == 'OPEN' || status == 'QUOTED') ...[
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () async {
                final result = await Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => ProviderSubmitQuoteScreen(jobRequestId: widget.jobRequestId),
                  ),
                );
                if (result == true) _loadJob();
              },
              icon: const Icon(Icons.send, size: 18),
              label: Text(loc.tr('submit_quote')),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          const SizedBox(height: 20),
        ],
      ],
    );
  }

  Widget _buildJobInfo(
    Map<String, dynamic> job,
    Map<String, dynamic>? category,
    String status,
    Color statusColor,
    Map<String, dynamic>? customer,
    String customerName,
    LocalizationProvider loc,
  ) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  job['title'] ?? '',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textPrimary,
                    fontSize: 18,
                  ),
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
                  status,
                  style: TextStyle(
                    color: statusColor,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          if (category != null) ...[
            const SizedBox(height: 8),
            Row(children: [
              const Icon(Icons.category_outlined, size: 14, color: AppTheme.textSecondary),
              const SizedBox(width: 4),
              Text(
                category['nameEn'] ?? '',
                style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
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
            ]),
          ],
          const SizedBox(height: 12),
          Text(
            job['description'] ?? '',
            style: const TextStyle(fontSize: 14, color: AppTheme.textPrimary, height: 1.4),
          ),
          if (job['address'] != null) ...[
            const SizedBox(height: 12),
            _buildInfoRow(Icons.location_on_outlined, job['address']),
          ],
          if (job['budgetMin'] != null || job['budgetMax'] != null) ...[
            const SizedBox(height: 8),
            _buildInfoRow(
              Icons.currency_rupee,
              '${loc.tr('budget_min')} - ${loc.tr('budget_max')}: ₹${job['budgetMin'] ?? '?'} - ₹${job['budgetMax'] ?? '?'}',
            ),
          ],
          if (job['preferredDate'] != null) ...[
            const SizedBox(height: 8),
            _buildInfoRow(Icons.calendar_today_outlined, _formatDate(job['preferredDate'])),
          ],
          const SizedBox(height: 8),
          _buildInfoRow(Icons.access_time, _formatDate(job['createdAt'])),
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String text) {
    return Row(children: [
      Icon(icon, size: 16, color: AppTheme.textSecondary),
      const SizedBox(width: 6),
      Expanded(
        child: Text(
          text,
          style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
        ),
      ),
    ]);
  }

  Widget _buildMyQuoteCard(LocalizationProvider loc) {
    final quote = _myQuote!;
    final status = (quote['status'] ?? 'PENDING') as String;
    final statusColor = _quoteStatusColor(status);
    final amount = quote['amount'];
    final message = quote['message'] as String?;
    final estimatedHours = quote['estimatedHours'];
    final validUntil = quote['validUntil'] as String?;
    final canWithdraw = status == 'PENDING';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFF5F0FF), Colors.white],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                loc.tr('my_quotes'),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  _quoteStatusLabel(status, loc),
                  style: TextStyle(
                    color: statusColor,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              const Icon(Icons.currency_rupee, color: AppTheme.primary, size: 22),
              Text(
                '$amount',
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.primary,
                ),
              ),
            ],
          ),
          if (estimatedHours != null) ...[
            const SizedBox(height: 8),
            Text(
              loc.tr('estimated_hours', params: {'hours': '$estimatedHours'}),
              style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
            ),
          ],
          if (message != null && message.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                message,
                style: const TextStyle(fontSize: 13, color: AppTheme.textPrimary, height: 1.4),
              ),
            ),
          ],
          if (validUntil != null) ...[
            const SizedBox(height: 8),
            Text(
              loc.tr('valid_until', params: {'date': _formatDate(validUntil)}),
              style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
            ),
          ],
          const SizedBox(height: 14),
          Text(
            _formatDate(quote['createdAt']),
            style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
          ),
          if (canWithdraw) ...[
            const SizedBox(height: 16),
            Row(children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () async {
                    final result = await Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => ProviderSubmitQuoteScreen(jobRequestId: widget.jobRequestId),
                      ),
                    );
                    if (result == true) _loadJob();
                  },
                  icon: const Icon(Icons.edit, size: 16),
                  label: Text(loc.tr('edit_quote'), style: const TextStyle(fontSize: 13)),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _withdrawing ? null : _withdrawQuote,
                  icon: _withdrawing
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
            ]),
          ],
        ],
      ),
    );
  }
}
