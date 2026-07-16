import 'dart:convert';
import 'package:hive_flutter/hive_flutter.dart';
import '../models/hive_chat_message.dart';

class CacheService {
  static const String _userBox = 'user_cache';
  static const String _bookingsBox = 'bookings_cache';
  static const String _servicesBox = 'services_cache';
  static const String _chatBox = 'chat_cache';
  static const String _settingsBox = 'settings_cache';

  static Future<void> init() async {
    await Hive.initFlutter();
    Hive.registerAdapter(HiveChatMessageAdapter());
    await Hive.openBox(_userBox);
    await Hive.openBox(_bookingsBox);
    await Hive.openBox(_servicesBox);
    await Hive.openBox(_chatBox);
    await Hive.openBox(_settingsBox);
  }

  // User cache
  static Future<void> cacheUser(Map<String, dynamic> userData) async {
    final box = Hive.box(_userBox);
    await box.put('current_user', jsonEncode(userData));
  }

  static Future<Map<String, dynamic>?> getCachedUser() async {
    final box = Hive.box(_userBox);
    final data = box.get('current_user') as String?;
    if (data != null) {
      return jsonDecode(data) as Map<String, dynamic>;
    }
    return null;
  }

  static Future<void> clearUserCache() async {
    final box = Hive.box(_userBox);
    await box.clear();
  }

  // Bookings cache
  static Future<void> cacheBookings(List<dynamic> bookings) async {
    final box = Hive.box(_bookingsBox);
    await box.put('bookings', jsonEncode(bookings));
    await box.put('last_updated', DateTime.now().toIso8601String());
  }

  static Future<List<dynamic>?> getCachedBookings() async {
    final box = Hive.box(_bookingsBox);
    final data = box.get('bookings') as String?;
    if (data != null) {
      return jsonDecode(data) as List<dynamic>;
    }
    return null;
  }

  static Future<DateTime?> getBookingsLastUpdated() async {
    final box = Hive.box(_bookingsBox);
    final data = box.get('last_updated') as String?;
    if (data != null) {
      return DateTime.parse(data);
    }
    return null;
  }

  static Future<void> clearBookingsCache() async {
    final box = Hive.box(_bookingsBox);
    await box.clear();
  }

  // Services cache
  static Future<void> cacheServiceCategories(List<dynamic> categories) async {
    final box = Hive.box(_servicesBox);
    await box.put('categories', jsonEncode(categories));
    await box.put('last_updated', DateTime.now().toIso8601String());
  }

  static Future<List<dynamic>?> getCachedServiceCategories() async {
    final box = Hive.box(_servicesBox);
    final data = box.get('categories') as String?;
    if (data != null) {
      return jsonDecode(data) as List<dynamic>;
    }
    return null;
  }

  static Future<void> clearServicesCache() async {
    final box = Hive.box(_servicesBox);
    await box.clear();
  }

  // Chat cache
  static Future<void> cacheChatMessages(String chatId, List<dynamic> messages) async {
    final box = Hive.box(_chatBox);
    await box.put('chat_$chatId', jsonEncode(messages));
  }

  static Future<List<dynamic>?> getCachedChatMessages(String chatId) async {
    final box = Hive.box(_chatBox);
    final data = box.get('chat_$chatId') as String?;
    if (data != null) {
      return jsonDecode(data) as List<dynamic>;
    }
    return null;
  }

  static Future<void> clearChatCache() async {
    final box = Hive.box(_chatBox);
    await box.clear();
  }

  // Settings cache
  static Future<void> saveSetting(String key, dynamic value) async {
    final box = Hive.box(_settingsBox);
    await box.put(key, jsonEncode(value));
  }

  static Future<dynamic> getSetting(String key) async {
    final box = Hive.box(_settingsBox);
    final data = box.get(key) as String?;
    if (data != null) {
      return jsonDecode(data);
    }
    return null;
  }

  static Future<void> clearSettingsCache() async {
    final box = Hive.box(_settingsBox);
    await box.clear();
  }

  // Clear all caches
  static Future<void> clearAllCaches() async {
    await clearUserCache();
    await clearBookingsCache();
    await clearServicesCache();
    await clearChatCache();
    await clearSettingsCache();
  }

  // Check if cache is stale (older than specified duration)
  static Future<bool> isCacheStale(String cacheType, {Duration maxAge = const Duration(hours: 1)}) async {
    DateTime? lastUpdated;
    
    switch (cacheType) {
      case 'bookings':
        lastUpdated = await getBookingsLastUpdated();
        break;
      case 'services':
        final box = Hive.box(_servicesBox);
        final data = box.get('last_updated') as String?;
        if (data != null) lastUpdated = DateTime.parse(data);
        break;
    }

    if (lastUpdated == null) return true;
    return DateTime.now().difference(lastUpdated) > maxAge;
  }
}
