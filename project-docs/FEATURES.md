# DesiCompany - Complete Feature List

**Last updated:** 2026-07-09

> **Recently implemented (2026-07-09):** Admin-controlled **"Zero Commission for N Days"** provider grace period. Admins set `provider_grace_period_days` + independent toggles for visibility-boost and commission-waiver. New providers pay 0% commission on in-window bookings (persisted as `commissionWaived`), see a dashboard badge + wallet "commission saved" counter, and receive welcome + expiry-reminder pushes. Admins track waived commission (promo cost) + retention on the dashboard with CSV export. See `project-docs/PROVIDER_GRACE_COMMISSION_PLAN.md`.

---

## Customer (Flutter) — 63 features

### Service Discovery
| # | Feature | Description |
|---|---------|-------------|
| 1 | Browse Service Categories | View grid of service categories (plumber, electrician, etc.) |
| 2 | Search Providers | Search providers by name or city with real-time filtering |
| 3 | Location-based Provider Search | Find nearby providers within configurable radius (2/5/10/25 km) |
| 4 | View Provider Profile | See provider details, services, pricing, reviews, distance |
| 5 | Get Directions | Open Google Maps directions to provider location |
| 6 | Notifications Badge | See unread notification count on home screen |

### Jobs
| # | Feature | Description |
|---|---------|-------------|
| 7 | My Jobs List | View all posted job requests with status, budget, quotes count |
| 8 | Post a Job | Create job request with title, description, category, address, budget, preferred date |
| 9 | Job Detail | View job details, received quotes, manage the request |
| 10 | View Quotes | See all provider quotes with amounts, messages, estimated hours |
| 11 | Accept Quote | Accept a provider's quote (with optional promo code), creating a booking |
| 12 | Cancel Job Request | Cancel an open/quoted job request |
| 13 | Apply Promo Code | Validate and apply promo code for discount on quote acceptance |
| 14 | Chat with Provider (from Quote) | Start direct chat with provider who submitted a quote |

### Bookings
| # | Feature | Description |
|---|---------|-------------|
| 15 | My Bookings List | View all bookings with status, amount, convenience fee |
| 16 | Booking Detail / Status | Track booking status (requested → accepted → on_the_way → working → completed) |
| 17 | Raise Issue (Grievance) | Start support chat for completed booking |
| 18 | Grievance Chat | Interact with support bot to report issues |
| 19 | Write Review | Rate and review provider after completed booking |
| 20 | Recurring Bookings | Create and manage recurring booking schedules |

### Requests Hub
| # | Feature | Description |
|---|---------|-------------|
| 21 | My Requests (Unified) | Unified view of all job requests and bookings sorted by date |

### Chat & Messaging
| # | Feature | Description |
|---|---------|-------------|
| 22 | Conversation List | View all chat conversations with providers |
| 23 | Booking Chat | Real-time chat with provider for a specific booking |
| 24 | Direct Chat | Direct messaging with a provider (not tied to a booking) |
| 25 | Send Images | Pick and send compressed images in chat |
| 26 | Send Files/Documents | Pick and send any file type in chat |
| 27 | Share Location | Share current location as a chat message |
| 28 | Translate Messages | Translate last received message between English and Hindi |
| 29 | Emoji Picker | Send emojis in chat messages |
| 30 | Edit/Delete Messages | Edit or delete your own sent messages |
| 31 | Read Receipts | See when messages are delivered and read (double checkmarks) |
| 32 | Typing Indicators | See when the other person is typing |
| 33 | Accept/Decline Quote in Chat | Accept or decline a quote received as a chat message |
| 34 | Offline Message Queue | Messages queued locally and retried when connection is restored |

### Membership & Subscriptions
| # | Feature | Description |
|---|---------|-------------|
| 35 | View Membership Plans | Browse available membership plans with pricing and benefits |
| 36 | View Active Membership | See current membership status and benefits |
| 37 | Join Membership | Subscribe to a plan with monthly or yearly billing |
| 38 | Cancel Membership | Cancel active membership subscription |

### Wallet & Payments
| # | Feature | Description |
|---|---------|-------------|
| 39 | View Wallet Balance | Check available wallet balance, total earned, total spent |
| 40 | Transaction History | View all wallet transactions (credits and debits) |
| 41 | Instant Payout | Withdraw wallet balance to bank (with 2.5% fee estimate) |
| 42 | Fee Waiver Status | See if convenience fees are waived due to membership |
| 43 | Initiate Payment | Create payment orders for bookings |
| 44 | View Invoices | Download invoices for bookings |

