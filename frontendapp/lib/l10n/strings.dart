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
      'conversations': 'Conversations',

      // Auth
      'phone_hint': 'Phone Number',
      'send_otp': 'Send OTP',
      'otp_sent': 'OTP sent to {phone}',
      'otp_hint': 'Enter OTP',
      'verify_login': 'Verify & Login',
      'wrong_number': '← Wrong number? Edit phone',
      'invalid_phone': 'Enter a valid 10-digit phone number',
      'enter_otp': 'Enter the OTP',
      'required_field': 'This field is required',
      'budget_invalid': 'Min must be less than or equal to max',

      // Profile Switching
      'switch_profile_title': 'Which profile?',
      'switch_profile_subtitle': 'You can switch anytime from Settings',
      'switch_profile': 'Switch Profile',
      'current_profile': 'Current',
      'active': 'Active',
      'new_label': 'New',

      // Role Selection
      'who_are_you': 'Who are you?',
      'customer_title': 'I need a service',
      'customer_desc': 'Find plumbers, electricians, cleaners & more',
      'provider_title': 'I offer services',
      'provider_desc': 'List your services and find customers',
      'continue_btn': 'Continue',
      'first_name_hint': 'First Name (optional)',
      'last_name_hint': 'Last Name (optional)',
      'new_user': 'New user! Tell us about yourself',

      // Navigation
      'nav_home': 'Home',
      'nav_bookings': 'Bookings',
      'nav_chat': 'Chat',
      'nav_profile': 'Profile',
      'nav_wallet': 'Wallet',
      'my_account': 'My Account',

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

      // Provider Services
      'my_services': 'My Services',
      'add_service': 'Add Service',
      'edit_service': 'Edit Service',
      'delete_service': 'Delete Service',
      'service_category': 'Service Category',
      'fixed_rate': 'Fixed Rate',
      'hourly_rate': 'Hourly Rate',
      'daily_rate': 'Daily Rate',
      'service_updated': 'Service updated',
      'service_created': 'Service created',
      'service_deleted': 'Service deleted',
      'service_delete_confirm': 'Are you sure you want to delete this service?',
      'no_services_yet': 'No services added yet',
      'select_category': 'Select category',
      'category_already_added': 'This category is already added',
      'no_categories': 'No categories available',

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
      'available_balance': 'Available Balance',
      'total_earned': 'Total Earned',
      'total_spent': 'Total Spent',
      'no_transactions_yet': 'No transactions yet',
      'add_money': 'Add Money',
      'withdraw': 'Withdraw',

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

      // Provider Feedback
      'private_feedback': 'Private Feedback',
      'submit_feedback': 'Submit',
      'paid_on_time': 'Paid on time',
      'cancelled_last_minute': 'Cancelled last minute',
      'no_show': 'No show',
      'rude_behavior': 'Rude behavior',
      'good_customer': 'Good customer',
      'changed_location': 'Changed location',
      'previous_feedback': 'Previous Feedback',
      'no_previous_feedback': 'No previous feedback yet',
      'feedback_submitted': 'Feedback submitted',
      'feedback_failed': 'Failed to submit feedback: {error}',

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
      'customer_feedback': 'Customer Feedback',
      'payment_gateways': 'Payment Gateways',
      'nav_dashboard': 'Dashboard',
      'nav_users': 'Users',
      'nav_kyc': 'KYC',
      'nav_more': 'More',
      'user_management': 'User Management',

      // KYC Upload
      'kyc_documents': 'KYC Documents',
      'add_photos': 'Add Photos',
      'take_photo': 'Take Photo',
      'choose_from_gallery': 'Choose from Gallery',
      'document_type': 'Document Type',
      'selected_photos': 'photos selected',
      'upload': 'Upload',
      'uploading': 'Uploading...',
      'uploaded_success': 'Documents uploaded successfully',
      'no_documents_yet': 'No documents uploaded yet',
      'doc_aadhaar': 'Aadhaar Card',
      'doc_pan': 'PAN Card',
      'doc_dl': 'Driving License',
      'doc_passport': 'Passport',
      'doc_voter': 'Voter ID',
      'doc_photo': 'Photo',
      'kyc_pending': 'PENDING',
      'kyc_approved': 'APPROVED',
      'kyc_rejected': 'REJECTED',

      // Header labels (for LabeledIconButton / Tooltip)
      'header_services': 'Services',
      'header_reviews': 'Reviews',
      'header_kyc': 'KYC',
      'header_wallet': 'Wallet',
      'header_logout': 'Logout',
      'header_refresh': 'Refresh',
      'header_back': 'Back',
      'header_edit': 'Edit',
      'header_cancel_edit': 'Cancel Edit',
      'header_notifications': 'Notifications',

      // Job Requests
      'post_a_job': 'Post a Job',
      'my_jobs': 'My Jobs',
      'job_details': 'Job Details',
      'title_label': 'Title',
      'description_label': 'Description',
      'budget_min': 'Budget Min',
      'budget_max': 'Budget Max',
      'preferred_date': 'Preferred Date',
      'use_my_location': 'Use my location',
      'post_job': 'Post Job',
      'job_posted': 'Job posted successfully',
      'job_post_failed': 'Failed to post job: {error}',
      'no_jobs_yet': 'No jobs posted yet',
      'quotes_count': '{count} quotes',
      'accept_quote': 'Accept Quote',
      'quote_accepted': 'Booking created!',
      'quote_accept_failed': 'Failed to accept quote: {error}',
      'cancel_request': 'Cancel Request',
      'cancel_request_confirm': 'Are you sure you want to cancel this request?',
      'request_cancelled': 'Request cancelled',
      'estimated_hours': 'Estimated: {hours} hrs',
      'valid_until': 'Valid until: {date}',
      'no_quotes_yet': 'No quotes yet',
      'chat_with_provider': 'Chat with Provider',
      'quote_status_pending': 'PENDING',
      'quote_status_accepted': 'ACCEPTED',
      'quote_status_rejected': 'REJECTED',
      'quote_status_withdrawn': 'WITHDRAWN',
      'header_jobs': 'Jobs',
      'open_jobs': 'Open Jobs',
      'submit_quote': 'Submit Quote',
      'my_quotes': 'My Quotes',
      'quote_amount': 'Amount (₹)',
      'quote_message': 'Message to customer',
      'quote_submitted': 'Quote submitted successfully',
      'quote_submit_failed': 'Failed to submit quote: {error}',
      'no_open_jobs': 'No open jobs nearby',
      'no_quotes_submitted': 'No quotes submitted yet',
      'quotes_received': '{count} quotes already',
      'withdraw_quote': 'Withdraw',
      'quote_withdrawn': 'Quote withdrawn',
      'quote_withdraw_failed': 'Failed to withdraw quote: {error}',
      'edit_quote': 'Edit Quote',
      'job_request_details': 'Job Details',
      'distance_away': '{distance} away',
      'hours_ago': '{hours} hours ago',
      'days_ago': '{days} days ago',
      'already_quoted': 'Already quoted',

      // Subscriptions & Memberships
      'subscription_plans': 'Subscription Plans',
      'membership_plans': 'Membership Plans',
      'subscribe': 'Subscribe',
      'join_membership': 'Join',
      'subscription_active': 'Active',
      'cancel_subscription': 'Cancel Subscription',
      'subscription_cancelled': 'Cancelled',
      'subscription_expired': 'Expired',
      'no_subscriptions': 'No plans available',
      'subscription_details': 'Explore plans to grow your business',
      'membership_benefits': 'Member Benefits',
      'fee_waived': 'Convenience Fee Waived ✓',
      'fee_waiver_active': 'You have a fee waiver as a member',
      'no_memberships': 'No membership plans yet',
      'membership_details': 'Join a plan to unlock perks and savings',
      'billing_monthly': '/month',
      'billing_yearly': '/year',
      'instant_payout': 'Instant Payout',
      'instant_payout_fee_info': 'Fee: {fee}',
      'instant_payout_confirm': 'Withdraw ₹{amount}? Fee: ₹{fee} Net: ₹{net}',
      'instant_payout_confirmed': 'Payout request submitted!',
      'payout_failed': 'Payout failed: {error}',
      'insufficient_balance_payout': 'Insufficient balance for instant payout',
      'monthly': 'Monthly',
      'yearly': 'Yearly',

      // Subscription benefits keys
      'benefit_commissionDiscount': 'Reduced commission by {value}%',
      'benefit_prioritySupport': 'Priority support',
      'benefit_freeListing': 'Free promoted listing',
      'benefit_premiumBadge': 'Premium badge on profile',
      'benefit_freeLeads': '{value} free lead responses/mo',
      'benefit_feeWaiverPercent': '{value}% fee waiver on bookings',
      'benefit_priorityBooking': 'Priority booking',
      'benefit_freeCancellation': 'Free cancellations',
      'benefit_earlyAccess': 'Early access to premium providers',
      'benefit_unlimitedQuotes': 'Unlimited quote responses',
      'benefit_dedicatedSupport': 'Dedicated account manager',

      // Promo Codes
      'promo_code': 'Promo Code',
      'promo_code_hint': 'Enter promo code',
      'apply': 'Apply',
      'promo_applied': 'Promo code applied!',
      'promo_invalid': 'Invalid promo code',
      'promo_expired': 'Promo code expired',
      'promo_used_up': 'Promo code usage limit reached',
      'promo_discount': 'Discount: -₹{amount}',
      'promo_fee_waived': 'Fee waived!',
      'promo_code_remove': 'Remove',

      // Fee breakdown
      'convenience_fee': 'Convenience Fee',
      'fee_included': 'Fee included in total',
      'total_amount': 'Total Amount',
      'subtotal': 'Subtotal',
      'net_revenue': 'Net Revenue',

      // Lead fee
      'lead_fee_notice': 'A lead fee of ₹{fee} applies when submitting a quote',
      'lead_fee_included': 'Lead fee included',

      // Admin Revenue Report
      'admin_revenue': 'Revenue Report',
      'revenue_stats': 'Revenue Stats',
      'convenience_fees': 'Convenience Fees',
      'subscription_revenue': 'Subscription Revenue',
      'discounts_given': 'Discounts Given',
      'revenue_auto_billing': '(Auto-billing coming)',
      'last_30_days': 'Last 30 days',

      // Support Tickets
      'support_tickets': 'Support Tickets',
      'create_ticket': 'Create Ticket',
      'subject': 'Subject',
      'submit_ticket': 'Submit Ticket',
      'ticket_created': 'Ticket created successfully',
      'no_tickets': 'No tickets yet',
      'booking_issue': 'Booking Issue',
      'payment_issue': 'Payment Issue',
      'technical_issue': 'Technical Issue',
      'account_issue': 'Account Issue',
      'open': 'Open',
      'in_progress': 'In Progress',
      'resolved': 'Resolved',
      'closed': 'Closed',
      'reply': 'Reply',
      'min_10_chars': 'Minimum 10 characters required',

      // Disputes
      'disputes': 'Disputes',
      'raise_dispute': 'Raise Dispute',
      'reason_for_dispute': 'Reason for Dispute',
      'dispute_created': 'Dispute created successfully',
      'in_review': 'In Review',
      'dismissed': 'Dismissed',
      'booking': 'Booking',
      'amount': 'Amount',
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
      'conversations': 'बातचीत',

      // Auth
      'phone_hint': 'फ़ोन नंबर',
      'send_otp': 'OTP भेजें',
      'otp_sent': '{phone} पर OTP भेजा गया',
      'otp_hint': 'OTP दर्ज करें',
      'verify_login': 'सत्यापित करें और लॉग इन करें',
      'wrong_number': '← गलत नंबर? फ़ोन बदलें',
      'invalid_phone': '10 अंकों का वैध फ़ोन नंबर दर्ज करें',
      'enter_otp': 'OTP दर्ज करें',
      'required_field': 'यह फ़ील्ड आवश्यक है',
      'budget_invalid': 'न्यूनतम अधिकतम से कम या बराबर होना चाहिए',

      // Profile Switching
      'switch_profile_title': 'कौन सा प्रोफ़ाइल?',
      'switch_profile_subtitle': 'आप सेटिंग से कभी भी स्विच कर सकते हैं',
      'switch_profile': 'प्रोफ़ाइल बदलें',
      'current_profile': 'वर्तमान',
      'active': 'सक्रिय',
      'new_label': 'नया',

      // Role Selection
      'who_are_you': 'आप कौन हैं?',
      'customer_title': 'मुझे सेवा चाहिए',
      'customer_desc': 'प्लंबर, इलेक्ट्रीशियन, सफाईकर्मी और अधिक खोजें',
      'provider_title': 'मैं सेवाएं प्रदान करता हूं',
      'provider_desc': 'अपनी सेवाएं सूचीबद्ध करें और ग्राहक खोजें',
      'continue_btn': 'जारी रखें',
      'first_name_hint': 'पहला नाम (वैकल्पिक)',
      'last_name_hint': 'अंतिम नाम (वैकल्पिक)',
      'new_user': 'नए उपयोगकर्ता! अपने बारे में बताएं',

      // Navigation
      'nav_home': 'होम',
      'nav_bookings': 'बुकिंग',
      'nav_chat': 'चैट',
      'nav_profile': 'प्रोफ़ाइल',
      'nav_wallet': 'वॉलेट',
      'my_account': 'मेरा खाता',

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

      // Provider Services
      'my_services': 'मेरी सेवाएं',
      'add_service': 'सेवा जोड़ें',
      'edit_service': 'सेवा संपादित करें',
      'delete_service': 'सेवा हटाएं',
      'service_category': 'सेवा श्रेणी',
      'fixed_rate': 'निश्चित दर',
      'hourly_rate': 'प्रति घंटा दर',
      'daily_rate': 'प्रति दिन दर',
      'service_updated': 'सेवा अपडेट हो गई',
      'service_created': 'सेवा बनाई गई',
      'service_deleted': 'सेवा हटा दी गई',
      'service_delete_confirm': 'क्या आप वाकई यह सेवा हटाना चाहते हैं?',
      'no_services_yet': 'अभी तक कोई सेवा नहीं जोड़ी गई',
      'select_category': 'श्रेणी चुनें',
      'category_already_added': 'यह श्रेणी पहले से जोड़ी जा चुकी है',
      'no_categories': 'कोई श्रेणी उपलब्ध नहीं',

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
      'available_balance': 'उपलब्ध शेष राशि',
      'total_earned': 'कुल कमाई',
      'total_spent': 'कुल खर्च',
      'no_transactions_yet': 'अभी तक कोई लेनदेन नहीं',
      'add_money': 'पैसे जोड़ें',
      'withdraw': 'निकालें',

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

      // Provider Feedback
      'private_feedback': 'निजी प्रतिक्रिया',
      'submit_feedback': 'सबमिट करें',
      'paid_on_time': 'समय पर भुगतान किया',
      'cancelled_last_minute': 'अंतिम क्षण में रद्द किया',
      'no_show': 'नहीं आए',
      'rude_behavior': 'अभद्र व्यवहार',
      'good_customer': 'अच्छे ग्राहक',
      'changed_location': 'स्थान बदला',
      'previous_feedback': 'पिछली प्रतिक्रिया',
      'no_previous_feedback': 'अभी तक कोई पिछली प्रतिक्रिया नहीं',
      'feedback_submitted': 'प्रतिक्रिया सबमिट हो गई',
      'feedback_failed': 'प्रतिक्रिया सबमिट करने में विफल: {error}',

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
      'customer_feedback': 'ग्राहक प्रतिक्रिया',
      'payment_gateways': 'भुगतान गेटवे',
      'nav_dashboard': 'डैशबोर्ड',
      'nav_users': 'उपयोगकर्ता',
      'nav_kyc': 'KYC',
      'nav_more': 'और',
      'user_management': 'उपयोगकर्ता प्रबंधन',

      // KYC Upload
      'kyc_documents': 'KYC दस्तावेज़',
      'add_photos': 'फ़ोटो जोड़ें',
      'take_photo': 'फ़ोटो लें',
      'choose_from_gallery': 'गैलरी से चुनें',
      'document_type': 'दस्तावेज़ प्रकार',
      'selected_photos': 'फ़ोटो चुनी गईं',
      'upload': 'अपलोड करें',
      'uploading': 'अपलोड हो रहा है...',
      'uploaded_success': 'दस्तावेज़ सफलतापूर्वक अपलोड हो गए',
      'no_documents_yet': 'अभी तक कोई दस्तावेज़ अपलोड नहीं किया गया',
      'doc_aadhaar': 'आधार कार्ड',
      'doc_pan': 'पैन कार्ड',
      'doc_dl': 'ड्राइविंग लाइसेंस',
      'doc_passport': 'पासपोर्ट',
      'doc_voter': 'वोटर आईडी',
      'doc_photo': 'फ़ोटो',
      'kyc_pending': 'लंबित',
      'kyc_approved': 'स्वीकृत',
      'kyc_rejected': 'अस्वीकृत',

      // Header labels (for LabeledIconButton / Tooltip)
      'header_services': 'सेवाएं',
      'header_reviews': 'समीक्षाएं',
      'header_kyc': 'KYC',
      'header_wallet': 'वॉलेट',
      'header_logout': 'लॉगआउट',
      'header_refresh': 'रिफ्रेश',
      'header_back': 'वापस',
      'header_edit': 'संपादित करें',
      'header_cancel_edit': 'संपादन रद्द करें',
      'header_notifications': 'सूचनाएं',

      // Job Requests
      'post_a_job': 'नौकरी पोस्ट करें',
      'my_jobs': 'मेरी नौकरियां',
      'job_details': 'नौकरी विवरण',
      'title_label': 'शीर्षक',
      'description_label': 'विवरण',
      'budget_min': 'न्यूनतम बजट',
      'budget_max': 'अधिकतम बजट',
      'preferred_date': 'पसंदीदा तिथि',
      'use_my_location': 'मेरा स्थान उपयोग करें',
      'post_job': 'नौकरी पोस्ट करें',
      'job_posted': 'नौकरी सफलतापूर्वक पोस्ट हो गई',
      'job_post_failed': 'नौकरी पोस्ट करने में विफल: {error}',
      'no_jobs_yet': 'अभी तक कोई नौकरी पोस्ट नहीं की गई',
      'quotes_count': '{count} कोटेशन',
      'accept_quote': 'कोटेशन स्वीकार करें',
      'quote_accepted': 'बुकिंग बन गई!',
      'quote_accept_failed': 'कोटेशन स्वीकार करने में विफल: {error}',
      'cancel_request': 'अनुरोध रद्द करें',
      'cancel_request_confirm': 'क्या आप वाकई यह अनुरोध रद्द करना चाहते हैं?',
      'request_cancelled': 'अनुरोध रद्द हो गया',
      'estimated_hours': 'अनुमानित: {hours} घंटे',
      'valid_until': 'तक मान्य: {date}',
      'no_quotes_yet': 'अभी तक कोई कोटेशन नहीं',
      'chat_with_provider': 'प्रदाता से चैट करें',
      'quote_status_pending': 'लंबित',
      'quote_status_accepted': 'स्वीकृत',
      'quote_status_rejected': 'अस्वीकृत',
      'quote_status_withdrawn': 'वापस लिया गया',
      'header_jobs': 'नौकरियां',
      'open_jobs': 'खुली नौकरियां',
      'submit_quote': 'कोटेशन सबमिट करें',
      'my_quotes': 'मेरे कोटेशन',
      'quote_amount': 'राशि (₹)',
      'quote_message': 'ग्राहक के लिए संदेश',
      'quote_submitted': 'कोटेशन सफलतापूर्वक सबमिट हो गया',
      'quote_submit_failed': 'कोटेशन सबमिट करने में विफल: {error}',
      'no_open_jobs': 'आस-पास कोई खुली नौकरी नहीं',
      'no_quotes_submitted': 'अभी तक कोई कोटेशन सबमिट नहीं किया गया',
      'quotes_received': 'पहले से {count} कोटेशन',
      'withdraw_quote': 'वापस लें',
      'quote_withdrawn': 'कोटेशन वापस लिया गया',
      'quote_withdraw_failed': 'कोटेशन वापस लेने में विफल: {error}',
      'edit_quote': 'कोटेशन संपादित करें',
      'job_request_details': 'नौकरी विवरण',
      'distance_away': '{distance} दूर',
      'hours_ago': '{hours} घंटे पहले',
      'days_ago': '{days} दिन पहले',
      'already_quoted': 'पहले से कोटेशन दिया',

      // Subscriptions & Memberships
      'subscription_plans': 'सदस्यता योजनाएं',
      'membership_plans': 'सदस्यता योजनाएं',
      'subscribe': 'सब्सक्राइब करें',
      'join_membership': 'ज्वाइन करें',
      'subscription_active': 'सक्रिय',
      'cancel_subscription': 'सदस्यता रद्द करें',
      'subscription_cancelled': 'रद्द',
      'subscription_expired': 'समाप्त',
      'no_subscriptions': 'कोई योजना उपलब्ध नहीं',
      'subscription_details': 'अपने व्यवसाय को बढ़ाने के लिए योजनाएं देखें',
      'membership_benefits': 'सदस्य लाभ',
      'fee_waived': 'सुविधा शुल्क माफ ✓',
      'fee_waiver_active': 'आपके पास सदस्य के रूप में शुल्क छूट है',
      'no_memberships': 'अभी तक कोई सदस्यता योजना नहीं',
      'membership_details': 'लाभ और बचत के लिए योजना ज्वाइन करें',
      'billing_monthly': '/माह',
      'billing_yearly': '/वर्ष',
      'instant_payout': 'इंस्टेंट पेआउट',
      'instant_payout_fee_info': 'शुल्क: {fee}',
      'instant_payout_confirm': '₹{amount} निकालें? शुल्क: ₹{fee} नेट: ₹{net}',
      'instant_payout_confirmed': 'पेआउट अनुरोध सबमिट हो गया!',
      'payout_failed': 'पेआउट विफल: {error}',
      'insufficient_balance_payout': 'इंस्टेंट पेआउट के लिए अपर्याप्त शेष राशि',
      'monthly': 'मासिक',
      'yearly': 'वार्षिक',

      // Subscription benefits keys
      'benefit_commissionDiscount': '{value}% कमीशन में छूट',
      'benefit_prioritySupport': 'प्राथमिकता सहायता',
      'benefit_freeListing': 'मुफ्त प्रमोटेड लिस्टिंग',
      'benefit_premiumBadge': 'प्रोफाइल पर प्रीमियम बैज',
      'benefit_freeLeads': '{value} मुफ्त लीड प्रतिक्रिया/माह',
      'benefit_feeWaiverPercent': 'बुकिंग पर {value}% शुल्क छूट',
      'benefit_priorityBooking': 'प्राथमिकता बुकिंग',
      'benefit_freeCancellation': 'मुफ्त रद्दीकरण',
      'benefit_earlyAccess': 'प्रीमियम प्रदाताओं तक शीघ्र पहुंच',
      'benefit_unlimitedQuotes': 'असीमित कोटेशन प्रतिक्रियाएं',
      'benefit_dedicatedSupport': 'समर्पित खाता प्रबंधक',

      // Promo Codes
      'promo_code': 'प्रोमो कोड',
      'promo_code_hint': 'प्रोमो कोड दर्ज करें',
      'apply': 'लागू करें',
      'promo_applied': 'प्रोमो कोड लागू!',
      'promo_invalid': 'अमान्य प्रोमो कोड',
      'promo_expired': 'प्रोमो कोड समाप्त',
      'promo_used_up': 'प्रोमो कोड उपयोग सीमा समाप्त',
      'promo_discount': 'छूट: -₹{amount}',
      'promo_fee_waived': 'शुल्क माफ!',
      'promo_code_remove': 'हटाएं',

      // Fee breakdown
      'convenience_fee': 'सुविधा शुल्क',
      'fee_included': 'शुल्क कुल में शामिल',
      'total_amount': 'कुल राशि',
      'subtotal': 'उप-योग',
      'net_revenue': 'शुद्ध राजस्व',

      // Lead fee
      'lead_fee_notice': 'कोटेशन सबमिट करने पर ₹{fee} लीड शुल्क लागू होता है',
      'lead_fee_included': 'लीड शुल्क शामिल',

      // Admin Revenue Report
      'admin_revenue': 'राजस्व रिपोर्ट',
      'revenue_stats': 'राजस्व आंकड़े',
      'convenience_fees': 'सुविधा शुल्क',
      'subscription_revenue': 'सदस्यता राजस्व',
      'discounts_given': 'दी गई छूट',
      'revenue_auto_billing': '(ऑटो-बिलिंग जल्द)',
      'last_30_days': 'पिछले 30 दिन',

      // Support Tickets
      'support_tickets': 'सहायता टिकट',
      'create_ticket': 'टिकट बनाएं',
      'subject': 'विषय',
      'submit_ticket': 'टिकट जमा करें',
      'ticket_created': 'टिकट सफलतापूर्वक बनाया गया',
      'no_tickets': 'अभी तक कोई टिकट नहीं',
      'booking_issue': 'बुकिंग समस्या',
      'payment_issue': 'भुगतान समस्या',
      'technical_issue': 'तकनीकी समस्या',
      'account_issue': 'खाता समस्या',
      'open': 'खुला',
      'in_progress': 'प्रगति में',
      'resolved': 'हल',
      'closed': 'बंद',
      'reply': 'जवाब दें',
      'min_10_chars': 'कम से कम 10 अक्षर आवश्यक',

      // Disputes
      'disputes': 'विवाद',
      'raise_dispute': 'विवाद उठाएं',
      'reason_for_dispute': 'विवाद का कारण',
      'dispute_created': 'विवाद सफलतापूर्वक बनाया गया',
      'in_review': 'समीक्षा में',
      'dismissed': 'खारिज',
      'booking': 'बुकिंग',
      'amount': 'राशि',
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
