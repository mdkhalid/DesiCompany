import 'package:flutter/material.dart';

class AppStrings {
  static const Map<String, Map<String, String>> _translations = {
    'en': {
      // General
      'app_name': 'DesiCompany',
      'app_tagline': 'Local Service Marketplace',
      'loading': 'Loading...',
      'error': 'Error',
      'ok': 'OK',
      'cancel': 'Cancel',
      'save': 'Save',
      'delete': 'Delete',
      'edit': 'Edit',
      'done': 'Done',
      'back': 'Back',
      'retry': 'Retry',
      'no_data': 'No data available',

      // Auth
      'phone_hint': 'Phone Number',
      'send_otp': 'Send OTP',
      'otp_sent': 'OTP sent to {phone}',
      'otp_hint': 'Enter OTP',
      'verify_login': 'Verify & Login',
      'wrong_number': '← Wrong number? Edit phone',
      'invalid_phone': 'Enter a valid 10-digit phone number',
      'enter_otp': 'Enter the OTP',

      // Navigation
      'nav_home': 'Home',
      'nav_bookings': 'Bookings',
      'nav_chat': 'Chat',
      'nav_profile': 'Profile',
      'nav_wallet': 'Wallet',

      // Customer Home
      'find_services': 'Find Services',
      'set_location': 'Set location',
      'search_hint': 'Search services, providers...',
      'categories': 'Categories',
      'view_all': 'View All',
      'show_less': 'Show Less',
      'providers': 'Providers',
      'clear_filter': 'Clear Filter',
      'no_providers': 'No providers found',
      'try_adjusting': 'Try adjusting your search or filters',
      'km_2': '2 km',
      'km_5': '5 km',
      'km_10': '10 km',
      'km_25': '25 km',
      'km_all': 'All',
      'away': '{distance} away',

      // Provider Detail
      'walking_distance': 'Walking distance',
      'car_5_10': '~5-10 min by car',
      'car_15_30': '~15-30 min by car',
      'car_30_plus': '~30+ min by car',
      'booking_requested': 'Booking requested!',
      'review': 'review',
      'reviews': 'reviews',
      'get_directions': 'Get Directions',
      'ask_question': 'Ask a Question',
      'services': 'Services',
      'could_not_load_services': 'Could not load services',
      'fixed_price': 'Fixed: ₹{price}',
      'hourly_price': 'Hourly: ₹{price}/hr',
      'daily_price': 'Daily: ₹{price}/day',
      'service': 'Service',
      'already_booked': 'Already booked',
      'booked': 'Booked',
      'book': 'Book',
      'reviews_count': 'Reviews ({count})',

      // Bookings
      'my_bookings': 'My Bookings',
      'no_bookings': 'No bookings yet',
      'booking_number': 'Booking #',
      'reviewed': 'Reviewed',
      'write_review': 'Write Review',

      // Provider Home
      'provider_dashboard': 'Provider Dashboard',
      'manage_bookings': 'Manage your bookings',
      'accept': 'Accept',
      'reject': 'Reject',
      'on_the_way': 'On the Way',
      'start_working': 'Start Working',
      'mark_completed': 'Mark Completed',

      // Profile
      'my_profile': 'My Profile',
      'name': 'Name',
      'email': 'Email',
      'phone': 'Phone',
      'language': 'Language',
      'address': 'Address',
      'city': 'City',
      'state': 'State',
      'pincode': 'Pincode',
      'not_provided': 'Not provided',
      'set_my_location': 'Set My Location',
      'first_name': 'First Name',
      'last_name': 'Last Name',
      'save_changes': 'Save Changes',
      'profile_updated': 'Profile updated successfully',
      'profile_update_failed': 'Failed to update profile: {error}',
      'location_permission_denied': 'Location permission denied or unavailable',
      'location_saved': 'Location saved',
      'location_save_failed': 'Failed to save location: {error}',
      'english': 'English',
      'hindi': 'Hindi',

      // Wallet
      'wallet': 'Wallet',
      'balance': 'Balance',
      'transactions': 'Transactions',

      // Notifications
      'notifications': 'Notifications',
      'read_all': 'Read All',
      'no_notifications': 'No notifications',

      // Chat
      'chat': 'Chat',
      'ask_about': 'Ask about availability, pricing, or timing',
      'type_message': 'Type a message...',

      // Reviews
      'my_reviews': 'My Reviews',
      'no_reviews': 'No reviews yet',
      'complete_bookings_hint': 'Complete bookings to receive reviews from customers',

      // Write Review
      'select_rating': 'Please select a rating',
      'review_failed': 'Failed to submit review: {error}',
      'thank_you': 'Thank You!',
      'review_submitted': 'Your review for {provider} has been submitted.',
      'how_was_experience': 'How was your experience with {provider}?',
      'submit_review': 'Submit Review',
      'tap_to_rate': 'Tap a star to rate',
      'poor': 'Poor',
      'fair': 'Fair',
      'good': 'Good',
      'very_good': 'Very Good',
      'excellent': 'Excellent',
      'tell_us': 'Tell us about your experience (optional)',

      // Distance
      'meters_from_you': '{meters} m from you',
      'km_from_you': '{km} km from you',

      // Admin Dashboard
      'admin_dashboard': 'Admin Dashboard',
      'overview': 'Overview',
      'total_users': 'Total Users',
      'total_providers': 'Total Providers',
      'total_bookings': 'Total Bookings',
      'total_payments': 'Total Payments',
      'active_users': 'Active Users',
      'quick_actions': 'Quick Actions',
      'manage_users': 'Manage Users',
      'kyc_approvals': 'KYC Approvals',
      'admin_bookings': 'Bookings',
      'admin_reviews': 'Reviews',
      'payment_gateways': 'Payment Gateways',
      'nav_dashboard': 'Dashboard',
      'nav_users': 'Users',
      'nav_kyc': 'KYC',
      'nav_more': 'More',
      'user_management': 'User Management',
    },
    'hi': {
      // General
      'app_name': 'डेसीकंपनी',
      'app_tagline': 'स्थानीय सेवा बाज़ार',
      'loading': 'लोड हो रहा है...',
      'error': 'त्रुटि',
      'ok': 'ठीक है',
      'cancel': 'रद्द करें',
      'save': 'सहेजें',
      'delete': 'हटाएं',
      'edit': 'संपादित करें',
      'done': 'हो गया',
      'back': 'वापस',
      'retry': 'पुनः प्रयास करें',
      'no_data': 'कोई डेटा उपलब्ध नहीं',

      // Auth
      'phone_hint': 'फ़ोन नंबर',
      'send_otp': 'OTP भेजें',
      'otp_sent': '{phone} पर OTP भेजा गया',
      'otp_hint': 'OTP दर्ज करें',
      'verify_login': 'सत्यापित करें और लॉग इन करें',
      'wrong_number': '← गलत नंबर? फ़ोन बदलें',
      'invalid_phone': '10 अंकों का वैध फ़ोन नंबर दर्ज करें',
      'enter_otp': 'OTP दर्ज करें',

      // Navigation
      'nav_home': 'होम',
      'nav_bookings': 'बुकिंग',
      'nav_chat': 'चैट',
      'nav_profile': 'प्रोफ़ाइल',
      'nav_wallet': 'वॉलेट',

      // Customer Home
      'find_services': 'सेवाएं खोजें',
      'set_location': 'स्थान सेट करें',
      'search_hint': 'सेवाएं, प्रदाता खोजें...',
      'categories': 'श्रेणियां',
      'view_all': 'सभी देखें',
      'show_less': 'कम दिखाएं',
      'providers': 'प्रदाता',
      'clear_filter': 'फ़िल्टर साफ़ करें',
      'no_providers': 'कोई प्रदाता नहीं मिला',
      'try_adjusting': 'अपनी खोज या फ़िल्टर बदलकर देखें',
      'km_2': '2 किमी',
      'km_5': '5 किमी',
      'km_10': '10 किमी',
      'km_25': '25 किमी',
      'km_all': 'सभी',
      'away': '{distance} दूर',

      // Provider Detail
      'walking_distance': 'पैदल दूरी',
      'car_5_10': '~5-10 मिनट कार से',
      'car_15_30': '~15-30 मिनट कार से',
      'car_30_plus': '~30+ मिनट कार से',
      'booking_requested': 'बुकिंग अनुरोध भेजा गया!',
      'review': 'समीक्षा',
      'reviews': 'समीक्षाएं',
      'get_directions': 'दिशा-निर्देश प्राप्त करें',
      'ask_question': 'प्रश्न पूछें',
      'services': 'सेवाएं',
      'could_not_load_services': 'सेवाएं लोड नहीं हो सकीं',
      'fixed_price': 'निश्चित: ₹{price}',
      'hourly_price': 'प्रति घंटा: ₹{price}/घंटा',
      'daily_price': 'प्रति दिन: ₹{price}/दिन',
      'service': 'सेवा',
      'already_booked': 'पहले से बुक्ड',
      'booked': 'बुक्ड',
      'book': 'बुक करें',
      'reviews_count': 'समीक्षाएं ({count})',

      // Bookings
      'my_bookings': 'मेरी बुकिंग',
      'no_bookings': 'अभी तक कोई बुकिंग नहीं',
      'booking_number': 'बुकिंग #',
      'reviewed': 'समीक्षा हो गई',
      'write_review': 'समीक्षा लिखें',

      // Provider Home
      'provider_dashboard': 'प्रदाता डैशबोर्ड',
      'manage_bookings': 'अपनी बुकिंग प्रबंधित करें',
      'accept': 'स्वीकार करें',
      'reject': 'अस्वीकार करें',
      'on_the_way': 'रास्ते में',
      'start_working': 'काम शुरू करें',
      'mark_completed': 'पूरा चिह्नित करें',

      // Profile
      'my_profile': 'मेरी प्रोफ़ाइल',
      'name': 'नाम',
      'email': 'ईमेल',
      'phone': 'फ़ोन',
      'language': 'भाषा',
      'address': 'पता',
      'city': 'शहर',
      'state': 'राज्य',
      'pincode': 'पिनकोड',
      'not_provided': 'उपलब्ध नहीं',
      'set_my_location': 'मेरा स्थान सेट करें',
      'first_name': 'पहला नाम',
      'last_name': 'अंतिम नाम',
      'save_changes': 'बदलाव सहेजें',
      'profile_updated': 'प्रोफ़ाइल सफलतापूर्वक अपडेट हो गई',
      'profile_update_failed': 'प्रोफ़ाइल अपडेट विफल: {error}',
      'location_permission_denied': 'स्थान अनुमति अस्वीकृत या अनुपलब्ध',
      'location_saved': 'स्थान सहेजा गया',
      'location_save_failed': 'स्थान सहेजने में विफल: {error}',
      'english': 'अंग्रेज़ी',
      'hindi': 'हिंदी',

      // Wallet
      'wallet': 'वॉलेट',
      'balance': 'शेष राशि',
      'transactions': 'लेनदेन',

      // Notifications
      'notifications': 'सूचनाएं',
      'read_all': 'सभी पढ़ें',
      'no_notifications': 'कोई सूचना नहीं',

      // Chat
      'chat': 'चैट',
      'ask_about': 'उपलब्धता, मूल्य या समय के बारे में पूछें',
      'type_message': 'संदेश टाइप करें...',

      // Reviews
      'my_reviews': 'मेरी समीक्षाएं',
      'no_reviews': 'अभी तक कोई समीक्षा नहीं',
      'complete_bookings_hint': 'ग्राहकों से समीक्षा प्राप्त करने के लिए बुकिंग पूरी करें',

      // Write Review
      'select_rating': 'कृपया रेटिंग चुनें',
      'review_failed': 'समीक्षा सबमिट करने में विफल: {error}',
      'thank_you': 'धन्यवाद!',
      'review_submitted': '{provider} के लिए आपकी समीक्षा सबमिट हो गई।',
      'how_was_experience': '{provider} के साथ आपका अनुभव कैसा था?',
      'submit_review': 'समीक्षा सबमिट करें',
      'tap_to_rate': 'रेट करने के लिए स्टार पर टैप करें',
      'poor': 'खराब',
      'fair': 'ठीक',
      'good': 'अच्छा',
      'very_good': 'बहुत अच्छा',
      'excellent': 'उत्कृष्ट',
      'tell_us': 'अपने अनुभव के बारे में बताएं (वैकल्पिक)',

      // Distance
      'meters_from_you': 'आपसे {meters} मीटर दूर',
      'km_from_you': 'आपसे {km} किमी दूर',

      // Admin Dashboard
      'admin_dashboard': 'एडमिन डैशबोर्ड',
      'overview': 'अवलोकन',
      'total_users': 'कुल उपयोगकर्ता',
      'total_providers': 'कुल प्रदाता',
      'total_bookings': 'कुल बुकिंग',
      'total_payments': 'कुल भुगतान',
      'active_users': 'सक्रिय उपयोगकर्ता',
      'quick_actions': 'त्वरित कार्य',
      'manage_users': 'उपयोगकर्ता प्रबंधित करें',
      'kyc_approvals': 'KYC अनुमोदन',
      'admin_bookings': 'बुकिंग',
      'admin_reviews': 'समीक्षाएं',
      'payment_gateways': 'भुगतान गेटवे',
      'nav_dashboard': 'डैशबोर्ड',
      'nav_users': 'उपयोगकर्ता',
      'nav_kyc': 'KYC',
      'nav_more': 'और',
      'user_management': 'उपयोगकर्ता प्रबंधन',
    },
  };

