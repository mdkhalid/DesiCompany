import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart' as intl;
import '../l10n/strings.dart';
import '../main.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../theme.dart';

import 'package:desicompany/services/app_logger.dart';
class ProviderSubmitQuoteScreen extends StatefulWidget {
  final String jobRequestId;
  const ProviderSubmitQuoteScreen({super.key, required this.jobRequestId});

  @override
  State<ProviderSubmitQuoteScreen> createState() => _ProviderSubmitQuoteScreenState();
}

class _ProviderSubmitQuoteScreenState extends State<ProviderSubmitQuoteScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _hoursController = TextEditingController();
  final _messageController = TextEditingController();

  Map<String, dynamic>? _job;
  Map<String, dynamic>? _myQuote;
  bool _loading = true;
  bool _submitting = false;
  DateTime? _validUntil;

  @override
  void initState() {
    super.initState();
    _loadJob();
  }

  @override
  void dispose() {
    _amountController.dispose();
    _hoursController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _loadJob() async {
    try {
      final data = await ApiService.get('/job-requests/${widget.jobRequestId}');
      final job = data as Map<String, dynamic>;
      Map<String, dynamic>? myQuote;
      final providerId = await AuthService.getProviderId();
      final quotes = (job['quotes'] as List?) ?? [];
      for (final q in quotes) {
        if (q is Map && q['provider'] is Map && q['provider']['id'] == providerId) {
          myQuote = q as Map<String, dynamic>;
          break;
        }
      }
      if (!mounted) return;
      setState(() {
        _job = job;
        _myQuote = myQuote;
        if (myQuote != null) {
          _amountController.text = myQuote['amount']?.toString() ?? '';
          _hoursController.text = myQuote['estimatedHours']?.toString() ?? '';
          _messageController.text = (myQuote['message'] ?? '').toString();
          if (myQuote['validUntil'] != null) {
            try {
              _validUntil = DateTime.parse(myQuote['validUntil']);
            } catch (e, st) { AppLogger.e('provider_submit_quote_screen', 'Operation failed', e, st); }
          }
        }
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _validUntil ?? now.add(const Duration(days: 7)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() => _validUntil = picked);
    }
  }

  String _formatDate(String? iso) {
    if (iso == null) return '';
    try {
      final dt = DateTime.parse(iso);
      return intl.DateFormat('d MMM yyyy').format(dt);
    } catch (e, st) { AppLogger.e('provider_submit_quote_screen', 'Operation failed', e, st);
      return '';
    }
  }

  Future<void> _submit() async {
    final loc = DesiCompanyApp.localeProvider!;
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    final body = <String, dynamic>{
      'amount': double.parse(_amountController.text.trim()),
    };
    if (_hoursController.text.trim().isNotEmpty) {
      body['estimatedHours'] = double.tryParse(_hoursController.text.trim());
    }
    if (_messageController.text.trim().isNotEmpty) {
      body['message'] = _messageController.text.trim();
    }
    if (_validUntil != null) {
      body['validUntil'] = _validUntil!.toIso8601String();
    }
    try {
      if (_myQuote != null) {
        await ApiService.patch('/quotes/${_myQuote!['id']}', body: body);
      } else {
        await ApiService.post(
          '/job-requests/${widget.jobRequestId}/quotes',
          body: body,
        );
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(loc.tr('quote_submitted'))),
      );
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      final msg = e.toString().replaceFirst('Exception: ', '');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(loc.tr('quote_submit_failed', params: {'error': msg}))),
      );
    }
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
                    : SingleChildScrollView(
                        padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
                        child: Form(
                          key: _formKey,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              _buildJobInfo(loc),
                              const SizedBox(height: 16),
                              _buildLeadFeeNotice(loc),
                              const SizedBox(height: 24),
                              _buildLabel(loc.tr('quote_amount')),
                              TextFormField(
                                controller: _amountController,
                                keyboardType: TextInputType.number,
                                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                                decoration: const InputDecoration(
                                  hintText: '₹',
                                  prefixText: '₹ ',
                                ),
                                validator: (v) {
                                  if (v == null || v.trim().isEmpty) {
                                    return loc.tr('quote_amount');
                                  }
                                  final n = double.tryParse(v.trim());
                                  if (n == null || n < 1) return loc.tr('quote_amount');
                                  return null;
                                },
                              ),
                              const SizedBox(height: 16),
                              _buildLabel(loc.tr('estimated_hours', params: {'hours': ''})),
                              TextFormField(
                                controller: _hoursController,
                                keyboardType: TextInputType.number,
                                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                                decoration: const InputDecoration(
                                  hintText: '0',
                                  prefixIcon: Icon(Icons.access_time, color: AppTheme.primary),
                                ),
                              ),
                              const SizedBox(height: 16),
                              _buildLabel(loc.tr('quote_message')),
                              TextFormField(
                                controller: _messageController,
                                minLines: 3,
                                maxLines: 5,
                                decoration: InputDecoration(
                                  hintText: loc.tr('quote_message'),
                                ),
                              ),
                              const SizedBox(height: 16),
                              _buildLabel(loc.tr('valid_until', params: {'date': ''})),
                              InkWell(
                                onTap: _pickDate,
                                borderRadius: BorderRadius.circular(16),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(color: Colors.grey.shade200),
                                  ),
                                  child: Row(children: [
                                    const Icon(Icons.calendar_today_outlined, color: AppTheme.primary, size: 20),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Text(
                                        _validUntil == null
                                          ? loc.tr('preferred_date')
                                          : intl.DateFormat('d MMM yyyy').format(_validUntil!),
                                        style: TextStyle(
                                          color: _validUntil == null
                                            ? AppTheme.textSecondary
                                            : AppTheme.textPrimary,
                                          fontSize: 15,
                                        ),
                                      ),
                                    ),
                                    if (_validUntil != null)
                                      GestureDetector(
                                        onTap: () => setState(() => _validUntil = null),
                                        child: const Icon(Icons.close, size: 18, color: AppTheme.textSecondary),
                                      ),
                                  ]),
                                ),
                              ),
                              const SizedBox(height: 24),
                              ElevatedButton(
                                onPressed: _submitting ? null : _submit,
                                style: ElevatedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(vertical: 16),
                                ),
                                child: _submitting
                                  ? const SizedBox(
                                      width: 20, height: 20,
                                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                    )
                                  : Text(_myQuote != null ? loc.tr('edit_quote') : loc.tr('submit_quote')),
                              ),
                            ],
                          ),
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
          loc.tr('submit_quote'),
          style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
        ),
      ]),
    );
  }

  Widget _buildLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, left: 4),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: AppTheme.textPrimary,
        ),
      ),
    );
  }

  Widget _buildLeadFeeNotice(LocalizationProvider loc) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8E1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFFE082)),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline, size: 16, color: Color(0xFFF57F17)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              loc.tr('lead_fee_notice', params: {'fee': '10'}),
              style: const TextStyle(fontSize: 12, color: Color(0xFFF57F17), height: 1.3),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildJobInfo(LocalizationProvider loc) {
    final job = _job!;
    final category = job['category'] as Map<String, dynamic>?;
    final categoryName = category?['nameEn'] ?? '';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            job['title'] ?? '',
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              color: AppTheme.textPrimary,
              fontSize: 16,
            ),
          ),
          if (categoryName.isNotEmpty) ...[
            const SizedBox(height: 4),
            Row(children: [
              const Icon(Icons.category_outlined, size: 14, color: AppTheme.textSecondary),
              const SizedBox(width: 4),
              Text(
                categoryName,
                style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
              ),
            ]),
          ],
          if ((job['description'] ?? '').toString().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              job['description'] ?? '',
              style: const TextStyle(fontSize: 13, color: AppTheme.textPrimary, height: 1.4),
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          if (job['budgetMin'] != null || job['budgetMax'] != null) ...[
            const SizedBox(height: 8),
            Row(children: [
              const Icon(Icons.currency_rupee, size: 14, color: AppTheme.textSecondary),
              const SizedBox(width: 2),
              Text(
                '₹${job['budgetMin'] ?? '?'} - ₹${job['budgetMax'] ?? '?'}',
                style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
              ),
              const SizedBox(width: 12),
              const Icon(Icons.access_time, size: 14, color: AppTheme.textSecondary),
              const SizedBox(width: 4),
              Text(
                _formatDate(job['createdAt']),
                style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
              ),
            ]),
          ],
        ],
      ),
    );
  }
}
