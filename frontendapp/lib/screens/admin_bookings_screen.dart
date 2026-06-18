import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme.dart';

class AdminBookingsScreen extends StatefulWidget {
  const AdminBookingsScreen({super.key});

  @override
  State<AdminBookingsScreen> createState() => _AdminBookingsScreenState();
}

class _AdminBookingsScreenState extends State<AdminBookingsScreen> {
  List _bookings = [];
  bool _loading = true;
  String _selectedStatus = 'all';

  final List<Map<String, String>> _statusFilters = [
    {'value': 'all', 'label': 'All'},
    {'value': 'requested', 'label': 'Requested'},
    {'value': 'accepted', 'label': 'Accepted'},
    {'value': 'working', 'label': 'Working'},
    {'value': 'completed', 'label': 'Completed'},
  ];

  @override
  void initState() {
    super.initState();
    _loadBookings();
  }

  Future<void> _loadBookings() async {
    try {
      final data = await ApiService.get('/admin/bookings');
      if (mounted) setState(() { _bookings = data as List; _loading = false; });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List get _filteredBookings {
    if (_selectedStatus == 'all') return _bookings;
    return _bookings.where((b) => b['status'] == _selectedStatus).toList();
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
    return status.replaceAll('_', ' ').toUpperCase();
  }

  void _showBookingDetails(Map booking) {
    final customer = booking['customer'] ?? {};
    final customerUser = customer['user'] ?? {};
    final customerName = '${customerUser['firstName'] ?? ''} ${customerUser['lastName'] ?? ''}'.trim();
    final provider = booking['provider'] ?? {};
    final providerUser = provider['user'] ?? {};
    final providerName = '${providerUser['firstName'] ?? ''} ${providerUser['lastName'] ?? ''}'.trim();
    final status = booking['status'] ?? '';
    final statusColor = _statusColor(status);

    String dateStr = 'N/A';
    if (booking['scheduledDate'] != null) {
      try {
        final date = DateTime.parse(booking['scheduledDate']);
        dateStr = '${date.day}/${date.month}/${date.year}';
      } catch (_) {}
    }

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Booking #${booking['id'].toString().substring(0, 8)}',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppTheme.textPrimary),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                  child: Text(_statusLabel(status), style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
            const SizedBox(height: 20),
            _detailRow(Icons.person, 'Customer', customerName.isNotEmpty ? customerName : 'N/A'),
            const SizedBox(height: 12),
            _detailRow(Icons.build, 'Provider', providerName.isNotEmpty ? providerName : 'N/A'),
            const SizedBox(height: 12),
            _detailRow(Icons.currency_rupee, 'Amount', '₹${booking['totalAmount'] ?? 0}'),
            const SizedBox(height: 12),
            _detailRow(Icons.calendar_today, 'Scheduled', dateStr),
            const SizedBox(height: 12),
            _detailRow(Icons.info_outline, 'Status', _statusLabel(status)),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _detailRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppTheme.primary),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
            Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
          ],
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('All Bookings'),
        flexibleSpace: Container(decoration: AppTheme.gradientBackground),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                SizedBox(
                  height: 56,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                    scrollDirection: Axis.horizontal,
                    itemCount: _statusFilters.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (_, i) {
                      final filter = _statusFilters[i];
                      final isSelected = _selectedStatus == filter['value'];
                      return ChoiceChip(
                        label: Text(filter['label']!, style: TextStyle(
                          color: isSelected ? Colors.white : AppTheme.textSecondary,
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        )),
                        selected: isSelected,
                        selectedColor: AppTheme.primary,
                        backgroundColor: Colors.white,
                        side: BorderSide(color: isSelected ? AppTheme.primary : Colors.grey.shade200),
                        onSelected: (_) => setState(() => _selectedStatus = filter['value']!),
                      );
                    },
                  ),
                ),
                Expanded(
                  child: _filteredBookings.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.book_online, size: 64, color: Colors.grey.shade300),
                              const SizedBox(height: 16),
                              Text('No bookings found', style: TextStyle(fontSize: 16, color: Colors.grey.shade500)),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
                          itemCount: _filteredBookings.length,
                          itemBuilder: (_, i) {
                            final b = _filteredBookings[i];
                            final status = b['status'] ?? '';
                            final statusColor = _statusColor(status);

                            final customer = b['customer'] ?? {};
                            final customerUser = customer['user'] ?? {};
                            final customerName = '${customerUser['firstName'] ?? ''} ${customerUser['lastName'] ?? ''}'.trim();

                            final provider = b['provider'] ?? {};
                            final providerUser = provider['user'] ?? {};
                            final providerName = '${providerUser['firstName'] ?? ''} ${providerUser['lastName'] ?? ''}'.trim();

                            String dateStr = '';
                            if (b['scheduledDate'] != null) {
                              try {
                                final date = DateTime.parse(b['scheduledDate']);
                                dateStr = '${date.day}/${date.month}/${date.year}';
                              } catch (_) {}
                            }

                            return GestureDetector(
                              onTap: () => _showBookingDetails(b),
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
                                      Text('Booking #${b['id'].toString().substring(0, 8)}', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textPrimary, fontSize: 15)),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                                        child: Text(_statusLabel(status), style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.w600)),
                                      ),
                                    ]),
                                    const SizedBox(height: 10),
                                    Row(children: [
                                      const Icon(Icons.person, size: 16, color: AppTheme.textSecondary),
                                      const SizedBox(width: 6),
                                      Expanded(child: Text(customerName.isNotEmpty ? customerName : 'N/A', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13), overflow: TextOverflow.ellipsis)),
                                    ]),
                                    const SizedBox(height: 6),
                                    Row(children: [
                                      const Icon(Icons.build, size: 16, color: AppTheme.textSecondary),
                                      const SizedBox(width: 6),
                                      Expanded(child: Text(providerName.isNotEmpty ? providerName : 'N/A', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13), overflow: TextOverflow.ellipsis)),
                                    ]),
                                    const SizedBox(height: 10),
                                    Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                                      Row(children: [
                                        const Icon(Icons.currency_rupee, size: 16, color: AppTheme.textPrimary),
                                        Text('${b['totalAmount'] ?? 0}', style: const TextStyle(color: AppTheme.textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
                                      ]),
                                      if (dateStr.isNotEmpty)
                                        Row(children: [
                                          const Icon(Icons.calendar_today, size: 14, color: AppTheme.textSecondary),
                                          const SizedBox(width: 4),
                                          Text(dateStr, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                                        ]),
                                    ]),
                                  ]),
                                ),
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }
}
