import 'package:flutter/material.dart';
import '../l10n/strings.dart';
import '../main.dart';
import '../services/api_service.dart';
import '../theme.dart';

class ProviderScheduleScreen extends StatefulWidget {
  const ProviderScheduleScreen({super.key});

  @override
  State<ProviderScheduleScreen> createState() => _ProviderScheduleScreenState();
}

class _ProviderScheduleScreenState extends State<ProviderScheduleScreen> {
  String? _providerId;
  List<Map> _availabilities = [];
  List<Map> _overrides = [];
  bool _loading = true;
  bool _saving = false;
  String? _error;

  static const _dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() { _loading = true; _error = null; });
    }
    try {
      final profile = await ApiService.get('/users/profile');
      if (!mounted) return;
      final provider = profile is Map ? profile['provider'] : null;
      final pid = provider is Map ? provider['id']?.toString() : null;
      if (pid == null) {
        setState(() { _loading = false; _error = 'provider_id_missing'; });
        return;
      }
      _providerId = pid;
      final results = await Future.wait([
        ApiService.get('/services/availabilities?providerId=$pid'),
        ApiService.get('/services/date-overrides?providerId=$pid'),
      ]);
      if (!mounted) return;
      setState(() {
        _availabilities = (results[0] is List ? results[0] : results[0] is Map ? (results[0]['availabilities'] ?? results[0]['data'] ?? []) : [])
            .cast<Map>();
        _overrides = (results[1] is List ? results[1] : results[1] is Map ? (results[1]['overrides'] ?? results[1]['data'] ?? []) : [])
            .cast<Map>();
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.toString(); });
    }
  }

  List<Map> _slotsForDay(int day) =>
      _availabilities.where((s) => s['dayOfWeek'] == day).toList();

  String _formatTime(String? t) {
    if (t == null || t.length < 5) return '--:--';
    final parts = t.split(':');
    final h = int.parse(parts[0]);
    final m = parts[1];
    final ampm = h >= 12 ? 'PM' : 'AM';
    final h12 = h == 0 ? 12 : (h > 12 ? h - 12 : h);
    return '${h12.toString().padLeft(2, '0')}:$m $ampm';
  }

  Future<void> _addSlot(int day) async {
    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (_) => _TimeSlotDialog(day: day),
    );
    if (result == null) return;
    try {
      await ApiService.post('/services/availabilities', body: {
        'providerId': _providerId,
        'dayOfWeek': day,
        'startTime': result['start'],
        'endTime': result['end'],
      });
      if (mounted) _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${DesiCompanyApp.localeProvider!.tr('error')}: $e')),
        );
      }
    }
  }

  Future<void> _deleteSlot(String id) async {
    try {
      await ApiService.delete('/services/availabilities/$id');
      if (mounted) _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${DesiCompanyApp.localeProvider!.tr('error')}: $e')),
        );
      }
    }
  }

  Future<void> _addOverride() async {
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => const _DateOverrideDialog(),
    );
    if (result == null) return;
    try {
      await ApiService.post('/services/date-overrides', body: {
        'providerId': _providerId,
        ...result,
      });
      if (mounted) _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${DesiCompanyApp.localeProvider!.tr('error')}: $e')),
        );
      }
    }
  }

  Future<void> _deleteOverride(String id) async {
    try {
      await ApiService.delete('/services/date-overrides/$id?providerId=$_providerId');
      if (mounted) _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${DesiCompanyApp.localeProvider!.tr('error')}: $e')),
        );
      }
    }
  }

  Future<void> _saveWeekly() async {
    setState(() => _saving = true);
    try {
      final slots = _availabilities
          .map((s) => {
                'dayOfWeek': s['dayOfWeek'],
                'startTime': s['startTime'],
                'endTime': s['endTime'],
              })
          .toList();
      await ApiService.put('/services/availabilities/weekly?providerId=$_providerId', body: {'slots': slots});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(DesiCompanyApp.localeProvider!.tr('save'))),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${DesiCompanyApp.localeProvider!.tr('error')}: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final loc = DesiCompanyApp.localeProvider!;
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: LinearGradient(
          begin: Alignment.topLeft, end: Alignment.bottomRight,
          colors: [AppTheme.gradientStart, AppTheme.gradientEnd],
        )),
        child: SafeArea(
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 16, 0),
              child: Row(children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
                  onPressed: () => Navigator.pop(context),
                ),
                Expanded(
                  child: Text(
                    loc.tr('my_services'),
                    style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                ),
                if (!_loading && _error == null)
                  TextButton.icon(
                    onPressed: _saving ? null : _saveWeekly,
                    icon: _saving
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.save, color: Colors.white, size: 18),
                    label: Text(loc.tr('save'), style: const TextStyle(color: Colors.white)),
                  ),
              ]),
            ),
            const SizedBox(height: 16),
            Expanded(
              child: Container(
                decoration: const BoxDecoration(
                  color: AppTheme.background,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
                ),
                child: _loading
                    ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
                    : _error != null
                        ? _buildError(loc)
                        : RefreshIndicator(
                            onRefresh: _load,
                            child: ListView(
                              padding: const EdgeInsets.fromLTRB(20, 24, 20, 100),
                              children: [
                                _buildWeeklySection(loc),
                                const SizedBox(height: 24),
                                _buildOverridesSection(loc),
                              ],
                            ),
                          ),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _buildError(LocalizationProvider loc) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, size: 64, color: AppTheme.error),
          const SizedBox(height: 16),
          Text(loc.tr('error'), style: const TextStyle(color: AppTheme.textPrimary, fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text(_error ?? '', textAlign: TextAlign.center, style: const TextStyle(color: AppTheme.textSecondary)),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: _load,
            icon: const Icon(Icons.refresh, size: 18),
            label: Text(loc.tr('retry')),
          ),
        ],
      ),
    );
  }

  Widget _buildWeeklySection(LocalizationProvider loc) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Weekly Hours', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
      const SizedBox(height: 12),
      ...List.generate(7, (i) {
        final apiDay = i == 6 ? 0 : i + 1;
        final slots = _slotsForDay(apiDay);
        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(children: [
              SizedBox(
                width: 48,
                child: Text(_dayNames[i], style: const TextStyle(fontWeight: FontWeight.w600, color: AppTheme.textPrimary, fontSize: 14)),
              ),
              Expanded(
                child: slots.isEmpty
                    ? Text('Off', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13))
                    : Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: slots.map((s) => Chip(
                          label: Text('${_formatTime(s['startTime'])} - ${_formatTime(s['endTime'])}', style: const TextStyle(fontSize: 11)),
                          deleteIcon: const Icon(Icons.close, size: 14),
                          onDeleted: () => _deleteSlot(s['id']),
                          visualDensity: VisualDensity.compact,
                          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          backgroundColor: AppTheme.primary.withValues(alpha: 0.08),
                          side: BorderSide.none,
                        )).toList(),
                      ),
              ),
              IconButton(
                icon: const Icon(Icons.add_circle_outline, color: AppTheme.primary, size: 22),
                onPressed: () => _addSlot(apiDay),
                tooltip: 'Add time slot',
              ),
            ]),
          ),
        );
      }),
    ]);
  }

  Widget _buildOverridesSection(LocalizationProvider loc) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Text('Date Overrides', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
        const Spacer(),
        TextButton.icon(
          onPressed: _addOverride,
          icon: const Icon(Icons.add, size: 18),
          label: const Text('Add'),
        ),
      ]),
      const SizedBox(height: 8),
      if (_overrides.isEmpty)
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
          ),
          child: Text('No date overrides', style: const TextStyle(color: AppTheme.textSecondary)),
        )
      else
        ..._overrides.map((o) => Container(
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
          ),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            leading: Icon(
              o['isAvailable'] == true ? Icons.check_circle : Icons.block,
              color: o['isAvailable'] == true ? Colors.green : AppTheme.error,
            ),
            title: Text(o['overrideDate'] ?? '', style: const TextStyle(fontWeight: FontWeight.w500)),
            subtitle: o['isAvailable'] == true && o['startTime'] != null
                ? Text('${_formatTime(o['startTime'])} - ${_formatTime(o['endTime'])}')
                : Text(o['reason'] ?? (o['isAvailable'] == true ? 'Available' : 'Day off')),
            trailing: IconButton(
              icon: const Icon(Icons.delete_outline, color: AppTheme.error, size: 20),
              onPressed: () => _deleteOverride(o['id']),
            ),
          ),
        )),
    ]);
  }
}

