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

  Widget _buildModelChip(String? model, LocalizationProvider loc) {
    if (model == null || model.isEmpty) return const SizedBox.shrink();
    final labels = {
      'FIXED': loc.tr('fixed_rate'),
      'HOURLY': loc.tr('hourly_rate'),
      'DAILY': loc.tr('daily_rate'),
      'PER_UNIT': loc.tr('per_unit'),
      'QUOTE_BASED': loc.tr('quote_based'),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppTheme.primary.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
      ),
      child: Text(labels[model] ?? model,
          style: const TextStyle(color: AppTheme.primary, fontSize: 11, fontWeight: FontWeight.w700)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final loc = DesiCompanyApp.localeProvider!;
    return Scaffold(
      body: Container(
        color: const Color(0xFF66A3FF),
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
          Wrap(spacing: 6, runSpacing: 6, children: [
            _buildModelChip(service['pricingModel']?.toString(), loc),
            _buildRateChip(loc.tr('fixed_rate'), service['fixedRate'], Icons.payments),
            _buildRateChip(loc.tr('hourly_rate'), service['hourlyRate'], Icons.schedule),
            _buildRateChip(loc.tr('daily_rate'), service['dailyRate'], Icons.calendar_today),
            _buildRateChip(loc.tr('per_unit'), service['unitRate'], Icons.square_foot),
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
  final _unitCtrl = TextEditingController();
  String? _selectedCategoryId;
  String? _selectedPricingModel;
  List<String> _allowedModels = [];
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    if (widget.existing != null) {
      _selectedCategoryId = widget.existing!['categoryId']?.toString();
      _selectedPricingModel = widget.existing!['pricingModel']?.toString();
      _fixedCtrl.text = widget.existing!['fixedRate']?.toString() ?? '';
      _hourlyCtrl.text = widget.existing!['hourlyRate']?.toString() ?? '';
      _dailyCtrl.text = widget.existing!['dailyRate']?.toString() ?? '';
      _unitCtrl.text = widget.existing!['unitRate']?.toString() ?? '';
      _updateAllowedModels();
    }
  }

  @override
  void dispose() {
    _fixedCtrl.dispose();
    _hourlyCtrl.dispose();
    _dailyCtrl.dispose();
    _unitCtrl.dispose();
    super.dispose();
  }

  Map? _findCategory(String? id) {
    if (id == null) return null;
    for (final c in widget.categories) {
      if (c['id']?.toString() == id) return c as Map;
    }
    return null;
  }

  void _updateAllowedModels() {
    final cat = _findCategory(_selectedCategoryId);
    if (cat != null) {
      final raw = cat['pricingModels'];
      _allowedModels = (raw is List) ? raw.cast<String>() : [];
      if (!_allowedModels.contains(_selectedPricingModel)) {
        _selectedPricingModel = null;
      }
      // Auto-select if only one model
      if (_allowedModels.length == 1 && _selectedPricingModel == null) {
        _selectedPricingModel = _allowedModels.first;
      }
    } else {
      _allowedModels = [];
    }
  }

  String _categoryLabel(Map c) {
    final isHindi = DesiCompanyApp.localeProvider?.locale == 'hi';
    return isHindi ? (c['nameHi'] ?? c['nameEn'] ?? '') : (c['nameEn'] ?? c['nameHi'] ?? '');
  }

  double? _parseRate(String v) => v.trim().isEmpty ? null : double.tryParse(v.trim());

  double _computedServiceAmount() {
    final model = _selectedPricingModel;
    if (model == 'FIXED') return _parseRate(_fixedCtrl.text) ?? 0;
    if (model == 'HOURLY') {
      final rate = _parseRate(_hourlyCtrl.text) ?? 0;
      return rate * 1; // default 1 hour for preview
    }
    if (model == 'DAILY') {
      final rate = _parseRate(_dailyCtrl.text) ?? 0;
      return rate * 1; // default 1 day for preview
    }
    if (model == 'PER_UNIT') return _parseRate(_unitCtrl.text) ?? 0;
    return 0;
  }

  Widget _buildNetPayoutPreview() {
    final amount = _computedServiceAmount();
    if (amount <= 0 && _allowedModels.isEmpty) return const SizedBox.shrink();
    final loc = DesiCompanyApp.localeProvider!;
    // GST is collected FROM the customer on top of the service amount.
    // It is NOT deducted from the provider's earnings.
    // Provider only loses the platform commission from their service amount.
    final gst = amount * 0.18;         // informational only — paid by customer
    final commission = amount * 0.10;  // deducted from provider
    final net = amount - commission;   // provider earns service amount minus commission
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFBBF7D0)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(loc.tr('net_payout_preview'),
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF166534))),
        const SizedBox(height: 6),
        if (amount > 0) ...[
          _previewRow(loc.tr('subtotal'), amount, null),
          _previewRow(loc.tr('commission_estimate', params: {'percent': '10'}), commission, const Color(0xFFDC2626)),
          const Divider(height: 16),
          _previewRow(loc.tr('provider_earns', params: {'amount': net.toStringAsFixed(0)}), net, const Color(0xFF16A34A)),
          const SizedBox(height: 4),
          // Show GST as info — it is added to the customer's total, not taken from provider
          Row(children: [
            const Icon(Icons.info_outline, size: 12, color: Color(0xFF6B7280)),
            const SizedBox(width: 4),
            Expanded(
              child: Text(
                'GST 18% (₹${gst.toStringAsFixed(0)}) is added to customer\'s total',
                style: const TextStyle(fontSize: 10, color: Color(0xFF6B7280)),
              ),
            ),
          ]),
        ],
      ]),
    );
  }

  Widget _previewRow(String label, double amount, Color? amountColor) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(label, style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
        Text('₹${amount.toStringAsFixed(0)}',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: amountColor ?? AppTheme.textPrimary)),
      ]),
    );
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    final loc = DesiCompanyApp.localeProvider!;
    final fixed = _fixedCtrl.text.trim();
    final hourly = _hourlyCtrl.text.trim();
    final daily = _dailyCtrl.text.trim();
    final unit = _unitCtrl.text.trim();

    // Validate at least the required rate for the selected model is filled
    if (_selectedPricingModel != null) {
      final requiredEmpty = _selectedPricingModel == 'FIXED' && fixed.isEmpty ||
          _selectedPricingModel == 'HOURLY' && hourly.isEmpty ||
          _selectedPricingModel == 'DAILY' && daily.isEmpty ||
          _selectedPricingModel == 'PER_UNIT' && unit.isEmpty;
      if (requiredEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${loc.tr('error')}: rate required for ${_selectedPricingModel}')),
        );
        return;
      }
    } else if (fixed.isEmpty && hourly.isEmpty && daily.isEmpty && unit.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${loc.tr('error')}: rate required')),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      if (widget.existing != null) {
        final body = <String, dynamic>{};
        if (fixed.isNotEmpty) body['fixedRate'] = _parseRate(fixed);
        if (hourly.isNotEmpty) body['hourlyRate'] = _parseRate(hourly);
        if (daily.isNotEmpty) body['dailyRate'] = _parseRate(daily);
        if (unit.isNotEmpty) body['unitRate'] = _parseRate(unit);
        if (_selectedPricingModel != null) body['pricingModel'] = _selectedPricingModel;
        if (body.isEmpty) body['isActive'] = true;
        await ApiService.patch('/services/provider-services/${widget.existing!['id']}', body: body);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(loc.tr('service_updated'))),
          );
        }
      } else {
        final body = <String, dynamic>{
          'providerId': widget.providerId,
          'categoryId': _selectedCategoryId,
        };
        if (fixed.isNotEmpty) body['fixedRate'] = _parseRate(fixed);
        if (hourly.isNotEmpty) body['hourlyRate'] = _parseRate(hourly);
        if (daily.isNotEmpty) body['dailyRate'] = _parseRate(daily);
        if (unit.isNotEmpty) body['unitRate'] = _parseRate(unit);
        if (_selectedPricingModel != null) body['pricingModel'] = _selectedPricingModel;
        await ApiService.post('/services/provider-services', body: body);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(loc.tr('service_created'))),
          );
        }
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${loc.tr('error')}: $e')),
        );
      }
    }
  }

  Widget _buildRateField(String label, IconData icon, TextEditingController ctrl) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: ctrl,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon, color: AppTheme.primary),
        ),
        validator: (v) {
          if (v == null || v.trim().isEmpty) return null;
          if (double.tryParse(v.trim()) == null) return 'invalid';
          return null;
        },
      ),
    );
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
            // Category selector / display
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
                  _categoryLabel(_findCategory(_selectedCategoryId) ?? <String, dynamic>{}),
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
                onChanged: (v) {
                  setState(() {
                    _selectedCategoryId = v;
                    _updateAllowedModels();
                    // Clear rate fields when category changes
                    _fixedCtrl.clear();
                    _hourlyCtrl.clear();
                    _dailyCtrl.clear();
                    _unitCtrl.clear();
                  });
                },
                validator: (v) => v == null ? loc.tr('select_category') : null,
              ),
            const SizedBox(height: 16),

            // Pricing model selector (if multiple models available)
            if (_allowedModels.length > 1) ...[
              DropdownButtonFormField<String>(
                initialValue: _selectedPricingModel,
                decoration: InputDecoration(
                  labelText: loc.tr('pricing_model'),
                  prefixIcon: const Icon(Icons.category, color: AppTheme.primary),
                ),
                items: _allowedModels
                    .map<DropdownMenuItem<String>>((m) => DropdownMenuItem<String>(
                          value: m,
                          child: Text(m.replaceAll('_', ' ')),
                        ))
                    .toList(),
                onChanged: (v) => setState(() => _selectedPricingModel = v),
                validator: (v) => v == null ? loc.tr('select_pricing_model') : null,
              ),
              const SizedBox(height: 16),
            ],

            // Dynamic rate fields based on selected pricing model
            if (_allowedModels.contains('FIXED') || (_selectedPricingModel == null && _allowedModels.isEmpty))
              _buildRateField(loc.tr('fixed_rate'), Icons.payments, _fixedCtrl),
            if (_allowedModels.contains('HOURLY') || (_selectedPricingModel == null && _allowedModels.isEmpty))
              _buildRateField(loc.tr('hourly_rate'), Icons.schedule, _hourlyCtrl),
            if (_allowedModels.contains('DAILY') || (_selectedPricingModel == null && _allowedModels.isEmpty))
              _buildRateField(loc.tr('daily_rate'), Icons.calendar_today, _dailyCtrl),
            if (_allowedModels.contains('PER_UNIT') || (_selectedPricingModel == null && _allowedModels.isEmpty))
              _buildRateField(loc.tr('unit_rate_field'), Icons.square_foot, _unitCtrl),

            // Net payout preview
            _buildNetPayoutPreview(),
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
