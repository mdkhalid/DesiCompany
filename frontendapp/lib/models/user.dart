class User {
  final String id;
  final String phone;
  final String role;
  final String? token;

  User({required this.id, required this.phone, required this.role, this.token});

  factory User.fromJson(Map<String, dynamic> json, {String? token}) {
    return User(id: json['id'], phone: json['phone'], role: json['role'], token: token);
  }

  bool get isCustomer => role == 'customer';
  bool get isProvider => role == 'provider';
}

class ServiceCategory {
  final String id;
  final String nameEn;

  ServiceCategory({required this.id, required this.nameEn});
  factory ServiceCategory.fromJson(Map<String, dynamic> json) =>
      ServiceCategory(id: json['id'], nameEn: json['nameEn'] ?? json['name_en']);
}

class ProviderService {
  final String id;
  final String providerId;
  final String name;
  final double? fixedRate;
  final double? hourlyRate;
  final double? dailyRate;
  final double rating;

  ProviderService({required this.id, required this.providerId, required this.name, this.fixedRate, this.hourlyRate, this.dailyRate, this.rating = 0});
  factory ProviderService.fromJson(Map<String, dynamic> json) => ProviderService(
    id: json['id'], providerId: json['providerId'] ?? '', name: json['name'] ?? '',
    fixedRate: (json['fixedRate'] ?? json['fixed_rate'])?.toDouble(),
    hourlyRate: (json['hourlyRate'] ?? json['hourly_rate'])?.toDouble(),
    dailyRate: (json['dailyRate'] ?? json['daily_rate'])?.toDouble(),
    rating: (json['averageRating'] ?? json['average_rating'] ?? 0).toDouble(),
  );
}

class Booking {
  final String id;
  final String status;
  final double totalAmount;
  final String scheduledDate;

  Booking({required this.id, required this.status, this.totalAmount = 0, required this.scheduledDate});
  factory Booking.fromJson(Map<String, dynamic> json) => Booking(
    id: json['id'], status: json['status'],
    totalAmount: (json['totalAmount'] ?? json['total_amount'] ?? 0).toDouble(),
    scheduledDate: json['scheduledDate'] ?? json['scheduled_date'] ?? '',
  );
}
