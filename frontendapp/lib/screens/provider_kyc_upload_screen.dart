import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../l10n/strings.dart';
import '../services/api_service.dart';
import '../theme.dart';

class ProviderKycUploadScreen extends StatefulWidget {
  const ProviderKycUploadScreen({super.key});

  @override
  State<ProviderKycUploadScreen> createState() => _ProviderKycUploadScreenState();
}

class _ProviderKycUploadScreenState extends State<ProviderKycUploadScreen> {
  final _picker = ImagePicker();

  String? _providerId;
  String _selectedDocType = 'aadhaar';
  final List<XFile> _selectedPhotos = [];
  bool _uploading = false;

  List _existingDocs = [];
  bool _loading = true;
  String? _error;

  static const Map<String, String> _docTypes = {
    'Aadhaar Card': 'aadhaar',
    'PAN Card': 'pan',
    'Driving License': 'dl',
    'Passport': 'passport',
    'Voter ID': 'voter_id',
    'Photo': 'photo',
  };

  static const Map<String, String> _docLabelKeys = {
    'aadhaar': 'doc_aadhaar',
    'pan': 'doc_pan',
    'dl': 'doc_dl',
    'passport': 'doc_passport',
    'voter_id': 'doc_voter',
    'photo': 'doc_photo',
  };

