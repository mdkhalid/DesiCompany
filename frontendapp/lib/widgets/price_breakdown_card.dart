import 'package:flutter/material.dart';
import '../l10n/strings.dart';
import '../services/api_service.dart';
import '../theme.dart';

/// Itemized price breakdown card built from the backend breakdown map
/// returned by `GET /price-breakdown/estimate`.
///
/// Expected keys in [breakdown]:
///   baseAmount, convenienceFee, gstRate, gstAmount, total
class PriceBreakdownCard extends StatelessWidget {
  final Map<String, dynamic> breakdown;
  final bool variablePricing;

  const PriceBreakdownCard({
    super.key,
    required this.breakdown,
    this.variablePricing = false,
  });

  static String _fmt(dynamic v) {
    final d = double.tryParse('$v') ?? 0;
    return d == d.roundToDouble() ? d.toInt().toString() : d.toStringAsFixed(2);
  }

  static String _gstPct(dynamic rate) {
    final pct = (double.tryParse('$rate') ?? 0) * 100;
    return pct == pct.roundToDouble()
        ? pct.toInt().toString()
        : pct.toStringAsFixed(1);
  }

  @override
  Widget build(BuildContext context) {
    final loc = LocalizationProvider.of(context);
    final fee = double.tryParse('${breakdown['convenienceFee']}') ?? 0;

    Widget row(String label, String value, {bool bold = false}) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: bold ? 14 : 13,
                fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
                color: bold ? AppTheme.textPrimary : AppTheme.textSecondary,
              ),
            ),
            Text(
              value,
              style: TextStyle(
                fontSize: bold ? 15 : 13,
                fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
                color: bold ? AppTheme.primary : AppTheme.textPrimary,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            loc.tr('price_breakdown_title'),
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppTheme.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          if (variablePricing)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(
                loc.tr('estimate_depends_on_duration'),
                style: TextStyle(
                  fontSize: 11,
                  fontStyle: FontStyle.italic,
                  color: Colors.grey.shade500,
                ),
              ),
            ),
          row(loc.tr('base_price'), '₹${_fmt(breakdown['baseAmount'])}'),
          row(
            loc.tr('convenience_fee'),
            fee > 0 ? '₹${_fmt(breakdown['convenienceFee'])}' : loc.tr('fee_waived'),
          ),
          row(
            '${loc.tr('gst')} (${_gstPct(breakdown['gstRate'])}%)',
            '₹${_fmt(breakdown['gstAmount'])}',
          ),
          const Divider(height: 16, thickness: 1),
          row(loc.tr('total_amount'), '₹${_fmt(breakdown['total'])}', bold: true),
        ],
      ),
    );
  }
}

/// Fetches and displays the live price breakdown for a given [amount].
/// Re-fetches whenever [amount] changes (e.g. while typing a quote).
class QuotePriceBreakdown extends StatefulWidget {
  final double amount;
  final bool variablePricing;

  const QuotePriceBreakdown({
    super.key,
    required this.amount,
    this.variablePricing = false,
  });

  @override
  State<QuotePriceBreakdown> createState() => _QuotePriceBreakdownState();
}

class _QuotePriceBreakdownState extends State<QuotePriceBreakdown> {
  Future<Map<String, dynamic>?>? _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant QuotePriceBreakdown oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.amount != widget.amount) _load();
  }

  void _load() {
    if (widget.amount <= 0) {
      setState(() => _future = Future.value(null));
      return;
    }
    setState(() {
      _future = ApiService.get(
        '/price-breakdown/estimate?amount=${widget.amount}',
      ).then((v) => v as Map<String, dynamic>?);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (widget.amount <= 0) return const SizedBox.shrink();
    return FutureBuilder<Map<String, dynamic>?>(
      future: _future,
      builder: (ctx, snap) {
        if (!snap.hasData || snap.data == null) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.only(top: 12),
          child: PriceBreakdownCard(
            breakdown: snap.data!,
            variablePricing: widget.variablePricing,
          ),
        );
      },
    );
  }
}
