import 'package:flutter/material.dart';
import '../l10n/strings.dart';
import '../services/api_service.dart';
import '../theme.dart';
import 'write_review_screen.dart';
import 'grievance_chat_screen.dart';
import 'booking_detail_screen.dart';

import 'package:desicompany/services/app_logger.dart';
class MyBookingsScreen extends StatefulWidget {
  const MyBookingsScreen({super.key});
  @override
  State<MyBookingsScreen> createState() => _MyBookingsScreenState();
}

class _MyBookingsScreenState extends State<MyBookingsScreen> {
  List _bookings = [];
  bool _loading = true;
  final Set<String> _reviewedBookingIds = {};
  final Set<String> _eligibleForGrievance = {};
  final Map<String, dynamic> _grievanceEligibility = {};

  @override
  void initState() {
    super.initState();
    _loadBookings();
  }

  Future<void> _loadBookings() async {
    try {
      final data = await ApiService.get('/bookings/customer/me');
      if (!mounted) return;
      setState(() { _bookings = data as List; _loading = false; });
      _checkReviewedBookings();
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _checkReviewedBookings() async {
    for (final b in _bookings) {
      if (b['status'] == 'completed') {
        try {
          await ApiService.get('/reviews/booking/${b['id']}');
          if (mounted) setState(() => _reviewedBookingIds.add(b['id'] as String));
        } catch (e, st) { AppLogger.e('my_bookings_screen', 'Operation failed', e, st); }
      }
    }
    _checkGrievanceEligibility();
  }

  Future<void> _checkGrievanceEligibility() async {
    for (final b in _bookings) {
      if (b['status'] == 'completed') {
        try {
          final data = await ApiService.get('/grievances/check-eligibility/${b['id']}');
          if (mounted && data['eligible'] == true) {
            setState(() {
              _eligibleForGrievance.add(b['id'] as String);
              _grievanceEligibility[b['id']] = data;
            });
          }
        } catch (e, st) { AppLogger.e('my_bookings_screen', 'Operation failed', e, st); }
      }
    }
  }

  void _openGrievanceChat(Map booking) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => GrievanceChatScreen(
          bookingId: booking['id'] as String,
        ),
      ),
    ).then((_) {
      _checkGrievanceEligibility();
    });
  }

  Color _statusColor(String status) {
    return switch (status) {
      'requested' => const Color(0xFFFF6F00),
      'accepted' => const Color(0xFF1E88E5),
      'on_the_way' => const Color(0xFF6C3FB4),
      'working' => const Color(0xFF00BFA5),
      'completed' => const Color(0xFF43A047),
      'rejected' => const Color(0xFFE53935),
      _ => Colors.grey,
    };
  }

  String _statusLabel(String status) {
    return switch (status) {
      'requested' => 'Requested',
      'accepted' => 'Accepted',
      'on_the_way' => 'On the way',
      'working' => 'Working',
      'completed' => 'Completed',
      'rejected' => 'Rejected',
      'cancelled' => 'Cancelled',
      _ => status.replaceAll('_', ' '),
    };
  }

  IconData _statusIcon(String status) {
    return switch (status) {
      'requested' => Icons.mail_outline,
      'accepted' => Icons.check_circle_outline,
      'on_the_way' => Icons.directions_walk,
      'working' => Icons.build,
      'completed' => Icons.celebration_outlined,
      'rejected' => Icons.cancel_outlined,
      'cancelled' => Icons.cancel_outlined,
      _ => Icons.info_outline,
    };
  }

  void _openWriteReview(Map booking) {
    final provider = booking['provider'] ?? {};
    final user = provider['user'] ?? {};
    final providerName = '${user['firstName'] ?? ''} ${user['lastName'] ?? ''}'.trim();

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => WriteReviewScreen(
          bookingId: booking['id'] as String,
          providerName: providerName.isNotEmpty ? providerName : 'Provider',
          providerId: provider['id'] as String? ?? '',
        ),
      ),
    ).then((_) {
      _loadBookings();
    });
  }

  @override
  Widget build(BuildContext context) {
    final loc = LocalizationProvider.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(loc.tr('my_bookings')),
        flexibleSpace: Container(decoration: AppTheme.gradientBackground),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _bookings.isEmpty
              ? Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.book_online, size: 64, color: Colors.grey.shade300),
                    const SizedBox(height: 16),
                    Text(loc.tr('no_bookings'), style: const TextStyle(color: AppTheme.textSecondary, fontSize: 16)),
                  ]),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(20),
                  itemCount: _bookings.length,
                  itemBuilder: (_, i) {
                    final b = _bookings[i];
                    final status = b['status'] ?? '';
                    final statusColor = _statusColor(status);
                    final isCompleted = status == 'completed';
                    final isReviewed = _reviewedBookingIds.contains(b['id']);

                    final provider = b['provider'] as Map? ?? {};
                    final psvc = b['providerService'] as Map? ?? {};
                    final cat = psvc['category'] as Map? ?? {};
                    final svcName = cat['nameEn'] as String? ?? 'Service';
                    final provName = '${provider['firstName'] ?? ''} ${provider['lastName'] ?? ''}'.trim();
                    final sched = b['scheduledDate'] as String?;
                    String dateStr = '';
                    if (sched != null) {
                      try {
                        final dt = DateTime.parse(sched);
                        dateStr = '${dt.day}/${dt.month}/${dt.year}';
                      } catch (_) {}
                    }
                    return InkWell(
                      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => BookingDetailScreen(bookingId: b['id']))).then((_) => _loadBookings()),
                      borderRadius: BorderRadius.circular(20),
                      child: Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, 4))],
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                            Expanded(child: Text(svcName, style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textPrimary, fontSize: 15), overflow: TextOverflow.ellipsis)),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                              child: Row(mainAxisSize: MainAxisSize.min, children: [
                                Icon(_statusIcon(status), size: 14, color: statusColor),
                                const SizedBox(width: 4),
                                Text(_statusLabel(status), style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.w600)),
                              ]),
                            ),
                          ]),
                          const SizedBox(height: 6),
                          Row(children: [
                            Icon(Icons.person, size: 14, color: Colors.grey.shade500),
                            const SizedBox(width: 4),
                            Text(provName, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                          ]),
                          Row(children: [
                            Icon(Icons.calendar_today, size: 14, color: Colors.grey.shade500),
                            const SizedBox(width: 4),
                            Text(dateStr, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                          ]),
                          const SizedBox(height: 6),
                          Row(children: [
                            const Icon(Icons.currency_rupee, size: 16, color: AppTheme.textSecondary),
                            Text('₹${double.tryParse('${b['totalAmount']}')?.toStringAsFixed(0) ?? b['totalAmount'] ?? '0'}', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 14)),
                          ]),
                          if ((double.tryParse('${b['convenienceFee']}') ?? 0) > 0) ...[
                            const SizedBox(height: 4),
                            Row(children: [
                              const Icon(Icons.receipt_long, size: 14, color: Color(0xFFE65100)),
                              const SizedBox(width: 4),
                              Text(
                                '${loc.tr('convenience_fee')}: ₹${double.tryParse('${b['convenienceFee']}')?.toStringAsFixed(0) ?? b['convenienceFee']}',
                                style: const TextStyle(color: Color(0xFFE65100), fontSize: 12),
                              ),
                            ]),
                          ],
                          if (isCompleted) ...[
                            const SizedBox(height: 12),
                            // Raise Issue button
                            if (_eligibleForGrievance.contains(b['id']))
                              SizedBox(
                                width: double.infinity,
                                child: OutlinedButton.icon(
                                  onPressed: () => _openGrievanceChat(b),
                                  icon: const Icon(Icons.support_agent, size: 18),
                                  label: Text('Raise Issue${_grievanceEligibility[b['id']] != null ? ' (${_grievanceEligibility[b['id']]['remainingDays']}d left)' : ''}'),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: Colors.orange.shade700,
                                    side: BorderSide(color: Colors.orange.shade700),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                    padding: const EdgeInsets.symmetric(vertical: 10),
                                  ),
                                ),
                              ),
                            const SizedBox(height: 8),
                            if (isReviewed)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                decoration: BoxDecoration(
                                  color: AppTheme.secondary.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(Icons.check_circle, size: 14, color: AppTheme.secondary),
                                    const SizedBox(width: 4),
                                    Text(
                                      loc.tr('reviewed'),
                                      style: const TextStyle(color: AppTheme.secondary, fontSize: 12, fontWeight: FontWeight.w600),
                                    ),
                                  ],
                                ),
                              )
                            else
                              SizedBox(
                                width: double.infinity,
                                child: OutlinedButton.icon(
                                  onPressed: () => _openWriteReview(b),
                                  icon: const Icon(Icons.rate_review_outlined, size: 18),
                                  label: Text(loc.tr('write_review')),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: AppTheme.primary,
                                    side: const BorderSide(color: AppTheme.primary),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                    padding: const EdgeInsets.symmetric(vertical: 10),
                                  ),
                                ),
                              ),
                          ],
                        ]),
                      ),
                    ));
                  },
                ),
    );
  }
}
