import 'package:flutter/material.dart';
import 'package:intl/intl.dart' as intl;
import '../l10n/strings.dart';
import '../main.dart';
import '../services/api_service.dart';
import '../theme.dart';
import 'customer_post_job_screen.dart';
import 'customer_job_detail_screen.dart';

import 'package:desicompany/services/app_logger.dart';
class CustomerJobsScreen extends StatefulWidget {
  const CustomerJobsScreen({super.key});

  @override
  State<CustomerJobsScreen> createState() => _CustomerJobsScreenState();
}

class _CustomerJobsScreenState extends State<CustomerJobsScreen> {
  List<dynamic> _jobs = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadJobs();
  }

  Future<void> _loadJobs() async {
    try {
      final data = await ApiService.get('/job-requests/customer/me');
      if (!mounted) return;
      setState(() {
        _jobs = data as List;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Color _statusColor(String status) {
    return switch (status) {
      'open' => const Color(0xFF1E88E5),
      'quoted' => const Color(0xFFFF6F00),
      'accepted' => const Color(0xFF43A047),
      'cancelled' => const Color(0xFFE53935),
      'closed' => Colors.grey,
      _ => Colors.grey,
    };
  }

  String _formatDate(String? iso) {
    if (iso == null) return '';
    try {
      final dt = DateTime.parse(iso);
      return intl.DateFormat('d MMM yyyy').format(dt);
    } catch (e, st) { AppLogger.e('customer_jobs_screen', 'Operation failed', e, st);
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final loc = DesiCompanyApp.localeProvider!;
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: LinearGradient(
          begin: Alignment.topLeft, end: Alignment.bottomRight,
          colors: [Color(0xFF6C3FB4), Color(0xFF5E35B1), Color(0xFF7C4DFF)],
        )),
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
                          padding: const EdgeInsets.fromLTRB(20, 24, 20, 100),
                          itemCount: _jobs.length,
                          itemBuilder: (_, i) => _buildJobCard(_jobs[i], loc),
                        ),
                ),
              ),
            ),
          ]),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final result = await Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const CustomerPostJobScreen()),
          );
          if (result == true && mounted) _loadJobs();
        },
        backgroundColor: AppTheme.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: Text(loc.tr('post_a_job'), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
      ),
    );
  }

  Widget _buildAppBar(LocalizationProvider loc) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 20, 0),
      child: Row(children: [
        IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        const SizedBox(width: 4),
        Text(
          loc.tr('my_jobs'),
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
            loc.tr('no_jobs_yet'),
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
    final status = (job['status'] ?? 'open') as String;
    final statusColor = _statusColor(status);
    final category = job['category'] as Map<String, dynamic>?;
    final categoryName = category?['nameEn'] ?? '';
    final budgetMin = job['budgetMin'];
    final budgetMax = job['budgetMax'];
    final quotes = (job['quotes'] as List?) ?? [];
    final quotesCount = job['_count']?['quotes'] ?? quotes.length;

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
                builder: (_) => CustomerJobDetailScreen(jobRequestId: job['id']),
              ),
            );
            if (mounted) _loadJobs();
          },
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        job['title'] ?? '',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textPrimary,
                          fontSize: 16,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        status,
                        style: TextStyle(
                          color: statusColor,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                if (categoryName.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Row(children: [
                    const Icon(Icons.category_outlined, size: 14, color: AppTheme.textSecondary),
                    const SizedBox(width: 4),
                    Text(
                      categoryName,
                      style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                    ),
                  ]),
                ],
                const SizedBox(height: 10),
                Row(children: [
                  if (budgetMin != null || budgetMax != null) ...[
                    const Icon(Icons.currency_rupee, size: 14, color: AppTheme.textSecondary),
                    const SizedBox(width: 2),
                    Text(
                      '${budgetMin ?? '?'} - ₹${budgetMax ?? '?'}',
                      style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                    ),
                    const SizedBox(width: 12),
                  ],
                  const Icon(Icons.chat_bubble_outline, size: 14, color: AppTheme.textSecondary),
                  const SizedBox(width: 4),
                  Text(
                    loc.tr('quotes_count', params: {'count': '$quotesCount'}),
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
                    _formatDate(job['createdAt']),
                    style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                  ),
                ]),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
