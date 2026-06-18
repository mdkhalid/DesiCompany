import 'dart:math';
import 'package:flutter/material.dart';

class DistanceBadge extends StatelessWidget {
  final double? distanceMeters;

  const DistanceBadge({super.key, this.distanceMeters});

  static double? calculateDistance({
    required double lat1,
    required double lon1,
    required double lat2,
    required double lon2,
  }) {
    const earthRadius = 6371000;
    final dLat = _toRad(lat2 - lat1);
    final dLon = _toRad(lon2 - lon1);
    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_toRad(lat1)) * cos(_toRad(lat2)) *
        sin(dLon / 2) * sin(dLon / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return earthRadius * c;
  }

  static double _toRad(double deg) => deg * pi / 180;

  String _formatDistance(double meters) {
    final km = meters / 1000;
    if (km < 1) return '${meters.toStringAsFixed(0)} m from you';
    return '${km.toStringAsFixed(1)} km from you';
  }

  @override
  Widget build(BuildContext context) {
    if (distanceMeters == null) return const SizedBox.shrink();
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.place, size: 14, color: Colors.deepPurple.shade300),
        const SizedBox(width: 4),
        Text(
          _formatDistance(distanceMeters!),
          style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
        ),
      ],
    );
  }
}
