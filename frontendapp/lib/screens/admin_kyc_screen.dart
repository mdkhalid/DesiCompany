import 'package:flutter/material.dart';
import '../l10n/strings.dart';
import '../services/api_service.dart';
import '../theme.dart';
import '../utils/id_helpers.dart';

class AdminKycScreen extends StatefulWidget {
  const AdminKycScreen({super.key});
  @override
  State<AdminKycScreen> createState() => _AdminKycScreenState();
}

class _AdminKycScreenState extends State<AdminKycScreen>
    with SingleTickerProviderStateMixin {
  List _allDocs = [];
  bool _loading = true;
  String? _error;
  late TabController _tabController;

  final _tabs = ['all', 'pending', 'approved', 'rejected'];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
    _tabController.addListener(() => setState(() {}));
    _loadDocuments();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadDocuments() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ApiService.get('/kyc');
      if (!mounted) return;
      setState(() {
        _allDocs = data as List;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  List get _filteredDocs {
    final tab = _tabs[_tabController.index];
    if (tab == 'all') return _allDocs;
    return _allDocs.where((d) => d['status'] == tab).toList();
  }

  Color _statusColor(String status) {
    return switch (status) {
      'pending' => const Color(0xFFFF6F00),
      'under_review' => const Color(0xFF1E88E5),
      'approved' => const Color(0xFF43A047),
      'rejected' => const Color(0xFFE53935),
      _ => Colors.grey,
    };
  }

  String _statusLabel(String status) {
    return status.replaceAll('_', ' ').toUpperCase();
  }

  Future<void> _updateStatus(String id, String status, {String? remarks}) async {
    final body = <String, dynamic>{'status': status};
    if (remarks != null && remarks.isNotEmpty) {
      body['remarks'] = remarks;
    }
    await ApiService.patch('/kyc/$id/status', body: body);
    _loadDocuments();
  }

  void _showConfirmDialog(String id, String action) {
    final remarksController = TextEditingController();
    final isReject = action == 'rejected';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(isReject ? 'Reject KYC' : 'Approve KYC'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(isReject
                ? 'Are you sure you want to reject this KYC document?'
                : 'Are you sure you want to approve this KYC document?'),
            if (isReject) ...[
              const SizedBox(height: 16),
              TextField(
                controller: remarksController,
                decoration: const InputDecoration(
                  labelText: 'Rejection reason (required)',
                  hintText: 'Enter reason...',
                ),
                maxLines: 2,
              ),
            ],
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(AppStrings.tr('cancel')),
          ),
          ElevatedButton(
            onPressed: () async {
              if (isReject && remarksController.text.trim().isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Remarks are required for rejection')),
                );
                return;
              }
              Navigator.pop(ctx);
              try {
                await _updateStatus(
                  id,
                  action,
                  remarks: isReject ? remarksController.text.trim() : null,
                );
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(isReject ? 'KYC rejected' : 'KYC approved'),
                    backgroundColor: isReject ? AppTheme.error : AppTheme.secondary,
                  ),
                );
              } catch (e) {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Failed: $e'), backgroundColor: AppTheme.error),
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: isReject ? AppTheme.error : AppTheme.secondary,
            ),
            child: Text(isReject ? 'Reject' : 'Approve'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredDocs;

    return Scaffold(
      appBar: AppBar(
        title: const Text('KYC Approvals'),
        flexibleSpace: Container(decoration: AppTheme.gradientBackground),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.white,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          tabs: [
            Tab(text: 'All (${_allDocs.length})'),
            Tab(text: 'Pending (${_allDocs.where((d) => d['status'] == 'pending').length})'),
            Tab(text: 'Approved (${_allDocs.where((d) => d['status'] == 'approved').length})'),
            Tab(text: 'Rejected (${_allDocs.where((d) => d['status'] == 'rejected').length})'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.error_outline, size: 64, color: AppTheme.error),
                      const SizedBox(height: 16),
                      Text(_error!, style: const TextStyle(color: AppTheme.error)),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadDocuments,
                        child: Text(AppStrings.tr('retry')),
                      ),
                    ],
                  ),
                )
              : filtered.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.verified_user, size: 64, color: Colors.grey.shade300),
                          const SizedBox(height: 16),
                          const Text(
                            'No documents found',
                            style: TextStyle(color: AppTheme.textSecondary, fontSize: 16),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadDocuments,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(20),
                        itemCount: filtered.length,
                        itemBuilder: (_, i) => _buildCard(filtered[i]),
                      ),
                    ),
    );
  }

  Widget _buildCard(Map doc) {
    final provider = doc['provider'] ?? {};
    final user = provider['user'] ?? {};
    final providerName =
        '${user['firstName'] ?? ''} ${user['lastName'] ?? ''}'.trim();
    final status = doc['status'] ?? 'pending';
    final statusColor = _statusColor(status);
    final createdAt = doc['createdAt'];
    String dateStr = '';
    if (createdAt != null) {
      try {
        final dt = DateTime.parse(createdAt);
        dateStr = '${dt.day}/${dt.month}/${dt.year}';
      } catch (_) {
        dateStr = createdAt.toString();
      }
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
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
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    providerName.isNotEmpty ? providerName : 'Unknown Provider',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textPrimary,
                      fontSize: 16,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    _statusLabel(status),
                    style: TextStyle(
                      color: statusColor,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _infoRow(Icons.description, 'Document', doc['documentType'] ?? '-'),
            const SizedBox(height: 6),
            _infoRow(Icons.tag, 'Doc Number', shortId((doc['documentNumber'] ?? doc['id'] ?? '-').toString())),
            if (dateStr.isNotEmpty) ...[
              const SizedBox(height: 6),
              _infoRow(Icons.calendar_today, 'Submitted', dateStr),
            ],
            if (status == 'rejected' && doc['remarks'] != null) ...[
              const SizedBox(height: 6),
              _infoRow(Icons.comment, 'Remarks', doc['remarks']),
            ],
            if (status == 'pending') ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => _showConfirmDialog(doc['id'], 'approved'),
                      icon: const Icon(Icons.check, size: 18),
                      label: const Text('Approve'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.secondary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => _showConfirmDialog(doc['id'], 'rejected'),
                      icon: const Icon(Icons.close, size: 18),
                      label: const Text('Reject'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.error,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppTheme.textSecondary),
        const SizedBox(width: 8),
        Text('$label: ', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(color: AppTheme.textPrimary, fontSize: 13, fontWeight: FontWeight.w500),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}