  static const Map<String, String> _statusLabelKeys = {
    'pending': 'kyc_pending',
    'approved': 'kyc_approved',
    'rejected': 'kyc_rejected',
    'under_review': 'kyc_pending',
  };

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  Future<void> _initialize() async {
    try {
      final profile = await ApiService.get('/users/profile');
      if (profile is! Map || profile['provider'] == null) {
        throw Exception('Provider profile not found');
      }
      final providerId = (profile['provider'] as Map)['id']?.toString();
      if (providerId == null || providerId.isEmpty) {
        throw Exception('Provider ID missing');
      }
      if (!mounted) return;
      setState(() => _providerId = providerId);
      await _loadExisting();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _loadExisting() async {
    if (_providerId == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ApiService.get('/kyc/provider/$_providerId');
      if (!mounted) return;
      setState(() {
        _existingDocs = data is List ? data : (data is Map && data['documents'] is List ? data['documents'] as List : []);
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

  Future<void> _pickFromCamera() async {
    try {
      final photo = await _picker.pickImage(source: ImageSource.camera, imageQuality: 70);
      if (photo != null) {
        setState(() {
          _selectedPhotos.add(photo);
        });
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    }
  }

  Future<void> _pickFromGallery() async {
    try {
      final photos = await _picker.pickMultiImage(imageQuality: 70);
      if (photos.isNotEmpty) {
        setState(() {
          _selectedPhotos.addAll(photos);
        });
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    }
  }

  void _removePhoto(int index) {
    setState(() {
      _selectedPhotos.removeAt(index);
    });
  }

  Future<void> _upload() async {
    final loc = LocalizationProvider.of(context);
    if (_providerId == null || _selectedPhotos.isEmpty) return;

    setState(() => _uploading = true);

    try {
      final token = await AuthService.getToken();

      final request = http.MultipartRequest(
        'POST',
        Uri.parse('${ApiService.baseUrl}/kyc/upload'),
      );
      request.fields['providerId'] = _providerId!;
      request.fields['documentType'] = _selectedDocType;
      for (final photo in _selectedPhotos) {
        final bytes = await photo.readAsBytes();
        request.files.add(http.MultipartFile.fromBytes('documents', bytes, filename: photo.name, contentType: http.MediaType.parse(photo.mimeType ?? 'image/jpeg')));
      }
      if (token != null) {
        request.headers['Authorization'] = 'Bearer $token';
      }

      final response = await request.send();
      final body = await response.stream.bytesToString();

      if (!mounted) return;

      if (response.statusCode >= 200 && response.statusCode < 300) {
        setState(() {
          _selectedPhotos.clear();
          _uploading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(loc.tr('uploaded_success')),
            backgroundColor: AppTheme.secondary,
          ),
        );
        await _loadExisting();
      } else {
        setState(() => _uploading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(body.isNotEmpty ? body : 'Upload failed'),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _uploading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: AppTheme.error,
        ),
      );
    }
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

  String _docTypeLabel(String code) {
    final key = _docLabelKeys[code];
    if (key == null) return code;
    final loc = LocalizationProvider.of(context);
    return loc.tr(key);
  }

  String _statusLabel(String status) {
    final key = _statusLabelKeys[status] ?? status;
    final loc = LocalizationProvider.of(context);
    return loc.tr(key);
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
                    IconButton(
                      icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
                      onPressed: () => Navigator.pop(context),
                    ),
                    Text(
                      loc.tr('kyc_documents'),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Expanded(
                child: _loading
                    ? const Center(child: CircularProgressIndicator(color: Colors.white))
                    : _error != null
                        ? _buildErrorState(loc)
                        : Container(
                            decoration: const BoxDecoration(
                              color: Color(0xFFF5F0FF),
                              borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
                            ),
                            child: ListView(
                              padding: const EdgeInsets.fromLTRB(20, 24, 20, 100),
                              children: [
                                _buildUploadCard(loc),
                                const SizedBox(height: 24),
                                _buildExistingSection(loc),
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

  Widget _buildErrorState(LocalizationProvider loc) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFFF5F0FF),
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 64, color: AppTheme.error),
            const SizedBox(height: 16),
            Text(_error!, style: const TextStyle(color: AppTheme.error)),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _initialize,
              child: Text(loc.tr('retry')),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildUploadCard(LocalizationProvider loc) {
    return Container(
      padding: const EdgeInsets.all(16),
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppTheme.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.upload_file, color: AppTheme.primary, size: 20),
              ),
              const SizedBox(width: 12),
              Text(
                loc.tr('add_photos'),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _selectedDocType,
                isExpanded: true,
                icon: const Icon(Icons.keyboard_arrow_down, color: AppTheme.primary),
                items: _docTypes.entries
                    .map((entry) => DropdownMenuItem<String>(
                          value: entry.value,
                          child: Text(
                            entry.key,
                            style: const TextStyle(fontSize: 14, color: AppTheme.textPrimary),
                          ),
                        ))
                    .toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _selectedDocType = val);
                },
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _uploading ? null : _pickFromCamera,
                  icon: const Icon(Icons.camera_alt, size: 18),
                  label: Text(loc.tr('take_photo'), style: const TextStyle(fontSize: 13)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.primary,
                    side: const BorderSide(color: AppTheme.primary),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _uploading ? null : _pickFromGallery,
                  icon: const Icon(Icons.photo_library, size: 18),
                  label: Text(loc.tr('choose_from_gallery'), style: const TextStyle(fontSize: 13)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.primary,
                    side: const BorderSide(color: AppTheme.primary),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
            ],
          ),
          if (_selectedPhotos.isNotEmpty) ...[
            const SizedBox(height: 16),
            SizedBox(
              height: 90,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _selectedPhotos.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) => _buildThumbnail(File(_selectedPhotos[i].path), onRemove: () => _removePhoto(i)),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '${_selectedPhotos.length} ${loc.tr('selected_photos')}',
              style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
            ),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton.icon(
              onPressed: _uploading || _selectedPhotos.isEmpty ? null : _upload,
              icon: _uploading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : const Icon(Icons.cloud_upload, size: 20),
              label: Text(
                _uploading ? loc.tr('uploading') : loc.tr('upload'),
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                disabledBackgroundColor: Colors.grey.shade300,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildThumbnail(dynamic source, {VoidCallback? onRemove}) {
    final file = source is File ? source : null;
    final path = source is String ? source : file?.path;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: Container(
            width: 80,
            height: 80,
            color: Colors.grey.shade100,
            child: file != null
                ? Image.file(file, width: 80, height: 80, fit: BoxFit.cover)
                : const Icon(Icons.image, size: 32, color: AppTheme.textSecondary),
          ),
        ),
        if (onRemove != null)
          Positioned(
            top: -6,
            right: -6,
            child: GestureDetector(
              onTap: onRemove,
              child: Container(
                width: 22,
                height: 22,
                decoration: const BoxDecoration(
                  color: AppTheme.error,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.close, size: 14, color: Colors.white),
              ),
            ),
          ),
        if (onRemove == null && path != null && !File(path).existsSync())
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Center(
                child: Icon(Icons.broken_image, size: 24, color: Colors.white70),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildExistingSection(LocalizationProvider loc) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          loc.tr('kyc_documents'),
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: AppTheme.textPrimary,
          ),
        ),
        const SizedBox(height: 12),
        if (_existingDocs.isEmpty)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 40),
            alignment: Alignment.center,
            child: Column(
              children: [
                Icon(Icons.folder_open, size: 56, color: Colors.grey.shade300),
                const SizedBox(height: 12),
                Text(
                  loc.tr('no_documents_yet'),
                  style: const TextStyle(color: AppTheme.textSecondary, fontSize: 14),
                ),
              ],
            ),
          )
        else
          ..._existingDocs.map((doc) => _buildExistingCard(doc, loc)),
      ],
    );
  }

  Widget _buildExistingCard(Map doc, LocalizationProvider loc) {
    final docType = doc['documentType']?.toString() ?? '-';
    final status = doc['status']?.toString() ?? 'pending';
    final statusColor = _statusColor(status);
    final remarks = doc['remarks']?.toString();

    List files = [];
    final rawFiles = doc['files'] ?? doc['documents'];
    if (rawFiles is List) files = rawFiles;
    if (files.isEmpty && doc['fileUrl'] != null) files = [doc['fileUrl']];
    if (files.isEmpty && doc['url'] != null) files = [doc['url']];

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
                Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: AppTheme.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.description, size: 18, color: AppTheme.primary),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      _docTypeLabel(docType),
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                  ],
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
            if (files.isNotEmpty) ...[
              const SizedBox(height: 12),
              SizedBox(
                height: 80,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: files.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (_, i) {
                    final f = files[i];
                    final pathOrUrl = f is Map ? (f['path'] ?? f['url'] ?? '') : f.toString();
                    return _buildThumbnail(pathOrUrl);
                  },
                ),
              ),
            ],
            if (status == 'rejected' && remarks != null && remarks.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.error.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppTheme.error.withValues(alpha: 0.2)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.comment, size: 14, color: AppTheme.error),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        remarks,
                        style: const TextStyle(fontSize: 12, color: AppTheme.error),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}