class _TimeSlotDialog extends StatefulWidget {
  final int day;
  const _TimeSlotDialog({required this.day});

  @override
  State<_TimeSlotDialog> createState() => _TimeSlotDialogState();
}

class _TimeSlotDialogState extends State<_TimeSlotDialog> {
  TimeOfDay _start = const TimeOfDay(hour: 9, minute: 0);
  TimeOfDay _end = const TimeOfDay(hour: 17, minute: 0);

  Future<void> _pickTime(bool isStart) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: isStart ? _start : _end,
    );
    if (picked != null) {
      setState(() {
        if (isStart) _start = picked; else _end = picked;
      });
    }
  }

  String _pad(int n) => n.toString().padLeft(2, '0');

  @override
  Widget build(BuildContext context) {
    final loc = DesiCompanyApp.localeProvider!;
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      title: Text('Add Time Slot'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        _buildTimeRow('Start', _start, true),
        const SizedBox(height: 12),
        _buildTimeRow('End', _end, false),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: Text(loc.tr('cancel'))),
        ElevatedButton(
          onPressed: () {
            final startMin = _start.hour * 60 + _start.minute;
            final endMin = _end.hour * 60 + _end.minute;
            if (startMin >= endMin) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Start time must be before end time')),
              );
              return;
            }
            Navigator.pop(context, {
              'start': '${_pad(_start.hour)}:${_pad(_start.minute)}',
              'end': '${_pad(_end.hour)}:${_pad(_end.minute)}',
            });
          },
          style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
          child: Text(loc.tr('save'), style: const TextStyle(color: Colors.white)),
        ),
      ],
    );
  }

  Widget _buildTimeRow(String label, TimeOfDay time, bool isStart) {
    return InkWell(
      onTap: () => _pickTime(isStart),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: AppTheme.background,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(children: [
          Text('$label: ', style: const TextStyle(color: AppTheme.textSecondary)),
          const SizedBox(width: 8),
          Text(time.format(context), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
          const Spacer(),
          const Icon(Icons.access_time, color: AppTheme.primary, size: 20),
        ]),
      ),
    );
  }
}

