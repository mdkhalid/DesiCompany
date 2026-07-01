import 'package:flutter/foundation.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

class ErrorHandler {
  static Future<void> initialize() async {
    await SentryFlutter.init(
      (options) {
        options.dsn = const String.fromEnvironment('SENTRY_DSN', defaultValue: '');
        options.tracesSampleRate = 1.0;
        options.debug = kDebugMode;
      },
      appRunner: () {},
    );

    FlutterError.onError = (details) {
      FlutterError.presentError(details);
      if (kReleaseMode) {
        Sentry.captureException(
          details.exception,
          stackTrace: details.stack,
        );
      }
    };

    PlatformDispatcher.instance.onError = (error, stack) {
      if (kReleaseMode) {
        Sentry.captureException(error, stackTrace: stack);
      }
      return true;
    };
  }
}
