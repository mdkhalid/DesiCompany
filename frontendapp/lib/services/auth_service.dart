import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import 'api_service.dart';

class AuthService {
  static Future<void> sendOtp(String phone) async {
    await ApiService.post('/auth/otp/request', body: {'phone': phone});
  }

  static Future<User> verifyOtp(String phone, String otp) async {
    final data = await ApiService.post('/auth/login', body: {'phone': phone, 'otp': otp});
    final prefs = await SharedPreferences.getInstance();
    final token = data['tokens']['accessToken'] as String;
    final userData = data['user'] as Map<String, dynamic>;
    await prefs.setString('token', token);
    await prefs.setString('user_data', jsonEncode(userData));
    return User.fromJson(userData, token: token);
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('user_data');
  }

  static Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.containsKey('token');
  }

  static Future<String?> getUserRole() async {
    final prefs = await SharedPreferences.getInstance();
    final userData = prefs.getString('user_data');
    if (userData == null) return null;
    return (jsonDecode(userData) as Map)['role'] as String?;
  }

  static Future<String?> getUserId() async {
    final prefs = await SharedPreferences.getInstance();
    final userData = prefs.getString('user_data');
    if (userData == null) return null;
    return (jsonDecode(userData) as Map)['id'] as String?;
  }
}
