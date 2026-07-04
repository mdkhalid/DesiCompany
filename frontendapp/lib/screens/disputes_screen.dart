import 'package:flutter/material.dart';
import '../l10n/strings.dart';
import '../services/api_service.dart';

class DisputesScreen extends StatefulWidget {
  const DisputesScreen({super.key});
  @override
  State<DisputesScreen> createState() => _DisputesScreenState();
}

class _DisputesScreenState extends State<DisputesScreen> {
  List _bookings = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadBookings();
  }

  Future<void> _loadBookings() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService.get('/bookings/customer/me');
      if (!mounted) return;
      setState(() { _bookings = data as List; _loading = false; });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final loc = LocalizationProvider.of(context);
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF66A3FF),
        title: Text(loc.tr('disputes')),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadBookings,
              child: _bookings.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.gavel, size: 64, color: Colors.grey.shade400),
                          const SizedBox(height: 16),
                          Text(loc.tr('no_bookings'), style: TextStyle(color: Colors.grey.shade600)),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(8),
                      itemCount: _bookings.length,
                      itemBuilder: (ctx, i) => _buildBookingCard(_bookings[i], loc),
                    ),
            ),
    );
  }

  Widget _buildBookingCard(Map booking, LocalizationProvider loc) {
    final provider = booking['provider'] ?? {};
    final providerUser = provider['user'] ?? {};
    final providerName = '${providerUser['firstName'] ?? ''} ${providerUser['lastName'] ?? ''}'.trim();
    if (providerName.isEmpty) providerName.isNotEmpty ? providerName : 'Provider';
    final service = booking['providerService'] ?? {};
    final serviceName = service['name'] ?? booking['description'] ?? '';
    final amount = booking['totalAmount'] ?? 0;

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: Colors.orange.withValues(alpha: 0.1),
          child: const Icon(Icons.gavel, color: Colors.orange, size: 20),
        ),
        title: Text(serviceName, maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: Text('with $providerName • ₹$amount'),
        trailing: ElevatedButton(
          onPressed: () => _showRaiseDispute(booking, loc),
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.orange,
            foregroundColor: Colors.white,
            minimumSize: const Size(80, 32),
          ),
          child: Text(loc.tr('raise_dispute'), style: const TextStyle(fontSize: 12)),
        ),
      ),
    );
  }

  void _showRaiseDispute(Map booking, LocalizationProvider loc) {
    final reasonCtrl = TextEditingController();
    final provider = booking['provider'] ?? {};
    final providerUser = provider['user'] ?? {};
    final providerName = '${providerUser['firstName'] ?? ''} ${providerUser['lastName'] ?? ''}'.trim();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(ctx).viewInsets.bottom + 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.warning_amber_rounded, color: Colors.orange),
                const SizedBox(width: 8),
                Text(loc.tr('raise_dispute'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              '${loc.tr('booking_with')} $providerName',
              style: TextStyle(color: Colors.grey.shade600),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: reasonCtrl,
              maxLines: 5,
              decoration: InputDecoration(
                labelText: loc.tr('dispute_reason'),
                hintText: loc.tr('dispute_reason_hint'),
                border: const OutlineInputBorder(),
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              loc.tr('min_10_chars'),
              style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () async {
                  final reason = reasonCtrl.text.trim();
                  if (reason.length < 10) return;
                  Navigator.pop(ctx);
                  await _submitDispute(booking['id'], reason);
                },
                style: ElevatedButton.styleFrom(backgroundColor: Colors.orange),
                child: Text(loc.tr('submit_dispute')),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submitDispute(String bookingId, String reason) async {
    try {
      await ApiService.post('/disputes', body: {
        'bookingId': bookingId,
        'reason': reason,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Dispute submitted successfully'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        final msg = e.toString().contains('already exists')
            ? 'A dispute already exists for this booking'
            : 'Failed to submit dispute';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg), backgroundColor: Colors.red),
        );
      }
    }
  }
}
