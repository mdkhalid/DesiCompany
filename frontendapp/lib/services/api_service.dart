import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'auth_service.dart';

/// Typed exception for API errors with the HTTP status code.
class ApiException implements Exception {
  final int statusCode;
  final String message;
  final dynamic body;

  ApiException(this.statusCode, this.message, [this.body]);

  @override
  String toString() => message;

  bool get isNotFound => statusCode == 404;
  bool get isUnauthorized => statusCode == 401;
  bool get isConflict => statusCode == 409;
  bool get isBadRequest => statusCode == 400;
}

/// Whether Android emulator 10.0.2.2 routing is applicable.
bool get _isAndroid => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

class ApiService {
  /// Base URL for the backend API.
  ///
  /// Set via:
  ///   flutter run --dart-define=API_BASE_URL=http://192.168.1.10:3000/api/v1
  ///
  /// Defaults (dev only):
  ///   - Android emulator: http://10.0.2.2:3000/api/v1
  ///   - iOS simulator:   http://localhost:3000/api/v1
  ///   - Web/Chrome:      http://localhost:3000/api/v1
  ///   - Other (physical device): http://localhost:3000/api/v1
  ///
  /// For physical Android device, override with your computer's LAN IP.
  /// In release builds, API_BASE_URL must be provided via --dart-define.
  static const String _defaultBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  static String get baseUrl {
    if (_defaultBaseUrl.isNotEmpty) {
      return _defaultBaseUrl;
    }
    if (kReleaseMode) {
      throw StateError(
        'API_BASE_URL not set. Pass --dart-define=API_BASE_URL=https://your-api.com/api/v1 when building release.',
      );
    }
    if (_isAndroid) {
      return 'http://10.0.2.2:3000/api/v1';
    }
    return 'http://localhost:3000/api/v1';
  }

  static Future<String?> getToken() async {
    return AuthService.getToken();
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
    final queryIdx = pathPart.indexOf('?');
    if (queryIdx >= 0) {
      final cleanPath = pathPart.substring(0, queryIdx);
      final queryString = pathPart.substring(queryIdx + 1);
      return base.replace(path: '${base.path}$cleanPath', query: queryString);
    }
    return base.replace(path: '${base.path}$pathPart');
  }

  /// Send a request, automatically refreshing the access token on 401 and retrying once.
  static Future<http.Response> _sendWithRefresh(
    Future<http.Response> Function() send, {
    bool allowRefresh = true,
  }) async {
    final res = await send();
    if (res.statusCode == 401 && allowRefresh) {
      final newToken = await AuthService.refreshAccessToken();
      if (newToken != null) {
        return await send();
      }
    }
    return res;
  }

  static ApiException _buildException(http.Response res) {
    final body = res.body;
    String message;
    try {
      final json = jsonDecode(body);
      message = json['message'] ?? 'Request failed: $body';
    } catch (_) {
      message = 'Request failed (${res.statusCode})';
    }
    return ApiException(res.statusCode, message, body);
  }

  static Future<dynamic> get(String path) async {
    final res = await _sendWithRefresh(
      () async => http.get(_uri(path), headers: await _headers()),
    );
    if (res.statusCode == 304) return null;
    if (res.statusCode >= 400) throw _buildException(res);
    if (res.statusCode == 304) return null;
        if (res.statusCode >= 400) throw _buildException(res);
        if (res.statusCode == 304) return null;
        if (res.statusCode >= 400) throw _buildException(res);
        if (res.statusCode == 304) return null;
        if (res.statusCode >= 400) throw _buildException(res);
        if (res.statusCode == 304) return null;
        if (res.statusCode >= 400) throw _buildException(res);
        return jsonDecode(res.body);
  }

  static Future<dynamic> post(String path, {Map<String, dynamic>? body}) async {
    final res = await _sendWithRefresh(
      () async => http.post(
        _uri(path),
        headers: await _headers(),
        body: body != null ? jsonEncode(body) : null,
      ),
      allowRefresh: !path.endsWith('/auth/refresh'),
    );
    if (res.statusCode >= 400) throw _buildException(res);
    return jsonDecode(res.body);
  }

  static Future<dynamic> put(String path, {Map<String, dynamic>? body}) async {
    final res = await _sendWithRefresh(
      () async => http.put(
        _uri(path),
        headers: await _headers(),
        body: body != null ? jsonEncode(body) : null,
      ),
    );
    if (res.statusCode >= 400) throw _buildException(res);
    return jsonDecode(res.body);
  }

  static Future<dynamic> patch(String path, {Map<String, dynamic>? body}) async {
    final res = await _sendWithRefresh(
      () async => http.patch(
        _uri(path),
        headers: await _headers(),
        body: body != null ? jsonEncode(body) : null,
      ),
    );
    if (res.statusCode >= 400) throw _buildException(res);
    return jsonDecode(res.body);
  }

  static Future<dynamic> delete(String path, {Map<String, dynamic>? body}) async {
    final res = await _sendWithRefresh(
      () async => http.delete(
        _uri(path),
        headers: await _headers(),
        body: body != null ? jsonEncode(body) : null,
      ),
    );
    if (res.statusCode >= 400) throw _buildException(res);
    return jsonDecode(res.body);
  }
}
