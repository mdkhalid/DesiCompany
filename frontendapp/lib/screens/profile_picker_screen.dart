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
        // First: authenticate without role to avoid "User does not have this role"
        user = await AuthService.verifyOtp(widget.phone!, widget.otp!);
        // Then: add the role if user doesn't have it yet, or switch if they do
        if (user.roles.contains(role)) {
          if (user.role != role) {
            user = await AuthService.switchRole(role);
          }
        } else {
          user = await AuthService.addRole(role: role);
        }
      } else if (widget.user.roles.contains(role)) {
        user = await AuthService.switchRole(role);
      } else {
        user = await AuthService.addRole(role: role);
      }
      if (!mounted) return;
      PushNotificationService.reconnect();
      Navigator.of(context, rootNavigator: true).pushReplacementNamed(
        user.isProvider ? '/provider-home' : '/customer-home',
        arguments: user.isProvider ? const {'initialIndex': 1} : null,
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
                    color: const Color(0xFFFF7043),
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
                    color: const Color(0xFF00BFA5),
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
    required Color color,
  }) {
    final loc = LocalizationProvider.of(context);
    final textColor = isActive ? Colors.white : const Color(0xFF1E1E2E);
    final subTextColor = isActive ? Colors.white70 : Colors.grey.shade600;

    return GestureDetector(
      onTap: _loading ? null : onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isActive ? color : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isActive ? color : Colors.grey.shade200,
            width: isActive ? 2 : 1.5,
          ),
          boxShadow: [
            BoxShadow(
              color: isActive
                  ? color.withOpacity(0.25)
                  : Colors.black.withOpacity(0.06),
              blurRadius: isActive ? 16 : 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isActive
                    ? Colors.white.withOpacity(0.2)
                    : color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(icon, size: 32, color: isActive ? Colors.white : color),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Flexible(
                        child: Text(
                          title,
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.bold,
                            color: textColor,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (isActive) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.2),
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
                      ],
                      if (isNew) ...[
                        const SizedBox(width: 8),
                        Container(
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
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(description, style: TextStyle(fontSize: 13, color: subTextColor)),
                ],
              ),
            ),
            if (!isActive)
              Icon(Icons.arrow_forward_ios, size: 16, color: color),
          ],
        ),
      ),
    );
  }
}
