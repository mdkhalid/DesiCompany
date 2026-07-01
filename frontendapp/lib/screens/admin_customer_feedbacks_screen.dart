import 'package:flutter/material.dart';
import '../l10n/strings.dart';
import '../services/api_service.dart';
import '../theme.dart';

import 'package:desicompany/services/app_logger.dart';
class AdminCustomerFeedbacksScreen extends StatefulWidget {
  const AdminCustomerFeedbacksScreen({super.key});

  @override
  State<AdminCustomerFeedbacksScreen> createState() => _AdminCustomerFeedbacksScreenState();
}

class _AdminCustomerFeedbacksScreenState extends State<AdminCustomerFeedbacksScreen> {
  List<Map<String, dynamic>> _feedbacks = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadFeedbacks();
  }

  Future<void> _loadFeedbacks() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final data = await ApiService.get('/admin/customer-feedbacks');
      if (!mounted) return;
      setState(() {
        _feedbacks = (data as List? ?? [])
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList();
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

  double _parseRating(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0;
    return 0;
  }

  String _nameFromRelation(Map<String, dynamic>? relation, String fallback) {
    if (relation == null) return fallback;
    final user = relation['user'];
    if (user is Map<String, dynamic>) {
      final name = '${user['firstName'] ?? ''} ${user['lastName'] ?? ''}'.trim();
      if (name.isNotEmpty) return name;
    }
    return fallback;
  }

  String _bookingId(dynamic booking) {
    if (booking is Map<String, dynamic>) {
      final id = booking['id'] ?? booking['_id'];
      if (id != null) {
        final s = id.toString();
        return s.length > 8 ? s.substring(0, 8) : s;
      }
    }
    return 'N/A';
  }

  List<String> _parseTags(dynamic value) {
    if (value is List) {
      return value.map((e) => e.toString()).where((s) => s.isNotEmpty).toList();
    }
    if (value is String && value.isNotEmpty) {
      return value.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
    }
    return const [];
  }

  String _formatDate(dynamic value) {
    if (value == null) return '';
    try {
      final date = DateTime.parse(value.toString());
      return '${date.day}/${date.month}/${date.year}';
    } catch (e, st) { AppLogger.e('admin_customer_feedbacks_screen', 'Operation failed', e, st);
      return '';
    }
  }

  Widget _buildStars(double rating, {double size = 16}) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        final starNumber = index + 1;
        if (starNumber <= rating) {
          return Icon(Icons.star_rounded, size: size, color: const Color(0xFFFFD600));
        } else if (starNumber - rating < 1) {
          return Icon(Icons.star_half_rounded, size: size, color: const Color(0xFFFFD600));
        }
        return Icon(Icons.star_outline_rounded, size: size, color: Colors.grey.shade300);
      }),
    );
  }

  Widget _buildErrorState(String message) {
    final loc = LocalizationProvider.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 64, color: AppTheme.primary.withValues(alpha: 0.7)),
            const SizedBox(height: 16),
            Text(
              loc.tr('error'),
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: _loadFeedbacks,
              icon: const Icon(Icons.refresh),
              label: Text(loc.tr('retry')),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final loc = LocalizationProvider.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(loc.tr('customer_feedback')),
        flexibleSpace: Container(decoration: AppTheme.gradientBackground),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildErrorState(_error!)
              : _feedbacks.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.feedback_outlined, size: 64, color: Colors.grey.shade300),
                          const SizedBox(height: 16),
                          Text(
                            loc.tr('no_data'),
                            style: TextStyle(fontSize: 16, color: Colors.grey.shade500),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadFeedbacks,
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
                        itemCount: _feedbacks.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final fb = _feedbacks[index];
                          final customer = fb['customer'] as Map<String, dynamic>?;
                          final provider = fb['provider'] as Map<String, dynamic>?;
                          final customerName = _nameFromRelation(customer, 'N/A');
                          final providerName = _nameFromRelation(provider, 'N/A');
                          final rating = _parseRating(fb['rating']);
                          final comment = fb['comment']?.toString();
                          final tags = _parseTags(fb['tags']);
                          final booking = fb['booking'];
                          final bookingShort = _bookingId(booking);
                          final dateStr = _formatDate(fb['createdAt']);

                          return Container(
                            padding: const EdgeInsets.all(16),
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
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                                Row(children: [
                                  CircleAvatar(
                                    radius: 16,
                                    backgroundColor: AppTheme.primary.withValues(alpha: 0.1),
                                    child: Text(
                                      providerName.isNotEmpty ? providerName[0].toUpperCase() : '?',
                                      style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Text(
                                      providerName,
                                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                                    ),
                                    if (dateStr.isNotEmpty)
                                      Text(dateStr, style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                                  ]),
                                ]),
                                _buildStars(rating),
                              ]),
                              const SizedBox(height: 10),
                              Row(children: [
                                const Icon(Icons.person, size: 14, color: AppTheme.textSecondary),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    customerName,
                                    style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ]),
                              const SizedBox(height: 6),
                              Row(children: [
                                const Icon(Icons.confirmation_number, size: 14, color: AppTheme.textSecondary),
                                const SizedBox(width: 6),
                                Text(
                                  '${loc.tr('booking_number')}$bookingShort',
                                  style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                                ),
                              ]),
                              if (tags.isNotEmpty) ...[
                                const SizedBox(height: 10),
                                Wrap(
                                  spacing: 6,
                                  runSpacing: 6,
                                  children: tags
                                      .map((t) => Chip(
                                            label: Text(t, style: const TextStyle(fontSize: 11, color: AppTheme.primary, fontWeight: FontWeight.w600)),
                                            backgroundColor: AppTheme.primary.withValues(alpha: 0.08),
                                            side: BorderSide(color: AppTheme.primary.withValues(alpha: 0.2)),
                                            visualDensity: VisualDensity.compact,
                                            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                            padding: const EdgeInsets.symmetric(horizontal: 4),
                                          ))
                                      .toList(),
                                ),
                              ],
                              if (comment != null && comment.isNotEmpty) ...[
                                const SizedBox(height: 10),
                                Text(
                                  comment,
                                  style: TextStyle(fontSize: 14, color: Colors.grey.shade700, height: 1.4),
                                ),
                              ],
                            ]),
                          );
                        },
                      ),
                    ),
    );
  }
}
