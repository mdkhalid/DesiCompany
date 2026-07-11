# Mobile Navigation Redesign
**Goal**: Clean up top/bottom bars by consolidating navigation into a dedicated "My Account" page.

---

## **Design Overview**

### **Mobile App (Flutter) - Current vs New**

#### **Current**
```
TOP BAR
[🏠 Home] [🔍 Search] [📋 Requests] [🔔 Notifications] [👤 Profile]

BOTTOM BAR
[🏠 Home] [📋 Requests] [📅 Bookings] [💬 Chat] [👤 Profile]
```

#### **New**
```
TOP BAR (Clean)
[🏠 Home] [🔍 Search] [📋 Requests] [🔔 Notifications] [👤 My Account]

BOTTOM BAR
[🏠 Home] [📋 Requests] [📅 Bookings] [💬 Chat] [👤 My Account]
```

### **My Account Page**
```
┌─────────────────────────────────┐
│  👤 My Account                  │
├─────────────────────────────────┤
│  [Avatar]                        │
│  John Doe                        │
│  john@example.com                │
├─────────────────────────────────┤
│  👤 Profile           →         │
│  ⚙️  Settings          →         │
│  💳 Billing           →         │
│  ❓ Help              →         │
│  🚪 Logout            →         │
└─────────────────────────────────┘
```

### **Requests Page - Provider Dashboard**
```
┌─────────────────────────────────┐
│  📋 Requests                    │
├─────────────────────────────────┤
│  [Customer] [Provider]           │
├─────────────────────────────────┤
│  Customer Requests List          │
│  OR                             │
│  Provider Dashboard (if tab)     │
└─────────────────────────────────┘
```

---

## **Phase 1: Audit Results**

### **Mobile App (Flutter) - Current Navigation**

#### **Customer Home Screen** (`customer_home_screen.dart`)
```
TOP HEADER:
[📍 Location] [💼 Jobs] [🎁 Membership] [🎧 Support] [⚖️ Disputes] [🔔 Notifications] [🚪 Logout]

BOTTOM BAR:
[🏠 Home] [📋 Requests] [💬 Chat] [👤 Profile]
```
**Issues**:
- Top bar has 7 icons (cluttered on mobile)
- "Profile" in bottom bar should be "My Account"

#### **Provider Home Screen** (`provider_home_screen.dart`)
```
TOP HEADER:
[🔄 Refresh] [Provider Dashboard] [💼 Jobs] [📅 Schedule] [💰 Wallet] [💬 Chat] [👤 Profile] [🚪 Logout] [⋯ More]

BOTTOM BAR:
[📋 Requests] [💰 Wallet] [💬 Chat] [👤 Profile]
```
**Issues**:
- Top bar has 7+ icons (very cluttered)
- "More" popup has 8 items (Services, Reviews, KYC, Subscriptions, Quotes, Support, Disputes, Busy Slots)
- "Profile" in bottom bar should be "My Account"

#### **Profile Screen** (`profile_screen.dart`)
```
Current: Standalone screen with edit, logout, language switch
```
**Action**: Will be nested inside "My Account" page

#### **Customer Requests Screen** (`customer_requests_screen.dart`)
```
Current: Simple AppBar with "My Requests" title
```
**Action**: Add tab for Provider Dashboard if needed

#### **Provider Requests Screen** (`provider_requests_screen.dart`)
```
Current: Has filter chips (All, Open Jobs, Bookings)
```
**Action**: Add Provider Dashboard tab if needed

---

### **Admin Web (React) - Current Navigation**

#### **Sidebar** (`Sidebar.tsx`)
```
[📊 Dashboard]
[👥 Users]
[🪪 KYC Verification]
[📁 Categories]
[📅 Bookings]
[💳 Payment Gateways]
[💰 Fees & Revenue]
[📋 Commissions]
[↩️ Refunds]
[⭐ Reviews]
[💬 Customer Feedback]
[📢 Advertisements]
[🎧 Grievances]
[🛑 Error Logs]
─────────────────
[🚪 Logout]
```
**Issues**:
- Fixed width `w-64` (no mobile collapse)
- No "Profile" or "My Account" link
- 14 navigation items (long list)