class _DateOverrideDialog extends StatefulWidget {
  const _DateOverrideDialog();

  @override
  State<_DateOverrideDialog> createState() => _DateOverrideDialogState();
}

class _DateOverrideDialogState extends State<_DateOverrideDialog> {
  DateTime? _date;
  bool _isAvailable = true;
  TimeOfDay? _startTime;
  TimeOfDay? _endTime;
  final _reasonCtrl = TextEditingController();

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  String _pad(int n) => n.toString().padLeft(2, '0');

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _pickTime(bool isStart) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: isStart ? ( _startTime ?? const TimeOfDay(hour: 9, minute: 0)) : (_endTime ?? const TimeOfDay(hour: 17, minute: 0)),
    );
    if (picked != null) {
      setState(() { if (isStart) _startTime = picked; else _endTime = picked; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final loc = DesiCompanyApp.localeProvider!;
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      title: const Text('Date Override'),
      content: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          InkWell(
            onTap: _pickDate,
            borderRadius: BorderRadius.circular(12),
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
                Text(_date == null ? 'Select date' : '${_date!.year}-${_pad(_date!.month)}-${_pad(_date!.day)}',
                    style: TextStyle(fontWeight: FontWeight.w500, color: _date == null ? AppTheme.textSecondary : AppTheme.textPrimary)),
              ]),
            ),
          ),
          const SizedBox(height: 16),
          Row(children: [
            const Text('Available: '),
            Switch(
              value: _isAvailable,
              onChanged: (v) => setState(() => _isAvailable = v),
              activeThumbColor: AppTheme.primary,
            ),
          ]),
          if (_isAvailable) ...[
            const SizedBox(height: 12),
            InkWell(
              onTap: () => _pickTime(true),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: AppTheme.background,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(children: [
                  const Icon(Icons.access_time, color: AppTheme.primary, size: 20),
                  const SizedBox(width: 12),
                  Text('Start: ${_startTime?.format(context) ?? '--:--'}', style: const TextStyle(color: AppTheme.textPrimary)),
                ]),
              ),
            ),
            const SizedBox(height: 8),
            InkWell(
              onTap: () => _pickTime(false),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: AppTheme.background,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(children: [
                  const Icon(Icons.access_time, color: AppTheme.primary, size: 20),
                  const SizedBox(width: 12),
                  Text('End: ${_endTime?.format(context) ?? '--:--'}', style: const TextStyle(color: AppTheme.textPrimary)),
                ]),
              ),
            ),
          ],
          if (!_isAvailable) ...[
            const SizedBox(height: 12),
            TextField(
              controller: _reasonCtrl,
              decoration: const InputDecoration(
                hintText: 'Reason (e.g., holiday)',
                prefixIcon: Icon(Icons.note, color: AppTheme.primary),
              ),
            ),
          ],
        ]),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: Text(loc.tr('cancel'))),
        ElevatedButton(
          onPressed: () {
            if (_date == null) return;
            final body = <String, dynamic>{
              'overrideDate': '${_date!.year}-${_pad(_date!.month)}-${_pad(_date!.day)}',
              'isAvailable': _isAvailable,
            };
            if (_isAvailable && _startTime != null && _endTime != null) {
              body['startTime'] = '${_pad(_startTime!.hour)}:${_pad(_startTime!.minute)}';
              body['endTime'] = '${_pad(_endTime!.hour)}:${_pad(_endTime!.minute)}';
            }
            if (!_isAvailable && _reasonCtrl.text.trim().isNotEmpty) {
              body['reason'] = _reasonCtrl.text.trim();
            }
            Navigator.pop(context, body);
          },
          style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
          child: const Text('Add', style: TextStyle(color: Colors.white)),
        ),
      ],
    );
  }
}
