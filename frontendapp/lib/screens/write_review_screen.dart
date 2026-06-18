import 'package:flutter/material.dart';
import '../l10n/strings.dart';
import '../services/api_service.dart';
import '../theme.dart';

class WriteReviewScreen extends StatefulWidget {
  final String bookingId;
  final String providerName;
  final String providerId;

  const WriteReviewScreen({
    super.key,
    required this.bookingId,
    required this.providerName,
    required this.providerId,
  });

  @override
  State<WriteReviewScreen> createState() => _WriteReviewScreenState();
}

class _WriteReviewScreenState extends State<WriteReviewScreen> {
  int _rating = 0;
  final _commentController = TextEditingController();
  bool _submitting = false;
  bool _submitted = false;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _submitReview() async {
    final loc = LocalizationProvider.of(context);
    if (_rating == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(loc.tr('select_rating'))),
      );
      return;
    }

    setState(() => _submitting = true);

    try {
      await ApiService.post('/reviews', body: {
        'bookingId': widget.bookingId,
        'rating': _rating,
        if (_commentController.text.isNotEmpty)
          'comment': _commentController.text,
      });

      if (mounted) {
        setState(() => _submitted = true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(loc.tr('review_failed', params: {'error': e.toString()}))),
        );
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final loc = LocalizationProvider.of(context);
    if (_submitted) {
      return Scaffold(
        body: Container(
          decoration: AppTheme.gradientBackground,
          child: SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.check_circle, color: Colors.white, size: 64),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      loc.tr('thank_you'),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      loc.tr('review_submitted', params: {'provider': widget.providerName}),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.9),
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 32),
                    ElevatedButton(
                      onPressed: () => Navigator.pop(context),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: AppTheme.primary,
                      ),
                      child: Text(loc.tr('done')),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(loc.tr('write_review')),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Container(
        decoration: const BoxDecoration(
          color: Color(0xFFF5F0FF),
          borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
        ),
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              loc.tr('how_was_experience', params: {'provider': widget.providerName}),
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 24),
            _buildStarRating(),
            const SizedBox(height: 24),
            _buildRatingLabel(loc),
            const SizedBox(height: 24),
            _buildCommentField(loc),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: _submitting ? null : _submitReview,
                child: _submitting
                    ? const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(loc.tr('submit_review')),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStarRating() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(5, (index) {
        final starNumber = index + 1;
        return GestureDetector(
          onTap: () => setState(() => _rating = starNumber),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Icon(
              starNumber <= _rating ? Icons.star_rounded : Icons.star_outline_rounded,
              size: 48,
              color: starNumber <= _rating ? const Color(0xFFFF9800) : Colors.grey.shade300,
            ),
          ),
        );
      }),
    );
  }

  Widget _buildRatingLabel(LocalizationProvider loc) {
    final labels = {
      0: loc.tr('tap_to_rate'),
      1: loc.tr('poor'),
      2: loc.tr('fair'),
      3: loc.tr('good'),
      4: loc.tr('very_good'),
      5: loc.tr('excellent'),
    };
    return Center(
      child: Text(
        labels[_rating]!,
        style: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w500,
          color: _rating == 0 ? AppTheme.textSecondary : AppTheme.primary,
        ),
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
}