#### **Layout** (`App.tsx`)
```
[Sidebar 256px] [Main Content]
```
**Issues**:
- No mobile responsive sidebar (hamburger menu)
- No top bar with user avatar/account

---

## **Phases**

### **Phase 1: Planning & Audit**
**Objective**: Finalize requirements and audit current navigation.

**Status**: ✅ COMPLETED

**Tasks Completed**:
1. ✅ Audit `frontendapp/lib/main.dart` (top/bottom bars)
2. ✅ Audit `frontendapp/lib/screens/` (Profile, Requests, etc.)
3. ✅ Audit `adminweb/src/components/Sidebar.tsx` (sidebar)
4. ✅ Audit `adminweb/src/pages/` (Bookings, Advertisements, etc.)

---

### **Phase 2: Mobile App (Flutter)**
**Objective**: Implement dedicated "My Account" page and clean top/bottom bars.

**Status**: ✅ COMPLETED

**Tasks Completed**:
1. **Create `MyAccountScreen`** (`lib/screens/my_account_screen.dart`)
   - Add sections: Profile, Settings, Wallet, Help, Logout
   - Link to existing screens (`ProfileScreen`, `WalletScreen`, `SupportTicketsScreen`)
2. **Update Customer Home Top Bar** (`customer_home_screen.dart`)
   - Remove: Jobs, Membership, Support, Disputes, Logout
   - Keep: Location picker, Notifications
   - Add: My Account icon (links to `MyAccountScreen`)
3. **Update Provider Home Top Bar** (`provider_home_screen.dart`)
   - Remove: Jobs, Schedule, Wallet, Chat, Profile, Logout
   - Keep: Refresh, Notifications
   - Add: My Account icon (links to `MyAccountScreen`)
4. **Update Bottom Bars** (both customer & provider)
   - Replace "Profile" with "My Account"
5. **Refactor "Provider Dashboard"**
   - Already has tabs in `ProviderRequestsScreen` (All, Open Jobs, Bookings)
   - No changes needed

---

### **Phase 3: Admin Web (React)**
**Objective**: Implement dedicated "My Account" page and clean sidebar.

**Status**: ❌ CANCELLED (No changes needed for admin web)

**Tasks Cancelled**:
1. **Create `MyAccountPage`** (`src/pages/MyAccount.tsx`)
   - Add sections: Profile, Settings, Help, Logout
   - No billing needed (admin panel)
2. **Add Mobile Header** (`src/components/Header.tsx`) - NEW FILE
   - Add hamburger menu button for mobile
   - Add user avatar with "My Account" link
   - Show on screens < 768px width
3. **Update Sidebar** (`src/components/Sidebar.tsx`)
   - Add mobile collapse functionality (hamburger toggle)
   - Add "My Account" link at bottom (above Logout)
   - Add responsive width (w-64 on desktop, w-0 on mobile)
4. **Update Layout** (`src/App.tsx`)
   - Add mobile header component
   - Pass sidebar toggle state to Sidebar

---

### **Phase 4: Testing & Validation**
**Objective**: Ensure usability and consistency across platforms.

**Tasks**:
1. **Mobile App (Flutter)**
   - Test touch targets (48x48px minimum)
   - Verify "My Account" page navigation
   - Check "Provider Dashboard" in Requests
2. **Admin Web (React)**
   - Test mobile responsiveness (Tailwind breakpoints)
   - Verify "My Account" page links
   - Check sidebar collapse on mobile
3. **Cross-Platform**
   - Test on iOS/Android (Flutter)
   - Test on mobile browsers (React)

---

### **Phase 5: Deployment**
**Objective**: Roll out changes incrementally.

**Tasks**:
1. Merge Flutter changes to `frontendapp/`
2. Merge React changes to `adminweb/`
3. Monitor user feedback and iterate

---

## **Open Questions**
1. **Provider Dashboard**: Tabs or collapsible section?
2. **Additional Sections**: Any other items for "My Account"?
3. **Visual Style**: Cards or list tiles for "My Account" page?
