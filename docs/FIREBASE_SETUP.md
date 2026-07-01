# Firebase Configuration Setup

## Steps to configure Firebase for DesiCompany

### 1. Create Firebase Project
1. Go to https://console.firebase.google.com
2. Create a new project named "DesiCompany"
3. Enable Analytics (optional but recommended)

### 2. Register Android App
1. Click "Add app" → Android
2. Package name: `com.desicompany.app`
3. App nickname: DesiCompany Android
4. Download `google-services.json`
5. Place it at: `android/app/google-services.json`

### 3. Register iOS App
1. Click "Add app" → iOS
2. Bundle ID: `com.desicompany.app`
3. App nickname: DesiCompany iOS
4. Download `GoogleService-Info.plist`
5. Place it at: `ios/Runner/GoogleService-Info.plist`

### 4. Enable Cloud Messaging
1. Go to Project Settings → Cloud Messaging
2. Enable Firebase Cloud Messaging API (V1)

### 5. Generate Firebase Options
Run in project root:
```bash
flutterfire configure
```
This generates `lib/firebase_options.dart`

### 6. Required Files (NOT committed to git)
- `android/app/google-services.json`
- `ios/Runner/GoogleService-Info.plist`
- `lib/firebase_options.dart`

These files contain sensitive API keys and should be in `.gitignore`.
