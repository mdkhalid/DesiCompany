import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_service.dart';

// Booking model
class Booking {
  final String id;
  final String status;
  final String serviceCategory;
  final String? providerName;
  final String? customerName;
  final DateTime scheduledAt;
  final double? totalAmount;
  final String? address;

  Booking({
    required this.id,
    required this.status,
    required this.serviceCategory,
    this.providerName,
    this.customerName,
    required this.scheduledAt,
    this.totalAmount,
    this.address,
  });

  factory Booking.fromJson(Map<String, dynamic> json) {
    return Booking(
      id: json['id'] as String,
      status: json['status'] as String,
      serviceCategory: json['serviceCategory'] as String? ?? 'General',
      providerName: json['provider']?['user']?['firstName'] as String?,
      customerName: json['customer']?['user']?['firstName'] as String?,
      scheduledAt: DateTime.parse(json['scheduledAt'] as String),
      totalAmount: double.tryParse('${json['totalAmount'] ?? ''}'),
      address: json['address'] as String?,
    );
  }
}

// Bookings state
class BookingsState {
  final List<Booking> bookings;
  final bool isLoading;
  final String? error;
  final String? filterStatus;

  const BookingsState({
    this.bookings = const [],
    this.isLoading = false,
    this.error,
    this.filterStatus,
  });

  BookingsState copyWith({
    List<Booking>? bookings,
    bool? isLoading,
    String? error,
    String? filterStatus,
  }) {
    return BookingsState(
      bookings: bookings ?? this.bookings,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      filterStatus: filterStatus ?? this.filterStatus,
    );
  }

  List<Booking> get filteredBookings {
    if (filterStatus == null || filterStatus == 'all') {
      return bookings;
    }
    return bookings.where((b) => b.status == filterStatus).toList();
  }
}

// Bookings notifier
class BookingsNotifier extends StateNotifier<BookingsState> {
  BookingsNotifier() : super(const BookingsState());

  Future<void> fetchBookings({String? status}) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final queryParams = status != null ? '?status=$status' : '';
      final data = await ApiService.get('/bookings$queryParams');
      final bookings = (data as List)
          .map((json) => Booking.fromJson(json as Map<String, dynamic>))
          .toList();
      state = BookingsState(
        bookings: bookings,
        isLoading: false,
        filterStatus: status,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> refreshBookings() async {
    await fetchBookings(status: state.filterStatus);
  }

  void setFilter(String? status) {
    state = state.copyWith(filterStatus: status);
  }

  void clearError() {
    state = state.copyWith(error: null);
  }
}

// Bookings provider
final bookingsProvider = StateNotifierProvider<BookingsNotifier, BookingsState>((ref) {
  return BookingsNotifier();
});

// Convenience providers
final activeBookingsProvider = Provider<List<Booking>>((ref) {
  return ref.watch(bookingsProvider).bookings
      .where((b) => ['pending', 'accepted', 'on_the_way', 'working'].contains(b.status))
      .toList();
});

final completedBookingsProvider = Provider<List<Booking>>((ref) {
  return ref.watch(bookingsProvider).bookings
      .where((b) => b.status == 'completed')
      .toList();
});