### Notifications
| # | Feature | Description |
|---|---------|-------------|
| 45 | View Notifications | See all notifications with read/unread status |
| 46 | Mark Notification Read | Mark individual notification as read |
| 47 | Mark All Read | Mark all notifications as read |

### Profile & Settings
| # | Feature | Description |
|---|---------|-------------|
| 48 | View Profile | View name, email, phone, language, address, city, state, pincode |
| 49 | Edit Profile | Update name, email, address, city, state, pincode, language |
| 50 | Set Location | Capture and save current GPS coordinates to profile |
| 51 | Switch Profile Role | Switch between customer and provider roles |
| 52 | Change Language | Switch between English and Hindi |

### Other
| # | Feature | Description |
|---|---------|-------------|
| 53 | View Loyalty Points | Check loyalty points balance and history |
| 54 | View Provider Portfolio | View provider portfolio/gallery images |
| 55 | Check Booking Photos | View photos attached to a booking |
| 56 | Submit Dispute | File a dispute for a booking |
| 57 | Support Tickets | Create and view support tickets |
| 58 | Submit Feedback | Submit general app feedback |
| 59 | Get Ads/Banners | View promotional advertisements |
| 60 | View Badges | See earned badges for the provider |
| 61 | Referral Program | Use referral codes and track referral rewards |
| 62 | View Pricing | Check platform fee structure |

---

## Provider (Flutter) — 48 features

### Dashboard
| # | Feature | Description |
|---|---------|-------------|
| 1 | Dashboard (Bookings) | Active bookings with accept/reject/on-the-way/working/completed status transitions |

### Jobs
| # | Feature | Description |
|---|---------|-------------|
| 2 | Open Jobs | Browse open job requests posted by customers within 10km radius |
| 3 | Submit Quote | Submit quote with amount, estimated hours, message, valid-until date |
| 4 | Edit Quote | Edit an existing pending quote |
| 5 | Job Detail | Detailed view of job request with customer info, description, budget |
| 6 | My Quotes | List all quotes with status (pending/accepted/rejected/withdrawn) |
| 7 | Withdraw Quote | Withdraw a pending quote |

### Services
| # | Feature | Description |
|---|---------|-------------|
| 8 | My Services | Add, edit, delete service offerings with rate configuration |
| 9 | Service Categories | Browse available service categories |

### Schedule
| # | Feature | Description |
|---|---------|-------------|
| 10 | Weekly Schedule | Set weekly time slots (per day of week) |
| 11 | Date Overrides | Add/delete date overrides (holidays or custom hours) |

### KYC
| # | Feature | Description |
|---|---------|-------------|
| 12 | KYC Upload | Upload KYC documents (Aadhaar, PAN, DL, Passport, Voter ID, Photo) |
| 13 | KYC Status | Track KYC approval status (pending/approved/rejected) |

### Subscriptions
| # | Feature | Description |
|---|---------|-------------|
| 14 | Subscription Plans | Browse available subscription plans |
| 15 | Active Subscription | View current subscription status |
| 16 | Subscribe | Subscribe to a plan |
| 17 | Cancel Subscription | Cancel current subscription |

### Reviews & Feedback
| # | Feature | Description |
|---|---------|-------------|
| 18 | View Reviews | See average rating and all customer reviews |
| 19 | Customer Feedback | Submit private feedback about customers after completed booking |
| 20 | Feedback History | View previous feedback submitted |

### Requests
| # | Feature | Description |
|---|---------|-------------|
| 21 | Requests Feed | Merged feed of open job requests and active bookings |

### Chat
| # | Feature | Description |
|---|---------|-------------|
| 22 | Conversation List | List all conversations with unread counts |
| 23 | Booking Chat | Real-time chat for specific booking |
| 24 | Direct Chat | Direct messaging with customers |
| 25 | Send Images | Pick and send compressed images |
| 26 | Send Documents | Pick and send any file type |
| 27 | Share Location | Share current location |
| 28 | Translate Messages | Translate between English and Hindi |
| 29 | Emoji Picker | Send emojis |
| 30 | Edit/Delete Messages | Edit or delete own messages |
| 31 | Read Receipts | See delivery and read status |
| 32 | Typing Indicators | See when customer is typing |
| 33 | Offline Message Queue | Messages queued and retried when online |

