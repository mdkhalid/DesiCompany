import 'package:flutter/material.dart';
import '../main.dart';
import '../services/api_service.dart';
import '../services/app_presence_service.dart';
import '../services/notification_websocket_service.dart';
import '../models/user.dart';
import '../theme.dart';
import '../l10n/strings.dart';
import '../utils/id_helpers.dart';
import 'profile_picker_screen.dart';

import 'dart:async';
import 'package:desicompany/services/app_logger.dart';

class ProviderHomeScreen extends StatefulWidget {
  const ProviderHomeScreen({super.key});

  @override
  State<ProviderHomeScreen> createState() => _ProviderHomeScreenState();
}

class _ProviderHomeScreenState extends State<ProviderHomeScreen> {
  List _bookings = [];
  int _todayJobs = 0;
  double _todayEarnings = 0.0;
  int _pendingCount = 0;
  int _unreadCount = 0;
  bool _hasMultipleRoles = false;
  User? _currentUser;
  bool _loading = true;
  String _providerName = '';
  StreamSubscription<int>? _unreadCountSub;

  @override
  void initState() {
    super.initState();
    _loadBookings();
    _loadProviderName();
    _loadUnreadCount();
    AppPresenceService.connect();
    _unreadCountSub = NotificationWebSocketService.unreadCountStream.listen((count) {
      if (mounted) setState(() => _unreadCount = count);
    });
  }

  Future<void> _loadProviderName() async {
    try {
      final profile = await ApiService.get('/users/profile');
      if (!mounted) return;
      final provider = profile is Map ? profile['provider'] : null;
      if (provider is Map) {
        final first = (provider['firstName'] ?? '').toString();
        final last = (provider['lastName'] ?? '').toString();
        final name = '$first $last'.trim();
        if (name.isNotEmpty) {
          setState(() => _providerName = name);
        }
      }
      final roles = profile['roles'];
      final parsedRoles = roles is List ? roles.cast<String>() : <String>[];
      setState(() {
        _hasMultipleRoles = parsedRoles.length > 1;
        _currentUser = User.fromJson(Map<String, dynamic>.from(profile));
      });
    } catch (e, st) {
      AppLogger.e('provider_home_screen', 'Operation failed', e, st);
    }
  }

  Future<void> _loadUnreadCount() async {
    try {
      final data = await ApiService.get('/notifications/unread-count');
      if (mounted) setState(() => _unreadCount = data as int);
    } catch (e, st) {
      AppLogger.e('provider_home_screen', 'Operation failed', e, st);
    }
  }

