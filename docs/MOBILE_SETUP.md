# Mobile Setup Guide

This guide explains how to run the DesiCompany Flutter mobile app on Android (real device or emulator) and how to prepare for iOS (requires macOS).

---

## 1. Backend Setup (runs on your computer)

Start the NestJS backend so the mobile app can reach it:

```bash
cd backendapi
docker-compose up -d        # PostgreSQL + Redis
npm run start:dev           # Backend on http://localhost:3000
```

The mobile app connects to `http://localhost:3000/api/v1` by default. The base URL is configured in `lib/services/api_service.dart` and is **platform-aware**:

| Platform | Base URL |
|---|---|
| Web (Chrome/Edge) | `http://localhost:3000/api/v1` |
| Android emulator | `http://10.0.2.2:3000/api/v1` |
| iOS simulator | `http://localhost:3000/api/v1` |
| Physical Android device | Set `API_BASE_URL` at build time (see below) |

---

## 2. Android — Emulator

### Prerequisites
- Android Studio installed (https://developer.android.com/studio)
- Android SDK installed via Android Studio SDK Manager
- At least one AVD created in AVD Manager

### Run
```bash
cd frontendapp
flutter emulators                 # list available AVDs
flutter emulators --launch <id>   # start the emulator
flutter devices                   # confirm device appears
flutter run                       # auto-detects the emulator
```

The Android emulator routes `10.0.2.2` to the host machine's `localhost`, so `http://10.0.2.2:3000/api/v1` reaches your backend.

### Test Credentials (mock OTP = `123456`)
| Role | Phone |
|---|---|
| Admin | `9999999999` |
| Customer | `9876543210` |
| Provider | `9876543211` |

---

## 3. Android — Physical Device

### Enable Developer Options + USB Debugging
1. On phone: **Settings → About phone** → tap **Build number** 7 times.
2. **Settings → Developer options** → enable **USB debugging**.
3. Connect phone via USB cable (or Wi-Fi ADB).

### Find your computer's LAN IP
```bash
ipconfig          # Windows
# Look for IPv4 Address (e.g. 192.168.1.10)
```

### Run with custom API URL
```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.10:3000/api/v1
```

Replace `192.168.1.10` with your actual LAN IP. Both phone and computer must be on the same Wi-Fi network.

### Firewall
Allow inbound on port 3000. On Windows:
```powershell
New-NetFirewallRule -DisplayName "DesiCompany API" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

---

## 4. iOS — Simulator (macOS only)

iOS development **requires macOS with Xcode installed**. It is not possible to build iOS from Windows.

### Prerequisites
- macOS 13 or later
- Xcode 15+ from the App Store
- `sudo gem install cocoapods` (or `brew install cocoapods`)
- Apple Silicon or Intel Mac

### Run
```bash
cd frontendapp
cd ios && pod install && cd ..
flutter run -d "iPhone 15"
```

iOS simulator can reach the host's localhost directly via `http://localhost:3000/api/v1`.

### iOS Files Created
This project already includes:
- `ios/Runner/Info.plist` with camera, photo library, location usage descriptions
- `NSAppTransportSecurity` exception for `localhost` (allows HTTP during dev)
- Clear app name: `DesiCompany`

> Note: iOS folder is currently missing `AppDelegate.swift`, `Runner.xcodeproj`, and Xcode project files. Run `flutter create --platforms=ios .` on macOS to generate them before first iOS build.

---

## 5. Permissions Configured

The app needs these permissions. They are already declared:

### Android (`android/app/src/main/AndroidManifest.xml`)
- `INTERNET`
- `ACCESS_NETWORK_STATE`
- `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`
- `CAMERA`
- `READ_MEDIA_IMAGES` / `READ_EXTERNAL_STORAGE`
- `android:usesCleartextTraffic="true"` (allows HTTP to localhost during dev)

### iOS (`ios/Runner/Info.plist`)
- `NSLocationWhenInUseUsageDescription`
- `NSCameraUsageDescription`
- `NSPhotoLibraryUsageDescription`
- `NSPhotoLibraryAddUsageDescription`
- `NSAppTransportSecurity.NSAllowsLocalNetworking = true`

---

## 6. Camera + Photo Library (image_picker)

Already configured. Packages added to `pubspec.yaml`:
- `image_picker: ^1.1.2`
- `geolocator: ^14.0.0`
- `permission_handler: ^11.0.0`
- `url_launcher: ^6.3.0`
- `http_parser: ^4.0.2`

On Android, the permission dialog is shown automatically by `image_picker`. On iOS, the strings from Info.plist are shown.

---

## 7. Building a Release APK

```bash
cd frontendapp
flutter build apk --release \
  --dart-define=API_BASE_URL=https://api.your-domain.com/api/v1
```

Output: `build/app/outputs/flutter-apk/app-release.apk`

For app bundle (Play Store):
```bash
flutter build appbundle --release \
  --dart-define=API_BASE_URL=https://api.your-domain.com/api/v1
```

---

## 8. Quick Reference

| Action | Command |
|---|---|
| List devices | `flutter devices` |
| List emulators | `flutter emulators` |
| Launch emulator | `flutter emulators --launch <id>` |
| Run app (auto device) | `flutter run` |
| Run with custom API URL | `flutter run --dart-define=API_BASE_URL=http://YOUR_IP:3000/api/v1` |
| Run on Android | `flutter run -d android` |
| Run on Chrome | `flutter run -d chrome` |
| Build APK | `flutter build apk --release` |
| Build iOS (macOS only) | `flutter build ios --release` |
| Run tests | `flutter analyze` |

---

## 9. Troubleshooting

**App can't reach backend on real Android device:**
- Make sure phone and computer are on the same Wi-Fi network
- Use your computer's LAN IP, not `localhost`
- Allow port 3000 in firewall

**Camera not opening:**
- Accept the runtime permission dialog on first use
- On Android 13+, `READ_MEDIA_IMAGES` is required for gallery access

**GPS not working on emulator:**
- Set a mock location in Android Studio Extended Controls → Location
- iOS simulator: **Features → Location → Custom Location**

**Build fails on iOS:**
- Run `cd ios && pod install` after adding new packages
- Run `flutter clean` then `flutter pub get`