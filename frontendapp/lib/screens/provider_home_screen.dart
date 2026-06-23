import 'package:flutter/material.dart';
import '../main.dart';
import '../services/api_service.dart';
import '../theme.dart';

class ProviderHomeScreen extends StatefulWidget {
  const ProviderHomeScreen({super.key});
  @override
  State<ProviderHomeScreen> createState() => _ProviderHomeScreenState();
}

class _ProviderHomeScreenState extends State<ProviderHomeScreen> {
  List _bookings = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _loadBookings(); }

  Future<void> _loadBookings() async {
    try {
      final data = await ApiService.get('/bookings/provider/me');
      if (mounted) setState(() { _bookings = data as List; _loading = false; });
    } catch (e) { if (mounted) setState(() => _loading = false); }
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

@override
  Widget build(BuildContext context) {
    final loc = DesiCompanyApp.localeProvider!;
    return Scaffold(
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(64),
        child: SafeArea(
          child: Container(
            decoration: const BoxDecoration(gradient: LinearGradient(
              begin: Alignment.topLeft, end: Alignment.bottomRight,
              colors: [Color(0xFF00BFA5), Color(0xFF009688)],
            )),
            child: Row(
              children: [
                const SizedBox(width: 12),
                IconButton(
                  icon: const Icon(Icons.refresh, color: Colors.white),
                  tooltip: loc.tr('header_refresh'),
                  onPressed: _loadBookings,
                ),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(loc.tr('provider_dashboard'),
                        style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(loc.tr('manage_bookings'),
                        style: const TextStyle(color: Colors.white70, fontSize: 12),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                Expanded(
                  flex: 2,
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _buildHeaderButton(Icons.work_outline, loc.tr('header_jobs'),
                          () => Navigator.pushNamed(context, '/provider-open-jobs')),
                        _buildHeaderButton(Icons.handyman, loc.tr('header_services'),
                          () => Navigator.pushNamed(context, '/provider-services')),
                        _buildHeaderButton(Icons.star_rate, loc.tr('header_reviews'),
                          () => Navigator.pushNamed(context, '/provider-reviews')),
                        _buildHeaderButton(Icons.verified_user, loc.tr('header_kyc'),
                          () => Navigator.pushNamed(context, '/provider-kyc-upload')),
                        _buildHeaderButton(Icons.card_membership, loc.tr('subscription_plans'),
                          () => Navigator.pushNamed(context, '/provider-subscriptions')),
                        _buildHeaderButton(Icons.account_balance_wallet, loc.tr('header_wallet'),
                          () => Navigator.pushNamed(context, '/wallet')),
                        _buildHeaderButton(Icons.feedback, loc.tr('my_quotes'),
                          () => Navigator.pushNamed(context, '/provider-my-quotes')),
                        _buildHeaderButton(Icons.logout, loc.tr('header_logout'),
                          () => Navigator.pushReplacementNamed(context, '/login')),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Colors.white))
          : Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF00BFA5), Color(0xFF009688)],
                ),
              ),
              child: _bookings.isEmpty
                ? Center(child: Container(
                    margin: const EdgeInsets.all(40),
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(loc.tr('no_bookings'),
                      style: const TextStyle(color: AppTheme.textSecondary, fontSize: 16),
                      textAlign: TextAlign.center,
                    ),
                  ))
                : Container(
                    decoration: const BoxDecoration(
                      color: Color(0xFFF5F0FF),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
                    ),
                    child: ListView.builder(
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
                            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, 4))],
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                                Expanded(
                                  child: Text('${loc.tr('booking_number')}${b['id'].toString().substring(0, 8)}',
                                    style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textPrimary, fontSize: 15),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                                  child: Text(_statusLabel(b['status'] ?? ''),
                                    style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.w600),
                                  ),
                                ),
                              ]),
                              const SizedBox(height: 8),
                              Row(children: [
                                const Icon(Icons.currency_rupee, size: 16, color: AppTheme.textSecondary),
                                Text('${b['totalAmount'] ?? 0}', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 14)),
                              ]),
                              const SizedBox(height: 12),
                              if (b['status'] == 'requested')
                                Row(children: [
                                  Expanded(child: ElevatedButton(
                                    onPressed: () => _updateStatus(b['id'], 'accepted'),
                                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF43A047), padding: const EdgeInsets.symmetric(vertical: 12)),
                                    child: Text(loc.tr('accept'), style: const TextStyle(fontSize: 13)),
                                  )),
                                  const SizedBox(width: 12),
                                  Expanded(child: OutlinedButton(
                                    onPressed: () => _updateStatus(b['id'], 'rejected'),
                                    style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFFE53935), side: const BorderSide(color: Color(0xFFE53935)), padding: const EdgeInsets.symmetric(vertical: 12)),
                                    child: Text(loc.tr('reject'), style: const TextStyle(fontSize: 13)),
                                  )),
                                ]),
                              if (b['status'] == 'accepted')
                                SizedBox(width: double.infinity, child: ElevatedButton(
                                  onPressed: () => _updateStatus(b['id'], 'on_the_way'),
                                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6C3FB4), padding: const EdgeInsets.symmetric(vertical: 12)),
                                  child: Text(loc.tr('on_the_way'), style: const TextStyle(fontSize: 13)),
                                )),
                              if (b['status'] == 'on_the_way')
                                SizedBox(width: double.infinity, child: ElevatedButton(
                                  onPressed: () => _updateStatus(b['id'], 'working'),
                                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF00BFA5), padding: const EdgeInsets.symmetric(vertical: 12)),
                                  child: Text(loc.tr('start_working'), style: const TextStyle(fontSize: 13)),
                                )),
                              if (b['status'] == 'working')
                                SizedBox(width: double.infinity, child: ElevatedButton(
                                  onPressed: () => _updateStatus(b['id'], 'completed'),
                                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1E88E5), padding: const EdgeInsets.symmetric(vertical: 12)),
                                  child: Text(loc.tr('mark_completed'), style: const TextStyle(fontSize: 13)),
                                )),
                              if (b['status'] == 'completed')
                                SizedBox(width: double.infinity, child: OutlinedButton.icon(
                                  onPressed: () {
                                    final customer = b['customer'];
                                    final customerUser = customer is Map ? customer['user'] : null;
                                    final customerName = customerUser is Map
                                      ? '${customerUser['firstName'] ?? ''} ${customerUser['lastName'] ?? ''}'.trim()
                                      : 'Customer';
                                    Navigator.pushNamed(context, '/provider-customer-feedback', arguments: {
                                      'bookingId': b['id'],
                                      'customerName': customerName,
                                      'providerName': 'Provider',
                                    });
                                  },
                                  icon: const Icon(Icons.feedback_outlined, size: 16),
                                  label: Text(loc.tr('private_feedback'), style: const TextStyle(fontSize: 13)),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: const Color(0xFF6C3FB4),
                                    side: const BorderSide(color: Color(0xFF6C3FB4)),
                                    padding: const EdgeInsets.symmetric(vertical: 12),
                                  ),
                                )),
                            ]),
                          ),
                        );
                      },
                    ),
                  ),
            ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 20, offset: const Offset(0, -4))],
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
              _navItem(Icons.book_online, loc.tr('nav_bookings'), true, () {}),
              _navItem(Icons.wallet, loc.tr('nav_wallet'), false, () => Navigator.pushNamed(context, '/wallet')),
              _navItem(Icons.chat, loc.tr('nav_chat'), false, () => Navigator.pushNamed(context, '/conversations')),
              _navItem(Icons.person, loc.tr('nav_profile'), false, () => Navigator.pushNamed(context, '/profile')),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _buildHeaderButton(IconData icon, String tooltip, VoidCallback onTap) {
    return Tooltip(
      message: tooltip,
      child: IconButton(
        icon: Icon(icon, color: Colors.white, size: 22),
        onPressed: onTap,
        constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
        padding: const EdgeInsets.all(6),
      ),
    );
  }

  Widget _navItem(IconData icon, String label, bool active, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, color: active ? const Color(0xFF00BFA5) : AppTheme.textSecondary, size: 24),
        const SizedBox(height: 4),
        Text(label, style: TextStyle(fontSize: 11, color: active ? const Color(0xFF00BFA5) : AppTheme.textSecondary)),
      ]),
    );
  }
}
