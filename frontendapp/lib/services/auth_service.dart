import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import 'api_service.dart';

class AuthService {
  static Future<void> sendOtp(String phone) async {
    await ApiService.post('/auth/otp/request', body: {'phone': phone});
  }

  /// Register a new user (first-time flow). Requires a valid OTP.
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
    final prefs = await SharedPreferences.getInstance();
    final token = data['tokens']['accessToken'] as String;
    final refreshToken = data['tokens']['refreshToken'] as String?;
    final userData = data['user'] as Map<String, dynamic>;
    await prefs.setString('token', token);
    if (refreshToken != null) await prefs.setString('refresh_token', refreshToken);
    await prefs.setString('user_data', jsonEncode(userData));
    return User.fromJson(userData, token: token);
  }

  /// Switch the active role for the current session.
  /// Returns new tokens with the requested role.
  static Future<User> switchRole(String newRole) async {
    final data = await ApiService.post('/auth/switch-role', body: {
      'activeRole': newRole,
    });
    final prefs = await SharedPreferences.getInstance();
    final token = data['tokens']['accessToken'] as String;
    final refreshToken = data['tokens']['refreshToken'] as String?;

    // Update stored user data with new role
    final userDataStr = prefs.getString('user_data');
    if (userDataStr != null) {
      final userData = jsonDecode(userDataStr) as Map<String, dynamic>;
      userData['role'] = newRole;
      await prefs.setString('user_data', jsonEncode(userData));
    }

    await prefs.setString('token', token);
    if (refreshToken != null) await prefs.setString('refresh_token', refreshToken);
    return User.fromJson(
      jsonDecode(prefs.getString('user_data') ?? '{}') as Map<String, dynamic>,
      token: token,
    );
  }

  /// Add a new role to an already-authenticated user (no OTP needed).
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
    final prefs = await SharedPreferences.getInstance();
    final token = data['tokens']['accessToken'] as String;
    final refreshToken = data['tokens']['refreshToken'] as String?;
    final userData = data['user'] as Map<String, dynamic>;
    await prefs.setString('token', token);
    if (refreshToken != null) await prefs.setString('refresh_token', refreshToken);
    await prefs.setString('user_data', jsonEncode(userData));
    return User.fromJson(userData, token: token);
  }

  static Future<User> verifyOtp(String phone, String otp, {String? role}) async {
    final data = await ApiService.post('/auth/login', body: {
      'phone': phone,
      'otp': otp,
      if (role != null) 'role': role,
    });
    final prefs = await SharedPreferences.getInstance();
    final token = data['tokens']['accessToken'] as String;
    final refreshToken = data['tokens']['refreshToken'] as String?;
    final userData = data['user'] as Map<String, dynamic>;
    await prefs.setString('token', token);
    if (refreshToken != null) await prefs.setString('refresh_token', refreshToken);
    await prefs.setString('user_data', jsonEncode(userData));
    return User.fromJson(userData, token: token);
  }

  /// Verify OTP and return user info with available roles for role selection.
  static Future<VerifyOtpResponse> verifyOtpAndSelectRole(String phone, String otp) async {
    final data = await ApiService.post('/auth/verify-otp', body: {'phone': phone, 'otp': otp});
    return VerifyOtpResponse.fromJson(data);
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('refresh_token');
    await prefs.remove('user_data');
  }

  /// Exchange the stored refresh token for a new access token.
  /// Returns the new access token, or null if no refresh is possible.
  static Future<String?> refreshAccessToken() async {
    final prefs = await SharedPreferences.getInstance();
    final refreshToken = prefs.getString('refresh_token');
    if (refreshToken == null || refreshToken.isEmpty) return null;
    try {
      final data = await ApiService.post('/auth/refresh', body: {
        'refreshToken': refreshToken,
      });
      final tokens = data['tokens'] as Map<String, dynamic>?;
      final newAccess = tokens?['accessToken'] as String?;
      final newRefresh = tokens?['refreshToken'] as String?;
      if (newAccess != null) {
        await prefs.setString('token', newAccess);
      }
      if (newRefresh != null) {
        await prefs.setString('refresh_token', newRefresh);
      }
      return newAccess;
    } catch (_) {
      return null;
    }
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
