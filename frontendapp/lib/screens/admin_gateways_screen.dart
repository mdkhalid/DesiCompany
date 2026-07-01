import 'dart:convert';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme.dart';

import 'package:desicompany/services/app_logger.dart';
class AdminGatewaysScreen extends StatefulWidget {
  const AdminGatewaysScreen({super.key});

  @override
  State<AdminGatewaysScreen> createState() => _AdminGatewaysScreenState();
}

class _AdminGatewaysScreenState extends State<AdminGatewaysScreen> {
  List _gateways = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadGateways();
  }

  Future<void> _loadGateways() async {
    try {
      final data = await ApiService.get('/admin/payment-gateways');
      if (!mounted) return;
      setState(() {
        _gateways = data['gateways'] ?? data as List;
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  IconData _gatewayIcon(String type) {
    return switch (type.toLowerCase()) {
      'razorpay' => Icons.account_balance_wallet,
      'stripe' => Icons.credit_card,
      'cash' => Icons.money,
      _ => Icons.payment,
    };
  }

  Color _gatewayColor(String type) {
    return switch (type.toLowerCase()) {
      'razorpay' => const Color(0xFF2D89EF),
      'stripe' => const Color(0xFF635BFF),
      'cash' => const Color(0xFF4CAF50),
      _ => AppTheme.primary,
    };
  }

  String _maskCredentials(dynamic credentials) {
    if (credentials == null) return '****';
    try {
      final map = credentials is String ? jsonDecode(credentials) : credentials;
      if (map is Map && map.isNotEmpty) {
        final keys = map.keys.toList();
        if (keys.length == 1) return '${keys.first}: ****';
        return '${keys.first}: ****, ${keys.last}: ****';
      }
    } catch (e, st) { AppLogger.e('admin_gateways_screen', 'Operation failed', e, st); }
    return '****';
  }

  Future<void> _toggleActive(Map gateway) async {
    final isActive = gateway['isActive'] == true;
    try {
      await ApiService.patch('/admin/payment-gateways/${gateway['id']}', body: {'isActive': !isActive});
      _loadGateways();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to update status'), backgroundColor: AppTheme.error),
        );
      }
    }
  }

  Future<void> _setDefault(Map gateway) async {
    try {
      await ApiService.patch('/admin/payment-gateways/${gateway['id']}/default');
      _loadGateways();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Default gateway updated'), backgroundColor: AppTheme.secondary),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to set default'), backgroundColor: AppTheme.error),
        );
      }
    }
  }

  Future<void> _deleteGateway(Map gateway) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Delete Gateway'),
        content: Text('Remove "${gateway['name'] ?? ''}" permanently?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: AppTheme.error)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await ApiService.delete('/admin/payment-gateways/${gateway['id']}');
      _loadGateways();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to delete gateway'), backgroundColor: AppTheme.error),
        );
      }
    }
  }

  void _showEditDialog(Map gateway) {
    final nameCtrl = TextEditingController(text: gateway['name'] ?? '');
    final credCtrl = TextEditingController(
      text: gateway['credentials'] is Map ? jsonEncode(gateway['credentials']) : (gateway['credentials'] ?? ''),
    );
    bool isActive = gateway['isActive'] == true;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('Edit Gateway'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Icon(_gatewayIcon(gateway['type'] ?? ''), color: _gatewayColor(gateway['type'] ?? ''), size: 20),
                    const SizedBox(width: 8),
                    Text(gateway['type'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                  ],
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Name', hintText: 'e.g. Main Razorpay'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: credCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Credentials (JSON)',
                    hintText: '{"key_id": "...", "key_secret": "..."}',
                  ),
                  maxLines: 3,
                ),
                const SizedBox(height: 12),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Active'),
                  value: isActive,
                  activeThumbColor: AppTheme.secondary,
                  onChanged: (v) => setDialogState(() => isActive = v),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                Map<String, dynamic>? parsedCreds;
                try {
                  if (credCtrl.text.isNotEmpty) {
                    parsedCreds = jsonDecode(credCtrl.text) as Map<String, dynamic>;
                  }
                } catch (e, st) { AppLogger.e('admin_gateways_screen', 'Operation failed', e, st);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Invalid JSON in credentials'), backgroundColor: AppTheme.error),
                  );
                  return;
                }
                Navigator.pop(ctx);
                try {
                  await ApiService.patch('/admin/payment-gateways/${gateway['id']}', body: {
                    'name': nameCtrl.text,
                    'credentials': parsedCreds,
                    'isActive': isActive,
                  });
                  _loadGateways();
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Failed to update gateway'), backgroundColor: AppTheme.error),
                    );
                  }
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
              child: const Text('Save', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  void _showCreateDialog() {
    String type = 'razorpay';
    final nameCtrl = TextEditingController();
    final credCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('Add Gateway'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: type,
                  decoration: const InputDecoration(labelText: 'Type'),
                  borderRadius: BorderRadius.circular(12),
                  items: const [
                    DropdownMenuItem(value: 'razorpay', child: Text('Razorpay')),
                    DropdownMenuItem(value: 'stripe', child: Text('Stripe')),
                    DropdownMenuItem(value: 'cash', child: Text('Cash')),
                  ],
                  onChanged: (v) => setDialogState(() => type = v ?? type),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Name', hintText: 'e.g. Razorpay Production'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: credCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Credentials (JSON)',
                    hintText: '{"key_id": "...", "key_secret": "..."}',
                  ),
                  maxLines: 3,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                if (nameCtrl.text.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Name is required'), backgroundColor: AppTheme.error),
                  );
                  return;
                }
                Map<String, dynamic>? parsedCreds;
                try {
                  if (credCtrl.text.isNotEmpty) {
                    parsedCreds = jsonDecode(credCtrl.text) as Map<String, dynamic>;
                  }
                } catch (e, st) { AppLogger.e('admin_gateways_screen', 'Operation failed', e, st);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Invalid JSON in credentials'), backgroundColor: AppTheme.error),
                  );
                  return;
                }
                Navigator.pop(ctx);
                try {
                  await ApiService.post('/admin/payment-gateways', body: {
                    'type': type,
                    'name': nameCtrl.text,
                    'credentials': parsedCreds,
                  });
                  _loadGateways();
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Failed to create gateway'), backgroundColor: AppTheme.error),
                    );
                  }
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
              child: const Text('Create', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: AppTheme.primary,
        title: const Text('Payment Gateways', style: TextStyle(color: Colors.white)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showCreateDialog,
        backgroundColor: AppTheme.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Add Gateway', style: TextStyle(color: Colors.white)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _gateways.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.payment_outlined, size: 64, color: Colors.grey.shade300),
                      const SizedBox(height: 16),
                      Text('No payment gateways configured', style: TextStyle(fontSize: 16, color: Colors.grey.shade500)),
                      const SizedBox(height: 8),
                      Text('Tap + to add your first gateway', style: TextStyle(fontSize: 14, color: Colors.grey.shade400)),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadGateways,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
                    itemCount: _gateways.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final g = _gateways[index] as Map;
                      final isActive = g['isActive'] == true;
                      final isDefault = g['isDefault'] == true;
                      final gatewayType = g['type'] ?? '';
                      final iconColor = _gatewayColor(gatewayType);

                      return GestureDetector(
                        onTap: () => _showEditDialog(g),
                        child: Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.05),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
                            border: isDefault
                                ? Border.all(color: AppTheme.primary.withValues(alpha: 0.3), width: 2)
                                : null,
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      width: 48,
                                      height: 48,
                                      decoration: BoxDecoration(
                                        color: iconColor.withValues(alpha: 0.1),
                                        borderRadius: BorderRadius.circular(14),
                                      ),
                                      child: Icon(_gatewayIcon(gatewayType), color: iconColor, size: 24),
                                    ),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Expanded(
                                                child: Text(
                                                  g['name'] ?? '',
                                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16, color: AppTheme.textPrimary),
                                                ),
                                              ),
                                              if (isDefault)
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                                  decoration: BoxDecoration(
                                                    color: AppTheme.primary.withValues(alpha: 0.1),
                                                    borderRadius: BorderRadius.circular(8),
                                                  ),
                                                  child: const Text('DEFAULT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppTheme.primary)),
                                                ),
                                            ],
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            gatewayType.toUpperCase(),
                                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Colors.grey.shade500),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Switch(
                                      value: isActive,
                                      activeThumbColor: AppTheme.secondary,
                                      onChanged: (_) => _toggleActive(g),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: Colors.grey.shade50,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Text(
                                    _maskCredentials(g['credentials']),
                                    style: TextStyle(fontSize: 13, color: Colors.grey.shade500, fontFamily: 'monospace'),
                                  ),
                                ),
                                const SizedBox(height: 12),
                                Row(
                                  children: [
                                    if (!isDefault)
                                      Expanded(
                                        child: OutlinedButton.icon(
                                          onPressed: () => _setDefault(g),
                                          icon: const Icon(Icons.star_border, size: 16),
                                          label: const Text('Set as Default'),
                                          style: OutlinedButton.styleFrom(
                                            foregroundColor: AppTheme.primary,
                                            side: const BorderSide(color: AppTheme.primary),
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                            padding: const EdgeInsets.symmetric(vertical: 8),
                                          ),
                                        ),
                                      ),
                                    if (!isDefault) const SizedBox(width: 10),
                                    Expanded(
                                      child: OutlinedButton.icon(
                                        onPressed: () => _deleteGateway(g),
                                        icon: const Icon(Icons.delete_outline, size: 16),
                                        label: const Text('Delete'),
                                        style: OutlinedButton.styleFrom(
                                          foregroundColor: AppTheme.error,
                                          side: const BorderSide(color: AppTheme.error),
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                          padding: const EdgeInsets.symmetric(vertical: 8),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
