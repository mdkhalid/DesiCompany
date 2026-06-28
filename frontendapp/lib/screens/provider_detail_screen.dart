import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../l10n/strings.dart';
import '../services/api_service.dart';
import '../theme.dart';
import '../widgets/distance_badge.dart';

class ProviderDetailScreen extends StatefulWidget {
  final Map provider;
  const ProviderDetailScreen({super.key, required this.provider});
  @override
  State<ProviderDetailScreen> createState() => _ProviderDetailScreenState();
}

class _ProviderDetailScreenState extends State<ProviderDetailScreen> {
  List _services = [];
  List _reviews = [];
  bool _loading = true;
  String? _error;
  Set<String> _bookedServiceIds = {};
  double? _distanceMeters;

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
    _loadReviews();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_distanceMeters == null) _calculateDistance();
  }

  void _calculateDistance() {
    final args = ModalRoute.of(context)?.settings.arguments;
    final customerLat = args is Map ? (args['customerLatitude'] as num?)?.toDouble() : null;
    final customerLng = args is Map ? (args['customerLongitude'] as num?)?.toDouble() : null;
    final providerLat = double.tryParse('${widget.provider['latitude'] ?? ''}');
    final providerLng = double.tryParse('${widget.provider['longitude'] ?? ''}');
    if (customerLat != null && customerLng != null && providerLat != null && providerLng != null) {
      _distanceMeters = DistanceBadge.calculateDistance(
        lat1: customerLat, lon1: customerLng,
        lat2: providerLat, lon2: providerLng,
      );
    }
  }

  String _getTravelTimeEstimate() {
    if (_distanceMeters == null) return '';
    final loc = LocalizationProvider.of(context);
    final km = _distanceMeters! / 1000;
    if (km < 1) return loc.tr('walking_distance');
    if (km < 5) return loc.tr('car_5_10');
    if (km < 15) return loc.tr('car_15_30');
    return loc.tr('car_30_plus');
  }

  Future<void> _openDirections() async {
    final providerLat = double.tryParse('${widget.provider['latitude'] ?? ''}');
    final providerLng = double.tryParse('${widget.provider['longitude'] ?? ''}');
    if (providerLat == null || providerLng == null) return;
    final url = Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$providerLat,$providerLng');
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  void _openDirectChat() {
    Navigator.pushNamed(context, '/chat', arguments: {
      'providerId': widget.provider['id'],
      'mode': 'direct_chat',
    });
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

  Future<void> _loadReviews() async {
    try {
      final data = await ApiService.get('/reviews/provider/${widget.provider['id']}');
      if (mounted) setState(() { _reviews = data as List; });
    } catch (_) {}
  }

  Future<void> _bookService(Map service) async {
    final loc = LocalizationProvider.of(context);
    DateTime? date;
    String? selectedSlot;
    List slots = [];
    bool loadingSlots = false;

    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: const Text('Book Service'),
          content: SizedBox(
            width: double.maxFinite,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                InkWell(
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: ctx,
                      initialDate: DateTime.now().add(const Duration(days: 1)),
                      firstDate: DateTime.now().add(const Duration(days: 1)),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (picked != null) {
                      setDialogState(() {
                        date = picked;
                        selectedSlot = null;
                        slots = [];
                        loadingSlots = true;
                      });
                      try {
                        final dateStr = '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
                        final data = await ApiService.get('/services/available-slots?providerId=${widget.provider['id']}&date=$dateStr');
                        if (!ctx.mounted) return;
                        final parsed = (data is Map ? data['slots'] : []) as List;
                        setDialogState(() { slots = parsed; loadingSlots = false; });
                      } catch (e) {
                        if (ctx.mounted) setDialogState(() => loadingSlots = false);
                      }
                    }
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: BoxDecoration(
                      color: AppTheme.background,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(children: [
                      const Icon(Icons.calendar_today, color: AppTheme.primary, size: 20),
                      const SizedBox(width: 12),
                      Text(
                        date == null ? loc.tr('preferred_date') : '${date!.day}/${date!.month}/${date!.year}',
                        style: TextStyle(fontWeight: FontWeight.w500, color: date == null ? AppTheme.textSecondary : AppTheme.textPrimary),
                      ),
                    ]),
                  ),
                ),
                const SizedBox(height: 16),
                if (loadingSlots)
                  const Center(child: Padding(
                    padding: EdgeInsets.all(16),
                    child: CircularProgressIndicator(),
                  ))
                else if (date != null && slots.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(16),
                    child: Text('No available slots for this date', style: TextStyle(color: AppTheme.textSecondary)),
                  )
                else
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: slots.map((s) {
                      final start = s['start'] as String? ?? '';
                      final end = s['end'] as String? ?? '';
                      final display = start.length >= 5
                          ? '${int.parse(start.split(':')[0]) > 12 ? int.parse(start.split(':')[0]) - 12 : (int.parse(start.split(':')[0]) == 0 ? 12 : int.parse(start.split(':')[0]))}:${start.split(':')[1]} ${int.parse(start.split(':')[0]) >= 12 ? 'PM' : 'AM'}'
                          : start;
                      final isSelected = selectedSlot == start;
                      return GestureDetector(
                        onTap: () => setDialogState(() => selectedSlot = start),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          decoration: BoxDecoration(
                            color: isSelected ? AppTheme.primary : Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: isSelected ? AppTheme.primary : Colors.grey.shade300),
                          ),
                          child: Text(
                            display,
                            style: TextStyle(
                              color: isSelected ? Colors.white : AppTheme.textPrimary,
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: Text(loc.tr('cancel'))),
            ElevatedButton(
              onPressed: date == null || selectedSlot == null
                  ? null
                  : () => Navigator.pop(ctx, {
                      'date': '${date!.year}-${date!.month.toString().padLeft(2, '0')}-${date!.day.toString().padLeft(2, '0')}',
                      'time': selectedSlot!,
                    }),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: Text(loc.tr('book'), style: const TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );

    if (result == null) return;
    try {
      await ApiService.post('/bookings', body: {
        'customerId': 'me',
        'providerId': widget.provider['id'],
        'providerServiceId': service['id'],
        'scheduledDate': '${result['date']}T${result['time']}:00Z',
      });
      if (!mounted) return;
      setState(() => _bookedServiceIds.add(service['id'] as String));
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(loc.tr('booking_requested'))));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final loc = LocalizationProvider.of(context);
    final p = widget.provider;
    final color = Colors.deepPurple;
    final totalReviews = p['totalReviews'] ?? _reviews.length;
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
                    Text(
                      '${p['averageRating'] ?? 0} ${loc.tr('reviews_count', params: {'count': totalReviews.toString()})}',
                      style: const TextStyle(color: Colors.white70, fontSize: 14),
                    ),
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
                  if (_distanceMeters != null) ...[
                    DistanceBadge(distanceMeters: _distanceMeters),
                    const SizedBox(height: 4),
                    Text(
                      _getTravelTimeEstimate(),
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                    ),
                    const SizedBox(height: 16),
                  ],
                  if (widget.provider['latitude'] != null && widget.provider['longitude'] != null) ...[
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: _openDirections,
                        icon: const Icon(Icons.directions, size: 18),
                        label: Text(loc.tr('get_directions')),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.deepPurple,
                          side: const BorderSide(color: Colors.deepPurple),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _openDirectChat,
                      icon: const Icon(Icons.chat_bubble_outline, size: 18),
                      label: Text(loc.tr('ask_question')),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.deepPurple,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(loc.tr('services'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
                  if (_error != null)
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: const BoxDecoration(color: Color(0xFFFFE0E0), borderRadius: BorderRadius.all(Radius.circular(12))),
                      child: Text(loc.tr('could_not_load_services'), style: TextStyle(color: Colors.red.shade700, fontSize: 13)),
                    ),
                  const SizedBox(height: 12),
                  ..._services.map((s) {
                    final pricing = [
                      if (s['fixedRate'] != null) loc.tr('fixed_price', params: {'price': '${s['fixedRate']}'}),
                      if (s['hourlyRate'] != null) loc.tr('hourly_price', params: {'price': '${s['hourlyRate']}'}),
                      if (s['dailyRate'] != null) loc.tr('daily_price', params: {'price': '${s['dailyRate']}'}),
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
                            Text(s['category']?['nameEn'] ?? loc.tr('service'), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: isBooked ? AppTheme.textSecondary : AppTheme.textPrimary)),
                            const SizedBox(height: 4),
                            Text(isBooked ? loc.tr('already_booked') : pricing, style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
                          ])),
                          ElevatedButton(
                            onPressed: isBooked ? null : () => _bookService(s),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: isBooked ? Colors.green : color,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            child: Text(isBooked ? loc.tr('booked') : loc.tr('book'), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                          ),
                        ]),
                      ),
                    );
                  }),
                  if (_reviews.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    Text(loc.tr('reviews_count', params: {'count': totalReviews.toString()}), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
                    const SizedBox(height: 12),
                    ..._reviews.map((r) => _buildReviewCard(r)),
                  ],
                ]),
              ),
        ),
      ]),
    );
  }

  Widget _buildReviewCard(Map review) {
    final customer = review['customer'];
    final user = customer?['user'] ?? {};
    final name = '${user['firstName'] ?? ''} ${user['lastName'] ?? ''}'.trim();
    final phone = user['phone'] ?? '';
    final rating = (review['rating'] as num).toDouble();
    final comment = review['comment'] as String?;
    final createdAt = review['createdAt'] as String?;

    String dateStr = '';
    if (createdAt != null) {
      try {
        final date = DateTime.parse(createdAt);
        dateStr = '${date.day}/${date.month}/${date.year}';
      } catch (_) {}
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 16,
                    backgroundColor: AppTheme.primary.withValues(alpha: 0.1),
                    child: Text(
                      name.isNotEmpty ? name[0].toUpperCase() : '?',
                      style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name.isNotEmpty ? name : phone,
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                      ),
                      if (dateStr.isNotEmpty)
                        Text(
                          dateStr,
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                        ),
                    ],
                  ),
                ],
              ),
              _buildStars(rating),
            ],
          ),
          if (comment != null && comment.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              comment,
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey.shade700,
                height: 1.4,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStars(double rating) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        final starNumber = index + 1;
        if (starNumber <= rating) {
          return const Icon(Icons.star_rounded, size: 16, color: Color(0xFFFFD600));
        } else if (starNumber - rating < 1) {
          return const Icon(Icons.star_half_rounded, size: 16, color: Color(0xFFFFD600));
        }
        return Icon(Icons.star_outline_rounded, size: 16, color: Colors.grey.shade300);
      }),
    );
  }
}
