import 'dart:convert';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:permission_handler/permission_handler.dart';

class LocationService {
  static Future<bool> requestPermission() async {
    var status = await Permission.location.status;
    if (status.isGranted) return true;

    status = await Permission.location.request();
    if (status.isGranted) return true;

    if (status.isPermanentlyDenied) {
      openAppSettings();
    }
    return false;
  }

  static Future<Position?> getCurrentLocation() async {
    final hasPermission = await requestPermission();
    if (!hasPermission) return null;

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

  static Future<String> getAddressFromCoordinates(double lat, double lng) async {
    try {
      final url = Uri.parse(
        'https://nominatim.openstreetmap.org/reverse?format=json&lat=$lat&lon=$lng&zoom=14',
      );
      final response = await http.get(url, headers: {
        'User-Agent': 'DesiCompanyApp/1.0',
      });
      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        final address = data['address'] as Map<String, dynamic>? ?? {};
        // Build a readable location from address components
        final parts = <String>[];
        if (address['suburb'] != null) parts.add(address['suburb'].toString());
        if (address['city'] != null || address['town'] != null || address['village'] != null) {
          parts.add((address['city'] ?? address['town'] ?? address['village']).toString());
        } else if (address['county'] != null) {
          parts.add(address['county'].toString());
        }
        if (parts.isNotEmpty) return parts.join(', ');
        // Fallback to display_name (first part before comma)
        final displayName = data['display_name'] as String? ?? '';
        if (displayName.isNotEmpty) {
          return displayName.split(',').take(2).join(',');
        }
      }
    } catch (e) {
      // Ignore network errors
    }
    // Fallback to coordinates
    return '${lat.toStringAsFixed(4)}, ${lng.toStringAsFixed(4)}';
  }
}
