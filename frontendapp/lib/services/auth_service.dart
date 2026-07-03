import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import 'api_service.dart';

import 'package:desicompany/services/app_logger.dart';
class AuthService {
  // Keys
  static const _keyToken = 'auth_token';
  static const _keyRefreshToken = 'auth_refresh_token';
  static const _keyUserData = 'auth_user_data';

  static Future<void> sendOtp(String phone) async {
    await ApiService.post('/auth/otp/request', body: {'phone': phone});
  }

  static Future<User> register({
    required String phone,
    required String otp,
    required String role,
    String? firstName,
    String? lastName,
  }) async {
    final data = await ApiService.post('/auth/register', body: {
      'phone': phone,
      'otp': otp,
      'role': role,
      if (firstName != null && firstName.isNotEmpty) 'firstName': firstName,
      if (lastName != null && lastName.isNotEmpty) 'lastName': lastName,
    });
    final token = data['tokens']['accessToken'] as String;
    final refreshToken = data['tokens']['refreshToken'] as String?;
    final userData = data['user'] as Map<String, dynamic>;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyToken, token);
    if (refreshToken != null) await prefs.setString(_keyRefreshToken, refreshToken);
    await prefs.setString(_keyUserData, jsonEncode(userData));
    return User.fromJson(userData, token: token);
  }

  static Future<User> switchRole(String newRole) async {
    final data = await ApiService.post('/auth/switch-role', body: {
      'activeRole': newRole,
    });
    final token = data['tokens']['accessToken'] as String;
    final refreshToken = data['tokens']['refreshToken'] as String?;
    final prefs = await SharedPreferences.getInstance();

    final userDataStr = prefs.getString(_keyUserData);
    if (userDataStr != null) {
      final userData = jsonDecode(userDataStr) as Map<String, dynamic>;
      userData['role'] = newRole;
      await prefs.setString(_keyUserData, jsonEncode(userData));
    }

    await prefs.setString(_keyToken, token);
    if (refreshToken != null) await prefs.setString(_keyRefreshToken, refreshToken);
    final updatedDataStr = prefs.getString(_keyUserData);
    return User.fromJson(
      jsonDecode(updatedDataStr ?? '{}') as Map<String, dynamic>,
      token: token,
    );
  }

  static Future<User> addRole({
    required String role,
    String? firstName,
    String? lastName,
  }) async {
    final data = await ApiService.post('/auth/add-role', body: {
      'role': role,
      if (firstName != null && firstName.isNotEmpty) 'firstName': firstName,
      if (lastName != null && lastName.isNotEmpty) 'lastName': lastName,
    });
    final token = data['tokens']['accessToken'] as String;
    final refreshToken = data['tokens']['refreshToken'] as String?;
    final userData = data['user'] as Map<String, dynamic>;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyToken, token);
    if (refreshToken != null) await prefs.setString(_keyRefreshToken, refreshToken);
    await prefs.setString(_keyUserData, jsonEncode(userData));
    return User.fromJson(userData, token: token);
  }

  static Future<User> verifyOtp(String phone, String otp, {String? role}) async {
    final data = await ApiService.post('/auth/login', body: {
      'phone': phone,
      'otp': otp,
      if (role != null) 'role': role,
    });
    final token = data['tokens']['accessToken'] as String;
    final refreshToken = data['tokens']['refreshToken'] as String?;
    final userData = data['user'] as Map<String, dynamic>;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyToken, token);
    if (refreshToken != null) await prefs.setString(_keyRefreshToken, refreshToken);
    await prefs.setString(_keyUserData, jsonEncode(userData));
    return User.fromJson(userData, token: token);
  }

  static Future<VerifyOtpResponse> verifyOtpAndSelectRole(String phone, String otp) async {
    final data = await ApiService.post('/auth/verify-otp', body: {'phone': phone, 'otp': otp});
    return VerifyOtpResponse.fromJson(data);
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyToken);
    await prefs.remove(_keyRefreshToken);
    await prefs.remove(_keyUserData);
  }

  static Future<String?> refreshAccessToken() async {
    final prefs = await SharedPreferences.getInstance();
    final refreshToken = prefs.getString(_keyRefreshToken);
    if (refreshToken == null || refreshToken.isEmpty) return null;
    try {
      final data = await ApiService.post('/auth/refresh', body: {
        'refreshToken': refreshToken,
      });
      final tokens = data['tokens'] as Map<String, dynamic>?;
      final newAccess = tokens?['accessToken'] as String?;
      final newRefresh = tokens?['refreshToken'] as String?;
      if (newAccess != null) {
        await prefs.setString(_keyToken, newAccess);
      }
      if (newRefresh != null) {
        await prefs.setString(_keyRefreshToken, newRefresh);
      }
      return newAccess;
    } catch (e, st) {
      AppLogger.e('auth_service', 'Operation failed', e, st);
      return null;
    }
  }

  static Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_keyToken);
    return token != null && token.isNotEmpty;
  }

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyToken);
  }

  static Future<String?> getUserData() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyUserData);
  }

  static Future<String?> getUserRole() async {
    final prefs = await SharedPreferences.getInstance();
    final userData = prefs.getString(_keyUserData);
    if (userData == null) return null;
    return (jsonDecode(userData) as Map)['role'] as String?;
  }

  static Future<String?> getUserId() async {
    final prefs = await SharedPreferences.getInstance();
    final userData = prefs.getString(_keyUserData);
    if (userData == null) return null;
    return (jsonDecode(userData) as Map)['id'] as String?;
  }

  static Future<String?> getProviderId() async {
    final prefs = await SharedPreferences.getInstance();
    final userData = prefs.getString(_keyUserData);
    if (userData == null) return null;
    return (jsonDecode(userData) as Map)['providerId'] as String?;
  }
}

class VerifyOtpResponse {
  final Map<String, dynamic> user;
  final List<String> availableRoles;
  final String defaultRole;

  VerifyOtpResponse({
    required this.user,
    required this.availableRoles,
    required this.defaultRole,
  });

  factory VerifyOtpResponse.fromJson(Map<String, dynamic> json) {
    return VerifyOtpResponse(
      user: json['user'] as Map<String, dynamic>,
      availableRoles: (json['availableRoles'] as List).cast<String>(),
      defaultRole: json['defaultRole'] as String,
    );
  }
}
