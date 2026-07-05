import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/app_presence_service.dart';
import '../services/location_service.dart';
import '../services/notification_websocket_service.dart';
import '../models/user.dart';
import '../theme.dart';
import '../l10n/strings.dart';
import '../widgets/distance_badge.dart';

import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'profile_picker_screen.dart';
import 'package:desicompany/services/app_logger.dart';
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
  bool _showAllCategories = false;
  final _searchController = TextEditingController();
  String _searchQuery = '';
  int _unreadCount = 0;
  bool _hasMultipleRoles = false;
  User? _currentUser;
  String _locationText = 'Set location';
  double? _latitude;
  double? _longitude;
  double _radiusKm = 5;
  StreamSubscription<PresenceUpdate>? _presenceSub;
  StreamSubscription<int>? _unreadCountSub;

  static const _categoryIcons = {
    'plumber': {'icon': Icons.plumbing, 'color': Color(0xFF2196F3)},
    'electrician': {'icon': Icons.electrical_services, 'color': Color(0xFFFFC107)},
    'carpenter': {'icon': Icons.handyman, 'color': Color(0xFF795548)},
    'painter': {'icon': Icons.format_paint, 'color': Color(0xFFE91E63)},
    'cleaning': {'icon': Icons.cleaning_services, 'color': Color(0xFF4CAF50)},
    'driver': {'icon': Icons.directions_car, 'color': Color(0xFF9C27B0)},
    'ac repair': {'icon': Icons.ac_unit, 'color': Color(0xFF00BCD4)},
    'pest control': {'icon': Icons.bug_report, 'color': Color(0xFFFF5722)},
    'shifting': {'icon': Icons.local_shipping, 'color': Color(0xFF607D8B)},
    'laundry': {'icon': Icons.local_laundry_service, 'color': Color(0xFF3F51B5)},
    'appliance repair': {'icon': Icons.kitchen, 'color': Color(0xFF009688)},
    'salon': {'icon': Icons.content_cut, 'color': Color(0xFFFF9800)},
    'photography': {'icon': Icons.camera_alt, 'color': Color(0xFF673AB7)},
    'tutoring': {'icon': Icons.school, 'color': Color(0xFF8BC34A)},
    'fitness trainer': {'icon': Icons.fitness_center, 'color': Color(0xFFF44336)},
    'computer repair': {'icon': Icons.computer, 'color': Color(0xFF455A64)},
  };

  static const _defaultIcon = {'icon': Icons.build, 'color': Color(0xFF607D8B)};

  @override
  void initState() {
    super.initState();
    _loadData();
    _initLocation();
    AppPresenceService.connect();
    _presenceSub = AppPresenceService.updates.listen((evt) {
      _applyPresenceUpdate(evt.userId, evt.online);
    });
    _unreadCountSub = NotificationWebSocketService.unreadCountStream.listen((count) {
      if (mounted) setState(() => _unreadCount = count);
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    _presenceSub?.cancel();
    _presenceSub = null;
    _unreadCountSub?.cancel();
    super.dispose();
  }

  bool matchesProviderUser(Map<String, dynamic> p, String userId) {
    if (p['userId'] == userId) return true;
    final u = p['user'];
    if (u is Map && u['id'] == userId) return true;
    return false;
  }

  void _applyPresenceUpdate(String userId, bool online) {
    if (!mounted) return;
    setState(() {
      for (final p in _allProviders) {
        if (matchesProviderUser(p, userId)) {
          p['isOnline'] = online;
        }
      }
      for (final p in _filteredProviders) {
        if (matchesProviderUser(p, userId)) {
          p['isOnline'] = online;
        }
      }
    });
  }

  Future<void> _loadData() async {
    try {
      final cats = await ApiService.get('/services/categories');
      if (!mounted) return;
      setState(() {
        _categories = (cats as List).map((c) => ServiceCategory.fromJson(c)).toList();
      });
      await _loadProviders();
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
    _loadUnreadCount();
    _loadUserRole();
  }

  Future<void> _loadProviders() async {
    try {
      List provs;
      if (_latitude != null && _longitude != null && _radiusKm > 0) {
        final path = '/services/search?latitude=$_latitude&longitude=$_longitude&radiusKm=$_radiusKm';
        provs = await ApiService.get(path);
      } else {
        provs = await ApiService.get('/services/providers');
      }
      if (!mounted) return;
      setState(() {
        _allProviders = provs;
        _applyFilters();
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _onRadiusChanged(double radius) {
    setState(() {
      _radiusKm = radius;
      _loading = true;
    });
    _loadProviders();
  }

  Future<void> _loadUnreadCount() async {
    try {
      final data = await ApiService.get('/notifications/unread-count');
      if (mounted) setState(() => _unreadCount = data as int);
    } catch (e, st) { AppLogger.e('customer_home_screen', 'Operation failed', e, st); }
  }

  Future<void> _loadUserRole() async {
    try {
      final data = await ApiService.get('/users/profile');
      if (!mounted) return;
      final roles = data['roles'];
      final parsedRoles = roles is List ? roles.cast<String>() : <String>[];
      setState(() {
        _hasMultipleRoles = parsedRoles.length > 1;
        _currentUser = User.fromJson(Map<String, dynamic>.from(data));
      });
    } catch (e, st) { AppLogger.e('customer_home_screen', 'Operation failed', e, st); }
  }

  Future<void> _showLocationPicker() async {
    final loc = LocalizationProvider.of(context);
    final cityController = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Set location'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => Navigator.pop(ctx, 'gps'),
                icon: const Icon(Icons.my_location),
                label: Text(loc.tr('use_current_location')),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Row(children: [
              Expanded(child: Divider()),
              Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Text('OR', style: TextStyle(color: Colors.grey, fontSize: 12))),
              Expanded(child: Divider()),
            ]),
            const SizedBox(height: 16),
            TextField(
              controller: cityController,
              decoration: InputDecoration(
                hintText: 'Enter city name (e.g. Lucknow)',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  if (cityController.text.trim().isNotEmpty) {
                    Navigator.pop(ctx, cityController.text.trim());
                  }
                },
                child: const Text('Search in this city'),
              ),
            ),
          ],
        ),
      ),
    );

    if (result == null) return;

    if (result == 'gps') {
      // Use GPS
      final position = await LocationService.getCurrentLocation();
      if (!mounted || position == null) return;
      setState(() {
        _latitude = position.latitude;
        _longitude = position.longitude;
        _locationText = 'Current location';
        _loading = true;
      });
      _loadProviders();
      LocationService.getAddressFromCoordinates(position.latitude, position.longitude)
          .then((addr) { if (mounted) setState(() => _locationText = addr); });
    } else {
      // Search by city name
      try {
        final cityName = result;
        final url = Uri.parse('https://nominatim.openstreetmap.org/search?format=json&q=$cityName&limit=1&countrycodes=in');
        final response = await http.get(url, headers: {'User-Agent': 'DesiCompanyApp/1.0'});
        if (response.statusCode == 200) {
          final data = jsonDecode(response.body);
          if (data is List && data.isNotEmpty) {
            final lat = double.parse(data[0]['lat']);
            final lon = double.parse(data[0]['lon']);
            if (!mounted) return;
            setState(() {
              _latitude = lat;
              _longitude = lon;
              _locationText = cityName;
              _radiusKm = 10;
              _loading = true;
            });
            _loadProviders();
          }
        }
      } catch (_) {}
    }
  }

  Future<void> _initLocation() async {
    final position = await LocationService.getCurrentLocation();
    if (!mounted) return;
    if (position != null) {
      _latitude = position.latitude;
      _longitude = position.longitude;
      final address = await LocationService.getAddressFromCoordinates(
        position.latitude,
        position.longitude,
      );
      if (!mounted) return;
      setState(() => _locationText = address);
      _loadProviders();
    }
  }

  void _selectCategory(String? id) {
    setState(() {
      _selectedCategoryId = _selectedCategoryId == id ? null : id;
      _applyFilters();
    });
  }

  void _applyFilters() {
    List results = _allProviders;

    if (_selectedCategoryId != null) {
      results = results.where((p) {
        final svcs = p['services'] as List? ?? [];
        return svcs.any((s) {
          final cat = s['category'];
          if (cat == null) return false;
          return cat['id'] == _selectedCategoryId;
        });
      }).toList();
    }

    if (_searchQuery.isNotEmpty) {
      results = results.where((p) {
        final name = '${p['firstName'] ?? ''} ${p['lastName'] ?? ''}'.toLowerCase();
        final city = (p['city'] ?? '').toLowerCase();
        return name.contains(_searchQuery.toLowerCase()) || city.contains(_searchQuery.toLowerCase());
      }).toList();
    }

    results.sort((a, b) {
      final da = double.tryParse('${a['distance'] ?? ''}');
      final db = double.tryParse('${b['distance'] ?? ''}');
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da.compareTo(db);
    });

    _filteredProviders = results;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      body: Container(
        color: const Color(0xFF66A3FF),
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(),
              _buildSearchBar(),
              _buildRadiusFilter(),
              Expanded(
                child: _loading
                    ? const Center(child: CircularProgressIndicator(color: Colors.white))
                    : _buildContent(),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: _buildBottomNav(),
    );
  }

  Widget _buildHeader() {
    final loc = LocalizationProvider.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          GestureDetector(
            onTap: _showLocationPicker,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.location_on, color: Colors.white, size: 18),
                    ),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _locationText == 'Set location' ? loc.tr('set_location') : _locationText,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.8),
                            fontSize: 12,
                          ),
                        ),
                        Text(
                          loc.tr('find_services'),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
          Row(
            children: [
              if (_hasMultipleRoles) ...[
                GestureDetector(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ProfilePickerScreen(user: _currentUser!),
                      ),
                    ).then((_) {
                      _loadUserRole();
                      _loadUnreadCount();
                    });
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.swap_horiz, color: Colors.white, size: 14),
                        const SizedBox(width: 4),
                        Text(
                          loc.tr('switch_profile'),
                          style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              _buildNotificationButton(),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationButton() {
    final loc = LocalizationProvider.of(context);
    return Tooltip(
      message: loc.tr('header_notifications'),
      child: GestureDetector(
        onTap: () async {
          await Navigator.pushNamed(context, '/notifications');
          _loadUnreadCount();
        },
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.notifications_outlined, color: Colors.white, size: 20),
            ),
            if (_unreadCount > 0)
              Positioned(
                right: -2,
                top: -2,
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(
                    color: Color(0xFFE53935),
                    shape: BoxShape.circle,
                  ),
                  child: Text(
                    _unreadCount > 9 ? '9+' : '$_unreadCount',
                    style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    final loc = LocalizationProvider.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.grey.shade200, width: 1),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: TextField(
          controller: _searchController,
          onChanged: (value) {
            setState(() {
              _searchQuery = value;
              _applyFilters();
            });
          },
          decoration: InputDecoration(
            hintText: loc.tr('search_hint'),
            hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 14),
            prefixIcon: const Icon(Icons.search, color: AppTheme.primary, size: 22),
            suffixIcon: _searchQuery.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear, size: 20),
                    onPressed: () {
                      _searchController.clear();
                      setState(() {
                        _searchQuery = '';
                        _applyFilters();
                      });
                    },
                  )
                : null,
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          ),
        ),
      ),
    );
  }

  Widget _buildRadiusFilter() {
    final loc = LocalizationProvider.of(context);
    final options = [
      {'label': loc.tr('km_2'), 'value': 2.0},
      {'label': loc.tr('km_5'), 'value': 5.0},
      {'label': loc.tr('km_10'), 'value': 10.0},
      {'label': loc.tr('km_25'), 'value': 25.0},
      {'label': loc.tr('km_all'), 'value': 0.0},
    ];
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: options.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final opt = options[index];
          final value = opt['value'] as double;
          final isSelected = _radiusKm == value;
          return ChoiceChip(
            label: Text(
              opt['label'] as String,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: isSelected ? Colors.white : Colors.grey.shade600,
              ),
            ),
            selected: isSelected,
            selectedColor: AppTheme.primary,
            backgroundColor: Colors.white,
            side: BorderSide(
              color: isSelected ? AppTheme.primary : Colors.grey.shade300,
            ),
            onSelected: (_) => _onRadiusChanged(value),
          );
        },
      ),
    );
  }

  Widget _buildContent() {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFFF8F9FA),
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
        children: [
          _buildCategoriesSection(),
          const SizedBox(height: 24),
          _buildProvidersSection(),
        ],
      ),
    );
  }

  Widget _buildCategoriesSection() {
    final loc = LocalizationProvider.of(context);
    final displayCategories = _showAllCategories ? _categories : _categories.take(8).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              loc.tr('categories'),
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
            ),
            if (_categories.length > 8)
              TextButton(
                onPressed: () {
                  setState(() {
                    _showAllCategories = !_showAllCategories;
                  });
                },
                child: Text(_showAllCategories ? loc.tr('show_less') : loc.tr('view_all')),
              ),
          ],
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 4,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 0.85,
          ),
          itemCount: displayCategories.length,
          itemBuilder: (context, index) {
            return _buildCategoryCard(displayCategories[index]);
          },
        ),
      ],
    );
  }

  Widget _buildCategoryCard(ServiceCategory cat) {
    final iconData = _categoryIcons[cat.nameEn.toLowerCase()] ?? _defaultIcon;
    final color = iconData['color'] as Color;
    final icon = iconData['icon'] as IconData;
    final isSelected = cat.id == _selectedCategoryId;

    return GestureDetector(
      onTap: () => _selectCategory(cat.id),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: isSelected ? color : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected ? color : Colors.grey.shade200,
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: (isSelected ? color : Colors.black).withValues(alpha: 0.08),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: isSelected ? Colors.white.withValues(alpha: 0.2) : color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: isSelected ? Colors.white : color, size: 20),
            ),
            const SizedBox(height: 4),
            Text(
              cat.nameEn,
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w600,
                color: isSelected ? Colors.white : AppTheme.textPrimary,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProvidersSection() {
    final loc = LocalizationProvider.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '${loc.tr('providers')}${_selectedCategoryId != null ? " (${_filteredProviders.length})" : ""}',
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
            ),
            if (_selectedCategoryId != null)
              TextButton(
                onPressed: () => setState(() {
                  _selectedCategoryId = null;
                  _applyFilters();
                }),
                child: Text(loc.tr('clear_filter')),
              ),
          ],
        ),
        const SizedBox(height: 12),
        if (_filteredProviders.isEmpty)
          _buildEmptyState()
        else
          ..._filteredProviders.map((p) => _buildProviderCard(p)),
      ],
    );
  }

  Widget _buildEmptyState() {
    final loc = LocalizationProvider.of(context);
    return Container(
      padding: const EdgeInsets.all(40),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Icon(Icons.search_off, size: 64, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          Text(
            loc.tr('no_providers'),
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: Colors.grey.shade600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            loc.tr('try_adjusting'),
            style: TextStyle(color: Colors.grey.shade500),
          ),
        ],
      ),
    );
  }

  Widget _buildProviderCard(Map<String, dynamic> p) {
    final rating = double.tryParse(p['averageRating']?.toString() ?? '0') ?? 0;
    final services = (p['services'] as List? ?? []).take(2).toList();

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200, width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => Navigator.pushNamed(context, '/provider-detail', arguments: p),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                SizedBox(
                  width: 64,
                  height: 64,
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      _buildProviderAvatar(p),
                      if (p['isOnline'] == true)
                        Positioned(
                          right: -2,
                          bottom: -2,
                          child: Container(
                            width: 16,
                            height: 16,
                            decoration: BoxDecoration(
                              color: const Color(0xFF4CAF50),
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 2.5),
                            ),
                          ),
                        ),
                    ],
                  ),
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
                              '${p['firstName'] ?? ''} ${p['lastName'] ?? ''}',
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.textPrimary,
                              ),
                            ),
                          ),
                          _buildRatingBadge(rating),
                        ],
                      ),
                      const SizedBox(height: 4),
                      if (p['city'] != null)
                        Row(
                          children: [
                            Icon(Icons.location_on_outlined, size: 13, color: Colors.grey.shade400),
                            const SizedBox(width: 3),
                            Text(
                              p['city'],
                              style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                            ),
                          ],
                        ),
                      const SizedBox(height: 2),
                      if (p['distance'] != null)
                        DistanceBadge(distanceMeters: double.tryParse('${p['distance']}') ?? 0),
                      const SizedBox(height: 8),
                      if (services.isNotEmpty)
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          children: services.map((s) {
                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: AppTheme.primary.withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                s['name'] ?? '',
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w500,
                                  color: AppTheme.primary,
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Icon(Icons.arrow_forward_ios, size: 14, color: Colors.grey.shade400),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildProviderAvatar(Map<String, dynamic> p) {
    final firstName = (p['firstName'] ?? '').toString();
    final initial = firstName.isNotEmpty ? firstName[0] : '?';
    return Container(
      width: 64,
      height: 64,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppTheme.primary,
            AppTheme.primary.withValues(alpha: 0.7),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: AppTheme.primary.withValues(alpha: 0.3),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Center(
        child: Text(
          initial.toUpperCase(),
          style: const TextStyle(
            color: Colors.white,
            fontSize: 24,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

  Widget _buildRatingBadge(double rating) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF3E0),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.star, size: 14, color: Color(0xFFFF9800)),
          const SizedBox(width: 4),
          Text(
            rating.toStringAsFixed(1),
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Color(0xFFFF9800),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomNav() {
    final loc = LocalizationProvider.of(context);
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 20,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _navItem(Icons.home_rounded, loc.tr('nav_home'), true, () {}),
              _navItem(Icons.assignment_outlined, 'Requests', false, () => Navigator.pushNamed(context, '/customer-requests')),
              _navItem(Icons.chat_bubble_outline, loc.tr('nav_chat'), false, () => Navigator.pushNamed(context, '/conversations')),
              _navItem(Icons.person_outline, 'My Account', false, () => Navigator.pushNamed(context, '/my-account')),
            ],
          ),
        ),
      ),
    );
  }

  Widget _navItem(IconData icon, String label, bool active, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: active
            ? BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              )
            : null,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: active ? AppTheme.primary : AppTheme.textSecondary,
              size: 24,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: active ? FontWeight.w600 : FontWeight.normal,
                color: active ? AppTheme.primary : AppTheme.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
