import 'dart:async';
import 'package:flutter/material.dart';
import '../services/api_service.dart';

class AdBanner extends StatefulWidget {
  final String placement;
  final String? categoryId;

  const AdBanner({super.key, this.placement = 'home_banner', this.categoryId});

  @override
  State<AdBanner> createState() => _AdBannerState();
}

class _AdBannerState extends State<AdBanner> {
  List<dynamic> _ads = [];
  int _currentIndex = 0;
  Timer? _autoRotate;
  Timer? _autoClose;
  Set<String> _recordedImpressions = {};
  bool _visible = true;

  @override
  void initState() {
    super.initState();
    _fetchAds();
  }

  @override
  void dispose() {
    _autoRotate?.cancel();
    _autoClose?.cancel();
    super.dispose();
  }

  @override
  void didUpdateWidget(AdBanner old) {
    super.didUpdateWidget(old);
    if (old.categoryId != widget.categoryId) {
      _fetchAds();
    }
  }

  Future<void> _fetchAds() async {
    try {
      final params = 'placement=${widget.placement}'
          '${widget.categoryId != null ? '&categoryId=${widget.categoryId}' : ''}';
      final ads = await ApiService.get('/advertisements/active?$params');
      if (!mounted) return;
      setState(() {
        _ads = (ads is List) ? ads : [];
        _currentIndex = 0;
      });
      if (_ads.isNotEmpty) {
        _recordImpression(_ads[0]);
        _startAutoRotate();
      }
    } catch (_) {
      // Ads silently fail — they are non-critical UI
    }
  }

  void _startAutoRotate() {
    _autoRotate?.cancel();
    if (_ads.length <= 1) return;
    _autoRotate = Timer.periodic(const Duration(seconds: 5), (timer) {
      if (!mounted || _ads.isEmpty) {
        timer.cancel();
        return;
      }
      setState(() {
        _currentIndex = (_currentIndex + 1) % _ads.length;
      });
      _recordImpression(_ads[_currentIndex]);
    });
  }

  Future<void> _recordImpression(dynamic ad) async {
    final id = ad['id'] as String?;
    if (id == null || _recordedImpressions.contains(id)) return;
    _recordedImpressions.add(id);
    try {
      await ApiService.post('/advertisements/$id/impression', body: {});
    } catch (_) {}
  }

  Future<void> _recordClick(dynamic ad) async {
    final id = ad['id'] as String?;
    if (id == null) return;
    try {
      await ApiService.post('/advertisements/$id/click', body: {});
    } catch (_) {}
  }

  void _handleTap(dynamic ad) {
    _recordClick(ad);
    final targetUrl = ad['targetUrl'] as String?;
    final targetScreen = ad['targetScreen'] as String?;
    if (targetUrl != null && targetUrl.isNotEmpty) {
      // External URLs would use url_launcher; for now just log
    }
    if (targetScreen != null && targetScreen.isNotEmpty) {
      Navigator.pushNamed(context, targetScreen);
    }
  }

  void _dismiss() {
    _autoClose?.cancel();
    _autoRotate?.cancel();
    setState(() => _visible = false);
  }

  @override
  Widget build(BuildContext context) {
    if (!_visible || _ads.isEmpty) return const SizedBox.shrink();

    final ad = _ads[_currentIndex];
    final title = ad['title'] as String? ?? '';
    final imageUrl = ad['imageUrl'] as String? ?? '';
    final showClose = ad['showCloseButton'] as bool? ?? true;
    final autoCloseSec = ad['autoCloseSeconds'] as int?;
    final bgColor = _parseColor(ad['backgroundColor']);
    final textColor = _parseColor(ad['textColor']);

    if (autoCloseSec != null && autoCloseSec > 0) {
      _autoClose?.cancel();
      _autoClose = Timer(Duration(seconds: autoCloseSec), _dismiss);
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: bgColor ?? const Color(0xFF4F46E5),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          InkWell(
            onTap: () => _handleTap(ad),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (imageUrl.isNotEmpty)
                  Image.network(
                    imageUrl,
                    height: 120,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const SizedBox(height: 4),
                  ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 40, 12),
                  child: Text(
                    title,
                    style: TextStyle(
                      color: textColor ?? Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (showClose)
            Positioned(
              top: 6,
              right: 6,
              child: GestureDetector(
                onTap: _dismiss,
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: Colors.black26,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.close, size: 16, color: Colors.white70),
                ),
              ),
            ),
          // Page indicator
          if (_ads.length > 1)
            Positioned(
              bottom: 8,
              right: 12,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(_ads.length, (i) {
                  final active = i == _currentIndex;
                  return Container(
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: active ? 8 : 6,
                    height: active ? 8 : 6,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: active ? Colors.white : Colors.white38,
                    ),
                  );
                }),
              ),
            ),
        ],
      ),
    );
  }

  Color? _parseColor(dynamic value) {
    if (value is String && value.startsWith('#') && value.length == 7) {
      final hex = value.substring(1);
      final intVal = int.tryParse('FF$hex', radix: 16);
      if (intVal != null) return Color(intVal);
    }
    return null;
  }
}
