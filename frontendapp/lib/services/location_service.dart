import 'dart:convert';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;

class LocationService {
  static Future<Position?> getCurrentLocation() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return null;

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return null;
    }
    if (permission == LocationPermission.deniedForever) return null;

    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );
    } catch (e) {
      return null;
    }
  }

  /// Returns a user-friendly hint when location fails (browser HTTP issue).
  static Future<String?> locationHint() async {
    try {
      final permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        return 'Location access denied. Allow location in your browser settings and try again.';
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.low,
          timeLimit: Duration(seconds: 3),
        ),
      );
      if (position != null) return null;
      return null;
    } catch (e) {
      final msg = e.toString().toLowerCase();
      if (msg.contains('insecure') || msg.contains('http')) {
        return 'Geolocation requires HTTPS. Use http://localhost:8080 instead of your LAN IP.';
      }
      return 'Location unavailable. Enable location in your browser settings.';
    }
  }

  static Future<String> getAddressFromCoordinates(
      double lat, double lng) async {
    try {
      for (final zoom in [18, 16, 14]) {
        final url = Uri.parse(
          'https://nominatim.openstreetmap.org/reverse?format=json&lat=$lat&lon=$lng&zoom=$zoom',
        );
        final response = await http.get(url, headers: {
          'User-Agent': 'DesiCompanyApp/1.0',
        });
        if (response.statusCode == 200) {
          final data = json.decode(response.body) as Map<String, dynamic>;
          final address = data['address'] as Map<String, dynamic>? ?? {};
          final parts = <String>[];
          final specific = address['neighbourhood'] ??
              address['suburb'] ??
              address['residential'] ??
              address['quarter'];
          if (specific != null) parts.add(specific.toString());
          final area = address['city_district'] ??
              address['city'] ??
              address['town'] ??
              address['village'] ??
              address['county'];
          if (area != null) parts.add(area.toString());
          if (zoom == 14 && parts.isEmpty) {
            final displayName = data['display_name'] as String? ?? '';
            if (displayName.isNotEmpty) {
              return displayName.split(',').take(2).join(',');
            }
            return '${lat.toStringAsFixed(4)}, ${lng.toStringAsFixed(4)}';
          }
          if (parts.isNotEmpty) return parts.join(', ');
        }
      }
    } catch (e) {
      // Ignore
    }
    return '${lat.toStringAsFixed(4)}, ${lng.toStringAsFixed(4)}';
  }
}
