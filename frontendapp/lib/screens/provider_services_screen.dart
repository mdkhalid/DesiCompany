import 'package:flutter/material.dart';
import '../l10n/strings.dart';
import '../main.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../theme.dart';

class ProviderServicesScreen extends StatefulWidget {
  const ProviderServicesScreen({super.key});

  @override
  State<ProviderServicesScreen> createState() => _ProviderServicesScreenState();
}

class _ProviderServicesScreenState extends State<ProviderServicesScreen> {
  String? _providerId;
  List _services = [];
  List _categories = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      // Source 1: /users/profile response
      final profile = await ApiService.get('/users/profile');
      _providerId = _extractProviderId(profile);

      // Source 2: SharedPreferences fallback (in case profile response is stale)
      _providerId ??= await AuthService.getProviderId();

      // Source 3: Nested provider object in profile
      if (_providerId == null && profile is Map) {
        final provider = profile['provider'];
        if (provider is Map) {
          _providerId = provider['id']?.toString();
        }
      }

      if (_providerId == null) {
        if (mounted) {
          setState(() {
            _loading = false;
            _error = 'Could not find your provider profile. Please try switching roles again.';
          });
        }
        return;
      }

      final results = await Future.wait([
        ApiService.get('/services/categories'),
        ApiService.get('/services/provider-services?providerId=$_providerId'),
      ]);
      if (!mounted) return;
      setState(() {
        _categories = results[0] is List ? results[0] : (results[0]['categories'] ?? results[0]['data'] ?? []);
        _services = results[1] is List ? results[1] : [];
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = e.toString();
        });
      }
    }
  }

  String? _extractProviderId(dynamic profile) {
    if (profile is! Map) return null;
    final flatId = profile['providerId'];
    if (flatId is String && flatId.isNotEmpty) return flatId;
    final provider = profile['provider'];
    if (provider is Map) {
      final id = provider['id'];
      if (id != null) return id.toString();
    }
    return null;
  }

  Future<void> _showAddDialog() async {
    if (_providerId == null) return;
    final result = await showDialog<bool>(
      context: context,
      builder: (_) => _ServiceFormDialog(
        providerId: _providerId!,
        categories: _categories,
        existingCategoryIds: _services
            .map((s) => s['categoryId']?.toString())
            .where((id) => id != null)
            .toList()
            .cast<String>(),
      ),
    );
    if (result == true && mounted) {
      _load();
    }
  }

  Future<void> _showEditDialog(Map service) async {
    if (_providerId == null) return;
    final result = await showDialog<bool>(
      context: context,
      builder: (_) => _ServiceFormDialog(
        providerId: _providerId!,
        categories: _categories,
        existingCategoryIds: _services
            .map((s) => s['categoryId']?.toString())
            .where((id) => id != null)
            .toList()
            .cast<String>(),
        existing: service,
      ),
    );
    if (result == true && mounted) {
      _load();
    }
  }

  Future<void> _deleteService(Map service) async {
    final loc = DesiCompanyApp.localeProvider!;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(loc.tr('delete_service')),
        content: Text(loc.tr('service_delete_confirm')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(loc.tr('cancel')),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppTheme.error),
            child: Text(loc.tr('delete')),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await ApiService.patch('/services/provider-services/${service['id']}', body: {'isActive': false});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(loc.tr('service_deleted'))),
      );
      _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${loc.tr('error')}: $e')),
      );
    }
  }

  String _categoryName(Map service) {
    if (service['category'] is Map) {
      final cat = service['category'];
      final isHindi = DesiCompanyApp.localeProvider?.locale == 'hi';
      return isHindi ? (cat['nameHi'] ?? cat['nameEn'] ?? '') : (cat['nameEn'] ?? cat['nameHi'] ?? '');
    }
    return service['categoryId']?.toString() ?? '';
  }

  Widget _buildRateChip(String label, dynamic value, IconData icon) {
    if (value == null) return const SizedBox.shrink();
    final num = double.tryParse(value.toString()) ?? 0;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppTheme.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 14, color: AppTheme.primary),
        const SizedBox(width: 4),
        Text('$label ₹${num.toStringAsFixed(0)}',
            style: const TextStyle(color: AppTheme.primary, fontSize: 12, fontWeight: FontWeight.w600)),
      ]),
    );
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
                        ? _buildErrorState(loc)
                        : _services.isEmpty
                            ? _buildEmptyState(loc)
                            : RefreshIndicator(
                                onRefresh: _load,
                                child: ListView.builder(
                                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 100),
                                  itemCount: _services.length,
                                  itemBuilder: (_, i) => _buildServiceCard(_services[i], loc),
                                ),
                              ),
              ),
            ),
          ]),
        ),
      ),
      floatingActionButton: _loading || _error != null || _providerId == null
          ? null
          : FloatingActionButton.extended(
              onPressed: _showAddDialog,
              backgroundColor: AppTheme.primary,
              icon: const Icon(Icons.add, color: Colors.white),
              label: Text(loc.tr('add_service'), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
            ),
    );
  }

  Widget _buildErrorState(LocalizationProvider loc) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
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
      ),
    );
  }

  Widget _buildEmptyState(LocalizationProvider loc) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.miscellaneous_services_outlined, size: 80, color: AppTheme.primaryLight),
          const SizedBox(height: 16),
          Text(loc.tr('no_services_yet'),
              style: const TextStyle(color: AppTheme.textPrimary, fontSize: 16, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  Widget _buildServiceCard(Map service, LocalizationProvider loc) {
    final name = _categoryName(service);
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
          Row(children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.handyman, color: AppTheme.primary, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(name,
                  style: const TextStyle(color: AppTheme.textPrimary, fontSize: 16, fontWeight: FontWeight.bold)),
            ),
            IconButton(
              icon: const Icon(Icons.edit_outlined, color: AppTheme.primary),
              onPressed: () => _showEditDialog(service),
              tooltip: loc.tr('edit_service'),
            ),
            IconButton(
              icon: const Icon(Icons.delete_outline, color: AppTheme.error),
              onPressed: () => _deleteService(service),
              tooltip: loc.tr('delete_service'),
            ),
          ]),
          const SizedBox(height: 12),
          Wrap(spacing: 8, runSpacing: 8, children: [
            _buildRateChip(loc.tr('fixed_rate'), service['fixedRate'], Icons.payments),
            _buildRateChip(loc.tr('hourly_rate'), service['hourlyRate'], Icons.schedule),
            _buildRateChip(loc.tr('daily_rate'), service['dailyRate'], Icons.calendar_today),
          ]),
        ]),
      ),
    );
  }
}

