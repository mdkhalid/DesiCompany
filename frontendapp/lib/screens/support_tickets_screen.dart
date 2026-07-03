import 'package:flutter/material.dart';
import '../l10n/strings.dart';
import '../services/api_service.dart';

class SupportTicketsScreen extends StatefulWidget {
  const SupportTicketsScreen({super.key});
  @override
  State<SupportTicketsScreen> createState() => _SupportTicketsScreenState();
}

class _SupportTicketsScreenState extends State<SupportTicketsScreen> {
  List _tickets = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadTickets();
  }

  Future<void> _loadTickets() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService.get('/support/tickets/my');
      if (!mounted) return;
      setState(() { _tickets = data as List; _loading = false; });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final loc = LocalizationProvider.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(loc.tr('support_tickets')),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => _showCreateTicket(context, loc),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _tickets.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.support_agent, size: 64, color: Colors.grey.shade400),
                      const SizedBox(height: 16),
                      Text(loc.tr('no_tickets'), style: TextStyle(color: Colors.grey.shade600)),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadTickets,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(8),
                    itemCount: _tickets.length,
                    itemBuilder: (ctx, i) => _buildTicketCard(_tickets[i], loc),
                  ),
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showCreateTicket(context, loc),
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildTicketCard(Map ticket, LocalizationProvider loc) {
    final status = ticket['status'] ?? 'open';
    final statusColor = _statusColor(status);
    final statusLabel = _statusLabel(status, loc);
    final category = _categoryLabel(ticket['category'] ?? '', loc);
    final createdAt = DateTime.tryParse(ticket['createdAt'] ?? '') ?? DateTime.now();

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: statusColor.withValues(alpha: 0.1),
          child: Icon(_categoryIcon(ticket['category']), color: statusColor, size: 20),
        ),
        title: Text(ticket['subject'] ?? '', maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: Text('$category • $statusLabel', style: TextStyle(color: statusColor, fontSize: 12)),
        trailing: Text(_formatDate(createdAt), style: const TextStyle(fontSize: 11, color: Colors.grey)),
        onTap: () => _openTicketDetail(ticket, loc),
      ),
    );
  }

  void _showCreateTicket(BuildContext context, LocalizationProvider loc) {
    final subjectCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    String selectedCategory = 'booking_issue';

    final categories = [
      {'value': 'booking_issue', 'label': loc.tr('booking_issue')},
      {'value': 'payment_issue', 'label': loc.tr('payment_issue')},
      {'value': 'account_issue', 'label': loc.tr('account_issue')},
      {'value': 'technical_issue', 'label': loc.tr('technical_issue')},
      {'value': 'other', 'label': loc.tr('other')},
    ];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(ctx).viewInsets.bottom + 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(loc.tr('create_ticket'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: selectedCategory,
                decoration: InputDecoration(
                  labelText: loc.tr('category'),
                  border: const OutlineInputBorder(),
                ),
                items: categories.map((c) => DropdownMenuItem(value: c['value'], child: Text(c['label']!))).toList(),
                onChanged: (v) => setModalState(() => selectedCategory = v!),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: subjectCtrl,
                decoration: InputDecoration(
                  labelText: loc.tr('subject'),
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: descCtrl,
                maxLines: 4,
                decoration: InputDecoration(
                  labelText: loc.tr('description'),
                  border: const OutlineInputBorder(),
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () async {
                    if (subjectCtrl.text.isEmpty || descCtrl.text.isEmpty) return;
                    Navigator.pop(ctx);
                    await _createTicket(subjectCtrl.text, descCtrl.text, selectedCategory);
                  },
                  child: Text(loc.tr('submit')),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _createTicket(String subject, String description, String category) async {
    try {
      await ApiService.post('/support/tickets', body: {
        'subject': subject,
        'description': description,
        'category': category,
      });
      _loadTickets();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to create ticket'), backgroundColor: Colors.red),
        );
      }
    }
  }

  void _openTicketDetail(Map ticket, LocalizationProvider loc) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => TicketDetailScreen(ticket: ticket)),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'open': return Colors.orange;
      case 'in_progress': return Colors.blue;
      case 'resolved': return Colors.green;
      case 'closed': return Colors.grey;
      default: return Colors.grey;
    }
  }

  String _statusLabel(String status, LocalizationProvider loc) {
    switch (status) {
      case 'open': return loc.tr('open');
      case 'in_progress': return loc.tr('in_progress');
      case 'resolved': return loc.tr('resolved');
      case 'closed': return loc.tr('closed');
      default: return status;
    }
  }

  String _categoryLabel(String category, LocalizationProvider loc) {
    switch (category) {
      case 'booking_issue': return loc.tr('booking_issue');
      case 'payment_issue': return loc.tr('payment_issue');
      case 'account_issue': return loc.tr('account_issue');
      case 'technical_issue': return loc.tr('technical_issue');
      case 'other': return loc.tr('other');
      default: return category;
    }
  }

  IconData _categoryIcon(String category) {
    switch (category) {
      case 'booking_issue': return Icons.calendar_today;
      case 'payment_issue': return Icons.payment;
      case 'account_issue': return Icons.person;
      case 'technical_issue': return Icons.bug_report;
      default: return Icons.help_outline;
    }
  }

  String _formatDate(DateTime d) {
    return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
  }
}

