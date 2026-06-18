import 'dart:convert';
import 'dart:io' show Platform;
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  /// Base URL for the backend API.
  ///
  /// Set via:
  ///   flutter run --dart-define=API_BASE_URL=http://192.168.1.10:3000/api/v1
  ///
  /// Defaults:
  ///   - Android emulator: http://10.0.2.2:3000/api/v1
  ///   - iOS simulator:   http://localhost:3000/api/v1
  ///   - Web/Chrome:      http://localhost:3000/api/v1
  ///   - Other (physical device): http://localhost:3000/api/v1
  ///
  /// For physical Android device, override with your computer's LAN IP.
  static const String _defaultBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  static String get baseUrl {
    if (_defaultBaseUrl.isNotEmpty) {
      return _defaultBaseUrl;
    }
    try {
      if (Platform.isAndroid) {
        // Android emulator routes 10.0.2.2 to host machine's localhost.
        return 'http://10.0.2.2:3000/api/v1';
      }
    } catch (_) {
      // Platform may not be available (e.g. web).
    }
    return 'http://localhost:3000/api/v1';
  }

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token');
  }

  static Future<Map<String, String>> _headers() async {
    final token = await getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  static Uri _uri(String path) {
    final base = Uri.parse(baseUrl);
    final pathPart = path.startsWith('/') ? path : '/$path';
    return base.replace(path: '${base.path}$pathPart');
  }

  static Future<dynamic> get(String path) async {
    final res = await http.get(_uri(path), headers: await _headers());
    if (res.statusCode == 401) throw Exception('Unauthorized');
    if (res.statusCode >= 400) throw Exception('Request failed: ${res.body}');
    return jsonDecode(res.body);
  }

  static Future<dynamic> post(String path, {Map<String, dynamic>? body}) async {
    final res = await http.post(
      _uri(path),
      headers: await _headers(),
      body: body != null ? jsonEncode(body) : null,
    );
    if (res.statusCode == 401) throw Exception('Unauthorized');
    if (res.statusCode >= 400) throw Exception('Request failed: ${res.body}');
    return jsonDecode(res.body);
  }

  static Future<dynamic> patch(String path, {Map<String, dynamic>? body}) async {
    final res = await http.patch(
      _uri(path),
      headers: await _headers(),
      body: body != null ? jsonEncode(body) : null,
    );
    if (res.statusCode == 401) throw Exception('Unauthorized');
    if (res.statusCode >= 400) throw Exception('Request failed: ${res.body}');
    return jsonDecode(res.body);
  }

  static Future<dynamic> delete(String path) async {
    final res = await http.delete(_uri(path), headers: await _headers());
    if (res.statusCode == 401) throw Exception('Unauthorized');
    if (res.statusCode >= 400) throw Exception('Request failed: ${res.body}');
    return jsonDecode(res.body);
  }
}