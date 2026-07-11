import 'package:flutter/material.dart';
import 'package:intl/intl.dart' as intl;
import '../l10n/strings.dart';
import '../main.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/location_service.dart';
import '../theme.dart';
import '../widgets/distance_badge.dart';
import 'app_shell.dart';
import 'provider_submit_quote_screen.dart';
import 'provider_job_detail_screen.dart';

import 'package:desicompany/services/app_logger.dart';
class ProviderOpenJobsScreen extends StatefulWidget {
  const ProviderOpenJobsScreen({super.key});

  @override
  State<ProviderOpenJobsScreen> createState() => _ProviderOpenJobsScreenState();
}

class _ProviderOpenJobsScreenState extends State<ProviderOpenJobsScreen> {
  List<dynamic> _jobs = [];
  bool _loading = true;
  double? _latitude;
  double? _longitude;
  String? _providerId;
  static const double _radiusKm = 10;

  @override
  void initState() {
    super.initState();
    _loadJobs();
  }

  Future<void> _loadJobs() async {
    try {
      final position = await LocationService.getCurrentLocation();
      double? lat;
      double? lng;
      if (position != null) {
        lat = position.latitude;
        lng = position.longitude;
      }
      final params = <String, String>{
        'radiusKm': '$_radiusKm',
      };
      if (lat != null) params['lat'] = '$lat';
      if (lng != null) params['lng'] = '$lng';
      final query = params.entries.map((e) => '${e.key}=${e.value}').join('&');
      final data = await ApiService.get('/job-requests/open?$query');
      final providerId = await AuthService.getProviderId();
      if (!mounted) return;
      setState(() {
        _jobs = data as List;
        _latitude = lat;
        _longitude = lng;
        _providerId = providerId;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  String _formatDate(String? iso) {
    if (iso == null) return '';
    try {
      final dt = DateTime.parse(iso);
      return intl.DateFormat('d MMM yyyy').format(dt);
    } catch (e, st) { AppLogger.e('provider_open_jobs_screen', 'Operation failed', e, st);
      return '';
    }
  }

  String _relativeTime(String? iso, LocalizationProvider loc) {
    if (iso == null) return '';
    try {
      final dt = DateTime.parse(iso);
      final diff = DateTime.now().difference(dt);
      if (diff.inDays > 0) {
        return loc.tr('days_ago', params: {'days': '${diff.inDays}'});
      }
      if (diff.inHours > 0) {
        return loc.tr('hours_ago', params: {'hours': '${diff.inHours}'});
      }
      return _formatDate(iso);
    } catch (e, st) { AppLogger.e('provider_open_jobs_screen', 'Operation failed', e, st);
      return '';
    }
  }

  String _customerName(Map<String, dynamic>? customer) {
    if (customer == null) return '';
    final user = customer['user'] is Map ? customer['user'] as Map<String, dynamic> : null;
    if (user != null) {
      return '${user['firstName'] ?? ''} ${user['lastName'] ?? ''}'.trim();
    }
    return '${customer['firstName'] ?? ''} ${customer['lastName'] ?? ''}'.trim();
  }

  @override
  Widget build(BuildContext context) {
    final loc = DesiCompanyApp.localeProvider!;
    return Scaffold(
      body: Container(
        color: const Color(0xFF66A3FF),
        child: SafeArea(
          child: Column(children: [
            _buildAppBar(loc),
            Expanded(
              child: Container(
                margin: const EdgeInsets.only(top: 16),
                decoration: const BoxDecoration(
                  color: Color(0xFFF8F9FA),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
                ),
                child: RefreshIndicator(
                  onRefresh: _loadJobs,
                  child: _loading
                    ? const Center(child: CircularProgressIndicator())
                    : _jobs.isEmpty
                      ? ListView(
                          children: [
                            const SizedBox(height: 80),
                            _buildEmptyState(loc),
                          ],
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
                          itemCount: _jobs.length,
                          itemBuilder: (_, i) => _buildJobCard(_jobs[i], loc),
                        ),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _buildAppBar(LocalizationProvider loc) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 20, 0),
      child: Row(children: [
        IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => shellBack(context),
        ),
        const SizedBox(width: 4),
        Text(
          loc.tr('open_jobs'),
          style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
        ),
      ]),
    );
  }

  Widget _buildEmptyState(LocalizationProvider loc) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(children: [
          Icon(Icons.work_outline, size: 80, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          Text(
            loc.tr('no_open_jobs'),
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: Colors.grey.shade600,
            ),
          ),
        ]),
      ),
    );
  }

  Widget _buildJobCard(Map<String, dynamic> job, LocalizationProvider loc) {
    final category = job['category'] as Map<String, dynamic>?;
    final categoryName = category?['nameEn'] ?? '';
    final budgetMin = job['budgetMin'];
    final budgetMax = job['budgetMax'];
    final quotes = (job['quotes'] as List?) ?? [];
    final quotesCount = job['_count']?['quotes'] ?? quotes.length;
    final customer = job['customer'] as Map<String, dynamic>?;
    final customerName = _customerName(customer);
    final customerCity = (customer?['city'] ?? '').toString();
    final lat = double.tryParse('${job['latitude'] ?? ''}');
    final lng = double.tryParse('${job['longitude'] ?? ''}');
    double? distanceMeters;
    if (lat != null && lng != null && _latitude != null && _longitude != null) {
      distanceMeters = DistanceBadge.calculateDistance(
        lat1: _latitude!, lon1: _longitude!,
        lat2: lat, lon2: lng,
      );
    }
    final myQuote = quotes.firstWhere(
      (q) => q is Map && q['provider'] is Map && q['provider']['id'] == _providerId,
      orElse: () => null,
    );

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () async {
            await Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => ProviderJobDetailScreen(jobRequestId: job['id']),
              ),
            );
            if (mounted) _loadJobs();
          },
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  job['title'] ?? '',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textPrimary,
                    fontSize: 16,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (categoryName.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Row(children: [
                    const Icon(Icons.category_outlined, size: 14, color: AppTheme.textSecondary),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        categoryName,
                        style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ]),
                ],
                if ((job['description'] ?? '').toString().isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    job['description'] ?? '',
                    style: const TextStyle(fontSize: 13, color: AppTheme.textPrimary, height: 1.3),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                const SizedBox(height: 10),
                Wrap(
                  spacing: 12,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    if (customerName.isNotEmpty)
                      Row(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.person_outline, size: 14, color: AppTheme.textSecondary),
                        const SizedBox(width: 4),
                        Text(
                          customerName,
                          style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                        ),
                      ]),
                    if (customerCity.isNotEmpty || distanceMeters != null)
                      Row(mainAxisSize: MainAxisSize.min, children: [
                        if (distanceMeters != null)
                          DistanceBadge(distanceMeters: distanceMeters)
                        else if (customerCity.isNotEmpty)
                          Row(mainAxisSize: MainAxisSize.min, children: [
                            const Icon(Icons.place_outlined, size: 14, color: AppTheme.textSecondary),
                            const SizedBox(width: 4),
                            Text(customerCity, style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
                          ]),
                      ]),
                  ],
                ),
                const SizedBox(height: 8),
                Row(children: [
                  if (budgetMin != null || budgetMax != null) ...[
                    const Icon(Icons.currency_rupee, size: 14, color: AppTheme.textSecondary),
                    const SizedBox(width: 2),
                    Text(
                      '₹${budgetMin ?? '?'} - ₹${budgetMax ?? '?'}',
                      style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                    ),
                    const SizedBox(width: 12),
                  ],
                  const Icon(Icons.chat_bubble_outline, size: 14, color: AppTheme.textSecondary),
                  const SizedBox(width: 4),
                  Text(
                    quotesCount == 1
                      ? loc.tr('quotes_received', params: {'count': '$quotesCount'})
                      : loc.tr('quotes_count', params: {'count': '$quotesCount'}),
                    style: TextStyle(
                      fontSize: 13,
                      color: quotesCount > 0 ? AppTheme.primary : AppTheme.textSecondary,
                      fontWeight: quotesCount > 0 ? FontWeight.w600 : FontWeight.normal,
                    ),
                  ),
                ]),
                const SizedBox(height: 6),
                Row(children: [
                  const Icon(Icons.access_time, size: 14, color: AppTheme.textSecondary),
                  const SizedBox(width: 4),
                  Text(
                    _relativeTime(job['createdAt'], loc),
                    style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                  ),
                ]),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () async {
                      await Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => ProviderSubmitQuoteScreen(jobRequestId: job['id']),
                        ),
                      );
                      if (mounted) _loadJobs();
                    },
                    icon: Icon(
                      myQuote != null ? Icons.edit : Icons.send,
                      size: 16,
                    ),
                    label: Text(
                      myQuote != null ? loc.tr('edit_quote') : loc.tr('submit_quote'),
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: myQuote != null ? AppTheme.secondary : AppTheme.primary,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
