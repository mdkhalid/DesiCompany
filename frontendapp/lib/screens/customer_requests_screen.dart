import 'package:flutter/material.dart';
import 'package:intl/intl.dart' as intl;
import '../services/api_service.dart';
import '../theme.dart';
import 'customer_post_job_screen.dart';
import 'customer_job_detail_screen.dart';

class CustomerRequestsScreen extends StatefulWidget {
  const CustomerRequestsScreen({super.key});
  @override
  State<CustomerRequestsScreen> createState() => _CustomerRequestsScreenState();
}

class _CustomerRequestsScreenState extends State<CustomerRequestsScreen> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final jobs = await ApiService.get('/job-requests/customer/me');
      final bookings = await ApiService.get('/bookings/customer/me');
      if (!mounted) return;

      final List<Map<String, dynamic>> merged = [];
      for (final j in jobs as List) {
        merged.add({
          'id': j['id'],
          'type': 'job',
          'title': j['title'] ?? j['categoryName'] ?? 'Job',
          'subtitle': j['description'] ?? '',
          'status': j['status'] ?? 'OPEN',
          'price': j['budgetMax']?.toString(),
          'date': j['createdAt'],
          'partnerName': null,
          'raw': j,
        });
      }
      for (final b in bookings as List) {
        final provider = b['provider'] as Map<String, dynamic>?;
        merged.add({
          'id': b['id'],
          'type': 'booking',
          'title': b['description'] ?? b['providerService']?['category']?['nameEn'] ?? 'Booking',
          'subtitle': provider?['firstName'] != null ? '${provider!['firstName']} ${provider['lastName'] ?? ''}' : 'Provider',
          'status': b['status'] ?? 'requested',
          'price': b['totalAmount']?.toString(),
          'date': b['createdAt'],
          'partnerName': provider?['firstName'] != null ? '${provider!['firstName']} ${provider['lastName'] ?? ''}' : null,
          'raw': b,
        });
      }
      merged.sort((a, b) {
        final da = DateTime.tryParse(a['date'] ?? '') ?? DateTime(2000);
        final db = DateTime.tryParse(b['date'] ?? '') ?? DateTime(2000);
        return db.compareTo(da);
      });

      setState(() { _items = merged; _loading = false; });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Color _statusColor(String type, String status) {
    if (type == 'job') {
      return switch (status) {
        'OPEN' => const Color(0xFF1E88E5),
        'QUOTED' => const Color(0xFFFF6F00),
        'ACCEPTED' => const Color(0xFF43A047),
        'CANCELLED' => const Color(0xFFE53935),
        'CLOSED' => Colors.grey,
        _ => Colors.grey,
      };
    }
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

  String _statusLabel(String type, String status) {
    if (type == 'job') return status;
    return status.replaceAll('_', ' ').toUpperCase();
  }

  String _formatDate(String? iso) {
    if (iso == null) return '';
    try {
      return intl.DateFormat('d MMM yyyy').format(DateTime.parse(iso));
    } catch (_) {
      return '';
    }
  }

  void _openDetail(Map<String, dynamic> item) {
    if (item['type'] == 'job') {
      Navigator.push(context, MaterialPageRoute(
        builder: (_) => CustomerJobDetailScreen(jobRequestId: item['id']),
      )).then((_) => _load());
    } else {
      Navigator.pushNamed(context, '/my-bookings').then((_) => _load());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Requests'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: 'Post a Job',
            onPressed: () => Navigator.push(context, MaterialPageRoute(
              builder: (_) => const CustomerPostJobScreen(),
            )).then((_) => _load()),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _items.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.assignment_outlined, size: 64, color: Colors.grey.shade300),
                      const SizedBox(height: 16),
                      Text('No requests yet', style: TextStyle(color: Colors.grey.shade600, fontSize: 16)),
                      const SizedBox(height: 8),
                      TextButton.icon(
                        icon: const Icon(Icons.add),
                        label: const Text('Post a Job'),
                        onPressed: () => Navigator.push(context, MaterialPageRoute(
                          builder: (_) => const CustomerPostJobScreen(),
                        )).then((_) => _load()),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: _items.length,
                    itemBuilder: (_, i) {
                      final item = _items[i];
                      final type = item['type'] as String;
                      final status = item['status'] as String;
                      final isJob = type == 'job';

                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        elevation: 1,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: () => _openDetail(item),
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Row(
                              children: [
                                Container(
                                  width: 44, height: 44,
                                  decoration: BoxDecoration(
                                    color: isJob ? Colors.blue.withValues(alpha: 0.1) : AppTheme.primary.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Icon(
                                    isJob ? Icons.work_outline : Icons.calendar_today_outlined,
                                    color: isJob ? Colors.blue : AppTheme.primary,
                                    size: 22,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              item['title'] ?? '',
                                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                            decoration: BoxDecoration(
                                              color: _statusColor(type, status).withValues(alpha: 0.1),
                                              borderRadius: BorderRadius.circular(6),
                                            ),
                                            child: Text(
                                              _statusLabel(type, status),
                                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: _statusColor(type, status)),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        item['subtitle'] ?? '',
                                        style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 2),
                                      Row(
                                        children: [
                                          if (item['price'] != null) ...[
                                            Text('₹${item['price']}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.primary)),
                                            const SizedBox(width: 8),
                                          ],
                                          Text(
                                            _formatDate(item['date']),
                                            style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                                const Icon(Icons.chevron_right, color: Colors.grey),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}