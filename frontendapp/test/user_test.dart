import 'package:flutter_test/flutter_test.dart';
import 'package:desicompany/models/user.dart';

void main() {
  group('User', () {
    group('fromJson', () {
      test('parses all fields from JSON', () {
        final json = {
          'id': 'u1',
          'phone': '9876543210',
          'role': 'customer',
          'roles': ['customer', 'provider'],
          'latitude': 28.6139,
          'longitude': 77.2090,
          'serviceRadiusKm': 15.5,
        };

        final user = User.fromJson(json, token: 'tok_abc');

        expect(user.id, 'u1');
        expect(user.phone, '9876543210');
        expect(user.role, 'customer');
        expect(user.roles, ['customer', 'provider']);
        expect(user.token, 'tok_abc');
        expect(user.latitude, 28.6139);
        expect(user.longitude, 77.2090);
        expect(user.serviceRadiusKm, 15.5);
      });

      test('falls back to single role when roles array is absent', () {
        final json = {
          'id': 'u2',
          'phone': '1234567890',
          'role': 'provider',
        };

        final user = User.fromJson(json);

        expect(user.roles, ['provider']);
        expect(user.token, isNull);
      });

      test('handles null latitude/longitude/serviceRadiusKm gracefully', () {
        final json = {
          'id': 'u3',
          'phone': '1111111111',
          'role': 'admin',
        };

        final user = User.fromJson(json);

        expect(user.latitude, isNull);
        expect(user.longitude, isNull);
        expect(user.serviceRadiusKm, isNull);
      });

      test('parses numeric roles array', () {
        final json = {
          'id': 'u4',
          'phone': '2222222222',
          'role': 'customer',
          'roles': ['customer'],
        };

        final user = User.fromJson(json);

        expect(user.roles, ['customer']);
      });
    });

    group('role helpers', () {
      test('isCustomer returns true for customer role', () {
        final user = User(id: '1', phone: '1', role: 'customer', roles: ['customer']);
        expect(user.isCustomer, isTrue);
        expect(user.isProvider, isFalse);
        expect(user.isAdmin, isFalse);
      });

      test('isProvider returns true for provider role', () {
        final user = User(id: '1', phone: '1', role: 'provider', roles: ['provider']);
        expect(user.isProvider, isTrue);
        expect(user.isCustomer, isFalse);
        expect(user.isAdmin, isFalse);
      });

      test('isAdmin returns true for admin role', () {
        final user = User(id: '1', phone: '1', role: 'admin', roles: ['admin']);
        expect(user.isAdmin, isTrue);
        expect(user.isCustomer, isFalse);
        expect(user.isProvider, isFalse);
      });

      test('hasMultipleRoles returns true when roles.length > 1', () {
        final user = User(id: '1', phone: '1', role: 'customer', roles: ['customer', 'provider']);
        expect(user.hasMultipleRoles, isTrue);
      });

      test('hasMultipleRoles returns false for single role', () {
        final user = User(id: '1', phone: '1', role: 'customer', roles: ['customer']);
        expect(user.hasMultipleRoles, isFalse);
      });

      test('canBeCustomer checks roles list', () {
        final user = User(id: '1', phone: '1', role: 'provider', roles: ['provider', 'customer']);
        expect(user.canBeCustomer, isTrue);
      });

      test('canBeProvider checks roles list', () {
        final user = User(id: '1', phone: '1', role: 'customer', roles: ['customer', 'provider']);
        expect(user.canBeProvider, isTrue);
      });

      test('canBeCustomer false when not in roles', () {
        final user = User(id: '1', phone: '1', role: 'admin', roles: ['admin']);
        expect(user.canBeCustomer, isFalse);
        expect(user.canBeProvider, isFalse);
      });
    });
  });

  group('ServiceCategory', () {
    test('fromJson parses all fields', () {
      final json = {
        'id': 'sc1',
        'nameEn': 'Plumbing',
        'nameHi': 'प्लंबिंग',
        'pricingModels': ['fixed', 'hourly'],
        'defaultPricingModel': 'fixed',
      };

      final cat = ServiceCategory.fromJson(json);

      expect(cat.id, 'sc1');
      expect(cat.nameEn, 'Plumbing');
      expect(cat.nameHi, 'प्लंबिंग');
      expect(cat.pricingModels, ['fixed', 'hourly']);
      expect(cat.defaultPricingModel, 'fixed');
    });

    test('fromJson falls back to name_en key for nameEn', () {
      final json = {'id': 'sc2', 'name_en': 'Electrical'};

      final cat = ServiceCategory.fromJson(json);

      expect(cat.nameEn, 'Electrical');
      expect(cat.nameHi, isNull);
      expect(cat.pricingModels, isEmpty);
      expect(cat.defaultPricingModel, isNull);
    });

    test('fromJson handles null pricingModels', () {
      final json = {'id': 'sc3', 'nameEn': 'Cleaning'};

      final cat = ServiceCategory.fromJson(json);

      expect(cat.pricingModels, isEmpty);
    });
  });

  group('ProviderService', () {
    test('fromJson parses all fields including category', () {
      final json = {
        'id': 'ps1',
        'providerId': 'u1',
        'name': 'Pipe Repair',
        'fixedRate': 500.0,
        'hourlyRate': 200.0,
        'dailyRate': 1500.0,
        'unitRate': 50.0,
        'pricingModel': 'fixed',
        'averageRating': 4.5,
        'category': {
          'id': 'sc1',
          'nameEn': 'Plumbing',
        },
      };

      final svc = ProviderService.fromJson(json);

      expect(svc.id, 'ps1');
      expect(svc.providerId, 'u1');
      expect(svc.name, 'Pipe Repair');
      expect(svc.fixedRate, 500.0);
      expect(svc.hourlyRate, 200.0);
      expect(svc.dailyRate, 1500.0);
      expect(svc.unitRate, 50.0);
      expect(svc.pricingModel, 'fixed');
      expect(svc.rating, 4.5);
      expect(svc.category, isNotNull);
      expect(svc.category!.nameEn, 'Plumbing');
    });

    test('fromJson handles snake_case rate keys', () {
      final json = {
        'id': 'ps2',
        'fixed_rate': 300.0,
        'hourly_rate': 150.0,
        'daily_rate': 1200.0,
        'average_rating': 3.8,
      };

      final svc = ProviderService.fromJson(json);

      expect(svc.fixedRate, 300.0);
      expect(svc.hourlyRate, 150.0);
      expect(svc.dailyRate, 1200.0);
      expect(svc.rating, 3.8);
    });

    test('fromJson handles missing optional fields', () {
      final json = {'id': 'ps3'};

      final svc = ProviderService.fromJson(json);

      expect(svc.providerId, isNull);
      expect(svc.name, '');
      expect(svc.fixedRate, isNull);
      expect(svc.hourlyRate, isNull);
      expect(svc.dailyRate, isNull);
      expect(svc.unitRate, isNull);
      expect(svc.pricingModel, isNull);
      expect(svc.rating, 0.0);
      expect(svc.category, isNull);
    });

    test('fromJson handles providerId as non-string', () {
      final json = {'id': 'ps4', 'providerId': 12345};

      final svc = ProviderService.fromJson(json);

      expect(svc.providerId, '12345');
    });
  });

  group('Booking', () {
    test('fromJson parses all fields', () {
      final json = {
        'id': 'b1',
        'status': 'completed',
        'totalAmount': 1500.0,
        'scheduledDate': '2026-07-15',
      };

      final booking = Booking.fromJson(json);

      expect(booking.id, 'b1');
      expect(booking.status, 'completed');
      expect(booking.totalAmount, 1500.0);
      expect(booking.scheduledDate, '2026-07-15');
    });

    test('fromJson handles snake_case keys', () {
      final json = {
        'id': 'b2',
        'status': 'pending',
        'total_amount': 750.5,
        'scheduled_date': '2026-08-01',
      };

      final booking = Booking.fromJson(json);

      expect(booking.totalAmount, 750.5);
      expect(booking.scheduledDate, '2026-08-01');
    });

    test('fromJson defaults totalAmount to 0 when absent', () {
      final json = {
        'id': 'b3',
        'status': 'working',
        'scheduledDate': '2026-09-10',
      };

      final booking = Booking.fromJson(json);

      expect(booking.totalAmount, 0.0);
    });

    test('fromJson defaults scheduledDate to empty string when absent', () {
      final json = {
        'id': 'b4',
        'status': 'requested',
      };

      final booking = Booking.fromJson(json);

      expect(booking.scheduledDate, '');
    });
  });
}
