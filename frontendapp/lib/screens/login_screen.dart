import 'package:flutter/material.dart';
import '../l10n/strings.dart';
import '../models/user.dart';
import '../services/auth_service.dart';
import '../services/push_notification_service.dart';
import '../theme.dart';
import 'profile_picker_screen.dart';
import 'role_selection_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  bool _otpSent = false;
  String _error = '';
  bool _loading = false;

  @override
  void dispose() {
    _phoneController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    final loc = LocalizationProvider.of(context);
    final phone = _phoneController.text.trim();
    if (phone.length != 10 || !RegExp(r'^\d{10}$').hasMatch(phone)) {
      setState(() => _error = loc.tr('invalid_phone'));
      return;
    }
    setState(() { _error = ''; _loading = true; });
    try {
      await AuthService.sendOtp(phone);
      setState(() { _otpSent = true; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _verifyOtp() async {
    final loc = LocalizationProvider.of(context);
    if (_otpController.text.trim().isEmpty) {
      setState(() => _error = loc.tr('enter_otp'));
      return;
    }
    setState(() { _error = ''; _loading = true; });
    try {
      final phone = _phoneController.text.trim();
      final otp = _otpController.text.trim();

      final response = await AuthService.verifyOtpAndSelectRole(phone, otp);
      if (!mounted) return;

      PushNotificationService.reconnect();

      if (response.user['role'] == 'admin') {
        await AuthService.verifyOtp(phone, otp);
        if (!mounted) return;
        Navigator.pushReplacementNamed(context, '/admin-home');
      } else {
        final user = User.fromJson(response.user);
        if (!mounted) return;
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => ProfilePickerScreen(
              user: user,
              phone: phone,
              otp: otp,
            ),
          ),
        );
      }
    } catch (e) {
      final errMsg = e.toString();
      if (errMsg.contains('User not found') || errMsg.contains('404')) {
        if (!mounted) return;
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => RoleSelectionScreen(
              phone: _phoneController.text.trim(),
              otp: _otpController.text.trim(),
            ),
          ),
        );
      } else {
        setState(() { _error = errMsg.replaceFirst('Exception: ', ''); _loading = false; });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final loc = LocalizationProvider.of(context);
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: AppTheme.gradientBackground,
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: 0.15)),
                  child: const Icon(Icons.handyman, size: 64, color: Colors.white),
                ),
                const SizedBox(height: 20),
                Text(loc.tr('app_name'), style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white, letterSpacing: 1.2)),
                const SizedBox(height: 4),
                Text(loc.tr('app_tagline'), style: TextStyle(fontSize: 14, color: Colors.white.withValues(alpha: 0.8))),
                const SizedBox(height: 40),
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 30, offset: const Offset(0, 10))],
                  ),
                  child: Column(children: [
                    if (_error.isNotEmpty)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(12)),
                        child: Text(_error, style: TextStyle(color: Colors.red.shade700, fontSize: 13)),
                      ),
                    if (!_otpSent)
                      Column(children: [
                        TextField(
                          controller: _phoneController,
                          decoration: InputDecoration(labelText: loc.tr('phone_hint'), prefixIcon: const Icon(Icons.phone_android)),
                          keyboardType: TextInputType.phone,
                          maxLength: 10,
                        ),
                        const SizedBox(height: 8),
                        SizedBox(
                          width: double.infinity,
                          height: 52,
                          child: ElevatedButton(
                            onPressed: _loading ? null : _sendOtp,
                            child: _loading ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Text(loc.tr('send_otp')),
                          ),
                        ),
                      ])
                    else
                      Column(children: [
                        Row(children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(color: AppTheme.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                            child: const Icon(Icons.check_circle, color: AppTheme.secondary, size: 20),
                          ),
                          const SizedBox(width: 12),
                          Expanded(child: Text(loc.tr('otp_sent', params: {'phone': _phoneController.text}), style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13))),
                        ]),
                        const SizedBox(height: 20),
                        TextField(
                          controller: _otpController,
                          decoration: InputDecoration(labelText: loc.tr('otp_hint'), prefixIcon: const Icon(Icons.lock_outline)),
                          keyboardType: TextInputType.number,
                          maxLength: 6,
                        ),
                        const SizedBox(height: 8),
                        SizedBox(
                          width: double.infinity,
                          height: 52,
                          child: ElevatedButton(
                            onPressed: _loading ? null : _verifyOtp,
                            child: _loading ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Text(loc.tr('verify_login')),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextButton(
                          onPressed: () => setState(() { _otpSent = false; _error = ''; _otpController.clear(); }),
                          child: Text(loc.tr('wrong_number')),
                        ),
                      ]),
                  ]),
                ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
