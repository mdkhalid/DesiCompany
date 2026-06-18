import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme.dart';

class AdminReviewsScreen extends StatefulWidget {
  const AdminReviewsScreen({super.key});

  @override
  State<AdminReviewsScreen> createState() => _AdminReviewsScreenState();
}

class _AdminReviewsScreenState extends State<AdminReviewsScreen> {
  List _reviews = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadReviews();
  }

  Future<void> _loadReviews() async {
    try {
      final data = await ApiService.get('/admin/reviews');
      if (mounted) setState(() { _reviews = data as List; _loading = false; });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Widget _buildStars(double rating, {double size = 16}) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        final starNumber = index + 1;
        if (starNumber <= rating) {
          return Icon(Icons.star_rounded, size: size, color: const Color(0xFFFFD600));
        } else if (starNumber - rating < 1) {
          return Icon(Icons.star_half_rounded, size: size, color: const Color(0xFFFFD600));
        }
        return Icon(Icons.star_outline_rounded, size: size, color: Colors.grey.shade300);
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('All Reviews'),
        flexibleSpace: Container(decoration: AppTheme.gradientBackground),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _reviews.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.reviews_outlined, size: 64, color: Colors.grey.shade300),
                      const SizedBox(height: 16),
                      Text('No reviews yet', style: TextStyle(fontSize: 16, color: Colors.grey.shade500)),
                    ],
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
                  itemCount: _reviews.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final review = _reviews[index];
                    final customer = review['customer'];
                    final customerUser = customer?['user'] ?? {};
                    final customerName = '${customerUser['firstName'] ?? ''} ${customerUser['lastName'] ?? ''}'.trim();

                    final provider = review['provider'];
                    final providerUser = provider?['user'] ?? {};
                    final providerName = '${providerUser['firstName'] ?? ''} ${providerUser['lastName'] ?? ''}'.trim();

                    final rating = (review['rating'] as num).toDouble();
                    final comment = review['comment'] as String?;

                    String dateStr = '';
                    if (review['createdAt'] != null) {
                      try {
                        final date = DateTime.parse(review['createdAt']);
                        dateStr = '${date.day}/${date.month}/${date.year}';
                      } catch (_) {}
                    }

                    return Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, 4))],
                      ),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                          Row(children: [
                            CircleAvatar(
                              radius: 16,
                              backgroundColor: AppTheme.primary.withValues(alpha: 0.1),
                              child: Text(
                                customerName.isNotEmpty ? customerName[0].toUpperCase() : '?',
                                style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(customerName.isNotEmpty ? customerName : 'Anonymous', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                              if (dateStr.isNotEmpty)
                                Text(dateStr, style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                            ]),
                          ]),
                          _buildStars(rating),
                        ]),
                        const SizedBox(height: 10),
                        Row(children: [
                          const Icon(Icons.build, size: 14, color: AppTheme.textSecondary),
                          const SizedBox(width: 6),
                          Text(
                            providerName.isNotEmpty ? providerName : 'N/A',
                            style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                          ),
                        ]),
                        if (comment != null && comment.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Text(
                            comment,
                            style: TextStyle(fontSize: 14, color: Colors.grey.shade700, height: 1.4),
                          ),
                        ],
                      ]),
                    );
                  },
                ),
    );
  }
}
