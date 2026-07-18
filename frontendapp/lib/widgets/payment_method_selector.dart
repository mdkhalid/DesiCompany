import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import '../services/razorpay_service.dart';
import '../theme.dart';

class PaymentMethodSelector extends StatefulWidget {
  final String keyId;
  final String orderId;
  final int amountPaise;
  final double amount;
  final String planId;
  final String purpose;
  final String? billingCycle;

  const PaymentMethodSelector({
    super.key,
    required this.keyId,
    required this.orderId,
    required this.amountPaise,
    required this.amount,
    required this.planId,
    required this.purpose,
    this.billingCycle,
  });

  @override
  State<PaymentMethodSelector> createState() => _PaymentMethodSelectorState();
}

class _PaymentMethodSelectorState extends State<PaymentMethodSelector> {
  bool _processing = false;
  Map<String, dynamic>? _result;
  String? _error;

  Future<void> _launchPayment(String paymentMethod) async {
    if (kIsWeb) {
      setState(() {
        _result = {
          'status': 'failed',
          'error':
              'Razorpay mobile checkout is not available on Flutter Web. Please test this on Android or iOS.',
        };
      });
      return;
    }

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
        purpose: widget.purpose,
        paymentMethod: paymentMethod,
        billingCycle: widget.billingCycle,
      );

      if (!mounted) return;
      if (result?['status'] == 'cancelled') {
        setState(() {
          _processing = false;
        });
        return;
      }
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

  Widget _buildMethodCard(String title, String subtitle, IconData icon,
      String tip, String paymentMethod) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: Colors.grey.shade200)),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: _processing ? null : () => _launchPayment(paymentMethod),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                    color: AppTheme.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(14)),
                child: Icon(icon, color: AppTheme.primary, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.textPrimary)),
                    const SizedBox(height: 2),
                    Text(subtitle,
                        style: TextStyle(
                            fontSize: 12, color: Colors.grey.shade500)),
                    if (tip.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(tip,
                          style: TextStyle(
                              fontSize: 11,
                              fontStyle: FontStyle.italic,
                              color: Colors.grey.shade400)),
                    ],
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

  Widget _buildProcessingState() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: 20),
        const SizedBox(
            width: 48,
            height: 48,
            child: CircularProgressIndicator(strokeWidth: 3)),
        const SizedBox(height: 16),
        const Text('Opening Razorpay...',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        Text('Opening your selected payment method',
            style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildResultState() {
    final status = _result?['status'] ?? 'pending';
    final isSuccess = status == 'success';
    final isFailed = status == 'failed';

    final icon = isSuccess
        ? Icons.check_circle_outlined
        : (isFailed ? Icons.error_outlined : Icons.access_time_outlined);
    final color =
        isSuccess ? Colors.green : (isFailed ? AppTheme.error : Colors.orange);
    final title = isSuccess
        ? (widget.purpose == 'membership'
            ? 'Membership Activated!'
            : 'Subscription Activated!')
        : (isFailed ? 'Payment Failed' : 'Payment Pending');
    final subtitle = isSuccess
        ? (widget.purpose == 'membership'
            ? 'Your membership is now active.'
            : 'Your subscription is now active.')
        : (isFailed
            ? (_result?['error'] ?? 'Please try again.')
            : 'Your subscription will activate shortly.');

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: 16),
        Icon(icon, size: 56, color: color),
        const SizedBox(height: 12),
        Text(title,
            style: TextStyle(
                fontSize: 18, fontWeight: FontWeight.bold, color: color)),
        const SizedBox(height: 6),
        Text(subtitle,
            style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
        const SizedBox(height: 20),
        if (isFailed) ...[
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () => setState(() {
                _result = null;
                _error = null;
              }),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppTheme.primary,
                side: const BorderSide(color: AppTheme.primary),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              child: const Text('Try Again',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            ),
          ),
          const SizedBox(height: 10),
        ],
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () => Navigator.pop(context, _result),
            style: ElevatedButton.styleFrom(
              backgroundColor: isFailed ? AppTheme.error : AppTheme.primary,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
            ),
            child: Text(isFailed ? 'Close' : 'Done',
                style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Colors.white)),
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
      child: SingleChildScrollView(
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
                        borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 20),
            Row(
              children: [
                Text(
                    widget.purpose == 'membership'
                        ? 'Membership Payment'
                        : 'Subscription Payment',
                    style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.textPrimary)),
                const Spacer(),
                Text('₹${widget.amount.toStringAsFixed(0)}',
                    style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.primary)),
              ],
            ),
            const SizedBox(height: 4),
            Text('Choose your payment method',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
            const SizedBox(height: 20),
            if (_processing)
              _buildProcessingState()
            else if (_result != null)
              _buildResultState()
            else ...[
              if (_error != null)
                Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(_error!,
                        style: const TextStyle(
                            color: AppTheme.error, fontSize: 13))),
              _buildMethodCard(
                  'Credit / Debit Card',
                  'Visa, Mastercard, RuPay',
                  Icons.credit_card_outlined,
                  'Opens card payment directly',
                  'card'),
              _buildMethodCard(
                  'Scan / UPI',
                  'UPI ID and QR payment',
                  Icons.qr_code_scanner_outlined,
                  'Opens Razorpay UPI payment directly',
                  'upi'),
              _buildMethodCard(
                  'Installed App',
                  'GPay, PhonePe, Paytm, BHIM',
                  Icons.apps_outlined,
                  'Opens Razorpay UPI apps on Android',
                  'upi'),
            ],
          ],
        ),
      ),
    );
  }
}