class TicketDetailScreen extends StatefulWidget {
  final Map ticket;
  const TicketDetailScreen({super.key, required this.ticket});
  @override
  State<TicketDetailScreen> createState() => _TicketDetailScreenState();
}

class _TicketDetailScreenState extends State<TicketDetailScreen> {
  List _messages = [];
  bool _loading = true;
  final _msgCtrl = TextEditingController();
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _loadMessages();
  }

  Future<void> _loadMessages() async {
    try {
      final data = await ApiService.get('/support/tickets/${widget.ticket['id']}/messages');
      if (!mounted) return;
      setState(() { _messages = data as List; _loading = false; });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _sendMessage() async {
    final text = _msgCtrl.text.trim();
    if (text.isEmpty) return;

    setState(() => _sending = true);
    try {
      await ApiService.post('/support/tickets/${widget.ticket['id']}/messages', body: {
        'message': text,
      });
      _msgCtrl.clear();
      await _loadMessages();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to send'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = widget.ticket['status'] ?? 'open';
    final isClosed = status == 'resolved' || status == 'closed';

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.ticket['subject'] ?? 'Ticket'),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 8, top: 10),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: _statusColor(status).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              _statusLabel(status),
              style: TextStyle(color: _statusColor(status), fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _messages.isEmpty
                    ? const Center(child: Text('No messages yet'))
                    : ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: _messages.length,
                        itemBuilder: (ctx, i) => _buildMessage(_messages[i]),
                      ),
          ),
          if (!isClosed)
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Theme.of(context).scaffoldBackgroundColor,
                boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 4, offset: const Offset(0, -2))],
              ),
              child: SafeArea(
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _msgCtrl,
                        decoration: const InputDecoration(
                          hintText: 'Type a message...',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        ),
                        maxLines: null,
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      icon: _sending
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.send, color: Colors.blue),
                      onPressed: _sending ? null : _sendMessage,
                    ),
                  ],
                ),
              ),
            ),
          if (isClosed)
            Container(
              padding: const EdgeInsets.all(12),
              color: Colors.grey.shade100,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.lock_outline, size: 16, color: Colors.grey.shade600),
                  const SizedBox(width: 8),
                  Text('This ticket is $status', style: TextStyle(color: Colors.grey.shade600)),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildMessage(Map msg) {
    final isAdmin = msg['isAdmin'] == true;
    return Align(
      alignment: isAdmin ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.all(10),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        decoration: BoxDecoration(
          color: isAdmin ? Colors.grey.shade200 : Colors.blue.shade50,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (isAdmin)
              Text('Support', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.blue.shade700)),
            Text(msg['message'] ?? ''),
            const SizedBox(height: 4),
            Text(
              _formatDateTime(DateTime.tryParse(msg['createdAt'] ?? '') ?? DateTime.now()),
              style: TextStyle(fontSize: 10, color: Colors.grey.shade500),
            ),
          ],
        ),
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'open': return Colors.orange;
      case 'in_progress': return Colors.blue;
      case 'resolved': return Colors.green;
      case 'closed': return Colors.grey;
      default: return Colors.grey;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'open': return 'Open';
      case 'in_progress': return 'In Progress';
      case 'resolved': return 'Resolved';
      case 'closed': return 'Closed';
      default: return status;
    }
  }

  String _formatDateTime(DateTime d) {
    final h = d.hour.toString().padLeft(2, '0');
    final m = d.minute.toString().padLeft(2, '0');
    return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')} $h:$m';
  }
}
