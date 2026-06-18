import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme.dart';

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
    } catch (e) {}
  }

  Future<void> _markAllAsRead() async {
    try {
      await ApiService.patch('/notifications/read-all');
      _loadNotifications();
    } catch (e) {}
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
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: AppTheme.primary,
        title: const Text('Notifications', style: TextStyle(color: Colors.white)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          TextButton(
            onPressed: _markAllAsRead,
            child: const Text('Read All', style: TextStyle(color: Colors.white70)),
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
                      Text('No notifications', style: TextStyle(fontSize: 16, color: Colors.grey.shade500)),
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
                    return Container(
                      decoration: BoxDecoration(
                        color: isRead ? Colors.white : AppTheme.primary.withValues(alpha: 0.04),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: isRead ? Colors.grey.shade200 : AppTheme.primary.withValues(alpha: 0.2),
                        ),
                      ),
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
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
                    );
                  },
                ),
    );
  }
}
