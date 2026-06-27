import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../l10n/strings.dart';
import '../main.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/location_service.dart';
import '../theme.dart';
import 'profile_picker_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _profile;
  bool _loading = true;
  bool _editing = false;
  bool _saving = false;
  String _selectedLanguage = 'en';

  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _addressController = TextEditingController();
  final _cityController = TextEditingController();
  final _stateController = TextEditingController();
  final _pincodeController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _addressController.dispose();
    _cityController.dispose();
    _stateController.dispose();
    _pincodeController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    try {
      final data = await ApiService.get('/users/profile');
      if (!mounted) return;
      setState(() {
        _profile = data;
        _populateFields();
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _populateFields() {
    if (_profile == null) return;
    final role = _profile!['role'];
    Map<String, dynamic>? userData;
    if (role == 'customer') {
      userData = _profile!['customer'];
    } else {
      userData = _profile!['provider'];
    }
    if (userData != null) {
      _firstNameController.text = userData['firstName'] ?? '';
      _lastNameController.text = userData['lastName'] ?? '';
    }
    _emailController.text = _profile!['email'] ?? '';
    _selectedLanguage = _profile!['language'] ?? 'en';
    // Sync locale provider with saved language
    DesiCompanyApp.localeProvider?.setLocale(_selectedLanguage);
    if (userData != null) {
      _addressController.text = userData['address'] ?? '';
      _cityController.text = userData['city'] ?? '';
      _stateController.text = userData['state'] ?? '';
      _pincodeController.text = userData['pincode'] ?? '';
    }
  }

  Future<void> _saveProfile() async {
    final loc = LocalizationProvider.of(context);
    if (!_formKey.currentState!.validate()) return;

    setState(() => _saving = true);

    try {
      await ApiService.patch('/users/profile', body: {
        if (_firstNameController.text.isNotEmpty) 'firstName': _firstNameController.text,
        if (_lastNameController.text.isNotEmpty) 'lastName': _lastNameController.text,
        if (_emailController.text.isNotEmpty) 'email': _emailController.text,
        if (_addressController.text.isNotEmpty) 'address': _addressController.text,
        if (_cityController.text.isNotEmpty) 'city': _cityController.text,
        if (_stateController.text.isNotEmpty) 'state': _stateController.text,
        if (_pincodeController.text.isNotEmpty) 'pincode': _pincodeController.text,
        'language': _selectedLanguage,
      });

      if (!mounted) return;
      setState(() {
        _editing = false;
        _saving = false;
      });
      await _loadProfile();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(loc.tr('profile_updated'))),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(loc.tr('profile_update_failed', params: {'error': e.toString()}))),
        );
      }
    }
  }

  Future<void> _captureLocation() async {
    final loc = LocalizationProvider.of(context);
    try {
      final position = await LocationService.getCurrentLocation();
      if (!mounted) return;
      if (position == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(loc.tr('location_permission_denied'))),
        );
        return;
      }
      await ApiService.patch('/users/profile', body: {
        'latitude': position.latitude,
        'longitude': position.longitude,
      });
      if (!mounted) return;
      await _loadProfile();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(loc.tr('location_saved'))),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(loc.tr('location_save_failed', params: {'error': e.toString()}))),
        );
      }
    }
  }

  Future<void> _switchProfile() async {
    final roles = _profile?['roles'];
    if (roles is! List || roles.length < 2) return;

    final user = User.fromJson(_profile!);
    if (!mounted) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ProfilePickerScreen(user: user),
      ),
    ).then((_) => _loadProfile());
  }

  Future<void> _logout() async {
    await AuthService.logout();
    if (mounted) {
      Navigator.pushReplacementNamed(context, '/login');
    }
  }

  String _getInitials() {
    if (_profile == null) return '?';
    final role = _profile!['role'];
    Map<String, dynamic>? userData;
    if (role == 'customer') {
      userData = _profile!['customer'];
    } else {
      userData = _profile!['provider'];
    }
    if (userData == null) return '?';
    final firstName = userData['firstName'] ?? '';
    if (firstName.isNotEmpty) return firstName[0].toUpperCase();
    return '?';
  }

  @override
  Widget build(BuildContext context) {
    final loc = LocalizationProvider.of(context);
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF6C3FB4), Color(0xFF5E35B1)],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 16, 20, 0),
                child: Row(
                  children: [
                    Tooltip(
                      message: loc.tr('header_back'),
                      child: IconButton(
                        icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
                        onPressed: () => Navigator.pop(context),
                      ),
                    ),
                    Text(
                      loc.tr('my_profile'),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const Spacer(),
                    Tooltip(
                      message: loc.tr(_editing ? 'header_cancel_edit' : 'header_edit'),
                      child: IconButton(
                        icon: Icon(
                          _editing ? Icons.close : Icons.edit,
                          color: Colors.white70,
                        ),
                        onPressed: () {
                          setState(() {
                            _editing = !_editing;
                            if (!_editing) _populateFields();
                          });
                        },
                      ),
                    ),
                    Tooltip(
                      message: loc.tr('header_logout'),
                      child: IconButton(
                        icon: const Icon(Icons.logout, color: Colors.white70),
                        onPressed: _logout,
                      ),
                    ),
                  ],
                ),
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
                        child: ListView(
                          padding: const EdgeInsets.fromLTRB(20, 24, 20, 100),
                          children: [
                            Center(
                              child: Container(
                                width: 100,
                                height: 100,
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [Color(0xFF6C3FB4), Color(0xFF5E35B1)],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                  borderRadius: BorderRadius.circular(50),
                                ),
                                child: Center(
                                  child: Text(
                                    _getInitials(),
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 36,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),
                            Center(
                              child: Text(
                                _profile?['role']?.toString().toUpperCase() ?? '',
                                style: const TextStyle(
                                  color: AppTheme.primary,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                            const SizedBox(height: 24),
                            if (_editing) _buildEditForm(loc) else _buildProfileInfo(loc),
                          ],
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProfileInfo(LocalizationProvider loc) {
    final role = _profile?['role'];
    Map<String, dynamic>? userData;
    if (role == 'customer') {
      userData = _profile?['customer'];
    } else {
      userData = _profile?['provider'];
    }
    final lang = _profile?['language'] == 'hi' ? loc.tr('hindi') : loc.tr('english');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _infoTile(Icons.person, loc.tr('name'), '${userData?['firstName'] ?? ''} ${userData?['lastName'] ?? ''}'.trim()),
        _infoTile(Icons.email, loc.tr('email'), _profile?['email'] ?? loc.tr('not_provided')),
        _infoTile(Icons.phone, loc.tr('phone'), _profile?['phone'] ?? loc.tr('not_provided')),
        _infoTile(Icons.language, loc.tr('language'), lang),
        _infoTile(Icons.location_on, loc.tr('address'), userData?['address'] ?? loc.tr('not_provided')),
        _infoTile(Icons.location_city, loc.tr('city'), userData?['city'] ?? loc.tr('not_provided')),
        _infoTile(Icons.map, loc.tr('state'), userData?['state'] ?? loc.tr('not_provided')),
        _infoTile(Icons.markunread_mailbox, loc.tr('pincode'), userData?['pincode'] ?? loc.tr('not_provided')),
        const SizedBox(height: 16),
        // Switch profile button (only if user has multiple roles)
        if (_profile?['roles'] is List && (_profile!['roles'] as List).length > 1)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: SizedBox(
              width: double.infinity,
              height: 48,
              child: OutlinedButton.icon(
                onPressed: _switchProfile,
                icon: const Icon(Icons.swap_horiz, size: 18),
                label: Text(loc.tr('switch_profile'), style: const TextStyle(fontSize: 14)),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF00BFA5),
                  side: const BorderSide(color: Color(0xFF00BFA5)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          ),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: OutlinedButton.icon(
            onPressed: _captureLocation,
            icon: const Icon(Icons.my_location, size: 18),
            label: Text(loc.tr('set_my_location'), style: const TextStyle(fontSize: 14)),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppTheme.primary,
              side: const BorderSide(color: AppTheme.primary),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ),
      ],
    );
  }

  Widget _infoTile(IconData icon, String label, String value) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
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
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppTheme.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: AppTheme.primary, size: 20),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: AppTheme.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEditForm(LocalizationProvider loc) {
    return Form(
      key: _formKey,
      child: Column(
        children: [
          _buildTextField(_firstNameController, loc.tr('first_name'), Icons.person),
          _buildTextField(_lastNameController, loc.tr('last_name'), Icons.person_outline),
          _buildTextField(_emailController, loc.tr('email'), Icons.email, keyboardType: TextInputType.emailAddress),
          _buildTextField(_addressController, loc.tr('address'), Icons.location_on),
          _buildTextField(_cityController, loc.tr('city'), Icons.location_city),
          _buildTextField(_stateController, loc.tr('state'), Icons.map),
          _buildTextField(_pincodeController, loc.tr('pincode'), Icons.markunread_mailbox, keyboardType: TextInputType.number),
          const SizedBox(height: 16),
          Container(
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.all(16),
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
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.language, color: AppTheme.primary, size: 20),
                    const SizedBox(width: 12),
                    Text(loc.tr('language'), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: AppTheme.textPrimary)),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _buildLanguageOption('en', loc.tr('english')),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _buildLanguageOption('hi', loc.tr('hindi')),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              onPressed: _saving ? null : _saveProfile,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: _saving
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : Text(
                      loc.tr('save_changes'),
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextField(
    TextEditingController controller,
    String label,
    IconData icon, {
    TextInputType keyboardType = TextInputType.text,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
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
      ),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon, color: AppTheme.primary),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide.none,
          ),
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        ),
      ),
    );
  }

  Widget _buildLanguageOption(String code, String label) {
    final isSelected = _selectedLanguage == code;
    return GestureDetector(
      onTap: () {
        setState(() => _selectedLanguage = code);
        DesiCompanyApp.localeProvider?.setLocale(code);
        // Persist language choice
        SharedPreferences.getInstance().then((prefs) => prefs.setString('app_language', code));
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primary : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppTheme.primary : Colors.grey.shade300,
          ),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: isSelected ? Colors.white : AppTheme.textPrimary,
            ),
          ),
        ),
      ),
    );
  }
}