  Future<void> _loadBookings() async {
    try {
      final data = await ApiService.get('/bookings/provider/me');
      if (mounted) setState(() {
        _bookings = data as List;
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _updateStatus(String id, String status) async {
    await ApiService.patch('/bookings/$id/status', body: {'status': status});
    _loadBookings();
  }

  Color _statusColor(String status) {
    return switch (status) {
      'requested' => const Color(0xFFFF6F00),
      'accepted' => const Color(0xFF1E88E5),
      'on_the_way' => const Color(0xFF6C3FB4),
      'working' => const Color(0xFF00BFA5),
      'completed' => const Color(0xFF43A047),
      'rejected' => const Color(0xFFE53935),
      _ => Colors.grey,
    };
  }

  String _statusLabel(String status) {
    return status.replaceAll('_', ' ').toUpperCase();
  }

  Widget _buildHeader() {
    final loc = DesiCompanyApp.localeProvider!;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                loc.tr('provider_dashboard'),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                loc.tr('manage_bookings'),
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ],
          ),
          Row(
            children: [
              if (_hasMultipleRoles) ...[
                GestureDetector(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ProfilePickerScreen(user: _currentUser!),
                      ),
                    ).then((_) {
                      _loadProviderName();
                      _loadUnreadCount();
                    });
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.swap_horiz, color: Colors.white, size: 14),
                        const SizedBox(width: 4),
                        Text(
                          loc.tr('switch_profile'),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              _buildNotificationButton(),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildIconButton(IconData icon, VoidCallback onTap, {String? tooltipKey}) {
    final loc = DesiCompanyApp.localeProvider!;
    final button = GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, color: Colors.white, size: 20),
      ),
    );
    if (tooltipKey == null) return button;
    return Tooltip(message: loc.tr(tooltipKey), child: button);
  }

  Widget _buildNotificationButton() {
    final loc = DesiCompanyApp.localeProvider!;
    return Tooltip(
      message: loc.tr('header_notifications'),
      child: GestureDetector(
        onTap: () async {
          await Navigator.pushNamed(context, '/notifications');
          _loadUnreadCount();
        },
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.notifications_outlined, color: Colors.white, size: 20),
            ),
            if (_unreadCount > 0)
              Positioned(
                right: -2,
                top: -2,
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(
                    color: Color(0xFFE53935),
                    shape: BoxShape.circle,
                  ),
                  child: Text(
                    _unreadCount > 9 ? '9+' : '$_unreadCount',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _unreadCountSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final loc = DesiCompanyApp.localeProvider!;
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      body: Container(
        color: const Color(0xFF66A3FF),
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(),
              Expanded(
                child: _loading
                    ? const Center(child: CircularProgressIndicator(color: Colors.white))
                    : _buildContent(loc),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: _buildBottomNav(),
    );
  }

  Widget _buildContent(LocalizationProvider loc) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFFF5F0FF),
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      child: _bookings.isEmpty
          ? Center(
              child: Container(
                margin: const EdgeInsets.all(40),
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  loc.tr('no_bookings'),
                  style: const TextStyle(color: AppTheme.textSecondary, fontSize: 16),
                  textAlign: TextAlign.center,
                ),
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 100),
              itemCount: _bookings.length,
              itemBuilder: (_, i) {
                final b = _bookings[i];
                final statusColor = _statusColor(b['status'] ?? '');
                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              '${loc.tr('booking_number')}${shortId(b['id']?.toString())}',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: AppTheme.textPrimary,
                                fontSize: 15,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: statusColor.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              _statusLabel(b['status'] ?? ''),
                              style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          const Icon(Icons.currency_rupee, size: 16, color: AppTheme.textSecondary),
                          Text(
                            '${b['totalAmount'] ?? 0}',
                            style: const TextStyle(color: AppTheme.textSecondary, fontSize: 14),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(Icons.schedule, size: 14, color: Colors.grey.shade500),
                          const SizedBox(width: 4),
                          Text(
                            _formatBookingDate(b['scheduledDate']?.toString()),
                            style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      if (b['status'] == 'requested')
                        Row(
                          children: [
                            Expanded(
                              child: ElevatedButton(
                                onPressed: () => _updateStatus(b['id'], 'accepted'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF43A047),
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                ),
                                child: Text(
                                  loc.tr('accept'),
                                  style: const TextStyle(fontSize: 13),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () => _updateStatus(b['id'], 'rejected'),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: const Color(0xFFE53935),
                                  side: const BorderSide(color: Color(0xFFE53935)),
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                ),
                                child: Text(
                                  loc.tr('reject'),
                                  style: const TextStyle(fontSize: 13),
                                ),
                              ),
                            ),
                          ],
                        ),
                      if (b['status'] == 'accepted')
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: () => _updateStatus(b['id'], 'on_the_way'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF6C3FB4),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            child: Text(
                              loc.tr('on_the_way'),
                              style: const TextStyle(fontSize: 13),
                            ),
                          ),
                        ),
                      if (b['status'] == 'on_the_way')
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: () => _updateStatus(b['id'], 'working'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF00BFA5),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            child: Text(
                              loc.tr('start_working'),
                              style: const TextStyle(fontSize: 13),
                            ),
                          ),
                        ),
                      if (b['status'] == 'working')
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: () => _updateStatus(b['id'], 'completed'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF1E88E5),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            child: Text(
                              loc.tr('mark_completed'),
                              style: const TextStyle(fontSize: 13),
                            ),
                          ),
                        ),
                      if (b['status'] == 'completed')
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton.icon(
                            onPressed: () {
                              final customer = b['customer'];
                              final customerName = customer is Map
                                  ? '${customer['firstName'] ?? ''} ${customer['lastName'] ?? ''}'.trim()
                                  : 'Customer';
                              Navigator.pushNamed(
                                context,
                                '/provider-customer-feedback',
                                arguments: {
                                  'bookingId': b['id'],
                                  'customerName': customerName,
                                  'providerName': _providerName.isNotEmpty ? _providerName : 'Provider',
                                },
                              );
                            },
                            icon: const Icon(Icons.feedback_outlined, size: 16),
                            label: Text(
                              loc.tr('private_feedback'),
                              style: const TextStyle(fontSize: 13),
                            ),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF6C3FB4),
                              side: const BorderSide(color: Color(0xFF6C3FB4)),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                          ),
                        ),
                    ]),
                  ),
                );
              },
            ),
    );
  }

  Widget _buildBottomNav() {
    final loc = DesiCompanyApp.localeProvider!;
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _navItem(Icons.assignment_outlined, 'Requests', true, () {}),
              _navItem(Icons.wallet, loc.tr('nav_wallet'), false, () => Navigator.pushNamed(context, '/wallet')),
              _navItem(Icons.chat, loc.tr('nav_chat'), false, () => Navigator.pushNamed(context, '/conversations')),
              _navItem(Icons.person, 'My Account', false, () => Navigator.pushNamed(context, '/my-account')),
            ],
          ),
        ),
      ),
    );
  }

  String _formatBookingDate(String? iso) {
    if (iso == null) return '';
    try {
      final dt = DateTime.parse(iso);
      final d = dt.day.toString().padLeft(2, '0');
      final m = dt.month.toString().padLeft(2, '0');
      final h = dt.hour.toString().padLeft(2, '0');
      final min = dt.minute.toString().padLeft(2, '0');
      return '$d/$m/${dt.year} $h:$min';
    } catch (_) {
      return '';
    }
  }

  Widget _navItem(IconData icon, String label, bool active, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            color: active ? AppTheme.primary : AppTheme.textSecondary,
            size: 24,
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              color: active ? AppTheme.primary : AppTheme.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
