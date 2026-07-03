# Flutter Web — Local Testing Guide

Run the app on multiple browsers and devices on the same WiFi network.

---

## Quick Start (local dev, same machine)

```bash
# Terminal 1 — start backend
cd backendapi
npx nest start

# Terminal 2 — start Flutter web (opens Chrome)
cd frontendapp
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:3000/api/v1
```

OTP in dev mode: `123456`

---

## 1. Prerequisites — Backend API

Make sure the backend API is running first before launching Flutter.

### Start PostgreSQL + Redis (Docker)

```bash
cd backendapi
docker compose up -d postgres redis
```

### Start the backend API

```bash
cd backendapi
npm run start:dev
```

Wait until you see:

```
Application is running on: http://localhost:3000
```

The backend will be available at `http://localhost:3000` on your machine.

> If you get `EADDRINUSE: address already in use :::3000`, another instance is already running on port 3000.
> Find and kill it first:
>
> ```bash
> netstat -ano | findstr :3000
> taskkill //F //PID <PID_FROM_ABOVE>
> ```

---

## 2. Open Windows Firewall for port 3000 (Run as Administrator)

Other devices on the WiFi need to reach the backend API. Windows Firewall blocks incoming connections by default — you must add a rule **as Administrator**.

> **This step is required.** If you skip it, other devices will get `net::ERR_CONNECTION_REFUSED` errors.

### How to open Terminal as Administrator

| Method           | Steps                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| **Win + X menu** | Press **Win + X** → click **"Terminal (Admin)"** → click **Yes** on the UAC prompt                            |
| **Search**       | Press **Win + S**, type `cmd` → right-click **"Command Prompt"** → **"Run as administrator"** → click **Yes** |

### Add the firewall rule

In the Administrator terminal, paste and run:

```cmd
netsh advfirewall firewall add rule name="DesiCompany API 3000" dir=in action=allow protocol=TCP localport=3000
```

**Expected output:**

```
Ok.
```

That's it — the rule persists across restarts, so you only need to do this once.

---

## 3. Find your LAN IP

Open a terminal and run:

```bash
ipconfig
```

Look for your active WiFi adapter and copy the **IPv4 Address**.

Example:

```
IPv4 Address. . . . . . . . . . : 192.168.1.10
```

> **Important:** Make sure your computer and the test devices are on the **same WiFi network**.

---

## 4. Start Flutter Web — Multi-Device Testing

This mode allows you to open the app from multiple devices (phone, tablet, laptop, second browser) at the same time.

### Build and serve (recommended)

```bash
cd frontendapp
flutter build web --dart-define=API_BASE_URL=http://YOUR_LAN_IP:3000/api/v1
cd build/web
python -m http.server 8080
```

Replace `YOUR_LAN_IP` with your IP from step 3.

**What to type in the browser:**

- On your machine: `http://localhost:8080`
- From other devices on WiFi: `http://YOUR_LAN_IP:8080`

### Dev mode with hot reload (web-server)

```bash
cd frontendapp
flutter run -d web-server --web-hostname=0.0.0.0 --web-port=8080 --dart-define=API_BASE_URL=http://YOUR_LAN_IP:3000/api/v1
```

### Single Chrome only (same machine only)

```bash
cd frontendapp
flutter run -d chrome --dart-define=API_BASE_URL=http://YOUR_LAN_IP:3000/api/v1
```

---

## 5. Test as Customer + Provider Simultaneously

### Method A: Two browsers on the same machine

1. Start Flutter with web-server mode (step 4)
2. Open **Chrome** → `http://localhost:8080` → login as **customer**
3. Open **Edge** / **Firefox** / **Chrome incognito** → `http://localhost:8080` → login as **provider**

### Method B: Phone + Laptop

1. Start Flutter with web-server mode (step 4)
2. On your **laptop browser**: `http://localhost:8080` — login as **provider**
3. On your **phone** (same WiFi): `http://192.168.1.5:8080` — login as **customer**

> Both sessions share the same backend. Real-time chat and booking updates work between them.

### OTP for testing

In development mode, the OTP is always: **`123456`**

> Set in `backendapi/.env` via `OTP_MOCK=true`.

---

## 6. Troubleshooting

| Problem                                      | Solution                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `EADDRINUSE: address already in use :::3000` | Another backend is already running. Kill it with `taskkill //F //PID <PID>` (get PID via `netstat -ano \| findstr :3000`) |
| `net::ERR_CONNECTION_REFUSED`                | Backend not running, or wrong LAN IP in `API_BASE_URL`. Check IP with `ipconfig` and rebuild Flutter                      |
| `Page loads but no data`                     | Check that `API_BASE_URL` points to the correct LAN IP and port                                                           |
| `net::ERR_FAILED` / `CORS errors`            | Backend allows any localhost and LAN origin in dev mode. Make sure backend is running and firewall is open                 |
| `Visual Studio toolchain error`              | You ran `flutter run -d all` — use `-d web-server` or `-d chrome` instead                                                 |
| `App not loading on phone`                   | Make sure phone is on the **same WiFi** and the firewall allows ports 3000 and 8080                                       |

---

## Quick Reference

```bash
# Step 0: Open Windows Firewall (run once, as Administrator)
netsh advfirewall firewall add rule name="DesiCompany API 3000" dir=in action=allow protocol=TCP localport=3000

# Step 1: Start Docker services
cd backendapi && docker compose up -d postgres redis

# Step 2: Start backend
cd backendapi && npm run start:dev

# Step 3: Find your LAN IP
ipconfig

# Step 4: Build and serve Flutter web (replace YOUR_LAN_IP with your IP from step 3)
cd frontendapp && flutter build web --dart-define=API_BASE_URL=http://192.168.1.5:3000/api/v1
cd build/web && python -m http.server 8080

# Step 5: Open in browser(s)
# http://192.168.1.5:8080
```
