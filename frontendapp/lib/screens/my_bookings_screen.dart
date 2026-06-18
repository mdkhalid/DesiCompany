import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme.dart';

class MyBookingsScreen extends StatefulWidget {
  const MyBookingsScreen({super.key});
  @override
  State<MyBookingsScreen> createState() => _MyBookingsScreenState();
}

class _MyBookingsScreenState extends State<MyBookingsScreen> {
  List _bookings = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadBookings();
  }

  Future<void> _loadBookings() async {
    try {
      final data = await ApiService.get('/bookings/customer/me');
      if (mounted) setState(() { _bookings = data as List; _loading = false; });
    } catch (e) { if (mounted) setState(() => _loading = false); }
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Bookings'),
        flexibleSpace: Container(decoration: AppTheme.gradientBackground),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _bookings.isEmpty
              ? Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.book_online, size: 64, color: Colors.grey.shade300),
                    const SizedBox(height: 16),
                    const Text('No bookings yet', style: TextStyle(color: AppTheme.textSecondary, fontSize: 16)),
                  ]),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(20),
                  itemCount: _bookings.length,
                  itemBuilder: (_, i) {
                    final b = _bookings[i];
                    final statusColor = _statusColor(b['status'] ?? '');
                    return Container(
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
                              child: Text(_statusLabel(b['status'] ?? ''), style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.w600)),
                            ),
                          ]),
                          const SizedBox(height: 8),
                          Row(children: [
                            const Icon(Icons.currency_rupee, size: 16, color: AppTheme.textSecondary),
                            Text('${b['totalAmount'] ?? 0}', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 14)),
                          ]),
                        ]),
                      ),
                    );
                  },
                ),
    );
  }
}
