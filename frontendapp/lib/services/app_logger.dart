import 'package:flutter/foundation.dart';

/// Lightweight conditional logger.
/// In release mode, logs are no-ops unless [verboseLogging] is true.
/// In debug mode, logs are always printed via [debugPrint].
class AppLogger {
  static const bool verboseLogging = bool.fromEnvironment('VERBOSE_LOGGING');

  static void d(String tag, String message) {
    if (kDebugMode) {
      debugPrint('[$tag] $message');
    }
  }

  static void e(String tag, String message, [Object? error, StackTrace? stack]) {
    if (kDebugMode || verboseLogging) {
      debugPrint('[$tag][ERROR] $message${error != null ? ' | $error' : ''}');
      if (stack != null && verboseLogging) {
        debugPrint(stack.toString());
      }
    }
  }

  static void w(String tag, String message) {
    if (kDebugMode || verboseLogging) {
      debugPrint('[$tag][WARN] $message');
    }
  }

  static void i(String tag, String message) {
    if (verboseLogging) {
      debugPrint('[$tag][INFO] $message');
    }
  }
}
