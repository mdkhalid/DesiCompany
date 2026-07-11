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
      await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.low,
          timeLimit: Duration(seconds: 3),
        ),
      );
      return null;
    } catch (e) {
      final msg = e.toString().toLowerCase();
      if (msg.contains('insecure') || msg.contains('http')) {
        return 'Geolocation requires HTTPS. Use http://localhost:8080 instead of your LAN IP.';
      }
      return 'Location unavailable. Enable location in your browser settings.';
    }
  }

  /// Builds the most human-readable label for a coordinate, preferring the
  /// most granular OSM component (sublocality/colony/block) and appending the
  /// nearest landmark when available. Falls back gracefully at every step.
  static Future<String> getAddressFromCoordinates(
      double lat, double lng) async {
    final result = await reverseGeocode(lat, lng);
    return result['label'] as String;
  }

  /// Reverse-geocodes a coordinate into a structured result containing the
  /// precise [label], granular [locality] (colony/sublocality, e.g.
  /// "Kanchan Kunj"), [city], and the coordinates. Always returns all keys;
  /// falls back to raw coordinates for [label] when geocoding fails.
  static Future<Map<String, dynamic>> reverseGeocode(
      double lat, double lng) async {
    for (final zoom in [18, 16, 14]) {
      try {
        final url = Uri.parse(
          'https://nominatim.openstreetmap.org/reverse?format=jsonv2'
          '&addressdetails=1&extratags=1&namedetails=1'
          '&lat=$lat&lon=$lng&zoom=$zoom',
        );
        final response = await http.get(url, headers: {
          'User-Agent': 'DesiCompanyApp/1.0',
        });
        if (response.statusCode != 200) continue;
        final data = json.decode(response.body) as Map<String, dynamic>?;
        if (data == null) continue;
        final address = data['address'] as Map<String, dynamic>? ?? {};
        final label = _buildLabel(address, data['display_name'] as String?);
        if (label.isNotEmpty) {
          return {
            'label': label,
            'locality': _granularOf(address),
            'city': _secondaryOf(address),
            'latitude': lat,
            'longitude': lng,
          };
        }
      } catch (e) {
        // Try the next zoom level
      }
    }
    return {
      'label': '${lat.toStringAsFixed(4)}, ${lng.toStringAsFixed(4)}',
      'locality': '',
      'city': '',
      'latitude': lat,
      'longitude': lng,
    };
  }

  /// Resolves a free-text query (city or colony name) to the most precise
  /// human-readable label via Nominatim's forward search.
  ///
  /// To avoid picking a distant same-named place (e.g. "Masjid Bilal" in
  /// Kashmir when the user is in Delhi), the search is biased toward the
  /// user's current [biasLat]/[biasLng] via a viewbox, and retries by
  /// progressively simpler token subsets when the full query fails.
  /// Returns null when nothing is found so callers can surface a message.
  static Future<Map<String, dynamic>?> searchAddress(
    String query, {
    double? biasLat,
    double? biasLng,
  }) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return null;

    // Try the full query first, then fall back to individual tokens
    // (handles "Kanchan Kunj, Masjid Bilal" which isn't a single feature).
    final attempts = <String>[trimmed];
    final tokens =
        trimmed.split(RegExp(r'[,\s]+')).where((t) => t.isNotEmpty).toList();
    if (tokens.length > 1) {
      // Most-specific token last (colony/landmark), then progressively fewer.
      for (int i = tokens.length; i >= 1; i--) {
        final sub = tokens.sublist(0, i).join(' ');
        if (sub != trimmed) attempts.add(sub);
      }
    }

    for (final attempt in attempts) {
      final result = await _searchOnce(attempt, biasLat, biasLng);
      if (result != null) return result;
    }
    return null;
  }

  static Future<Map<String, dynamic>?> _searchOnce(
    String query,
    double? biasLat,
    double? biasLng,
  ) async {
    try {
      final buffer = StringBuffer(
        'https://nominatim.openstreetmap.org/search?format=jsonv2'
        '&addressdetails=1&extratags=1&namedetails=1'
        '&limit=5&countrycodes=in&q=${Uri.encodeComponent(query)}',
      );
      // Bias results toward the user's current location when known.
      if (biasLat != null && biasLng != null) {
        // Viewbox ~±0.2° (~22km) around the user, ordered minLon,minLat,maxLon,maxLat.
        final minLon = (biasLng - 0.2).toStringAsFixed(6);
        final minLat = (biasLat - 0.2).toStringAsFixed(6);
        final maxLon = (biasLng + 0.2).toStringAsFixed(6);
        final maxLat = (biasLat + 0.2).toStringAsFixed(6);
        buffer.write('&viewbox=$minLon,$minLat,$maxLon,$maxLat&bounded=0');
      }
      final response = await http.get(
        Uri.parse(buffer.toString()),
        headers: {'User-Agent': 'DesiCompanyApp/1.0'},
      );
      if (response.statusCode != 200) return null;
      final data = json.decode(response.body);
      if (data is! List || data.isEmpty) return null;

      // Prefer the closest candidate to the bias point when available.
      Map<String, dynamic>? best;
      double bestDist = double.infinity;
      for (final hit in data) {
        final hitMap = hit as Map<String, dynamic>;
        final lat = double.tryParse('${hitMap['lat']}');
        final lon = double.tryParse('${hitMap['lon']}');
        if (lat == null || lon == null) continue;
        final address = hitMap['address'] as Map<String, dynamic>? ?? {};
        final label = _buildLabel(address, hitMap['display_name'] as String?);
        final candidate = {
          'latitude': lat,
          'longitude': lon,
          'label': label.isNotEmpty ? label : query,
          'locality': _granularOf(address),
          'city': _secondaryOf(address),
        };
        if (biasLat != null && biasLng != null) {
          final d = (lat - biasLat) * (lat - biasLat) +
              (lon - biasLng) * (lon - biasLng);
          if (d < bestDist) {
            bestDist = d;
            best = candidate;
          }
        } else if (best == null) {
          best = candidate;
        }
      }
      return best;
    } catch (e) {
      return null;
    }
  }

  /// Returns the most granular OSM component (colony/sublocality/block/...)
  /// to use as the precise [locality], or '' when none is available.
  static String _granularOf(Map<String, dynamic> address) {
    for (final key in const [
      'sublocality_level_1',
      'sublocality',
      'block',
      'borough',
      'neighbourhood',
      'residential',
      'quarter',
      'city_district',
    ]) {
      final v = address[key];
      if (v != null && '$v'.trim().isNotEmpty) return '$v'.trim();
    }
    return '';
  }

  /// Returns the secondary (area/city) OSM component, or '' when none.
  static String _secondaryOf(Map<String, dynamic> address) {
    for (final key in const [
      'suburb',
      'city',
      'town',
      'village',
      'county',
    ]) {
      final v = address[key];
      if (v != null && '$v'.trim().isNotEmpty) return '$v'.trim();
    }
    return '';
  }

  /// Composes a precise label from OSM address components.
  ///
  /// Priority for the granular part:
  ///   sublocality_level_1 / sublocality → block → borough →
  ///   neighbourhood / residential / quarter → city_district
  /// Then appends the nearest landmark (amenity/POI) when present.
  /// Falls back to suburb → city → town → village, and finally the
  /// coarse display_name so we never return an empty string.
  static String _buildLabel(
    Map<String, dynamic> address,
    String? displayName,
  ) {
    String? granular;
    for (final key in const [
      'sublocality_level_1',
      'sublocality',
      'block',
      'borough',
      'neighbourhood',
      'residential',
      'quarter',
      'city_district',
    ]) {
      final v = address[key];
      if (v != null && '$v'.trim().isNotEmpty) {
        granular = '$v'.trim();
        break;
      }
    }

    String? secondary;
    for (final key in const [
      'suburb',
      'city',
      'town',
      'village',
      'county',
    ]) {
      final v = address[key];
      if (v != null && '$v'.trim().isNotEmpty) {
        secondary = '$v'.trim();
        break;
      }
    }

    // Nearest landmark / POI (e.g. Masjid Bilal) for extra precision.
    String? landmark;
    final amenity = address['amenity'];
    if (amenity != null && '$amenity'.trim().isNotEmpty) {
      landmark = '$amenity'.trim();
    } else {
      final named = address['namedetails'] as Map<String, dynamic>?;
      final nameVal = named?.values.whereType<String>().where((s) => s.trim().isNotEmpty);
      if (nameVal != null && nameVal.isNotEmpty) {
        landmark = nameVal.first.trim();
      }
    }

    final parts = <String>[];
    if (granular != null) parts.add(granular);
    if (secondary != null && secondary != granular) parts.add(secondary);
    if (landmark != null && !parts.contains(landmark)) {
      parts.add('Near $landmark');
    }

    if (parts.isNotEmpty) return parts.join(', ');

    if (displayName != null && displayName.trim().isNotEmpty) {
      return displayName.split(',').take(2).join(',').trim();
    }
    return '';
  }
}
