import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../l10n/strings.dart';
import '../main.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';
import '../theme.dart';

class CustomerPostJobScreen extends StatefulWidget {
  const CustomerPostJobScreen({super.key});

  @override
  State<CustomerPostJobScreen> createState() => _CustomerPostJobScreenState();
}

class _CustomerPostJobScreenState extends State<CustomerPostJobScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _addressController = TextEditingController();
  final _budgetMinController = TextEditingController();
  final _budgetMaxController = TextEditingController();

  List<dynamic> _categories = [];
  String? _selectedCategoryId;
  DateTime? _preferredDate;
  double? _latitude;
  double? _longitude;
  bool _loadingCategories = true;
  bool _locating = false;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadCategories();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _addressController.dispose();
    _budgetMinController.dispose();
    _budgetMaxController.dispose();
    super.dispose();
  }

  Future<void> _loadCategories() async {
    try {
      final data = await ApiService.get('/services/categories');
      if (!mounted) return;
      setState(() {
        _categories = data as List;
        _loadingCategories = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadingCategories = false);
    }
  }

  Future<void> _useMyLocation() async {
    setState(() => _locating = true);
    final position = await LocationService.getCurrentLocation();
    if (!mounted) return;
    if (position == null) {
      setState(() => _locating = false);
      final loc = DesiCompanyApp.localeProvider!;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(loc.tr('location_permission_denied'))),
      );
      return;
    }
    final address = await LocationService.getAddressFromCoordinates(
      position.latitude,
      position.longitude,
    );
    if (!mounted) return;
    setState(() {
      _latitude = position.latitude;
      _longitude = position.longitude;
      _addressController.text = address;
      _locating = false;
    });
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _preferredDate ?? now,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() => _preferredDate = picked);
    }
  }

  Future<void> _submit() async {
    final loc = DesiCompanyApp.localeProvider!;
    if (!_formKey.currentState!.validate()) return;
    if (_selectedCategoryId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(loc.tr('select_category'))),
      );
      return;
    }

    final body = <String, dynamic>{
      'categoryId': _selectedCategoryId,
      'title': _titleController.text.trim(),
      'description': _descriptionController.text.trim(),
    };
    if (_addressController.text.trim().isNotEmpty) {
      body['address'] = _addressController.text.trim();
    }
    if (_latitude != null) body['latitude'] = _latitude;
    if (_longitude != null) body['longitude'] = _longitude;
    if (_budgetMinController.text.trim().isNotEmpty) {
      body['budgetMin'] = double.tryParse(_budgetMinController.text.trim());
    }
    if (_budgetMaxController.text.trim().isNotEmpty) {
      body['budgetMax'] = double.tryParse(_budgetMaxController.text.trim());
    }
    if (_preferredDate != null) {
      body['preferredDate'] = _preferredDate!.toIso8601String();
    }

    setState(() => _submitting = true);
    try {
      await ApiService.post('/job-requests', body: body);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(loc.tr('job_posted'))),
      );
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      final msg = e.toString().replaceFirst('Exception: ', '');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(loc.tr('job_post_failed', params: {'error': msg}))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final loc = DesiCompanyApp.localeProvider!;
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: LinearGradient(
          begin: Alignment.topLeft, end: Alignment.bottomRight,
          colors: [Color(0xFF6C3FB4), Color(0xFF5E35B1), Color(0xFF7C4DFF)],
        )),
        child: SafeArea(
          child: Column(children: [
            _buildAppBar(loc),
            Expanded(
              child: Container(
                margin: const EdgeInsets.only(top: 16),
                decoration: const BoxDecoration(
                  color: Color(0xFFF8F9FA),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
                ),
                child: _loadingCategories
                  ? const Center(child: CircularProgressIndicator())
                  : SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _buildLabel(loc.tr('title_label')),
                            TextFormField(
                              controller: _titleController,
                              decoration: InputDecoration(
                                hintText: loc.tr('title_label'),
                              ),
                              validator: (v) => (v == null || v.trim().isEmpty)
                                ? loc.tr('title_label') : null,
                            ),
                            const SizedBox(height: 16),
                            _buildLabel(loc.tr('services')),
                            _buildCategoryDropdown(),
                            const SizedBox(height: 16),
                            _buildLabel(loc.tr('description_label')),
                            TextFormField(
                              controller: _descriptionController,
                              minLines: 4,
                              maxLines: 6,
                              decoration: InputDecoration(
                                hintText: loc.tr('description_label'),
                              ),
                              validator: (v) => (v == null || v.trim().isEmpty)
                                ? loc.tr('description_label') : null,
                            ),
                            const SizedBox(height: 16),
                            _buildLabel(loc.tr('address')),
                            TextFormField(
                              controller: _addressController,
                              decoration: InputDecoration(
                                hintText: loc.tr('address'),
                                prefixIcon: const Icon(Icons.location_on_outlined, color: AppTheme.primary),
                              ),
                            ),
                            const SizedBox(height: 8),
                            OutlinedButton.icon(
                              onPressed: _locating ? null : _useMyLocation,
                              icon: _locating
                                ? const SizedBox(
                                    width: 16, height: 16,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  )
                                : const Icon(Icons.my_location, size: 18),
                              label: Text(loc.tr('use_my_location')),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: AppTheme.primary,
                                side: const BorderSide(color: AppTheme.primary),
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),
                            Row(children: [
                              Expanded(child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _buildLabel(loc.tr('budget_min')),
                                  TextFormField(
                                    controller: _budgetMinController,
                                    keyboardType: TextInputType.number,
                                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                                    decoration: const InputDecoration(
                                      hintText: '₹',
                                      prefixText: '₹ ',
                                    ),
                                    validator: (v) {
                                      if (v == null || v.trim().isEmpty) return null;
                                      final min = double.tryParse(v.trim());
                                      final max = _budgetMaxController.text.trim().isNotEmpty
                                        ? double.tryParse(_budgetMaxController.text.trim())
                                        : null;
                                      if (min != null && max != null && min > max) {
                                        return '>';
                                      }
                                      return null;
                                    },
                                  ),
                                ],
                              )),
                              const SizedBox(width: 12),
                              Expanded(child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _buildLabel(loc.tr('budget_max')),
                                  TextFormField(
                                    controller: _budgetMaxController,
                                    keyboardType: TextInputType.number,
                                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                                    decoration: const InputDecoration(
                                      hintText: '₹',
                                      prefixText: '₹ ',
                                    ),
                                    validator: (v) {
                                      if (v == null || v.trim().isEmpty) return null;
                                      final max = double.tryParse(v.trim());
                                      final min = _budgetMinController.text.trim().isNotEmpty
                                        ? double.tryParse(_budgetMinController.text.trim())
                                        : null;
                                      if (min != null && max != null && min > max) {
                                        return '<';
                                      }
                                      return null;
                                    },
                                  ),
                                ],
                              )),
                            ]),
                            const SizedBox(height: 16),
                            _buildLabel(loc.tr('preferred_date')),
                            InkWell(
                              onTap: _pickDate,
                              borderRadius: BorderRadius.circular(16),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: Colors.grey.shade200),
                                ),
                                child: Row(children: [
                                  const Icon(Icons.calendar_today_outlined, color: AppTheme.primary, size: 20),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      _preferredDate == null
                                        ? loc.tr('preferred_date')
                                        : '${_preferredDate!.day}/${_preferredDate!.month}/${_preferredDate!.year}',
                                      style: TextStyle(
                                        color: _preferredDate == null
                                          ? AppTheme.textSecondary
                                          : AppTheme.textPrimary,
                                        fontSize: 15,
                                      ),
                                    ),
                                  ),
                                  if (_preferredDate != null)
                                    GestureDetector(
                                      onTap: () => setState(() => _preferredDate = null),
                                      child: const Icon(Icons.close, size: 18, color: AppTheme.textSecondary),
                                    ),
                                ]),
                              ),
                            ),
                            const SizedBox(height: 24),
                            ElevatedButton(
                              onPressed: _submitting ? null : _submit,
                              style: ElevatedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 16),
                              ),
                              child: _submitting
                                ? const SizedBox(
                                    width: 20, height: 20,
                                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                  )
                                : Text(loc.tr('post_job')),
                            ),
                          ],
                        ),
                      ),
                    ),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _buildAppBar(LocalizationProvider loc) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 20, 0),
      child: Row(children: [
        IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        const SizedBox(width: 4),
        Text(
          loc.tr('post_a_job'),
          style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
        ),
      ]),
    );
  }

  Widget _buildLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, left: 4),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: AppTheme.textPrimary,
        ),
      ),
    );
  }

  Widget _buildCategoryDropdown() {
    final loc = DesiCompanyApp.localeProvider!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: _selectedCategoryId,
          isExpanded: true,
          hint: Text(loc.tr('select_category'), style: const TextStyle(color: AppTheme.textSecondary)),
          icon: const Icon(Icons.keyboard_arrow_down, color: AppTheme.primary),
          items: _categories.map<DropdownMenuItem<String>>((c) {
            return DropdownMenuItem<String>(
              value: c['id'] as String,
              child: Text(c['nameEn'] ?? ''),
            );
          }).toList(),
          onChanged: (v) => setState(() => _selectedCategoryId = v),
        ),
      ),
    );
  }
}
