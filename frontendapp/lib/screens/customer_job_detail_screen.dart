import 'package:flutter/material.dart';
import 'package:intl/intl.dart' as intl;
import '../l10n/strings.dart';
import '../main.dart';
import '../services/api_service.dart';
import '../theme.dart';

import 'package:desicompany/services/app_logger.dart';
class CustomerJobDetailScreen extends StatefulWidget {
  final String jobRequestId;
  const CustomerJobDetailScreen({super.key, required this.jobRequestId});

  @override
  State<CustomerJobDetailScreen> createState() => _CustomerJobDetailScreenState();
}

class _CustomerJobDetailScreenState extends State<CustomerJobDetailScreen> {
  Map<String, dynamic>? _job;
  bool _loading = true;
  bool _cancelling = false;
  bool _acceptingId = false;

  @override
  void initState() {
    super.initState();
    _loadJob();
  }

  Future<void> _loadJob() async {
    try {
      final data = await ApiService.get('/job-requests/${widget.jobRequestId}');
      if (!mounted) return;
      setState(() {
        _job = data as Map<String, dynamic>;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _cancelRequest() async {
    final loc = DesiCompanyApp.localeProvider!;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(loc.tr('cancel_request')),
        content: Text(loc.tr('cancel_request_confirm')),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(loc.tr('cancel')),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(loc.tr('cancel_request'), style: const TextStyle(color: AppTheme.error)),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    setState(() => _cancelling = true);
    try {
      await ApiService.patch('/job-requests/${widget.jobRequestId}/cancel');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(loc.tr('request_cancelled'))),
      );
      _loadJob();
    } catch (e) {
      if (!mounted) return;
      setState(() => _cancelling = false);
    }
  }

  String? _promoCode;
  Map<String, dynamic>? _promoResult;
  bool _validatingPromo = false;
  final _promoController = TextEditingController();

  @override
  void dispose() {
    _promoController.dispose();
    super.dispose();
  }

  double _firstQuoteAmount(List<dynamic> quotes) {
    if (quotes.isEmpty) return 0;
    final first = quotes.first as Map<String, dynamic>?;
    return (first?['amount'] ?? 0).toDouble();
  }

  Future<void> _validatePromoCode(String code) async {
    final loc = DesiCompanyApp.localeProvider!;
    if (code.trim().isEmpty) return;
    setState(() => _validatingPromo = true);
    try {
      final quotes = (_job?['quotes'] as List?) ?? [];
      final amount = _firstQuoteAmount(quotes);
      final result = await ApiService.post('/promo-codes/validate', body: {
        'code': code.trim().toUpperCase(),
        'bookingAmount': amount,
      });
      if (!mounted) return;
      final res = result as Map<String, dynamic>;
      if (res['valid'] == true) {
        setState(() {
          _promoCode = code.trim().toUpperCase();
          _promoResult = res;
          _validatingPromo = false;
        });
      } else {
        setState(() {
          _promoCode = null;
          _promoResult = null;
          _validatingPromo = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message'] ?? loc.tr('promo_invalid'))),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _promoCode = null;
        _promoResult = null;
        _validatingPromo = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(loc.tr('promo_invalid'))),
      );
    }
  }

  Future<void> _acceptQuote(String quoteId) async {
    final loc = DesiCompanyApp.localeProvider!;
    setState(() => _acceptingId = true);
    try {
      final body = <String, dynamic>{};
      if (_promoCode != null) {
        body['promoCode'] = _promoCode;
      }
      await ApiService.post('/quotes/$quoteId/accept', body: body);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(loc.tr('quote_accepted'))),
      );
      Navigator.of(context).pushReplacementNamed('/my-bookings');
    } catch (e) {
      if (!mounted) return;
      setState(() => _acceptingId = false);
      final msg = e.toString().replaceFirst('Exception: ', '');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(loc.tr('quote_accept_failed', params: {'error': msg}))),
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
    } catch (e, st) { AppLogger.e('customer_job_detail_screen', 'Operation failed', e, st);
      return '';
    }
  }

  String _providerName(Map<String, dynamic> p) {
    if (p['user'] is Map) {
      final user = p['user'] as Map<String, dynamic>;
      return '${user['firstName'] ?? ''} ${user['lastName'] ?? ''}'.trim();
    }
    return '${p['firstName'] ?? ''} ${p['lastName'] ?? ''}'.trim();
  }

  String _providerInitial(Map<String, dynamic> p) {
    if (p['user'] is Map) {
      final user = p['user'] as Map<String, dynamic>;
      final name = (user['firstName'] ?? '').toString();
      if (name.isNotEmpty) return name[0].toUpperCase();
    }
    final name = (p['firstName'] ?? '?').toString();
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }

