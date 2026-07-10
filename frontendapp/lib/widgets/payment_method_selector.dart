import 'package:flutter/material.dart';
import '../services/razorpay_service.dart';
import '../theme.dart';

class PaymentMethod {
  final String id;
  final String title;
  final String subtitle;
  final IconData icon;
  final String? razorpayMethod;
  final List<Map<String, String>>? apps;

  const PaymentMethod({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.icon,
    this.razorpayMethod,
    this.apps,
  });
}

class PaymentMethodSelector extends StatefulWidget {
  final String keyId;
  final String orderId;
  final int amountPaise;
  final double amount;
  final String planId;
  final String? preferredMethod;

  const PaymentMethodSelector({
    super.key,
    required this.keyId,
    required this.orderId,
    required this.amountPaise,
    required this.amount,
    required this.planId,
    this.preferredMethod,
  });

  @override
  State<PaymentMethodSelector> createState() => _PaymentMethodSelectorState();
}

class _PaymentMethodSelectorState extends State<PaymentMethodSelector> {
  bool _processing = false;
  Map<String, dynamic>? _result;
  String? _error;

  static const _methods = [
    PaymentMethod(
      id: 'card',
      title: 'Credit / Debit Card',
      subtitle: 'Visa, Mastercard, RuPay',
      icon: Icons.credit_card_outlined,
      razorpayMethod: 'card',
    ),
    PaymentMethod(
      id: 'upi',
      title: 'UPI / Scan QR',
      subtitle: 'Google Pay, PhonePe, Paytm & more',
      icon: Icons.qr_code_scanner_outlined,
      razorpayMethod: 'upi',
    ),
    PaymentMethod(
      id: 'apps',
      title: 'Pay via App',
      subtitle: 'Choose your preferred UPI app',
      icon: Icons.phone_android_outlined,
    ),
  ];

  Future<void> _pay(String? method, {String? appUri}) async {
    setState(() {
      _processing = true;
      _error = null;
    });

    try {
      final result = await RazorpayService.payWithRazorpay(
        context: context,
        keyId: widget.keyId,
        orderId: widget.orderId,
        amountPaise: widget.amountPaise,
        amount: widget.amount,
        planId: widget.planId,
        preferredMethod: method,
        upiAppUri: appUri,
      );

      if (!mounted) return;
      setState(() {
        _result = result;
        _processing = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _processing = false;
      });
    }
  }

  Widget _buildMethodCard(PaymentMethod method) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: _processing
            ? null
            : () {
                if (method.id == 'apps') {
                  _showAppList();
                } else {
                  _pay(method.razorpayMethod);
                }
              },
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppTheme.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(method.icon, color: AppTheme.primary, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      method.title,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      method.subtitle,
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey.shade500,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: Colors.grey.shade400),
            ],
          ),
        ),
      ),
    );
  }

  void _showAppList() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Pay via UPI App',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Select your preferred UPI app',
              style: TextStyle(fontSize: 13, color: Colors.grey.shade500),
            ),
            const SizedBox(height: 16),
            ...RazorpayService.upiApps.map((app) => _buildAppItem(ctx, app)),
          ],
        ),
      ),
    );
  }

  Widget _buildAppItem(BuildContext ctx, Map<String, String> app) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: _processing
            ? null
            : () {
                Navigator.pop(ctx);
                _pay('upi', appUri: app['uri']);
              },
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            border: Border.all(color: Colors.grey.shade200),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppTheme.primary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Center(
                  child: Text(
                    app['name']!.substring(0, 1),
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.primary,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  app['name']!,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: AppTheme.textPrimary,
                  ),
                ),
              ),
              Icon(Icons.open_in_new, size: 18, color: Colors.grey.shade400),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProcessingState() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: 20),
        const SizedBox(
          width: 48,
          height: 48,
          child: CircularProgressIndicator(strokeWidth: 3),
        ),
        const SizedBox(height: 16),
        const Text(
          'Processing payment...',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 4),
        Text(
          'Please complete the payment in the popup',
          style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildResultState() {
    final status = _result?['status'] ?? 'pending';
    final isSuccess = status == 'success';
    final isFailed = status == 'failed';

    IconData icon;
    Color color;
    String title;
    String subtitle;

    if (isSuccess) {
      icon = Icons.check_circle_outlined;
      color = Colors.green;
      title = 'Subscription Activated!';
      subtitle = 'Your subscription is now active.';
    } else if (isFailed) {
      icon = Icons.error_outlined;
      color = AppTheme.error;
      title = 'Payment Failed';
      subtitle = _result?['error'] ?? 'Please try again.';
    } else {
      icon = Icons.access_time_outlined;
      color = Colors.orange;
      title = 'Payment Received';
      subtitle = 'Your subscription will activate shortly.';
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: 16),
        Icon(icon, size: 56, color: color),
        const SizedBox(height: 12),
        Text(
          title,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          subtitle,
          style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
        ),
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () => Navigator.pop(context, _result),
            style: ElevatedButton.styleFrom(
              backgroundColor: isFailed ? AppTheme.error : AppTheme.primary,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: Text(
              isFailed ? 'Try Again' : 'Done',
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              const Text(
                'Choose Payment Method',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
              ),
              const Spacer(),
              Text(
                '₹${widget.amount.toStringAsFixed(0)}',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Secure payment via Razorpay',
            style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
          ),
          const SizedBox(height: 20),
          if (_processing)
            _buildProcessingState()
          else if (_result != null)
            _buildResultState()
          else ...[
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  _error!,
                  style: const TextStyle(color: AppTheme.error, fontSize: 13),
                ),
              ),
            ..._methods.map(_buildMethodCard),
          ],
        ],
      ),
    );
  }
}