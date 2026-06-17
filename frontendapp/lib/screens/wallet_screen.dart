import 'package:flutter/material.dart';
import '../services/api_service.dart';

class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});
  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  double _balance = 0;
  List _txns = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _loadWallet(); }

  Future<void> _loadWallet() async {
    try {
      final wallet = await ApiService.get('/wallet');
      final txns = await ApiService.get('/wallet/transactions');
      setState(() {
        _balance = (wallet['balance'] ?? 0).toDouble();
        _txns = txns['transactions'] as List? ?? [];
        _loading = false;
      });
    } catch (e) { setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Wallet')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(padding: const EdgeInsets.all(16), children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(children: [
                    const Text('Balance', style: TextStyle(color: Colors.grey)),
                    Text('₹${_balance.toStringAsFixed(2)}', style: const TextStyle(fontSize: 36, fontWeight: FontWeight.bold)),
                  ]),
                ),
              ),
              const SizedBox(height: 16),
              const Text('Transactions', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ..._txns.map((t) => ListTile(
                leading: Icon(t['type'] == 'credit' ? Icons.arrow_upward : Icons.arrow_downward, color: t['type'] == 'credit' ? Colors.green : Colors.red),
                title: Text(t['description'] ?? ''),
                trailing: Text('₹${(t['amount'] ?? 0).toString()}', style: TextStyle(fontWeight: FontWeight.bold, color: t['type'] == 'credit' ? Colors.green : Colors.red)),
              )),
            ]),
    );
  }
}
