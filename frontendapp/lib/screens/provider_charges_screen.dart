import 'package:flutter/material.dart';
import '../main.dart';
import '../services/api_service.dart';
import '../theme.dart';

class ProviderChargesScreen extends StatefulWidget {
  final String bookingId;

  const ProviderChargesScreen({super.key, required this.bookingId});

  @override
  State<ProviderChargesScreen> createState() => _ProviderChargesScreenState();
}

class _ProviderChargesScreenState extends State<ProviderChargesScreen> {
  List _charges = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);
    try {
      final booking = await ApiService.get('/bookings/${widget.bookingId}');
      final charges = booking['charges'] as List? ?? [];
      if (mounted) {
        setState(() {
          _charges = charges;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.toString(); });
    }
  }

  Future<void> _addCharge() async {
    final loc = DesiCompanyApp.localeProvider!;
    final descCtrl = TextEditingController();
    final amountCtrl = TextEditingController();
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Text(loc.tr('add_charge')),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(
            controller: descCtrl,
            decoration: InputDecoration(labelText: loc.tr('charge_description')),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: amountCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(labelText: loc.tr('charge_amount')),
          ),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(loc.tr('cancel'))),
          ElevatedButton(
            onPressed: () {
              final desc = descCtrl.text.trim();
              final amt = double.tryParse(amountCtrl.text.trim());
              if (desc.isEmpty || amt == null || amt <= 0) return;
              Navigator.pop(ctx, {'description': desc, 'amount': amt});
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
            child: Text(loc.tr('add_charge'), style: const TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (result == null) return;

    try {
      await ApiService.post('/bookings/charges', body: {
        'bookingId': widget.bookingId,
        'chargeType': result['description'] ?? 'extra',
        'amount': result['amount'],
        'description': result['description'],
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(loc.tr('charge_added'))),
        );
        _load();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${loc.tr('error')}: $e')),
        );
      }
    }
  }

  Future<void> _removeCharge(String chargeId) async {
    final loc = DesiCompanyApp.localeProvider!;
    try {
      await ApiService.delete('/bookings/charges/$chargeId');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(loc.tr('charge_removed'))),
        );
        _load();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${loc.tr('error')}: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final loc = DesiCompanyApp.localeProvider!;
    return Scaffold(
      appBar: AppBar(
        title: Text(loc.tr('my_charges')),
        backgroundColor: const Color(0xFF66A3FF),
        foregroundColor: Colors.white,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : _error != null
              ? Center(child: Text('${loc.tr('error')}: $_error'))
              : _charges.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.receipt_long_outlined, size: 64, color: AppTheme.primaryLight),
                          const SizedBox(height: 16),
                          Text(loc.tr('no_extra_charges'),
                              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 16)),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _charges.length,
                      itemBuilder: (_, i) {
                        final charge = _charges[i] as Map;
                        final chargeId = charge['id']?.toString() ?? '';
                        final desc = charge['description'] ?? charge['chargeType'] ?? '';
                        final amount = double.tryParse('${charge['amount'] ?? 0}') ?? 0;
                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          child: ListTile(
                            leading: Container(
                              width: 44, height: 44,
                              decoration: BoxDecoration(
                                color: AppTheme.primary.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(Icons.receipt, color: AppTheme.primary),
                            ),
                            title: Text(desc, style: const TextStyle(fontWeight: FontWeight.w600)),
                            trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                              Text('₹${amount.toStringAsFixed(0)}',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                              const SizedBox(width: 8),
                              IconButton(
                                icon: const Icon(Icons.delete_outline, color: AppTheme.error, size: 20),
                                onPressed: () => _removeCharge(chargeId),
                              ),
                            ]),
                          ),
                        );
                      },
                    ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addCharge,
        backgroundColor: AppTheme.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: Text(loc.tr('add_charge'), style: const TextStyle(color: Colors.white)),
      ),
    );
  }
}
