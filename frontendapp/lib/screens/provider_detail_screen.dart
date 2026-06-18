import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme.dart';

class ProviderDetailScreen extends StatefulWidget {
  final Map provider;
  const ProviderDetailScreen({super.key, required this.provider});
  @override
  State<ProviderDetailScreen> createState() => _ProviderDetailScreenState();
}

class _ProviderDetailScreenState extends State<ProviderDetailScreen> {
  List _services = [];
  bool _loading = true;
  String? _error;
  Set<String> _bookedServiceIds = {};

  @override
  void initState() {
    super.initState();
    final embeddedServices = widget.provider['services'] as List?;
    if (embeddedServices != null && embeddedServices.isNotEmpty) {
      _services = embeddedServices;
      _loading = false;
    } else {
      _loadServices();
    }
    _loadExistingBookings();
  }

  Future<void> _loadExistingBookings() async {
    try {
      final data = await ApiService.get('/bookings/customer/me');
      if (!mounted) return;
      final bookings = data as List;
      final bookedIds = bookings
          .map((b) => b['providerService']?['id'] ?? b['providerServiceId'])
          .whereType<String>()
          .toSet();
      if (bookedIds.isNotEmpty) {
        setState(() => _bookedServiceIds = bookedIds);
      }
    } catch (_) {}
  }

  Future<void> _loadServices() async {
    try {
      final data = await ApiService.get('/services/providers/${widget.provider['id']}/services');
      if (mounted) setState(() { _services = data is List ? data : []; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.toString(); });
    }
  }

  Future<void> _bookService(Map service) async {
    final now = DateTime.now().add(const Duration(days: 1));
    final dateStr = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}T10:00:00Z';
    try {
      await ApiService.post('/bookings', body: {
        'customerId': 'me',
        'providerId': widget.provider['id'],
        'providerServiceId': service['id'],
        'scheduledDate': dateStr,
      });
      if (!mounted) return;
      setState(() => _bookedServiceIds.add(service['id'] as String));
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Booking requested!')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.provider;
    final color = Colors.deepPurple;
    return Scaffold(
      body: CustomScrollView(slivers: [
        SliverAppBar(
          expandedHeight: 200,
          pinned: true,
          flexibleSpace: FlexibleSpaceBar(
            background: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [color, color.withValues(alpha: 0.7), AppTheme.secondary],
                ),
              ),
              child: SafeArea(
                child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                  const Spacer(),
                  Container(
                    width: 72, height: 72,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Center(child: Text((p['firstName'] ?? '?')[0].toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold))),
                  ),
                  const SizedBox(height: 12),
                  Text('${p['firstName'] ?? ''} ${p['lastName'] ?? ''}', style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    const Icon(Icons.star, color: Color(0xFFFFD600), size: 18),
                    const SizedBox(width: 4),
                    Text('${p['averageRating'] ?? 0}', style: const TextStyle(color: Colors.white70, fontSize: 14)),
                    if (p['city'] != null) ...[
                      const SizedBox(width: 16),
                      const Icon(Icons.location_on, color: Colors.white70, size: 16),
                      const SizedBox(width: 4),
                      Text(p['city'], style: const TextStyle(color: Colors.white70, fontSize: 14)),
                    ],
                  ]),
                  const SizedBox(height: 20),
                ]),
              ),
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.all(20),
          sliver: _loading
            ? const SliverFillRemaining(child: Center(child: CircularProgressIndicator()))
            : SliverList(
                delegate: SliverChildListDelegate([
                  const Text('Services', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
                  if (_error != null)
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: Color(0xFFFFE0E0), borderRadius: BorderRadius.circular(12)),
                      child: Text('Could not load services', style: TextStyle(color: Colors.red.shade700, fontSize: 13)),
                    ),
                  const SizedBox(height: 12),
                  ..._services.map((s) {
                    final pricing = [
                      if (s['fixedRate'] != null) 'Fixed: ₹${s['fixedRate']}',
                      if (s['hourlyRate'] != null) 'Hourly: ₹${s['hourlyRate']}/hr',
                      if (s['dailyRate'] != null) 'Daily: ₹${s['dailyRate']}/day',
                    ].join(' | ');
                    final isBooked = _bookedServiceIds.contains(s['id']);
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: isBooked ? Colors.grey.shade100 : Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, 4))],
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(children: [
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: isBooked ? Colors.grey.shade200 : color.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Icon(Icons.check_circle, color: isBooked ? Colors.green : color, size: 28),
                          ),
                          const SizedBox(width: 16),
                          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(s['category']?['nameEn'] ?? 'Service', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: isBooked ? AppTheme.textSecondary : AppTheme.textPrimary)),
                            const SizedBox(height: 4),
                            Text(isBooked ? 'Already booked' : pricing, style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
                          ])),
                          ElevatedButton(
                            onPressed: isBooked ? null : () => _bookService(s),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: isBooked ? Colors.green : color,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            child: Text(isBooked ? 'Booked' : 'Book', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                          ),
                        ]),
                      ),
                    );
                  }),
                ]),
              ),
        ),
      ]),
    );
  }
}
