import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/user.dart';
import 'api_service.dart';

import 'package:desicompany/services/app_logger.dart';
class AuthService {
  static const _secureStorage = FlutterSecureStorage(
    aOptions: AndroidOptions(),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock_this_device,
    ),
  );

  // Keys
  static const _keyToken = 'token';
  static const _keyRefreshToken = 'refresh_token';
  static const _keyUserData = 'user_data';

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
    final token = data['tokens']['accessToken'] as String;
    final refreshToken = data['tokens']['refreshToken'] as String?;
    final userData = data['user'] as Map<String, dynamic>;
    await _secureStorage.write(key: _keyToken, value: token);
    if (refreshToken != null) await _secureStorage.write(key: _keyRefreshToken, value: refreshToken);
    await _secureStorage.write(key: _keyUserData, value: jsonEncode(userData));
    return User.fromJson(userData, token: token);
  }

  /// Switch the active role for the current session.
  /// Returns new tokens with the requested role.
  static Future<User> switchRole(String newRole) async {
    final data = await ApiService.post('/auth/switch-role', body: {
      'activeRole': newRole,
    });
    final token = data['tokens']['accessToken'] as String;
    final refreshToken = data['tokens']['refreshToken'] as String?;

    // Update stored user data with new role
    final userDataStr = await _secureStorage.read(key: _keyUserData);
    if (userDataStr != null) {
      final userData = jsonDecode(userDataStr) as Map<String, dynamic>;
      userData['role'] = newRole;
      await _secureStorage.write(key: _keyUserData, value: jsonEncode(userData));
    }

    await _secureStorage.write(key: _keyToken, value: token);
    if (refreshToken != null) await _secureStorage.write(key: _keyRefreshToken, value: refreshToken);
    final updatedDataStr = await _secureStorage.read(key: _keyUserData);
    return User.fromJson(
      jsonDecode(updatedDataStr ?? '{}') as Map<String, dynamic>,
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
    final token = data['tokens']['accessToken'] as String;
    final refreshToken = data['tokens']['refreshToken'] as String?;
    final userData = data['user'] as Map<String, dynamic>;
    await _secureStorage.write(key: _keyToken, value: token);
    if (refreshToken != null) await _secureStorage.write(key: _keyRefreshToken, value: refreshToken);
    await _secureStorage.write(key: _keyUserData, value: jsonEncode(userData));
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
    await _secureStorage.write(key: _keyToken, value: token);
    if (refreshToken != null) await _secureStorage.write(key: _keyRefreshToken, value: refreshToken);
    await _secureStorage.write(key: _keyUserData, value: jsonEncode(userData));
    return User.fromJson(userData, token: token);
  }

  /// Verify OTP and return user info with available roles for role selection.
  static Future<VerifyOtpResponse> verifyOtpAndSelectRole(String phone, String otp) async {
    final data = await ApiService.post('/auth/verify-otp', body: {'phone': phone, 'otp': otp});
    return VerifyOtpResponse.fromJson(data);
  }

  static Future<void> logout() async {
    await _secureStorage.delete(key: _keyToken);
    await _secureStorage.delete(key: _keyRefreshToken);
    await _secureStorage.delete(key: _keyUserData);
  }

  /// Exchange the stored refresh token for a new access token.
  /// Returns the new access token, or null if no refresh is possible.
  static Future<String?> refreshAccessToken() async {
    final refreshToken = await _secureStorage.read(key: _keyRefreshToken);
    if (refreshToken == null || refreshToken.isEmpty) return null;
    try {
      final data = await ApiService.post('/auth/refresh', body: {
        'refreshToken': refreshToken,
      });
      final tokens = data['tokens'] as Map<String, dynamic>?;
      final newAccess = tokens?['accessToken'] as String?;
      final newRefresh = tokens?['refreshToken'] as String?;
      if (newAccess != null) {
        await _secureStorage.write(key: _keyToken, value: newAccess);
      }
      if (newRefresh != null) {
        await _secureStorage.write(key: _keyRefreshToken, value: newRefresh);
      }
      return newAccess;
    } catch (e, st) {
      AppLogger.e('auth_service', 'Operation failed', e, st);
      return null;
    }
  }

  static Future<bool> isLoggedIn() async {
    final token = await _secureStorage.read(key: _keyToken);
    return token != null && token.isNotEmpty;
  }

  static Future<String?> getToken() async {
    return _secureStorage.read(key: _keyToken);
  }

  static Future<String?> getUserData() async {
    return _secureStorage.read(key: _keyUserData);
  }

  static Future<String?> getUserRole() async {
    final userData = await _secureStorage.read(key: _keyUserData);
    if (userData == null) return null;
    return (jsonDecode(userData) as Map)['role'] as String?;
  }

  static Future<String?> getUserId() async {
    final userData = await _secureStorage.read(key: _keyUserData);
    if (userData == null) return null;
    return (jsonDecode(userData) as Map)['id'] as String?;
  }

  static Future<String?> getProviderId() async {
    final userData = await _secureStorage.read(key: _keyUserData);
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
