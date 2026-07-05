import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../l10n/strings.dart';
import '../services/api_service.dart';
import '../theme.dart';
import '../widgets/distance_badge.dart';

import 'package:desicompany/services/app_logger.dart';
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
    _loadReviews();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_distanceMeters == null) _calculateDistance();
  }

  void _calculateDistance() {
    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is Map && args['distance'] != null) {
      _distanceMeters = double.tryParse('${args['distance']}');
      return;
    }
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
      if (mounted) setState(() { _reviews = data is List ? data : []; });
    } catch (e, st) { AppLogger.e('provider_detail_screen', 'Operation failed', e, st); }
  }

  Future<void> _bookService(Map service) async {
    final loc = LocalizationProvider.of(context);
    DateTime? date;
    String? selectedSlot;
    List slots = [];
    bool loadingSlots = false;
    bool dateUnavailable = false;
    String? unavailableReason;
    bool submitting = false;
    String? submitError;
    final descriptionController = TextEditingController();
    final addressController = TextEditingController();
    final cityController = TextEditingController();

    final availabilities = (widget.provider['availabilities'] as List?) ?? [];
    final availableWeekdays = availabilities
        .map((a) => a['dayOfWeek'] as int?)
        .whereType<int>()
        .toSet();
    final hasSchedule = availableWeekdays.isNotEmpty;
    bool isDayAvailable(DateTime d) {
      if (!hasSchedule) return true;
      return availableWeekdays.contains(d.weekday % 7);
    }

    String _estimateText(Map svc) {
      if (svc['fixedRate'] != null) return 'Fixed price: ₹${svc['fixedRate']}';
      if (svc['hourlyRate'] != null) return 'From ₹${svc['hourlyRate']}/hr (final depends on hours)';
      if (svc['dailyRate'] != null) return 'From ₹${svc['dailyRate']}/day';
      return 'Price quoted by provider';
    }

    Future<void> refreshSlotsNow(DateTime picked, StateSetter setState, BuildContext dialogCtx) async {
      setState(() {
        selectedSlot = null;
        slots = [];
        loadingSlots = true;
        dateUnavailable = false;
        unavailableReason = null;
        submitError = null;
      });
      try {
        final dateStr = '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
        final data = await ApiService.get('/services/available-slots?providerId=${widget.provider['id']}&date=$dateStr');
        if (!dialogCtx.mounted) return;
        final isAvailable = data is Map ? (data['available'] ?? true) : true;
        final parsed = (data is Map ? data['slots'] : []) as List;
        setState(() {
          slots = parsed;
          loadingSlots = false;
          if (!isAvailable) {
            dateUnavailable = true;
            unavailableReason = data['reason'] as String?;
          }
        });
      } catch (e) {
        if (dialogCtx.mounted) setState(() => loadingSlots = false);
      }
    }

    final success = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: Text(loc.tr('book_service')),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (submitError != null)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.red.shade200),
                    ),
                    child: Row(children: [
                      Icon(Icons.error_outline, color: Colors.red.shade700, size: 18),
                      const SizedBox(width: 8),
                      Expanded(child: Text(submitError!, style: TextStyle(color: Colors.red.shade700, fontSize: 13))),
                    ]),
                  ),
                // Price estimate
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.blue.shade200),
                  ),
                  child: Row(children: [
                    const Icon(Icons.currency_rupee, color: Colors.blue, size: 18),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_estimateText(service), style: const TextStyle(color: Colors.blue, fontSize: 13))),
                  ]),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: descriptionController,
                  maxLines: 3,
                  decoration: InputDecoration(
                    hintText: loc.tr('describe_work_hint'),
                    filled: true,
                    fillColor: AppTheme.background,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.all(14),
                  ),
                ),
                const SizedBox(height: 16),
                InkWell(
                  onTap: submitting ? null : () async {
                    DateTime firstSelectable = DateTime.now().add(const Duration(days: 1));
                    if (hasSchedule) {
                      while (!isDayAvailable(firstSelectable) &&
                             firstSelectable.isBefore(DateTime.now().add(const Duration(days: 90)))) {
                        firstSelectable = firstSelectable.add(const Duration(days: 1));
                      }
                    }
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: firstSelectable,
                      firstDate: firstSelectable,
                      lastDate: DateTime.now().add(const Duration(days: 90)),
                      selectableDayPredicate: hasSchedule ? isDayAvailable : null,
                    );
                    if (picked != null) {
                      date = picked;
                      refreshSlotsNow(picked, setDialogState, ctx);
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
                      Icon(
                        date == null || dateUnavailable
                            ? Icons.calendar_today
                            : Icons.check_circle,
                        color: dateUnavailable ? Colors.orange : AppTheme.primary,
                        size: 20,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          date == null
                              ? loc.tr('preferred_date')
                              : '${date!.day}/${date!.month}/${date!.year}',
                          style: TextStyle(
                            fontWeight: FontWeight.w500,
                            color: date == null
                                ? AppTheme.textSecondary
                                : dateUnavailable
                                    ? Colors.orange
                                    : AppTheme.textPrimary,
                          ),
                        ),
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
                else if (dateUnavailable)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.orange.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.orange.shade200),
                    ),
                    child: Row(children: [
                      Icon(Icons.error_outline, color: Colors.orange.shade700, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          unavailableReason ?? 'Provider not available on this date',
                          style: TextStyle(color: Colors.orange.shade800, fontSize: 13),
                        ),
                      ),
                    ]),
                  )
                else if (date != null && slots.isEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.red.shade200),
                    ),
                    child: Row(children: [
                      Icon(Icons.event_busy, color: Colors.red.shade600, size: 20),
                      const SizedBox(width: 10),
                      Text('Fully booked for this date',
                          style: TextStyle(color: Colors.red.shade700, fontSize: 13)),
                    ]),
                  )
                else
                   Wrap(
                     spacing: 8,
                     runSpacing: 8,
                     children: slots.map((s) {
                       final start = s['start'] as String? ?? '';
                       final isBooked = s['booked'] == true;
                       final display = start.length >= 5
                          ? '${int.parse(start.split(':')[0]) > 12 ? int.parse(start.split(':')[0]) - 12 : (int.parse(start.split(':')[0]) == 0 ? 12 : int.parse(start.split(':')[0]))}:${start.split(':')[1]} ${int.parse(start.split(':')[0]) >= 12 ? 'PM' : 'AM'}'
                          : start;
                      final isSelected = selectedSlot == start;
                      return GestureDetector(
                        onTap: isBooked || submitting ? null : () => setDialogState(() { selectedSlot = start; submitError = null; }),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? AppTheme.primary
                                : isBooked
                                    ? Colors.red.shade50
                                    : Colors.green.shade50,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isSelected
                                  ? AppTheme.primary
                                  : isBooked
                                      ? Colors.red.shade200
                                      : Colors.green.shade200,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.circle,
                                size: 8,
                                color: isSelected
                                    ? Colors.white
                                    : isBooked
                                        ? Colors.red.shade400
                                        : Colors.green.shade600,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                display,
                                style: TextStyle(
                                  color: isSelected
                                      ? Colors.white
                                      : isBooked
                                          ? Colors.red.shade600
                                          : Colors.green.shade700,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13,
                                  decoration: isBooked ? TextDecoration.lineThrough : null,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: submitting ? null : () => Navigator.pop(ctx, false),
              child: Text(loc.tr('cancel')),
            ),
            submitting
                ? const Padding(
                    padding: EdgeInsets.all(12),
                    child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                  )
                : ElevatedButton(
                    onPressed: date == null || selectedSlot == null || dateUnavailable
                        ? null
                        : () async {
                            setDialogState(() { submitting = true; submitError = null; });
                            try {
                              await ApiService.post('/bookings', body: {
                                'customerId': 'me',
                                'providerId': widget.provider['id'],
                                'providerServiceId': service['id'],
                                'scheduledDate': '${date!.year}-${date!.month.toString().padLeft(2, '0')}-${date!.day.toString().padLeft(2, '0')}T${selectedSlot!}:00Z',
                                'description': descriptionController.text.trim(),
                                'serviceAddress': addressController.text.trim().isEmpty ? null : addressController.text.trim(),
                                'serviceCity': cityController.text.trim().isEmpty ? null : cityController.text.trim(),
                              });
                              if (!ctx.mounted) return;
                              Navigator.pop(ctx, true);
                            } catch (e) {
                              if (!ctx.mounted) return;
                              String msg;
                              if (e is ApiException && (e.statusCode == 400 || e.statusCode == 409)) {
                                msg = 'This slot was just booked. Please pick another.';
                                refreshSlotsNow(date!, setDialogState, ctx);
                              } else if (e is ApiException) {
                                msg = e.message;
                              } else {
                                msg = 'Booking failed. Please try again.';
                              }
                              setDialogState(() { submitting = false; submitError = msg; });
                            }
                          },
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

    if (success != true) return;
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(loc.tr('booking_requested'))));
    await Future.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;
    Navigator.pushNamed(context, '/my-bookings');
  }

  @override
  Widget build(BuildContext context) {
    final loc = LocalizationProvider.of(context);
    final p = widget.provider;
    final color = AppTheme.primary;
    final totalReviews = p['totalReviews'] ?? _reviews.length;
    return Scaffold(
      body: CustomScrollView(slivers: [
        SliverAppBar(
          expandedHeight: 200,
          pinned: true,
          flexibleSpace: FlexibleSpaceBar(
            background: Container(
              decoration: BoxDecoration(
                color: color,
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
                    child: Center(child: Text(('${p['firstName'] ?? ''}').isNotEmpty ? '${p['firstName']}'[0].toUpperCase() : '?', style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold))),
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
                          foregroundColor: AppTheme.primary,
                          side: const BorderSide(color: AppTheme.primary),
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
                        backgroundColor: AppTheme.primary,
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
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, 4))],
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: color.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  child: Icon(Icons.build, color: color, size: 28),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        s['category']?['nameEn'] ?? loc.tr('service'),
                                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.textPrimary),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 4),
                                      Text(pricing, style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton(
                                onPressed: () => _bookService(s),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: color,
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                ),
                                child: Text(loc.tr('book'), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                              ),
                            ),
                          ],
                        ),
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
    final rating = double.tryParse('${review['rating'] ?? '0'}') ?? 0.0;
    final comment = review['comment'] as String?;
    final createdAt = review['createdAt'] as String?;

    String name = '';
    if (customer is Map) {
      String firstName = customer['firstName']?.toString() ?? '';
      String lastName = customer['lastName']?.toString() ?? '';

      if (firstName.isEmpty && lastName.isEmpty) {
        final user = customer['user'];
        if (user is Map) {
          firstName = user['firstName']?.toString() ?? '';
          lastName = user['lastName']?.toString() ?? '';
        }
      }

      final fullName = '$firstName $lastName'.trim();
      if (fullName.isNotEmpty && !_looksLikePhoneNumber(fullName)) {
        name = fullName;
      }
    }

    String dateStr = '';
    if (createdAt != null) {
      try {
        final date = DateTime.parse(createdAt);
        dateStr = '${date.day}/${date.month}/${date.year}';
      } catch (e, st) { AppLogger.e('provider_detail_screen', 'Operation failed', e, st); }
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
                        name.isNotEmpty ? name : 'Customer',
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

  bool _looksLikePhoneNumber(String text) {
    final cleaned = text.replaceAll(RegExp(r'[\s\-\(\)\.]'), '');
    final digitCount = RegExp(r'\d').allMatches(cleaned).length;
    if (cleaned.length > 0 && digitCount / cleaned.length > 0.6) {
      return true;
    }
    if (text.startsWith('+') && RegExp(r'\d').allMatches(text).length >= 7) {
      return true;
    }
    if (cleaned.length >= 10 && digitCount >= 8) {
      return true;
    }
    return false;
  }
}