  String _providerId(Map<String, dynamic> p) {
    return p['id']?.toString() ?? '';
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
          loc.tr('job_details'),
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
    final quotes = (job['quotes'] as List?) ?? [];

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
      children: [
        _buildJobInfo(job, category, status, statusColor, loc),
        const SizedBox(height: 24),
        _buildQuotesSection(quotes, status, loc),
        if (status == 'OPEN' || status == 'QUOTED') ...[
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _cancelling ? null : _cancelRequest,
              icon: _cancelling
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.cancel_outlined, size: 18),
              label: Text(loc.tr('cancel_request')),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppTheme.error,
                side: const BorderSide(color: AppTheme.error),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildJobInfo(
    Map<String, dynamic> job,
    Map<String, dynamic>? category,
    String status,
    Color statusColor,
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
              '₹${job['budgetMin'] ?? '?'} - ₹${job['budgetMax'] ?? '?'}',
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

  Widget _buildQuotesSection(List<dynamic> quotes, String jobStatus, LocalizationProvider loc) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '${loc.tr('quotes_count', params: {'count': '${quotes.length}'})}' ,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: AppTheme.textPrimary,
          ),
        ),
        const SizedBox(height: 12),
        if (quotes.isEmpty)
          Container(
            padding: const EdgeInsets.all(40),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Center(
              child: Text(
                loc.tr('no_quotes_yet'),
                style: const TextStyle(color: AppTheme.textSecondary, fontSize: 14),
              ),
            ),
          )
        else ...[
          ...quotes.map((q) => _buildQuoteCard(q as Map<String, dynamic>, jobStatus, loc)),
          const SizedBox(height: 16),
          _buildPromoCodeInput(loc),
        ],
      ],
    );
  }

  Widget _buildPromoCodeInput(LocalizationProvider loc) {
    final discount = _promoResult?['discount'] ?? 0;
    final feeWaived = _promoResult?['promoCode']?['type'] == 'fee_waiver';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: _promoCode != null ? const Color(0xFF43A047) : Colors.grey.shade200,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.local_offer_outlined, size: 16, color: AppTheme.primary),
              const SizedBox(width: 6),
              Text(
                loc.tr('promo_code'),
                style: const TextStyle(
                  fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.textPrimary,
                ),
              ),
              if (_promoCode != null) ...[
                const Spacer(),
                GestureDetector(
                  onTap: () {
                    setState(() {
                      _promoCode = null;
                      _promoResult = null;
                      _promoController.clear();
                    });
                  },
                  child: Text(
                    loc.tr('promo_code_remove'),
                    style: const TextStyle(color: AppTheme.error, fontSize: 12),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          if (_promoCode == null)
            Row(children: [
              Expanded(
                child: TextField(
                  controller: _promoController,
                  textCapitalization: TextCapitalization.characters,
                  decoration: InputDecoration(
                    hintText: loc.tr('promo_code_hint'),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  style: const TextStyle(fontSize: 14),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: _validatingPromo
                    ? null
                    : () => _validatePromoCode(_promoController.text),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
                child: _validatingPromo
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(loc.tr('apply'), style: const TextStyle(fontSize: 13)),
              ),
            ])
          else ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFE8F5E9),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.check_circle, size: 14, color: Color(0xFF2E7D32)),
                  const SizedBox(width: 4),
                  Text(
                    feeWaived ? loc.tr('promo_fee_waived') : loc.tr('promo_applied'),
                    style: const TextStyle(color: Color(0xFF2E7D32), fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
            if (!feeWaived && discount > 0) ...[
              const SizedBox(height: 6),
              Text(
                loc.tr('promo_discount', params: {'amount': '$discount'}),
                style: const TextStyle(color: Color(0xFF2E7D32), fontWeight: FontWeight.w500, fontSize: 13),
              ),
            ],
          ],
        ],
      ),
    );
  }

  Widget _buildQuoteCard(Map<String, dynamic> quote, String jobStatus, LocalizationProvider loc) {
    final status = (quote['status'] ?? 'PENDING') as String;
    final statusColor = _quoteStatusColor(status);
    final provider = (quote['provider'] as Map<String, dynamic>?) ?? {};
    final providerName = _providerName(provider);
    final providerId = _providerId(provider);
    final amount = quote['amount'];
    final message = quote['message'] as String?;
    final estimatedHours = quote['estimatedHours'];
    final validUntil = quote['validUntil'] as String?;
    final canAccept = status == 'PENDING' && (jobStatus == 'OPEN' || jobStatus == 'QUOTED');

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _buildProviderAvatar(_providerInitial(provider)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      providerName.isEmpty ? 'Provider' : providerName,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        color: AppTheme.textPrimary,
                        fontSize: 15,
                      ),
                    ),
                    if (estimatedHours != null)
                      Text(
                        loc.tr('estimated_hours', params: {'hours': '$estimatedHours'}),
                        style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                      ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.1),
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
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.primary,
                ),
              ),
            ],
          ),
          if (message != null && message.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF5F0FF),
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
          Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: providerId.isEmpty
                  ? null
                  : () => Navigator.of(context).pushNamed(
                        '/chat',
                        arguments: {
                          'providerId': providerId,
                          'mode': 'direct',
                          'providerName': providerName,
                        },
                      ),
                icon: const Icon(Icons.chat_bubble_outline, size: 16),
                label: Text(loc.tr('chat_with_provider'), style: const TextStyle(fontSize: 13)),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppTheme.primary,
                  side: const BorderSide(color: AppTheme.primary),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ),
            if (canAccept) ...[
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _acceptingId
                    ? null
                    : () => _acceptQuote(quote['id']),
                  icon: const Icon(Icons.check, size: 16),
                  label: Text(loc.tr('accept_quote'), style: const TextStyle(fontSize: 13)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF43A047),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
            ],
          ]),
        ],
      ),
    );
  }

  Widget _buildProviderAvatar(String initial) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppTheme.primary, AppTheme.primary.withValues(alpha: 0.7)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Center(
        child: Text(
          initial,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}
