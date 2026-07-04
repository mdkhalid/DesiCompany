import 'package:flutter/material.dart';
import '../l10n/strings.dart';
import '../models/user.dart';
import '../services/auth_service.dart';
import '../services/push_notification_service.dart';

class ProfilePickerScreen extends StatefulWidget {
  final User user;
  final String? phone;
  final String? otp;

  const ProfilePickerScreen({
    super.key,
    required this.user,
    this.phone,
    this.otp,
  });

  @override
  State<ProfilePickerScreen> createState() => _ProfilePickerScreenState();
}

class _ProfilePickerScreenState extends State<ProfilePickerScreen> {
  bool _loading = false;
  String _error = '';

  bool get _isFromLogin => widget.phone != null && widget.otp != null;

  Future<void> _selectRole(String role) async {
    setState(() {
      _error = '';
      _loading = true;
    });

    try {
      User user;
      if (_isFromLogin) {
        user = await AuthService.verifyOtp(widget.phone!, widget.otp!, role: role);
      } else if (widget.user.roles.contains(role)) {
        user = await AuthService.switchRole(role);
      } else {
        user = await AuthService.addRole(role: role);
      }
      if (!mounted) return;
      PushNotificationService.reconnect();
      Navigator.pushReplacementNamed(
        context,
        user.isProvider ? '/provider-home' : '/customer-home',
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final loc = LocalizationProvider.of(context);

    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        color: const Color(0xFF66A3FF),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Logo area
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withValues(alpha: 0.15),
                    ),
                    child: const Icon(
                      Icons.swap_horiz,
                      size: 48,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    loc.tr('switch_profile_title'),
                    style: const TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    loc.tr('switch_profile_subtitle'),
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.white.withValues(alpha: 0.8),
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 32),

                  // Error
                  if (_error.isNotEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        _error,
                        style: TextStyle(
                          color: Colors.red.shade700,
                          fontSize: 13,
                        ),
                      ),
                    ),

                  // Currently active profile notice
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 20),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.info_outline,
                          size: 18,
                          color: Colors.white.withValues(alpha: 0.8),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '${loc.tr('current_profile')}: ${widget.user.role.toUpperCase()}',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.9),
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Customer card (always show)
                  _buildProfileCard(
                    icon: Icons.person_search_outlined,
                    title: loc.tr('customer_title'),
                    description: loc.tr('customer_desc'),
                    isActive: widget.user.role == 'customer',
                    isNew: !widget.user.canBeCustomer,
                    gradientColors: const [Color(0xFF66A3FF), Color(0xFF66A3FF)],
                    onTap: () => _selectRole('customer'),
                  ),
                  const SizedBox(height: 12),

                  // Provider card (always show)
                  _buildProfileCard(
                    icon: Icons.work_outline,
                    title: loc.tr('provider_title'),
                    description: loc.tr('provider_desc'),
                    isActive: widget.user.role == 'provider',
                    isNew: !widget.user.canBeProvider,
                    gradientColors: const [Color(0xFF00BFA5), Color(0xFF009688)],
                    onTap: () => _selectRole('provider'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildProfileCard({
    required IconData icon,
    required String title,
    required String description,
    required bool isActive,
    required bool isNew,
    required VoidCallback onTap,
    required List<Color> gradientColors,
  }) {
    final loc = LocalizationProvider.of(context);

    return GestureDetector(
      onTap: _loading ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeInOut,
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: isActive
              ? LinearGradient(
                  colors: gradientColors,
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : null,
          color: isActive ? null : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isActive ? gradientColors.first : Colors.grey.shade200,
            width: isActive ? 1 : 1.5,
          ),
          boxShadow: [
            BoxShadow(
              color: isActive
                  ? gradientColors.first.withValues(alpha: 0.25)
                  : Colors.black.withValues(alpha: 0.04),
              blurRadius: isActive ? 16 : 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            // Icon
            AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isActive
                    ? Colors.white.withValues(alpha: 0.2)
                    : gradientColors.first.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(
                icon,
                size: 32,
                color: isActive ? Colors.white : gradientColors.first,
              ),
            ),
            const SizedBox(width: 16),
            // Text
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: isActive ? Colors.white : const Color(0xFF1E1E2E),
                        ),
                      ),
                      if (isActive)
                        Container(
                          margin: const EdgeInsets.only(left: 8),
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            loc.tr('active').toUpperCase(),
                            style: const TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      if (isNew)
                        Container(
                          margin: const EdgeInsets.only(left: 8),
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.amber.shade400,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            loc.tr('new_label').toUpperCase(),
                            style: const TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: TextStyle(
                      fontSize: 13,
                      color: isActive
                          ? Colors.white.withValues(alpha: 0.85)
                          : Colors.grey.shade600,
                    ),
                  ),
                ],
              ),
            ),
            // Arrow
            if (!isActive)
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  shape: BoxShape.circle,
                ),
                child: _loading
                    ? SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: gradientColors.first,
                        ),
                      )
                    : Icon(
                        Icons.arrow_forward_ios,
                        size: 16,
                        color: gradientColors.first,
                      ),
              ),
          ],
        ),
      ),
    );
  }
}