  static String tr(String key, {Map<String, String>? params}) {
    final translations = _translations['hi'] ?? {};
    String text = translations[key] ?? key;
    if (params != null) {
      for (final entry in params.entries) {
        text = text.replaceAll('{${entry.key}}', entry.value);
      }
    }
    return text;
  }

  static String trEn(String key, {Map<String, String>? params}) {
    final translations = _translations['en'] ?? {};
    String text = translations[key] ?? key;
    if (params != null) {
      for (final entry in params.entries) {
        text = text.replaceAll('{${entry.key}}', entry.value);
      }
    }
    return text;
  }
}

class LocalizationProviderScope extends InheritedWidget {
  final LocalizationProvider provider;
  const LocalizationProviderScope({required this.provider, required super.child});
  @override
  bool updateShouldNotify(LocalizationProviderScope old) => provider != old.provider;
}

class LocalizationProvider extends ChangeNotifier {
  String _locale = 'en';

  String get locale => _locale;

  static LocalizationProvider of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<LocalizationProviderScope>();
    assert(scope != null, 'No LocalizationProvider found in context');
    return scope!.provider;
  }

  LocalizationProvider({String initialLocale = 'en'}) : _locale = initialLocale;

  void setLocale(String locale) {
    if (_locale != locale && (locale == 'en' || locale == 'hi')) {
      _locale = locale;
      notifyListeners();
    }
  }

  String tr(String key, {Map<String, String>? params}) {
    final translations = AppStrings._translations[_locale] ?? {};
    String text = translations[key] ?? key;
    if (params != null) {
      for (final entry in params.entries) {
        text = text.replaceAll('{${entry.key}}', entry.value);
      }
    }
    return text;
  }
}
