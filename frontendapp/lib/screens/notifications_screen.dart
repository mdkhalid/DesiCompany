import 'package:flutter/material.dart';
import '../main.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../theme.dart';
import 'booking_detail_screen.dart';
import 'chat_screen.dart';

import 'package:desicompany/services/app_logger.dart';
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List _notifications = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    try {
      final data = await ApiService.get('/notifications');
      if (!mounted) return;
      setState(() {
        _notifications = data['notifications'] ?? [];
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markAsRead(String id) async {
    try {
      await ApiService.patch('/notifications/$id/read');
      _loadNotifications();
    } catch (e, st) { AppLogger.e('notifications_screen', 'Operation failed', e, st); }
  }

  Future<void> _markAllAsRead() async {
    try {
      await ApiService.patch('/notifications/read-all');
      _loadNotifications();
    } catch (e, st) { AppLogger.e('notifications_screen', 'Operation failed', e, st); }
  }

  Future<String?> _fetchPartnerName(String? userId, String? bookingId) async {
    if (bookingId != null) {
      try {
        final data = await ApiService.get('/bookings/$bookingId');
        if (data is Map) {
          final userRole = await AuthService.getUserRole();
          Map? partner;
          if (userRole == 'provider') {
            final customer = data['customer'];
            if (customer is Map) partner = customer['user'] as Map?;
          } else {
            final provider = data['provider'];
            if (provider is Map) partner = provider['user'] as Map?;
          }
          if (partner != null) {
            final first = partner['firstName'] as String? ?? '';
            final last = partner['lastName'] as String? ?? '';
            final name = '$first $last'.trim();
            if (name.isNotEmpty) return name;
          }
        }
      } catch (_) {}
    }
    if (userId != null) {
      try {
        final data = await ApiService.get('/users/$userId');
        if (data is Map) {
          final customer = data['customer'] as Map?;
          final provider = data['provider'] as Map?;
          final name = customer != null
              ? '${customer['firstName'] ?? ''} ${customer['lastName'] ?? ''}'.trim()
              : provider != null
                  ? '${provider['firstName'] ?? ''} ${provider['lastName'] ?? ''}'.trim()
                  : '';
          if (name.isNotEmpty) return name;
        }
      } catch (_) {}
    }
    return null;
  }

  void _handleTap(Map<String, dynamic> n) async {
    if (n['isRead'] != true) {
      _markAsRead(n['id']);
    }

    final metadata = n['metadata'];
    if (metadata is Map) {
      final type = metadata['type'] as String?;
      // Handle all chat-related notification types
      final isChatNotif = type == 'chat_quick_reply' ||
          type == 'chat_message' ||
          type == 'chat_image' ||
          type == 'chat_file' ||
          type == 'chat_quote' ||
          type == 'direct_message';

      if (isChatNotif) {
        final roomId = metadata['roomId'] as String?;
        final bookingId = metadata['bookingId'] as String?;
        final senderName = metadata['senderName'] as String?;
        // For booking-based chats: roomId is 'booking_<id>', or fallback to bookingId
        // For direct chats: roomId starts with 'direct_'
        final isDirect = roomId != null && roomId.startsWith('direct_');
        final effectiveBookingId = bookingId ?? (roomId != null && roomId.startsWith('booking_') ? roomId.replaceFirst('booking_', '') : null);

        if (isDirect) {
          final parts = roomId.split('_');
          final customerUserId = parts.length > 1 ? parts[1] : null;
          final providerEntityId = parts.length > 2 ? parts[2] : null;
          final userRole = await AuthService.getUserRole();
          final partnerId = userRole == 'provider' ? customerUserId : providerEntityId;
          if (!mounted) return;
          final resolvedName = senderName ?? (partnerId != null ? await _fetchPartnerName(partnerId, null) : null);
          if (partnerId != null) {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ChatScreen(
                  providerId: partnerId,
                  mode: 'direct',
                  providerName: resolvedName,
                ),
              ),
            );
          }
        } else if (effectiveBookingId != null) {
          if (!mounted) return;
          final resolvedName = senderName ?? await _fetchPartnerName(null, effectiveBookingId);
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => ChatScreen(
                bookingId: effectiveBookingId,
                mode: 'booking',
                providerName: resolvedName,
              ),
            ),
          );
        }
      } else if (metadata['bookingId'] != null) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => BookingDetailScreen(bookingId: metadata['bookingId']),
          ),
        );
      }
    }
  }

  IconData _notifIcon(String title) {
    if (title.toLowerCase().contains('accept')) return Icons.check_circle;
    if (title.toLowerCase().contains('reject')) return Icons.cancel;
    if (title.toLowerCase().contains('way')) return Icons.directions_car;
    if (title.toLowerCase().contains('start') || title.toLowerCase().contains('work')) return Icons.build;
    if (title.toLowerCase().contains('complet')) return Icons.task_alt;
    if (title.toLowerCase().contains('cancel')) return Icons.remove_circle_outline;
    return Icons.notifications;
  }

  Color _notifColor(String title) {
    if (title.toLowerCase().contains('accept')) return const Color(0xFF4CAF50);
    if (title.toLowerCase().contains('reject') || title.toLowerCase().contains('cancel')) return const Color(0xFFE53935);
    if (title.toLowerCase().contains('way')) return const Color(0xFF6C3FB4);
    if (title.toLowerCase().contains('start') || title.toLowerCase().contains('work')) return const Color(0xFF00BFA5);
    if (title.toLowerCase().contains('complet')) return const Color(0xFF1E88E5);
    return AppTheme.primary;
  }

  @override
  Widget build(BuildContext context) {
    final loc = DesiCompanyApp.localeProvider!;
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFF66A3FF),
        title: Text(loc.tr('notifications'), style: const TextStyle(color: Colors.white)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          TextButton(
            onPressed: _markAllAsRead,
            child: Text(loc.tr('read_all'), style: const TextStyle(color: Colors.white70)),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _notifications.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.notifications_none, size: 64, color: Colors.grey.shade300),
                      const SizedBox(height: 16),
                      Text(loc.tr('no_notifications'), style: TextStyle(fontSize: 16, color: Colors.grey.shade500)),
                    ],
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _notifications.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final n = _notifications[index];
                    final isRead = n['isRead'] == true;
                    return Material(
                      color: isRead ? Colors.white : AppTheme.primary.withValues(alpha: 0.04),
                      borderRadius: BorderRadius.circular(14),
                      child: Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: isRead ? Colors.grey.shade200 : AppTheme.primary.withValues(alpha: 0.2),
                          ),
                        ),
                        child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        onTap: () => _handleTap(n),
                        leading: Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: _notifColor(n['title'] ?? '').withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(_notifIcon(n['title'] ?? ''), color: _notifColor(n['title'] ?? ''), size: 22),
                        ),
                        title: Text(
                          n['title'] ?? '',
                          style: TextStyle(
                            fontWeight: isRead ? FontWeight.w500 : FontWeight.w600,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        subtitle: Text(
                          n['message'] ?? '',
                          style: TextStyle(fontSize: 13, color: Colors.grey.shade500),
                        ),
                        trailing: !isRead
                            ? GestureDetector(
                                onTap: () => _markAsRead(n['id']),
                                child: Container(
                                  width: 10,
                                  height: 10,
                                  decoration: const BoxDecoration(
                                    color: AppTheme.primary,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              )
                            : null,
                       ),
                      ),
                    );
                  },
                ),
    );
  }
}
