import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../theme.dart';

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
    if (userData != null) {
      _addressController.text = userData['address'] ?? '';
      _cityController.text = userData['city'] ?? '';
      _stateController.text = userData['state'] ?? '';
      _pincodeController.text = userData['pincode'] ?? '';
    }
  }

  Future<void> _saveProfile() async {
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
      });

      if (!mounted) return;
      setState(() {
        _editing = false;
        _saving = false;
      });
      await _loadProfile();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile updated successfully')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update profile: $e')),
        );
      }
    }
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
                    IconButton(
                      icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
                      onPressed: () => Navigator.pop(context),
                    ),
                    const Text(
                      'My Profile',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const Spacer(),
                    IconButton(
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
                    IconButton(
                      icon: const Icon(Icons.logout, color: Colors.white70),
                      onPressed: _logout,
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
                                style: TextStyle(
                                  color: AppTheme.primary,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                            const SizedBox(height: 24),
                            if (_editing) _buildEditForm() else _buildProfileInfo(),
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

  Widget _buildProfileInfo() {
    final role = _profile?['role'];
    Map<String, dynamic>? userData;
    if (role == 'customer') {
      userData = _profile?['customer'];
    } else {
      userData = _profile?['provider'];
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _infoTile(Icons.person, 'Name', '${userData?['firstName'] ?? ''} ${userData?['lastName'] ?? ''}'.trim()),
        _infoTile(Icons.email, 'Email', _profile?['email'] ?? 'Not provided'),
        _infoTile(Icons.phone, 'Phone', _profile?['phone'] ?? 'Not provided'),
        _infoTile(Icons.location_on, 'Address', userData?['address'] ?? 'Not provided'),
        _infoTile(Icons.location_city, 'City', userData?['city'] ?? 'Not provided'),
        _infoTile(Icons.map, 'State', userData?['state'] ?? 'Not provided'),
        _infoTile(Icons.markunread_mailbox, 'Pincode', userData?['pincode'] ?? 'Not provided'),
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
            color: Colors.black.withOpacity(0.05),
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
              color: AppTheme.primary.withOpacity(0.1),
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

  Widget _buildEditForm() {
    return Form(
      key: _formKey,
      child: Column(
        children: [
          _buildTextField(_firstNameController, 'First Name', Icons.person),
          _buildTextField(_lastNameController, 'Last Name', Icons.person_outline),
          _buildTextField(_emailController, 'Email', Icons.email, keyboardType: TextInputType.emailAddress),
          _buildTextField(_addressController, 'Address', Icons.location_on),
          _buildTextField(_cityController, 'City', Icons.location_city),
          _buildTextField(_stateController, 'State', Icons.map),
          _buildTextField(_pincodeController, 'Pincode', Icons.markunread_mailbox, keyboardType: TextInputType.number),
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
                  : const Text(
                      'Save Changes',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
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
            color: Colors.black.withOpacity(0.05),
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
}