### Wallet
| # | Feature | Description |
|---|---------|-------------|
| 34 | Wallet Balance | View balance, total earned, total spent |
| 35 | Transaction History | View all transactions |
| 36 | Request Payout | Withdraw balance to bank |

### Profile & Settings
| # | Feature | Description |
|---|---------|-------------|
| 37 | View Profile | View provider profile details |
| 38 | Edit Profile | Update name, email, address, city, state, pincode |
| 39 | Change Language | Switch between English and Hindi |

### Notifications
| # | Feature | Description |
|---|---------|-------------|
| 40 | View Notifications | See all notifications |
| 41 | Mark Read | Mark individual or all as read |

---

## Admin (Web + Flutter) — 28 features

### Dashboard & Analytics
| # | Feature | Platform | Description |
|---|---------|----------|-------------|
| 1 | Dashboard | Web + Flutter | Key metrics (users, providers, bookings, payments) with charts |
| 2 | Revenue Stats | Web + Flutter | Convenience fees, subscription revenue, discounts, net revenue |

### User Management
| # | Feature | Platform | Description |
|---|---------|----------|-------------|
| 3 | Manage Users | Web + Flutter | List/search/filter users, suspend/activate/delete, create admin |
| 4 | KYC Verification | Web + Flutter | Review/approve/reject provider KYC documents |
| 5 | Soft-Block Config | API | Configure provider soft-block rules, manual trigger, unblock |

### Bookings & Services
| # | Feature | Platform | Description |
|---|---------|----------|-------------|
| 6 | View All Bookings | Web + Flutter | List/filter bookings by status, export CSV |
| 7 | Service Categories | Web | CRUD for service categories (English/Hindi) |

### Payments & Revenue
| # | Feature | Platform | Description |
|---|---------|----------|-------------|
| 8 | Payment Gateways | Web + Flutter | CRUD (Razorpay/Stripe/Cash), set default, enable/disable |
| 9 | Commissions | Web | Configure by scope (global/category/provider), percentage/fixed |
| 10 | Fees & Revenue | Web | Convenience fees, payout fees, lead fees, plans, promo codes |
| 11 | Refunds | Web | Process full/partial refunds |

### Reviews & Feedback
| # | Feature | Platform | Description |
|---|---------|----------|-------------|
| 12 | Reviews | Web + Flutter | View/delete reviews |
| 13 | Customer Feedback | Web + Flutter | View all feedbacks with ratings and tags |

### Content & Advertising
| # | Feature | Platform | Description |
|---|---------|----------|-------------|
| 14 | Advertisements | Web | CRUD, scheduling, targeting, analytics (impressions/clicks/CTR) |

### Support & Resolution
| # | Feature | Platform | Description |
|---|---------|----------|-------------|
| 15 | Grievances | Web | View/assign/resolve, record calls, send messages, resolution actions |
| 16 | Support Tickets | API | View/update ticket status |
| 17 | Disputes | API | View/resolve disputes |

### Monitoring & Logging
| # | Feature | Platform | Description |
|---|---------|----------|-------------|
| 18 | Error Logs | Web | Paginated logs, detail view, resolve, purge |
| 19 | Activity Logs | API | Audit trail of admin/system actions |
| 20 | Verification Videos | API | Review/approve/reject provider videos |

### Automation
| # | Feature | Platform | Description |
|---|---------|----------|-------------|
| 21 | Notifications Broadcast | API | Send to all users or filtered by role |
| 22 | Booking Reminders | API | Trigger reminders for upcoming bookings |
| 23 | Recurring Bookings | API | Generate occurrences, process due bookings |
| 24 | Follow-Up Automation | API | Review follow-ups, re-engagement for inactive users |
| 25 | Promotions | API | View/expire provider promotions |

### Loyalty & Referrals
| # | Feature | Platform | Description |
|---|---------|----------|-------------|
| 26 | Loyalty Program | API | View loyalty users |
| 27 | Referral Program | API | Track referral rewards |

### Authentication
| # | Feature | Platform | Description |
|---|---------|----------|-------------|
| 28 | Admin Login | Web + Flutter | OTP-based phone login restricted to admin role |

---

## Summary

| Role | Features |
|------|----------|
| Customer | 63 |
| Provider | 48 |
| Admin | 28 |
| **Total** | **139** |
