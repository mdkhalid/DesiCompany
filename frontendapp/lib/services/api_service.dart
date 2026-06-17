import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const String baseUrl = 'http://localhost:3000/api/v1';

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

  static Future<dynamic> get(String path) async {
    final res = await http.get(Uri.parse('$baseUrl$path'), headers: await _headers());
    if (res.statusCode == 401) throw Exception('Unauthorized');
    if (res.statusCode >= 400) throw Exception('Request failed: ${res.body}');
    return jsonDecode(res.body);
  }

  static Future<dynamic> post(String path, {Map<String, dynamic>? body}) async {
    final res = await http.post(Uri.parse('$baseUrl$path'), headers: await _headers(), body: body != null ? jsonEncode(body) : null);
    if (res.statusCode == 401) throw Exception('Unauthorized');
    if (res.statusCode >= 400) throw Exception('Request failed: ${res.body}');
    return jsonDecode(res.body);
  }

  static Future<dynamic> patch(String path, {Map<String, dynamic>? body}) async {
    final res = await http.patch(Uri.parse('$baseUrl$path'), headers: await _headers(), body: body != null ? jsonEncode(body) : null);
    if (res.statusCode == 401) throw Exception('Unauthorized');
    if (res.statusCode >= 400) throw Exception('Request failed: ${res.body}');
    return jsonDecode(res.body);
  }
}
