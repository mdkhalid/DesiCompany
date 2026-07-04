import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme.dart';

class ProviderBusySlotsScreen extends StatefulWidget {
  const ProviderBusySlotsScreen({super.key});
  @override
  State<ProviderBusySlotsScreen> createState() => _ProviderBusySlotsScreenState();
}

class _ProviderBusySlotsScreenState extends State<ProviderBusySlotsScreen> {
  List _busySlots = [];
  bool _loading = true;
  String? _error;
  String? _providerId;

  @override
  void initState() {
    super.initState();
    _loadProviderId();
  }

  Future<void> _loadProviderId() async {
    try {
      final profile = await ApiService.get('/users/profile');
      final provider = profile['provider'] as Map?;
      final pid = provider?['id'] as String?;
      if (pid != null) {
        _providerId = pid;
        _loadBusySlots();
      }
    } catch (e) {
      if (mounted) setState(() { _error = 'Failed to load profile'; _loading = false; });
    }
  }

  Future<void> _loadBusySlots() async {
    if (_providerId == null) return;
    setState(() { _loading = true; _error = null; });
    try {
      final data = await ApiService.get('/services/busy-slots?providerId=$_providerId');
      if (mounted) setState(() { _busySlots = data as List; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _addBusySlot() async {
    DateTime? selectedDate;
    TimeOfDay? startTime;
    TimeOfDay? endTime;
    final reasonController = TextEditingController();
    final formKey = GlobalKey<FormState>();

    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Add Busy Slot'),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                InkWell(
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: ctx,
                      initialDate: DateTime.now().add(const Duration(days: 1)),
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 90)),
                    );
                    if (picked != null) setDialogState(() => selectedDate = picked);
                  },
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: BoxDecoration(
                      color: AppTheme.background,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(children: [
                      const Icon(Icons.calendar_today, color: AppTheme.primary, size: 20),
                      const SizedBox(width: 12),
                      Text(
                        selectedDate == null
                            ? 'Select date'
                            : '${selectedDate!.day}/${selectedDate!.month}/${selectedDate!.year}',
                        style: TextStyle(
                          color: selectedDate == null ? AppTheme.textSecondary : AppTheme.textPrimary,
                        ),
                      ),
                    ]),
                  ),
                ),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(
                    child: InkWell(
                      onTap: () async {
                        final picked = await showTimePicker(context: ctx, initialTime: TimeOfDay.now());
                        if (picked != null) setDialogState(() => startTime = picked);
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        decoration: BoxDecoration(
                          color: AppTheme.background,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(children: [
                          const Icon(Icons.schedule, color: AppTheme.primary, size: 20),
                          const SizedBox(width: 8),
                          Text(startTime == null ? 'Start' : startTime!.format(ctx)),
                        ]),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: InkWell(
                      onTap: () async {
                        final picked = await showTimePicker(context: ctx, initialTime: TimeOfDay.now());
                        if (picked != null) setDialogState(() => endTime = picked);
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        decoration: BoxDecoration(
                          color: AppTheme.background,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(children: [
                          const Icon(Icons.schedule, color: AppTheme.primary, size: 20),
                          const SizedBox(width: 8),
                          Text(endTime == null ? 'End' : endTime!.format(ctx)),
                        ]),
                      ),
                    ),
                  ),
                ]),
                const SizedBox(height: 12),
                TextField(
                  controller: reasonController,
                  decoration: const InputDecoration(
                    hintText: 'Reason (optional)',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: selectedDate == null || startTime == null || endTime == null
                  ? null
                  : () async {
                      try {
                        final dateStr = '${selectedDate!.year}-${selectedDate!.month.toString().padLeft(2, '0')}-${selectedDate!.day.toString().padLeft(2, '0')}';
                        final s = '${startTime!.hour.toString().padLeft(2, '0')}:${startTime!.minute.toString().padLeft(2, '0')}';
                        final e = '${endTime!.hour.toString().padLeft(2, '0')}:${endTime!.minute.toString().padLeft(2, '0')}';
                        await ApiService.post('/services/busy-slots', body: {
                          'providerId': _providerId,
                          'busyDate': dateStr,
                          'startTime': s,
                          'endTime': e,
                          'reason': reasonController.text.trim(),
                        });
                        if (!ctx.mounted) return;
                        Navigator.pop(ctx, true);
                      } catch (e) {
                        if (ctx.mounted) {
                          ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text('Error: $e')));
                        }
                      }
                    },
              child: const Text('Add'),
            ),
          ],
        ),
      ),
    );

    if (result == true) _loadBusySlots();
  }

  Future<void> _deleteBusySlot(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove Busy Slot'),
        content: const Text('Are you sure?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Remove')),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await ApiService.delete('/services/busy-slots/$id?providerId=$_providerId');
      _loadBusySlots();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF66A3FF),
        title: const Text('Busy Slots'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: _addBusySlot,
            tooltip: 'Add busy slot',
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('Error: $_error'))
              : _busySlots.isEmpty
                  ? const Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.event_busy, size: 64, color: Colors.grey),
                          SizedBox(height: 16),
                          Text('No busy slots set', style: TextStyle(color: Colors.grey, fontSize: 16)),
                          SizedBox(height: 8),
                          Text('Tap + to mark a time slot as busy', style: TextStyle(color: Colors.grey)),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadBusySlots,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _busySlots.length,
                        itemBuilder: (_, i) {
                          final slot = _busySlots[i];
                          final date = slot['busyDate'] ?? '';
                          final start = slot['startTime'] ?? '';
                          final end = slot['endTime'] ?? '';
                          final reason = slot['reason'] as String?;
                          return Card(
                            margin: const EdgeInsets.only(bottom: 8),
                            child: ListTile(
                              leading: Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: Colors.red.shade50,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Icon(Icons.block, color: Colors.red, size: 24),
                              ),
                              title: Text('$date  $start - $end', style: const TextStyle(fontWeight: FontWeight.w600)),
                              subtitle: reason != null && reason.isNotEmpty ? Text(reason) : null,
                              trailing: IconButton(
                                icon: const Icon(Icons.delete_outline, color: Colors.red),
                                onPressed: () => _deleteBusySlot(slot['id']),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
