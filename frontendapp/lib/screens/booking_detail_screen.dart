import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../l10n/strings.dart';
import '../services/api_service.dart';
import '../theme.dart';
import 'chat_screen.dart';

class BookingDetailScreen extends StatefulWidget {
  final String bookingId;
  const BookingDetailScreen({super.key, required this.bookingId});

  @override
  State<BookingDetailScreen> createState() => _BookingDetailScreenState();
}

class _BookingDetailScreenState extends State<BookingDetailScreen> {
  Map? _booking;
  bool _loading = true;
  String? _error;
  bool _updating = false;
  bool _isProvider = false;
  String? _currentUserId;

  static const _timelineSteps = [
    'requested',
    'accepted',
    'on_the_way',
    'working',
    'completed',
  ];

  static const _stepLabels = ['Requested', 'Accepted', 'On Way', 'Working', 'Done'];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await ApiService.get('/bookings/${widget.bookingId}');
      if (!mounted) return;
      final booking = data as Map?;
      // Determine if current user is the provider
      final profile = await ApiService.get('/users/profile');
      final uid = profile['id'] as String?;
      final providerUser = booking?['provider']?['user'] as Map?;
      final providerUserId = providerUser?['id'] as String?;
      if (mounted) setState(() {
        _booking = booking;
        _currentUserId = uid;
        _isProvider = uid == providerUserId;
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  int get _currentStepIndex {
    final status = _booking?['status'] as String? ?? '';
    return _timelineSteps.indexOf(status);
  }

  String _statusLabel(String s) => switch (s) {
    'requested' => 'Requested',
    'accepted' => 'Accepted',
    'on_the_way' => 'On the Way',
    'working' => 'Working',
    'completed' => 'Completed',
    'rejected' => 'Rejected',
    'cancelled' => 'Cancelled',
    _ => s,
  };

  Color _statusColor(String s) => switch (s) {
    'requested' => Colors.orange,
    'accepted' => AppTheme.primary,
    'on_the_way' => Colors.purple,
    'working' => Colors.blue,
    'completed' => Colors.green,
    'rejected' || 'cancelled' => Colors.red,
    _ => Colors.grey,
  };

  String _formatDate(String? iso) {
    if (iso == null) return '';
    try {
      final dt = DateTime.parse(iso);
      final d = dt.day.toString().padLeft(2, '0');
      final m = dt.month.toString().padLeft(2, '0');
      final h = dt.hour.toString().padLeft(2, '0');
      final min = dt.minute.toString().padLeft(2, '0');
      return '$d/$m/${dt.year} $h:$min';
    } catch (_) {
      return iso;
    }
  }

  Future<void> _updateStatus(String newStatus) async {
    if (_booking == null || _updating) return;
    setState(() => _updating = true);
    try {
      await ApiService.patch('/bookings/${widget.bookingId}/status', body: {
        'status': newStatus,
      });
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Status updated to ${_statusLabel(newStatus)}')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  Future<void> _callCustomer(String phone) async {
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  Future<void> _openInMaps(String address) async {
    final encoded = Uri.encodeFull(address);
    final uri = Uri.parse('https://www.google.com/maps/search/$encoded');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  @override
  Widget build(BuildContext context) {
    final loc = LocalizationProvider.of(context);
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF66A3FF),
        title: Text(loc.tr('booking_detail')),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _load,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('Error: $_error'))
              : _booking == null
                  ? const Center(child: Text('Booking not found'))
                  : _buildContent(loc),
    );
  }

  Widget _buildContent(LocalizationProvider loc) {
    final b = _booking!;
    final status = b['status'] as String? ?? '';
    final customer = b['customer'] as Map? ?? {};
    final psvc = b['providerService'] as Map? ?? {};
    final cat = psvc['category'] as Map? ?? {};
    final svcName = cat['nameEn'] as String? ?? 'Service';
    final custName = '${customer['firstName'] ?? ''} ${customer['lastName'] ?? ''}'.trim();
    final custPhone = customer['user']?['phone'] as String? ?? '';
    final address = b['serviceAddress'] as String?;
    final city = b['serviceCity'] as String?;
    final description = b['description'] as String? ?? '';
    final total = b['totalAmount'] ?? b['total'] ?? 'N/A';
    final sched = b['scheduledDate'] as String?;
    final color = _statusColor(status);

    return RefreshIndicator(
      onRefresh: _load,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status badge + date
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: color.withValues(alpha: 0.3)),
                  ),
                  child: Text(_statusLabel(status),
                    style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 14)),
                ),
                const Spacer(),
                if (sched != null)
                  Text(_formatDate(sched), style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
              ],
            ),
            const SizedBox(height: 24),

            // Timeline
            _buildTimeline(context, color),
            const SizedBox(height: 24),

            // Customer card
            _buildSectionCard(
              icon: Icons.person,
              title: 'Customer',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(custName.isNotEmpty ? custName : 'Unknown',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                  if (custPhone.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Row(children: [
                      const Icon(Icons.phone, size: 16, color: AppTheme.primary),
                      const SizedBox(width: 6),
                      GestureDetector(
                        onTap: () => _callCustomer(custPhone),
                        child: Text(custPhone,
                          style: const TextStyle(color: AppTheme.primary, decoration: TextDecoration.underline)),
                      ),
                    ]),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Service card
            _buildSectionCard(
              icon: Icons.build,
              title: 'Service',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(svcName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                  if (description.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(description, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 14)),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Price breakdown card
            _buildPriceBreakdown(b, loc),
            const SizedBox(height: 12),

            // Address card
            if (address != null || city != null)
              _buildSectionCard(
                icon: Icons.location_on,
                title: 'Address',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (address != null) Text(address, style: const TextStyle(fontSize: 14)),
                    if (city != null) ...[
                      const SizedBox(height: 4),
                      Text(city, style: const TextStyle(fontSize: 14)),
                    ],
                    if (address != null) ...[
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        onPressed: () => _openInMaps('$address, $city'),
                        icon: const Icon(Icons.map, size: 16),
                        label: const Text('Open in Maps'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppTheme.primary,
                          side: const BorderSide(color: AppTheme.primary),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            const SizedBox(height: 24),

            // Action buttons
            if (!['completed', 'rejected', 'cancelled'].contains(status))
              _buildActions(loc, status),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionCard({
    required IconData icon,
    required String title,
    required Widget child,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 10, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: AppTheme.primary, size: 20),
            ),
            const SizedBox(width: 10),
            Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16, color: AppTheme.textPrimary)),
          ]),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  Widget _buildPriceBreakdown(Map b, LocalizationProvider loc) {
    final total = double.tryParse('${b['totalAmount']}') ?? 0;
    final fee = double.tryParse('${b['convenienceFee']}') ?? 0;
    final gst = double.tryParse('${b['gstAmount']}') ?? 0;
    final base = total - fee - gst;

    // Derive GST rate from the stored amounts (graceful if zero)
    final taxable = base + fee;
    final gstRatePct = taxable > 0 ? (gst / taxable) * 100 : 0;

    String fmt(double v) =>
        v == v.roundToDouble() ? v.toInt().toString() : v.toStringAsFixed(2);

    Widget row(String label, String value, {bool bold = false}) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: bold ? 14 : 13,
                fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
                color: bold ? AppTheme.textPrimary : AppTheme.textSecondary,
              ),
            ),
            Text(
              value,
              style: TextStyle(
                fontSize: bold ? 15 : 13,
                fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
                color: bold ? AppTheme.primary : AppTheme.textPrimary,
              ),
            ),
          ],
        ),
      );
    }

    return _buildSectionCard(
      icon: Icons.receipt_long,
      title: loc.tr('price_breakdown_title'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          row(loc.tr('base_price'), '₹${fmt(base)}'),
          row(
            loc.tr('convenience_fee'),
            fee > 0 ? '₹${fmt(fee)}' : loc.tr('fee_waived'),
          ),
          row(
            '${loc.tr('gst')} (${gstRatePct == gstRatePct.roundToDouble() ? gstRatePct.toInt() : gstRatePct.toStringAsFixed(1)}%)',
            '₹${fmt(gst)}',
          ),
          const Divider(height: 16, thickness: 1),
          row(loc.tr('total_amount'), '₹${fmt(total)}', bold: true),
        ],
      ),
    );
  }

  Widget _buildTimeline(BuildContext context, Color activeColor) {
    final current = _currentStepIndex;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 10, offset: const Offset(0, 2))],
      ),
      child: Row(
        children: List.generate(_timelineSteps.length, (i) {
          final isActive = i <= current;
          final isCurrent = i == current;
          return Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Step circle
                Container(
                  width: isCurrent ? 36 : 28,
                  height: isCurrent ? 36 : 28,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isActive ? activeColor : Colors.grey.shade200,
                    border: isCurrent ? Border.all(color: Colors.white, width: 3) : null,
                    boxShadow: isCurrent
                        ? [BoxShadow(color: activeColor.withValues(alpha: 0.3), blurRadius: 8)]
                        : null,
                  ),
                  child: Center(
                    child: isActive
                        ? (isCurrent
                            ? Container(
                                width: 12,
                                height: 12,
                                decoration: const BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: Colors.white,
                                ),
                              )
                            : const Icon(Icons.check, color: Colors.white, size: 16))
                        : Text('${i + 1}', style: const TextStyle(color: Colors.white, fontSize: 12)),
                  ),
                ),
                const SizedBox(height: 6),
                // Label
                Text(
                  _stepLabels[i],
                  style: TextStyle(
                    fontSize: isCurrent ? 11 : 10,
                    fontWeight: isCurrent ? FontWeight.w600 : FontWeight.normal,
                    color: isCurrent ? activeColor : Colors.grey.shade500,
                  ),
                  textAlign: TextAlign.center,
                ),
                // Connector line
                if (i < _timelineSteps.length - 1)
                  Container(
                    height: 2,
                    margin: const EdgeInsets.only(top: 4),
                    decoration: BoxDecoration(
                      color: i < current ? activeColor : Colors.grey.shade200,
                      borderRadius: BorderRadius.circular(1),
                    ),
                  ),
              ],
            ),
          );
        }),
      ),
    );
  }

  Widget _buildActions(LocalizationProvider loc, String status) {
    if (_isProvider) {
      return _buildProviderActions(loc, status);
    }
    return _buildCustomerActions(loc, status);
  }

  Widget _buildProviderActions(LocalizationProvider loc, String status) {
    final nextStatus = _nextStatus(status);
    final customer = _booking?['customer'] as Map? ?? {};
    final custUser = customer['user'] as Map? ?? {};
    final phone = custUser['phone'] as String?;
    return Column(
      children: [
        if (nextStatus != null)
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _updating ? null : () => _updateStatus(nextStatus),
              style: ElevatedButton.styleFrom(
                backgroundColor: _statusColor(nextStatus),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: _updating
                  ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(_statusLabel(nextStatus),
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            ),
          ),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => ChatScreen(
                    bookingId: widget.bookingId,
                    mode: 'provider',
                  )),
                );
              },
              icon: const Icon(Icons.chat, size: 18),
              label: Text(loc.tr('chat')),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppTheme.primary,
                side: const BorderSide(color: AppTheme.primary),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          if (phone != null) ...[
            const SizedBox(width: 12),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _callCustomer(phone),
                icon: const Icon(Icons.phone, size: 18),
                label: Text(loc.tr('call')),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.green,
                  side: const BorderSide(color: Colors.green),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          ],
        ]),
      ],
    );
  }

  Widget _buildCustomerActions(LocalizationProvider loc, String status) {
    final provider = _booking?['provider'] as Map? ?? {};
    final provUser = provider['user'] as Map? ?? {};
    final phone = provUser['phone'] as String?;
    final psvc = _booking?['providerService'] as Map? ?? {};
    final cat = psvc['category'] as Map? ?? {};
    return Column(
      children: [
        if (status == 'requested')
          SizedBox(
            width: double.infinity,
            height: 52,
            child: OutlinedButton.icon(
              onPressed: _updating ? null : () => _cancelBooking(),
              icon: const Icon(Icons.cancel_outlined, size: 18),
              label: Text('Cancel Booking'),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.red,
                side: const BorderSide(color: Colors.red),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => ChatScreen(
                    bookingId: widget.bookingId,
                    providerName: cat['nameEn'] as String?,
                  )),
                );
              },
              icon: const Icon(Icons.chat, size: 18),
              label: Text(loc.tr('chat')),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppTheme.primary,
                side: const BorderSide(color: AppTheme.primary),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          if (phone != null) ...[
            const SizedBox(width: 12),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _callCustomer(phone),
                icon: const Icon(Icons.phone, size: 18),
                label: Text(loc.tr('call')),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.green,
                  side: const BorderSide(color: Colors.green),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          ],
        ]),
        if (status == 'completed') ...[
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton.icon(
              onPressed: () => _writeReview(),
              icon: const Icon(Icons.star, size: 18),
              label: Text(loc.tr('write_review')),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.amber,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Future<void> _cancelBooking() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel Booking'),
        content: const Text('Are you sure you want to cancel this booking?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('No')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Yes, Cancel')),
        ],
      ),
    );
    if (confirm != true) return;
    setState(() => _updating = true);
    try {
      await ApiService.patch('/bookings/${widget.bookingId}/status', body: {'status': 'cancelled'});
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Booking cancelled')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  void _writeReview() {
    // Navigate to write review screen
    Navigator.pushNamed(context, '/write-review', arguments: {'bookingId': widget.bookingId});
  }

  String? _nextStatus(String current) {
    return switch (current) {
      'requested' => 'accepted',
      'accepted' => 'on_the_way',
      'on_the_way' => 'working',
      'working' => 'completed',
      _ => null,
    };
  }
}
