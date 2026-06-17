import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../models/user.dart';
import '../theme.dart';

class CustomerHomeScreen extends StatefulWidget {
  const CustomerHomeScreen({super.key});
  @override
  State<CustomerHomeScreen> createState() => _CustomerHomeScreenState();
}

class _CustomerHomeScreenState extends State<CustomerHomeScreen> {
  List<ServiceCategory> _categories = [];
  List _allProviders = [];
  List _filteredProviders = [];
  String? _selectedCategoryId;
  bool _loading = true;

  static const _categoryColors = [
    Color(0xFF6C3FB4), Color(0xFF00BFA5), Color(0xFFFF6F00),
    Color(0xFFE53935), Color(0xFF1E88E5), Color(0xFF43A047),
  ];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final cats = await ApiService.get('/services/categories');
      final provs = await ApiService.get('/services/providers');
      if (!mounted) return;
      setState(() {
        _categories = (cats as List).map((c) => ServiceCategory.fromJson(c)).toList();
        _allProviders = provs as List;
        _filteredProviders = _allProviders;
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _selectCategory(String? id) {
    setState(() {
      _selectedCategoryId = _selectedCategoryId == id ? null : id;
      if (_selectedCategoryId == null) {
        _filteredProviders = _allProviders;
      } else {
        _filteredProviders = _allProviders.where((p) {
          final svcs = p['services'] as List? ?? [];
          return svcs.any((s) => s['category']?['id'] == _selectedCategoryId);
        }).toList();
      }
    });
  }

  IconData _categoryIcon(String name) {
    return switch (name.toLowerCase()) {
      'plumber' || 'plumbing' => Icons.plumbing,
      'electrician' || 'electrical' => Icons.electrical_services,
      'carpenter' || 'carpentry' => Icons.handyman,
      'painter' || 'painting' => Icons.format_paint,
      'cleaner' || 'cleaning' => Icons.cleaning_services,
      'driver' || 'driving' => Icons.directions_car,
      _ => Icons.build,
    };
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF6C3FB4), Color(0xFF5E35B1)],
        )),
        child: SafeArea(
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Hello!', style: TextStyle(color: Colors.white70, fontSize: 14)),
                  Text('Find Services', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                ]),
                IconButton(
                  icon: const Icon(Icons.logout, color: Colors.white70),
                  onPressed: () => Navigator.pushReplacementNamed(context, '/login'),
                ),
              ]),
            ),
            const SizedBox(height: 16),
            Expanded(
              child: _loading
                ? const Center(child: CircularProgressIndicator(color: Colors.white))
                : Container(
                    decoration: const BoxDecoration(
                      color: Color(0xFFF5F0FF),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
                    ),
                    child: ListView(padding: const EdgeInsets.fromLTRB(20, 24, 20, 100), children: [
                      const Text('Categories', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
                      const SizedBox(height: 12),
                      SizedBox(
                        height: 36,
                        child: ListView(
                          scrollDirection: Axis.horizontal,
                          children: [
                            ..._categories.asMap().entries.map((e) {
                              final i = e.key;
                              final c = e.value;
                              final isSelected = c.id == _selectedCategoryId;
                              final color = _categoryColors[i % _categoryColors.length];
                              return Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: GestureDetector(
                                  onTap: () => _selectCategory(c.id),
                                  child: AnimatedContainer(
                                    duration: const Duration(milliseconds: 200),
                                    padding: const EdgeInsets.symmetric(horizontal: 16),
                                    decoration: BoxDecoration(
                                      color: isSelected ? color : Colors.white,
                                      borderRadius: BorderRadius.circular(20),
                                      border: Border.all(color: color.withOpacity(0.3)),
                                      boxShadow: isSelected ? [BoxShadow(color: color.withOpacity(0.3), blurRadius: 8, offset: const Offset(0, 2))] : null,
                                    ),
                                    child: Row(children: [
                                      Icon(_categoryIcon(c.nameEn), size: 16, color: isSelected ? Colors.white : color),
                                      const SizedBox(width: 6),
                                      Text(c.nameEn, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: isSelected ? Colors.white : color)),
                                    ]),
                                  ),
                                ),
                              );
                            }),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),
                      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                        Text('Available Providers${_selectedCategoryId != null ? " (${_filteredProviders.length})" : ""}',
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
                      ]),
                      const SizedBox(height: 12),
                      if (_filteredProviders.isEmpty)
                        Container(
                          padding: const EdgeInsets.all(40),
                          alignment: Alignment.center,
                          child: const Text('No providers found', style: TextStyle(color: AppTheme.textSecondary)),
                        )
                      else
                        ..._filteredProviders.map((p) {
                          final color = _categoryColors[_allProviders.indexOf(p) % _categoryColors.length];
                          return Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(20),
                              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))],
                            ),
                            child: Material(
                              color: Colors.transparent,
                              borderRadius: BorderRadius.circular(20),
                              child: InkWell(
                                borderRadius: BorderRadius.circular(20),
                                onTap: () => Navigator.pushNamed(context, '/provider-detail', arguments: p),
                                child: Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Row(children: [
                                    Container(
                                      width: 56, height: 56,
                                      decoration: BoxDecoration(
                                        gradient: LinearGradient(colors: [color, color.withOpacity(0.7)], begin: Alignment.topLeft, end: Alignment.bottomRight),
                                        borderRadius: BorderRadius.circular(16),
                                      ),
                                      child: Center(child: Text((p['firstName'] ?? '?')[0].toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold))),
                                    ),
                                    const SizedBox(width: 16),
                                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                      Text('${p['firstName'] ?? ''} ${p['lastName'] ?? ''}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
                                      const SizedBox(height: 4),
                                      Row(children: [
                                        if (p['city'] != null) ...[
                                          Icon(Icons.location_on, size: 14, color: Colors.grey.shade400),
                                          const SizedBox(width: 4),
                                          Text(p['city'], style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                                          const SizedBox(width: 12),
                                        ],
                                        const Icon(Icons.star, size: 14, color: Color(0xFFFF6F00)),
                                        const SizedBox(width: 4),
                                        Text('${p['averageRating'] ?? 0}', style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                                      ]),
                                    ])),
                                    const Icon(Icons.arrow_forward_ios, size: 16, color: AppTheme.textSecondary),
                                  ]),
                                ),
                              ),
                            ),
                          );
                        }),
                    ]),
                  ),
            ),
          ]),
        ),
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 20, offset: const Offset(0, -4))],
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
              _navItem(Icons.home, 'Home', true, () {}),
              _navItem(Icons.book_online, 'Bookings', false, () => Navigator.pushNamed(context, '/my-bookings')),
              _navItem(Icons.chat, 'Chat', false, () => Navigator.pushNamed(context, '/chat')),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _navItem(IconData icon, String label, bool active, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, color: active ? AppTheme.primary : AppTheme.textSecondary, size: 24),
        const SizedBox(height: 4),
        Text(label, style: TextStyle(fontSize: 11, color: active ? AppTheme.primary : AppTheme.textSecondary)),
      ]),
    );
  }
}
