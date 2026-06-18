import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../theme.dart';

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
    final phone = _phoneController.text.trim();
    if (phone.length != 10 || !RegExp(r'^\d{10}$').hasMatch(phone)) {
      setState(() => _error = 'Enter a valid 10-digit phone number');
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
    if (_otpController.text.trim().isEmpty) {
      setState(() => _error = 'Enter the OTP');
      return;
    }
    setState(() { _error = ''; _loading = true; });
    try {
      final user = await AuthService.verifyOtp(_phoneController.text.trim(), _otpController.text.trim());
      if (!mounted) return;
      Navigator.pushReplacementNamed(context, user.isProvider ? '/provider-home' : '/customer-home');
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
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
                const Text('DesiCompany', style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white, letterSpacing: 1.2)),
                const SizedBox(height: 4),
                Text('Local Service Marketplace', style: TextStyle(fontSize: 14, color: Colors.white.withValues(alpha: 0.8))),
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
                          decoration: const InputDecoration(labelText: 'Phone Number', prefixIcon: Icon(Icons.phone_android)),
                          keyboardType: TextInputType.phone,
                          maxLength: 10,
                        ),
                        const SizedBox(height: 8),
                        SizedBox(
                          width: double.infinity,
                          height: 52,
                          child: ElevatedButton(
                            onPressed: _loading ? null : _sendOtp,
                            child: _loading ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Send OTP'),
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
                          Expanded(child: Text('OTP sent to ${_phoneController.text}', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13))),
                        ]),
                        const SizedBox(height: 20),
                        TextField(
                          controller: _otpController,
                          decoration: const InputDecoration(labelText: 'Enter OTP', prefixIcon: Icon(Icons.lock_outline)),
                          keyboardType: TextInputType.number,
                          maxLength: 6,
                        ),
                        const SizedBox(height: 8),
                        SizedBox(
                          width: double.infinity,
                          height: 52,
                          child: ElevatedButton(
                            onPressed: _loading ? null : _verifyOtp,
                            child: _loading ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Verify & Login'),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextButton(
                          onPressed: () => setState(() { _otpSent = false; _error = ''; _otpController.clear(); }),
                          child: const Text('← Wrong number? Edit phone'),
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
