import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'api_service.dart';
import 'app_logger.dart';

class RazorpayService {
  static Future<Map<String, dynamic>?> payWithRazorpay({
    required BuildContext context,
    required String keyId,
    required String orderId,
    required int amountPaise,
    required double amount,
    required String planId,
    required String purpose,
    required String paymentMethod,
    String? billingCycle,
  }) async {
    if (kIsWeb) {
      return {
        'status': 'failed',
        'error':
            'Razorpay mobile checkout is not available on Flutter Web. Please test this payment flow on Android or iOS.',
      };
    }

    final completer = Completer<Map<String, dynamic>?>();

    final razorpay = Razorpay();

    razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, (response) async {
      try {
        final verifyPath = purpose == 'membership'
            ? '/payments/membership/verify'
            : '/payments/subscription/verify';

        final paymentId = response is PaymentSuccessResponse
            ? response.paymentId
            : response['razorpay_payment_id'];
        final responseOrderId = response is PaymentSuccessResponse
            ? response.orderId
            : response['razorpay_order_id'];
        final signature = response is PaymentSuccessResponse
            ? response.signature
            : response['razorpay_signature'];

        final body = <String, dynamic>{
          'planId': planId,
          'razorpayPaymentId': paymentId,
          'razorpayOrderId': responseOrderId ?? orderId,
          'razorpaySignature': signature,
        };
        if (purpose == 'membership') {
          body['billingCycle'] = billingCycle ?? 'monthly';
        }

        final result = await ApiService.post(verifyPath, body: body);
        if (!completer.isCompleted) {
          completer.complete(result as Map<String, dynamic>?);
        }
      } catch (e) {
        AppLogger.e('RazorpayService', 'Verification failed', e);
        if (!completer.isCompleted) {
          completer.complete({'status': 'pending', 'error': e.toString()});
        }
      }
      razorpay.clear();
    });

    razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, (response) {
      final code =
          response is PaymentFailureResponse ? response.code : response['code'];
      final message = response is PaymentFailureResponse
          ? response.message
          : response['message'];
      AppLogger.e('RazorpayService', 'Payment error', message ?? '');
      if (!completer.isCompleted) {
        if (code == 2) {
          completer.complete({'status': 'cancelled'});
        } else {
          completer.complete(
              {'status': 'failed', 'error': message ?? 'Payment failed'});
        }
      }
      razorpay.clear();
    });

    razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, (response) {
      final walletName = response is ExternalWalletResponse
          ? response.walletName
          : response['wallet_name'];
      if (!completer.isCompleted) {
        completer.complete({'status': 'pending', 'wallet': walletName ?? ''});
      }
    });

    try {
      final options = <String, dynamic>{
        'key': keyId,
        'amount': amountPaise,
        'order_id': orderId,
        'name': 'DesiCompany',
        'description': purpose == 'membership'
            ? 'Customer Membership'
            : 'Provider Subscription',
        'prefill': {
          'contact': '',
          'email': '',
        },
        'method': _methodOptions(paymentMethod),
        'retry': {
          'enabled': true,
          'max_count': 3,
        },
        'theme': {'color': '#6C3FB4'},
      };

      AppLogger.d(
        'RazorpayService',
        'Opening checkout for order $orderId with method $paymentMethod',
      );
      _openCheckout(
        razorpay: razorpay,
        options: options,
        completer: completer,
      );
    } catch (e) {
      AppLogger.e('RazorpayService', 'Failed to open checkout', e);
      if (!completer.isCompleted) {
        completer.complete({'status': 'failed', 'error': e.toString()});
      }
    }

    return completer.future.timeout(const Duration(minutes: 5), onTimeout: () {
      razorpay.clear();
      return {'status': 'pending', 'error': 'Payment timed out'};
    });
  }

  static void _openCheckout({
    required Razorpay razorpay,
    required Map<String, dynamic> options,
    required Completer<Map<String, dynamic>?> completer,
    bool allowFallback = true,
  }) {
    runZonedGuarded(
      () => razorpay.open(options),
      (error, stack) {
        AppLogger.e('RazorpayService', 'Checkout launch failed', error, stack);
        if (allowFallback && options.containsKey('method')) {
          final fallbackOptions = Map<String, dynamic>.from(options)
            ..remove('method');
          AppLogger.w(
            'RazorpayService',
            'Retrying checkout launch without method restriction',
          );
          _openCheckout(
            razorpay: razorpay,
            options: fallbackOptions,
            completer: completer,
            allowFallback: false,
          );
          return;
        }
        if (!completer.isCompleted) {
          completer.complete({
            'status': 'failed',
            'error': 'Unable to open Razorpay checkout: $error',
          });
        }
        razorpay.clear();
      },
    );
  }

  static Map<String, bool> _methodOptions(String paymentMethod) {
    if (paymentMethod == 'card') {
      return {'card': true};
    }
    return {'upi': true};
  }
}
