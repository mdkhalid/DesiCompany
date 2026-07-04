import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';
import '../theme.dart';
import 'provider_job_detail_screen.dart';

import 'package:desicompany/services/app_logger.dart';
class ProviderRequestsScreen extends StatefulWidget {
  const ProviderRequestsScreen({super.key});
  @override
  State<ProviderRequestsScreen> createState() => _ProviderRequestsScreenState();
}

class _ProviderRequestsScreenState extends State<ProviderRequestsScreen> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  int _tabIndex = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final position = await LocationService.getCurrentLocation();
      final params = <String, String>{'radiusKm': '10'};
      if (position != null) {
        params['lat'] = '${position.latitude}';
        params['lng'] = '${position.longitude}';
      }
      final query = params.entries.map((e) => '${e.key}=${e.value}').join('&');
      final openJobs = await ApiService.get('/job-requests/open?$query');
      final bookings = await ApiService.get('/bookings/provider/me');
      if (!mounted) return;

      final List<Map<String, dynamic>> merged = [];
      for (final j in openJobs as List) {
        final customer = j['customer'] as Map<String, dynamic>?;
        merged.add({
          'id': j['id'],
          'type': 'open_job',
          'title': j['title'] ?? j['categoryName'] ?? 'Job',
          'subtitle': j['description'] ?? '',
          'customerName': customer?['firstName'] != null ? '${customer!['firstName']} ${customer['lastName'] ?? ''}' : 'Customer',
          'city': j['city'] ?? '',
          'budget': j['budgetMin'] != null && j['budgetMax'] != null ? '₹${j['budgetMin']}-${j['budgetMax']}' : (j['budgetMax']?.toString() ?? ''),
          'date': j['createdAt'],
          'distance': j['distance']?.toString(),
          'raw': j,
        });
      }
      for (final b in bookings as List) {
        final customer = b['customer'] as Map<String, dynamic>?;
        merged.add({
          'id': b['id'],
          'type': 'booking',
          'title': b['description'] ?? b['providerService']?['category']?['nameEn'] ?? 'Booking',
          'subtitle': b['status'] ?? 'requested',
          'customerName': customer?['firstName'] != null ? '${customer!['firstName']} ${customer['lastName'] ?? ''}' : 'Customer',
          'city': b['city'] ?? '',
          'budget': b['totalAmount']?.toString() != null ? '₹${b['totalAmount']}' : '',
          'date': b['createdAt'],
          'distance': null,
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
    if (type == 'open_job') return Colors.blue;
    return switch (status) {
      'requested' => const Color(0xFFFF6F00),
      'accepted' => const Color(0xFF1E88E5),
      'on_the_way' => const Color(0xFF6C3FB4),
      'working' => const Color(0xFF00BFA5),
      'completed' => const Color(0xFF43A047),
      'rejected' => Colors.grey,
      _ => Colors.grey,
    };
  }

  String _timeAgo(String? iso) {
    if (iso == null) return '';
    try {
      final dt = DateTime.parse(iso);
      final diff = DateTime.now().difference(dt);
      if (diff.inDays > 0) return '${diff.inDays}d ago';
      if (diff.inHours > 0) return '${diff.inHours}h ago';
      if (diff.inMinutes > 0) return '${diff.inMinutes}m ago';
      return 'Just now';
    } catch (e, st) { AppLogger.e('provider_requests_screen', 'Operation failed', e, st);
      return '';
    }
  }

  void _openDetail(Map<String, dynamic> item) {
    if (item['type'] == 'open_job') {
      Navigator.push(context, MaterialPageRoute(
        builder: (_) => ProviderJobDetailScreen(jobRequestId: item['id']),
      )).then((_) => _load());
    } else {
      Navigator.pushNamed(context, '/my-bookings').then((_) => _load());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF66A3FF),
        title: const Text('Requests'),
        centerTitle: true,
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: _items.length + 1,
                itemBuilder: (_, i) {
                  if (i == 0) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Row(
                        children: [
                          _filterChip('All', _tabIndex == 0, () => setState(() => _tabIndex = 0)),
                          const SizedBox(width: 8),
                          _filterChip('Open Jobs', _tabIndex == 1, () => setState(() => _tabIndex = 1)),
                          const SizedBox(width: 8),
                          _filterChip('Bookings', _tabIndex == 2, () => setState(() => _tabIndex = 2)),
                        ],
                      ),
                    );
                  }
                  final item = _items[i - 1];
                  final type = item['type'] as String;
                  if (_tabIndex == 1 && type != 'open_job') return const SizedBox.shrink();
                  if (_tabIndex == 2 && type != 'booking') return const SizedBox.shrink();

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
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 44, height: 44,
                              decoration: BoxDecoration(
                                color: type == 'open_job' ? Colors.green.withValues(alpha: 0.1) : AppTheme.primary.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Icon(
                                type == 'open_job' ? Icons.monetization_on_outlined : Icons.calendar_today_outlined,
                                color: type == 'open_job' ? Colors.green.shade700 : AppTheme.primary,
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
                                          item['customerName'] ?? '',
                                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      if (type == 'open_job')
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: Colors.green.withValues(alpha: 0.1),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: const Text(
                                            'OPEN',
                                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.green),
                                          ),
                                        )
                                      else
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: _statusColor(type, item['subtitle']).withValues(alpha: 0.1),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            (item['subtitle'] as String).replaceAll('_', ' ').toUpperCase(),
                                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: _statusColor(type, item['subtitle'])),
                                          ),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    item['title'] ?? '',
                                    style: const TextStyle(fontSize: 13),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      if (item['city'] != null && (item['city'] as String).isNotEmpty) ...[
                                        Icon(Icons.location_on_outlined, size: 13, color: Colors.grey.shade500),
                                        const SizedBox(width: 2),
                                        Text(item['city'], style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                                        const SizedBox(width: 8),
                                      ],
                                      if (item['budget'] != null && (item['budget'] as String).isNotEmpty) ...[
                                        Icon(Icons.currency_rupee, size: 13, color: Colors.grey.shade500),
                                        const SizedBox(width: 2),
                                        Text(item['budget'], style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.grey.shade600)),
                                        const SizedBox(width: 8),
                                      ],
                                      Text(
                                        _timeAgo(item['date']),
                                        style: TextStyle(fontSize: 11, color: Colors.grey.shade400),
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

  Widget _filterChip(String label, bool active, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: active ? AppTheme.primary : Colors.grey.shade200,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: active ? Colors.white : Colors.grey.shade700,
          ),
        ),
      ),
    );
  }
}