class _ServiceFormDialog extends StatefulWidget {
  final String providerId;
  final List categories;
  final List<String> existingCategoryIds;
  final Map? existing;

  const _ServiceFormDialog({
    required this.providerId,
    required this.categories,
    required this.existingCategoryIds,
    this.existing,
  });

  @override
  State<_ServiceFormDialog> createState() => _ServiceFormDialogState();
}

class _ServiceFormDialogState extends State<_ServiceFormDialog> {
  final _formKey = GlobalKey<FormState>();
  final _fixedCtrl = TextEditingController();
  final _hourlyCtrl = TextEditingController();
  final _dailyCtrl = TextEditingController();
  String? _selectedCategoryId;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    if (widget.existing != null) {
      _selectedCategoryId = widget.existing!['categoryId']?.toString();
      _fixedCtrl.text = widget.existing!['fixedRate']?.toString() ?? '';
      _hourlyCtrl.text = widget.existing!['hourlyRate']?.toString() ?? '';
      _dailyCtrl.text = widget.existing!['dailyRate']?.toString() ?? '';
    }
  }

  @override
  void dispose() {
    _fixedCtrl.dispose();
    _hourlyCtrl.dispose();
    _dailyCtrl.dispose();
    super.dispose();
  }

  String _categoryLabel(Map c) {
    final isHindi = DesiCompanyApp.localeProvider?.locale == 'hi';
    return isHindi ? (c['nameHi'] ?? c['nameEn'] ?? '') : (c['nameEn'] ?? c['nameHi'] ?? '');
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    final fixed = _fixedCtrl.text.trim();
    final hourly = _hourlyCtrl.text.trim();
    final daily = _dailyCtrl.text.trim();
    if (fixed.isEmpty && hourly.isEmpty && daily.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${DesiCompanyApp.localeProvider!.tr('error')}: rate required')),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      if (widget.existing != null) {
        final body = <String, dynamic>{};
        if (fixed.isNotEmpty) body['fixedRate'] = double.tryParse(fixed);
        if (hourly.isNotEmpty) body['hourlyRate'] = double.tryParse(hourly);
        if (daily.isNotEmpty) body['dailyRate'] = double.tryParse(daily);
        if (body.isEmpty) body['isActive'] = true;
        await ApiService.patch('/services/provider-services/${widget.existing!['id']}', body: body);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(DesiCompanyApp.localeProvider!.tr('service_updated'))),
          );
        }
      } else {
        final body = <String, dynamic>{
          'providerId': widget.providerId,
          'categoryId': _selectedCategoryId,
        };
        if (fixed.isNotEmpty) body['fixedRate'] = double.tryParse(fixed);
        if (hourly.isNotEmpty) body['hourlyRate'] = double.tryParse(hourly);
        if (daily.isNotEmpty) body['dailyRate'] = double.tryParse(daily);
        await ApiService.post('/services/provider-services', body: body);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(DesiCompanyApp.localeProvider!.tr('service_created'))),
          );
        }
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${DesiCompanyApp.localeProvider!.tr('error')}: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final loc = DesiCompanyApp.localeProvider!;
    final isEdit = widget.existing != null;
    final availableCategories = widget.categories.where((c) {
      final id = c['id']?.toString();
      if (id == null) return false;
      if (widget.existing != null && id == widget.existing!['categoryId']?.toString()) return true;
      return !widget.existingCategoryIds.contains(id);
    }).toList();

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      title: Text(isEdit ? loc.tr('edit_service') : loc.tr('add_service')),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(loc.tr('service_category'),
                style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13, fontWeight: FontWeight.w500)),
            const SizedBox(height: 6),
            if (isEdit)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: AppTheme.background,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(
                  _categoryLabel(
                    (widget.categories.firstWhere(
                      (c) => c['id']?.toString() == _selectedCategoryId,
                      orElse: () => <String, dynamic>{},
                    ) as Map).cast<String, dynamic>(),
                  ),
                  style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.w500),
                ),
              )
            else if (availableCategories.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: AppTheme.error.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(loc.tr('no_categories'),
                    style: const TextStyle(color: AppTheme.error, fontWeight: FontWeight.w500)),
              )
            else
              DropdownButtonFormField<String>(
                initialValue: _selectedCategoryId,
                decoration: const InputDecoration(hintText: 'select_category'),
                items: availableCategories
                    .map<DropdownMenuItem<String>>((c) => DropdownMenuItem<String>(
                          value: c['id']?.toString(),
                          child: Text(_categoryLabel((c as Map).cast<String, dynamic>())),
                        ))
                    .toList(),
                onChanged: (v) => setState(() => _selectedCategoryId = v),
                validator: (v) => v == null ? loc.tr('select_category') : null,
              ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _fixedCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(
                labelText: loc.tr('fixed_rate'),
                prefixIcon: const Icon(Icons.payments, color: AppTheme.primary),
              ),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return null;
                if (double.tryParse(v.trim()) == null) return 'invalid';
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _hourlyCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(
                labelText: loc.tr('hourly_rate'),
                prefixIcon: const Icon(Icons.schedule, color: AppTheme.primary),
              ),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return null;
                if (double.tryParse(v.trim()) == null) return 'invalid';
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _dailyCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(
                labelText: loc.tr('daily_rate'),
                prefixIcon: const Icon(Icons.calendar_today, color: AppTheme.primary),
              ),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return null;
                if (double.tryParse(v.trim()) == null) return 'invalid';
                return null;
              },
            ),
          ]),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.pop(context, false),
          child: Text(loc.tr('cancel')),
        ),
        ElevatedButton(
          onPressed: _saving ? null : _save,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppTheme.primary,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          child: _saving
              ? const SizedBox(
                  width: 18, height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : Text(loc.tr('save'), style: const TextStyle(color: Colors.white)),
        ),
      ],
    );
  }
}
