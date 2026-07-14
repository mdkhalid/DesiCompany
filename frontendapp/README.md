# DesiCompany — Mobile App

Flutter app for **customers** and **providers** (Android / iOS / Web). Admins use the
[admin dashboard](../adminweb) instead — this app does not allow admin login.

## Run

```bash
flutter pub get
flutter run
```

For full setup, features by role, test accounts, and troubleshooting, see the
**[root README](../README.md)**.

## Platform-specific API base URL

| Platform | Base URL |
|---|---|
| Web / iOS simulator | `http://localhost:3000/api/v1` (auto) |
| Android emulator | `http://10.0.2.2:3000/api/v1` (auto) |
| Physical device | `flutter run --dart-define=API_BASE_URL=http://<LAN_IP>:3000/api/v1` |

Detailed device setup: [`docs/MOBILE_SETUP.md`](../docs/MOBILE_SETUP.md)
