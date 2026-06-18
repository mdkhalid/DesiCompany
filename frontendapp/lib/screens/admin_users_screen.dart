import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../l10n/strings.dart';
import '../theme.dart';

class AdminUsersScreen extends StatefulWidget {
  const AdminUsersScreen({super.key});
  @override
  State<AdminUsersScreen> createState() => _AdminUsersScreenState();
}

class _AdminUsersScreenState extends State<AdminUsersScreen> {
  List _users = [];
  List _filteredUsers = [];
  bool _loading = true;
  String _searchQuery = '';
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadUsers();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadUsers() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService.get('/users');
      if (!mounted) return;
      setState(() {
        _users = data as List;
        _applyFilters();
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _applyFilters() {
    if (_searchQuery.isEmpty) {
      _filteredUsers = List.from(_users);
    } else {
      final query = _searchQuery.toLowerCase();
      _filteredUsers = _users.where((u) {
        final firstName = (u['firstName'] ?? '').toString().toLowerCase();
        final lastName = (u['lastName'] ?? '').toString().toLowerCase();
        final phone = (u['phone'] ?? '').toString().toLowerCase();
        return '$firstName $lastName'.contains(query) || phone.contains(query);
      }).toList();
    }
  }

  Color _roleColor(String role) {
    switch (role.toLowerCase()) {
      case 'admin':
        return AppTheme.error;
      case 'provider':
        return AppTheme.secondary;
      case 'customer':
      default:
        return AppTheme.primary;
    }
  }

  Color _statusColor(String status) {
    return status.toLowerCase() == 'active'
        ? AppTheme.secondary
        : AppTheme.error;
  }

  void _onUserTap(Map<String, dynamic> user) {
    final isActive = (user['status'] ?? 'active') == 'active';
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  '${user['firstName'] ?? ''} ${user['lastName'] ?? ''}'.trim(),
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textPrimary,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              ListTile(
                leading: Icon(
                  isActive ? Icons.block : Icons.check_circle_outline,
                  color: isActive ? AppTheme.error : AppTheme.secondary,
                ),
                title: Text(isActive ? 'Suspend' : 'Activate'),
                onTap: () {
                  Navigator.pop(ctx);
                  _toggleStatus(user, !isActive);
                },
              ),
              ListTile(
                leading: const Icon(Icons.person_outline, color: AppTheme.primary),
                title: const Text('View Profile'),
                onTap: () {
                  Navigator.pop(ctx);
                  _showProfileDialog(user);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _toggleStatus(Map<String, dynamic> user, bool activate) async {
    final loc = LocalizationProvider.of(context);
    final newStatus = activate ? 'active' : 'suspended';
    try {
      await ApiService.patch('/users/${user['id']}/status', body: {'status': newStatus});
      if (!mounted) return;
      setState(() {
        user['status'] = newStatus;
        _applyFilters();
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('User ${activate ? 'activated' : 'suspended'}')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(loc.tr('error'))),
        );
      }
    }
  }

  void _showProfileDialog(Map<String, dynamic> user) {
    final role = (user['role'] ?? 'customer').toString();
    final status = (user['status'] ?? 'active').toString();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircleAvatar(
              radius: 36,
              backgroundColor: _roleColor(role),
              child: Text(
                ((user['firstName'] ?? '?')[0] as String).toUpperCase(),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              '${user['firstName'] ?? ''} ${user['lastName'] ?? ''}'.trim(),
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            _profileDetailRow(Icons.phone, user['phone'] ?? 'N/A'),
            const SizedBox(height: 6),
            _profileDetailRow(Icons.email, user['email'] ?? 'N/A'),
            const SizedBox(height: 6),
            _profileDetailRow(Icons.badge, role[0].toUpperCase() + role.substring(1)),
            const SizedBox(height: 6),
            _profileDetailRow(
              Icons.circle,
              status[0].toUpperCase() + status.substring(1),
              iconColor: _statusColor(status),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Widget _profileDetailRow(IconData icon, String text, {Color? iconColor}) {
    return Row(
      children: [
        Icon(icon, size: 16, color: iconColor ?? AppTheme.textSecondary),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(fontSize: 14, color: AppTheme.textSecondary),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
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
            colors: [Color(0xFF6C3FB4), Color(0xFF5E35B1), Color(0xFF7C4DFF)],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _buildAppBar(loc),
              _buildSearchBar(loc),
              Expanded(
                child: _loading
                    ? const Center(child: CircularProgressIndicator(color: Colors.white))
                    : _buildContent(loc),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAppBar(LocalizationProvider loc) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 16, 20, 0),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
            onPressed: () => Navigator.pop(context),
          ),
          Text(
            loc.tr('user_management'),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
          ),
          const Spacer(),
          if (!_loading)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '${_users.length}',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSearchBar(LocalizationProvider loc) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
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
            hintText: 'Search users...',
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

  Widget _buildContent(LocalizationProvider loc) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFFF8F9FA),
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      child: _filteredUsers.isEmpty
          ? _buildEmptyState(loc)
          : ListView.builder(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
              itemCount: _filteredUsers.length,
              itemBuilder: (context, index) => _buildUserCard(_filteredUsers[index]),
            ),
    );
  }

  Widget _buildEmptyState(LocalizationProvider loc) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.people_outline, size: 64, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          Text(
            _searchQuery.isNotEmpty ? 'No users match your search' : loc.tr('no_data'),
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: Colors.grey.shade600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUserCard(Map<String, dynamic> user) {
    final role = (user['role'] ?? 'customer').toString();
    final status = (user['status'] ?? 'active').toString();
    final firstName = user['firstName'] ?? '';
    final lastName = user['lastName'] ?? '';
    final name = '$firstName $lastName'.trim();
    final phone = user['phone'] ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
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
          onTap: () => _onUserTap(user),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: _roleColor(role),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Center(
                    child: Text(
                      (firstName.isNotEmpty ? firstName[0] : '?').toUpperCase(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name.isNotEmpty ? name : 'Unknown',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      if (phone.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          phone,
                          style: TextStyle(fontSize: 13, color: Colors.grey.shade500),
                        ),
                      ],
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: _roleColor(role).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        role[0].toUpperCase() + role.substring(1),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: _roleColor(role),
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: _statusColor(status).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        status[0].toUpperCase() + status.substring(1),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: _statusColor(status),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
