import 'package:flutter/material.dart';
import '../main.dart';
import '../services/api_service.dart';
import '../services/app_presence_service.dart';
import '../services/location_service.dart';
import '../services/notification_websocket_service.dart';
import '../models/user.dart';
import '../theme.dart';
import '../l10n/strings.dart';
import '../utils/id_helpers.dart';
import 'profile_picker_screen.dart';

import 'dart:async';
import 'package:desicompany/services/app_logger.dart';

class ProviderHomeContent extends StatefulWidget {
  const ProviderHomeContent({super.key});

  @override
  State<ProviderHomeContent> createState() => _ProviderHomeContentState();
}

class _ProviderHomeContentState extends State<ProviderHomeContent> {
  List _bookings = [];
  int _unreadCount = 0;
  bool _hasMultipleRoles = false;
  User? _currentUser;
  bool _loading = true;
  String _providerName = '';
  double? _latitude;
  double? _longitude;
  String _locationText = 'Set location';
  StreamSubscription<int>? _unreadCountSub;
  Map<String, dynamic>? _graceStatus;

  @override
  void initState() {
    super.initState();
    _loadBookings();
    _loadProviderName();
    _loadUnreadCount();
    _loadGraceStatus();
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
        final lat = provider['latitude'];
        final lng = provider['longitude'];
        setState(() {
          if (name.isNotEmpty) _providerName = name;
          _latitude = lat is num ? lat.toDouble() : double.tryParse('${lat ?? ''}');
          _longitude = lng is num ? lng.toDouble() : double.tryParse('${lng ?? ''}');
        });
        // Reverse geocode to get location text
        if (_latitude != null && _longitude != null) {
          LocationService.getAddressFromCoordinates(_latitude!, _longitude!).then((addr) {
            if (mounted && addr.isNotEmpty) setState(() => _locationText = addr);
          });
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

  Future<void> _loadGraceStatus() async {
    try {
      final data = await ApiService.get('/provider-grace/status');
      if (mounted && data is Map) {
        setState(() => _graceStatus = Map<String, dynamic>.from(data));
      }
    } catch (e, st) {
      AppLogger.e('provider_home_screen', 'Failed to load grace status', e, st);
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
          GestureDetector(
            onTap: _showLocationPicker,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.location_on, color: Colors.white, size: 18),
                    ),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _locationText == 'Set location' ? loc.tr('set_location') : _locationText,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.8),
                            fontSize: 12,
                          ),
                        ),
                        Text(
                          loc.tr('provider_dashboard'),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
          Row(
            children: [
              if (_hasMultipleRoles) ...[
                GestureDetector(
                  onTap: () {
                    Navigator.of(context, rootNavigator: true).push(
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

  Future<void> _showLocationPicker() async {
    final cityController = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Set Your Location'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => Navigator.pop(ctx, 'gps'),
                icon: const Icon(Icons.my_location),
                label: const Text('Use Current Location (GPS)'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Row(children: [
              Expanded(child: Divider()),
              Padding(
                padding: EdgeInsets.symmetric(horizontal: 8),
                child: Text('OR', style: TextStyle(color: Colors.grey, fontSize: 12)),
              ),
              Expanded(child: Divider()),
            ]),
            const SizedBox(height: 16),
            TextField(
              controller: cityController,
              decoration: InputDecoration(
                hintText: 'Enter area, colony or landmark (e.g. Kanchan Kunj)',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  if (cityController.text.trim().isNotEmpty) {
                    Navigator.pop(ctx, cityController.text.trim());
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Find precise location'),
              ),
            ),
          ],
        ),
      ),
    );
    cityController.dispose();

    if (result == null) return;

    try {
      if (result == 'gps') {
        final pos = await LocationService.getCurrentLocation();
        if (pos == null) {
          final hint = await LocationService.locationHint();
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(hint ?? 'Could not detect location'),
                duration: const Duration(seconds: 5),
              ),
            );
          }
          return;
        }
        final geo = await LocationService.reverseGeocode(pos.latitude, pos.longitude);
        await ApiService.patch('/users/profile', body: {
          'latitude': pos.latitude,
          'longitude': pos.longitude,
          'locality': geo['locality'] ?? '',
          'city': geo['city'] ?? '',
        });
        if (mounted) {
          setState(() {
            _latitude = pos.latitude;
            _longitude = pos.longitude;
            _locationText = geo['label'] as String;
          });
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Location saved successfully!'),
            backgroundColor: Colors.green,
          ));
        }
      } else {
        final resolved = await LocationService.searchAddress(
          result,
          biasLat: _latitude,
          biasLng: _longitude,
        );
        if (resolved == null) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Location not found. Try a nearby colony or landmark.')),
            );
          }
          return;
        }
        final lat = resolved['latitude'] as double;
        final lon = resolved['longitude'] as double;
        final label = resolved['label'] as String;
        await ApiService.patch('/users/profile', body: {
          'latitude': lat,
          'longitude': lon,
          'locality': resolved['locality'] ?? '',
          'city': resolved['city'] ?? '',
        });
        if (mounted) {
          setState(() {
            _latitude = lat;
            _longitude = lon;
            _locationText = label;
          });
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Location set to $label'),
            backgroundColor: Colors.green,
          ));
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Location error: $e')));
      }
    } finally {
      if (mounted) setState(() {});
    }
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
    );
  }

  Widget _buildContent(LocalizationProvider loc) {
    final showGraceBanner = _graceStatus?['commissionWaivedActive'] == true;
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFFF5F0FF),
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      child: Column(
        children: [
          if (showGraceBanner)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: _buildGraceBanner(),
            ),
          Expanded(
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
                                  '${b['providerAmount'] ?? b['totalAmount'] ?? 0}',
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
                                    String customerName = 'Customer';
                                    if (customer is Map) {
                                      // Try direct firstName/lastName on customer
                                      String firstName = customer['firstName']?.toString() ?? '';
                                      String lastName = customer['lastName']?.toString() ?? '';
                                      
                                      // If empty, try nested user object
                                      if (firstName.isEmpty && lastName.isEmpty) {
                                        final user = customer['user'];
                                        if (user is Map) {
                                          firstName = user['firstName']?.toString() ?? '';
                                          lastName = user['lastName']?.toString() ?? '';
                                        }
                                      }
                                      
                                      final fullName = '$firstName $lastName'.trim();
                                      // Only use the name if it's not empty and doesn't look like a phone number
                                      if (fullName.isNotEmpty && !_looksLikePhoneNumber(fullName)) {
                                        customerName = fullName;
                                      }
                                    }
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
          ),
        ],
      ),
    );
  }

  Widget _buildGraceBanner() {
    final daysLeft = _graceStatus?['daysLeft'] ?? 0;
    final message = daysLeft == 1
        ? '0% commission today — your grace period ends soon!'
        : '0% commission · $daysLeft days left';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF43A047), Color(0xFF2E7D32)],
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          const Icon(Icons.celebration, color: Colors.white),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
          ),
        ],
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

  bool _looksLikePhoneNumber(String text) {
    // Remove common phone number formatting characters
    final cleaned = text.replaceAll(RegExp(r'[\s\-\(\)\.]'), '');
    
    // If it's mostly digits (more than 60% digits), it's likely a phone number
    final digitCount = RegExp(r'\d').allMatches(cleaned).length;
    if (cleaned.length > 0 && digitCount / cleaned.length > 0.6) {
      return true;
    }
    
    // If it starts with + and has many digits, it's a phone number
    if (text.startsWith('+') && RegExp(r'\d').allMatches(text).length >= 7) {
      return true;
    }
    
    // If it's very long and mostly numbers, it's likely a phone number
    if (cleaned.length >= 10 && digitCount >= 8) {
      return true;
    }
    
    return false;
  }
}
