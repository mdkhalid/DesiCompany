import 'package:flutter/material.dart';
import '../l10n/strings.dart';
import '../services/api_service.dart';
import '../theme.dart';

import 'package:desicompany/services/app_logger.dart';
class ProviderCustomerFeedbackScreen extends StatefulWidget {
  final String bookingId;
  final String customerName;
  final String providerName;

  const ProviderCustomerFeedbackScreen({
    super.key,
    required this.bookingId,
    required this.customerName,
    required this.providerName,
  });

  @override
  State<ProviderCustomerFeedbackScreen> createState() =>
      _ProviderCustomerFeedbackScreenState();
}

class _ProviderCustomerFeedbackScreenState
    extends State<ProviderCustomerFeedbackScreen> {
  int _rating = 0;
  final _commentController = TextEditingController();
  final Set<String> _selectedTags = <String>{};
  bool _submitting = false;

  List _previousFeedback = [];
  bool _loadingPrevious = true;

  static const List<Map<String, String>> _availableTags = [
    {'value': 'paid_on_time', 'key': 'paid_on_time'},
    {'value': 'cancelled_last_minute', 'key': 'cancelled_last_minute'},
    {'value': 'no_show', 'key': 'no_show'},
    {'value': 'rude_behavior', 'key': 'rude_behavior'},
    {'value': 'good_customer', 'key': 'good_customer'},
    {'value': 'changed_location', 'key': 'changed_location'},
  ];

  @override
  void initState() {
    super.initState();
    _loadPreviousFeedback();
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _loadPreviousFeedback() async {
    try {
      final data = await ApiService.get('/feedbacks/provider/me');
      final list = data is List ? data : (data is Map ? (data['items'] as List?) ?? [] : []);
      if (mounted) {
        setState(() {
          _previousFeedback = list;
          _loadingPrevious = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loadingPrevious = false);
      }
    }
  }

  Future<void> _submitFeedback() async {
    final loc = LocalizationProvider.of(context);
    if (_rating == 0 && _selectedTags.isEmpty && _commentController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(loc.tr('select_rating'))),
      );
      return;
    }

    setState(() => _submitting = true);

    try {
      await ApiService.post('/feedbacks', body: {
        'bookingId': widget.bookingId,
        if (_rating > 0) 'rating': _rating,
        if (_commentController.text.trim().isNotEmpty)
          'comment': _commentController.text.trim(),
        'tags': _selectedTags.toList(),
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(loc.tr('feedback_submitted'))),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(loc.tr('feedback_failed', params: {'error': e.toString()})),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final loc = LocalizationProvider.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(loc.tr('private_feedback')),
        flexibleSpace: Container(decoration: AppTheme.gradientBackground),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _buildBookingInfoCard(loc),
          const SizedBox(height: 20),
          _buildSectionTitle(loc.tr('how_was_experience', params: {'provider': widget.customerName})),
          const SizedBox(height: 12),
          _buildStarRating(),
          const SizedBox(height: 20),
          _buildSectionTitle(loc.tr('tell_us')),
          const SizedBox(height: 12),
          _buildCommentField(loc),
          const SizedBox(height: 20),
          _buildSectionTitle('Tags'),
          const SizedBox(height: 12),
          _buildTagChips(loc),
          const SizedBox(height: 28),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _submitting ? null : _submitFeedback,
              child: _submitting
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Text(loc.tr('submit_feedback')),
            ),
          ),
          const SizedBox(height: 32),
          _buildSectionTitle(loc.tr('previous_feedback')),
          const SizedBox(height: 12),
          _buildPreviousFeedbackList(loc),
        ],
      ),
    );
  }

  Widget _buildBookingInfoCard(LocalizationProvider loc) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF66A3FF),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppTheme.primary.withValues(alpha: 0.3),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: Colors.white.withValues(alpha: 0.2),
            child: Text(
              widget.customerName.isNotEmpty
                  ? widget.customerName[0].toUpperCase()
                  : '?',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.customerName,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${loc.tr('booking_number')}${widget.bookingId.substring(0, widget.bookingId.length.clamp(0, 8))}',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.85),
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  widget.providerName,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.85),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w600,
        color: AppTheme.textPrimary,
      ),
    );
  }

  Widget _buildStarRating() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
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
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(5, (index) {
          final starNumber = index + 1;
          return GestureDetector(
            onTap: () => setState(() => _rating = starNumber),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: Icon(
                starNumber <= _rating
                    ? Icons.star_rounded
                    : Icons.star_outline_rounded,
                size: 40,
                color: starNumber <= _rating
                    ? const Color(0xFFFF9800)
                    : Colors.grey.shade300,
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildCommentField(LocalizationProvider loc) {
    return Container(
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
      child: TextFormField(
        controller: _commentController,
        maxLines: 4,
        decoration: InputDecoration(
          hintText: loc.tr('tell_us'),
          hintStyle: TextStyle(color: Colors.grey.shade400),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide.none,
          ),
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.all(16),
        ),
      ),
    );
  }

  Widget _buildTagChips(LocalizationProvider loc) {
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _availableTags.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final tag = _availableTags[index];
          final value = tag['value']!;
          final label = loc.tr(tag['key']!);
          final selected = _selectedTags.contains(value);
          return FilterChip(
            label: Text(label),
            selected: selected,
            onSelected: (s) {
              setState(() {
                if (s) {
                  _selectedTags.add(value);
                } else {
                  _selectedTags.remove(value);
                }
              });
            },
            selectedColor: AppTheme.primary,
            backgroundColor: Colors.white,
            checkmarkColor: Colors.white,
            labelStyle: TextStyle(
              color: selected ? Colors.white : AppTheme.textPrimary,
              fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: BorderSide(
                color: selected ? AppTheme.primary : Colors.grey.shade300,
              ),
            ),
            elevation: selected ? 2 : 0,
          );
        },
      ),
    );
  }

  Widget _buildPreviousFeedbackList(LocalizationProvider loc) {
    if (_loadingPrevious) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (_previousFeedback.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Center(
          child: Text(
            loc.tr('no_previous_feedback'),
            style: TextStyle(fontSize: 14, color: Colors.grey.shade500),
          ),
        ),
      );
    }
    return Column(
      children: [
        for (final fb in _previousFeedback) ...[
          _buildFeedbackCard(fb, loc),
          const SizedBox(height: 10),
        ],
      ],
    );
  }

  Widget _buildFeedbackCard(Map feedback, LocalizationProvider loc) {
    final rating = double.tryParse('${feedback['rating'] ?? '0'}') ?? 0.0;
    final comment = feedback['comment'] as String?;
    final tags = (feedback['tags'] as List?)?.cast<String>() ?? [];
    final createdAt = feedback['createdAt'] as String?;
    final booking = feedback['booking'];

    String dateStr = '';
    if (createdAt != null) {
      try {
        final date = DateTime.parse(createdAt);
        dateStr = '${date.day}/${date.month}/${date.year}';
      } catch (e, st) { AppLogger.e('provider_customer_feedback_screen', 'Operation failed', e, st); }
    }

    String customerLabel = '';
    if (booking is Map) {
      final customer = booking['customer'];
      final user = customer is Map ? (customer['user'] as Map?) : null;
      if (user != null) {
        customerLabel = '${user['firstName'] ?? ''} ${user['lastName'] ?? ''}'.trim();
      }
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  customerLabel.isNotEmpty ? customerLabel : '—',
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
              ),
              if (dateStr.isNotEmpty)
                Text(
                  dateStr,
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                ),
            ],
          ),
              if (rating > 0) ...[
            const SizedBox(height: 6),
            Row(
              children: List.generate(5, (i) {
                final n = i + 1;
                return Icon(
                  n <= rating ? Icons.star_rounded : Icons.star_outline_rounded,
                  size: 16,
                  color: n <= rating
                      ? const Color(0xFFFF9800)
                      : Colors.grey.shade300,
                );
              }),
            ),
          ],
          if (tags.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: tags
                  .map((t) => Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppTheme.primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          _tagLabel(t, loc),
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppTheme.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ))
                  .toList(),
            ),
          ],
          if (comment != null && comment.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              comment,
              style: TextStyle(
                fontSize: 13,
                color: Colors.grey.shade700,
                height: 1.4,
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _tagLabel(String value, LocalizationProvider loc) {
    final entry = _availableTags.firstWhere(
      (t) => t['value'] == value,
      orElse: () => {'key': value},
    );
    return loc.tr(entry['key']!);
  }
}
