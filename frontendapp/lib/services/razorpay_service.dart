import 'dart:async';
import 'package:flutter/material.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'api_service.dart';
import 'app_logger.dart';

enum PaymentMethodType { card, upi, upiApp }

class RazorpayService {
  static final Map<String, bool> upiAppCache = {};
  static final List<Map<String, String>> upiApps = [
    {'name': 'Google Pay', 'package': 'com.google.android.apps.nbu.paisa.user', 'uri': 'tez://'},
    {'name': 'PhonePe', 'package': 'com.phonepe.app', 'uri': 'phonepe://'},
    {'name': 'Paytm', 'package': 'net.one97.paytm', 'uri': 'paytmmp://'},
    {'name': 'BHIM', 'package': 'in.org.npci.upiapp', 'uri': 'bhim://'},
    {'name': 'Amazon Pay', 'package': 'in.amazon.mShop.android.shopping', 'uri': 'amazonpay://'},
    {'name': 'CRED', 'package': 'com.dreamplug.androidapp', 'uri': 'cred://'},
    {'name': 'Mobikwik', 'package': 'com.mobikwik_new', 'uri': 'mobikwik://'},
    {'name': 'Freecharge', 'package': 'com.freecharge', 'uri': 'freecharge://'},
  ];

  static Future<Map<String, dynamic>> createOrder(String planId) async {
    try {
      return await ApiService.post('/payments/subscription-order', body: {
        'planId': planId,
      }) as Map<String, dynamic>;
    } catch (e) {
      AppLogger.e('RazorpayService', 'Failed to create order', e);
      rethrow;
    }
  }

  static Future<Map<String, dynamic>?> payWithRazorpay({
    required BuildContext context,
    required String keyId,
    required String orderId,
    required int amountPaise,
    required double amount,
    required String planId,
    String? preferredMethod,
    String? upiAppUri,
  }) async {
    final completer = Completer<Map<String, dynamic>?>();

    final razorpay = Razorpay();

    razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, (handler) async {
      try {
        final result = await ApiService.post('/payments/subscription/verify', body: {
          'planId': planId,
          'razorpayPaymentId': handler['razorpay_payment_id'],
          'razorpayOrderId': handler['razorpay_order_id'],
          'razorpaySignature': handler['razorpay_signature'],
        });
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

    razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, (handler) {
      AppLogger.e('RazorpayService', 'Payment error', handler['message'] ?? '');
      if (!completer.isCompleted) {
        completer.complete({'status': 'failed', 'error': handler['message'] ?? 'Payment failed'});
      }
      razorpay.clear();
    });

    razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, (handler) {
      if (!completer.isCompleted) {
        completer.complete({'status': 'pending', 'wallet': handler['wallet_name'] ?? ''});
      }
    });

    try {
      final options = <String, dynamic>{
        'key': keyId,
        'amount': amountPaise,
        'order_id': orderId,
        'name': 'DesiCompany',
        'description': 'Provider Subscription',
        'prefill': {
          'contact': '',
          'email': '',
        },
      };

      if (preferredMethod != null) {
        options['prefill']['method'] = preferredMethod;
      }

      if (upiAppUri != null) {
        options['upi'] = {'intent_uri': upiAppUri};
      }

      razorpay.open(options);
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
}