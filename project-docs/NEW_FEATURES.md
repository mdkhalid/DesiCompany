# DesiCompany — New Features Roadmap

**Created:** 2026-06-20
**Status:** Planning

---

## Priority Features (Build Order)

| # | Feature | Status | Priority |
|---|---------|--------|----------|
| 1 | Provider availability calendar (weekly time slots) | ✅ Complete | High |
| 2 | Recurring bookings (weekly/monthly scheduling) | ✅ Complete | High |
| 3 | Emergency service mode (urgent premium pricing) | ✅ Complete | High |
| 4 | Referral program (wallet credit for referrer + referee) | ✅ Complete | High |
| 5 | Admin analytics dashboard (revenue, bookings, top providers) | ✅ Complete | High |
| 6 | Booking reminders (push notification 1h before) | ✅ Complete | High |
| 7 | Customer loyalty program (points per booking) | ✅ Complete | Medium |
| 8 | Provider badges (Top Rated, Fast Responder, etc.) | ✅ Complete | Medium |
| 9 | Invoice generation (PDF with tax breakdown) | ✅ Complete | Medium |
| 10 | Automated follow-up (review reminder 24h after) | ✅ Complete | Medium |
| 11 | Before/after photo upload (proof of completion) | ✅ Complete | Medium |
| 12 | Provider portfolio (photo gallery on profile) | ✅ Complete | Medium |
| 13 | Multi-language chat (in-app translation) | ✅ Complete | Medium |
| 14 | Dynamic pricing (surge during peak hours) | ✅ Complete | Medium |
| 15 | Multi-service booking (multiple services in one trip) | ✅ Complete | Medium |
| 16 | Promoted listings (paid placement in search) | ✅ Complete | Low |
| 17 | Service packages (bundled services at discount) | ✅ Complete | Low |
| 18 | Service area map (visual radius on provider profile) | ✅ Complete | Low |
| 19 | Provider verification video | ✅ Complete | Low |
| 20 | Customer support chat (in-app tickets) | ✅ Complete | Low |

---

## Feature Details

### 1. Provider Availability Calendar
- Weekly calendar with time slot management
- Provider can set available hours per day
- Override for specific dates (holidays, special availability)
- Customer sees real-time availability when booking
- **Backend:** `ProviderAvailability` entity already exists, extend with date overrides
- **Mobile:** Calendar UI with time slot picker

### 2. Recurring Bookings
- Customer can set up recurring service schedule
- Auto-create booking on schedule (weekly, bi-weekly, monthly)
- Provider accepts/rejects each occurrence
- Cancel/modify recurring series
- **Backend:** New `RecurringBooking` entity + scheduler service
- **Mobile:** Recurring toggle on booking form, series management

### 3. Emergency Service Mode
- Customer can mark booking as "Urgent/Emergency"
- Higher base price (configurable multiplier)
- Priority notification to nearby providers
- Faster response SLA tracking
- **Backend:** `isEmergency` flag on Booking, price multiplier config
- **Mobile:** Emergency toggle with price preview

### 4. Referral Program
- Customer shares referral code
- New user registers with code → both get wallet credit
- Configurable credit amounts
- Referral tracking and analytics
- **Backend:** New `Referral` entity, wallet credit logic
- **Mobile:** Share code UI, referral status screen

### 5. Admin Analytics Dashboard
- Revenue charts (daily, weekly, monthly)
- Booking trends and peak hours
- Top providers by rating/completion rate
- Customer retention metrics
- Category performance breakdown
- **Backend:** New analytics endpoints with aggregation queries
- **Admin Web:** Dashboard with Chart.js/Recharts

### 6. Booking Reminders
- Push notification 1 hour before scheduled service
- Email confirmation (optional)
- Provider and customer both notified
- **Backend:** Cron job to check upcoming bookings
- **Mobile:** Notification handling

### 7. Customer Loyalty Program
- Points earned per booking (based on amount)
- Tier system (Bronze, Silver, Gold, Platinum)
- Points redeemable for wallet credit or discounts
- Tier-based benefits (priority support, exclusive offers)
- **Backend:** `LoyaltyPoint` entity, tier calculation
- **Mobile:** Points balance, tier progress UI

### 8. Provider Badges
- "Top Rated" — 4.5+ rating with 20+ reviews
- "Fast Responder" — responds to bookings within 15 min
- "Experienced" — 50+ completed bookings
- "Reliable" — 95%+ completion rate
- Badge display on provider profile
- **Backend:** Badge calculation service
- **Mobile:** Badge icons on provider cards

### 9. Invoice Generation
- PDF invoice after booking completion
- Service details, charges, commission breakdown
- Tax calculation (GST if applicable)
- Download from booking history
- **Backend:** PDF generation (puppeteer/pdfkit)
- **Mobile:** Download invoice button

### 10. Automated Follow-up
- Push notification 24h after booking completion
- Reminder to leave review and rating
- One-tap review flow
- **Backend:** Cron job for follow-up notifications
- **Mobile:** Deep link to review screen

### 11. Before/After Photo Upload
- Provider uploads photos before starting work
- Provider uploads photos after completing work
- Stored in booking for dispute resolution
- Admin can view for verification
- **Backend:** Extend `BookingCharge` or new `BookingPhoto` entity
- **Mobile:** Camera integration on booking status screens

### 12. Provider Portfolio
- Photo gallery of past work
- Organized by service category
- Customer can view before booking
- **Backend:** New `PortfolioItem` entity
- **Mobile:** Gallery view on provider profile

### 13. Multi-language Chat
- Real-time translation of chat messages
- Support for English + Hindi initially
- Provider and customer see messages in their language
- **Backend:** Translation API integration (Google Translate)
- **Mobile:** Language toggle in chat

### 14. Dynamic Pricing
- Surge pricing during peak hours
- Holiday pricing modifiers
- Demand-based price suggestions
- Configurable by admin per category
- **Backend:** Pricing rules engine
- **Mobile:** Price indicator (normal/surge)

### 15. Multi-Service Booking
- Book multiple services in one booking
- Single provider or multiple providers
- Combined pricing with bundle discount
- **Backend:** Extend booking to support multiple `ProviderService` items
- **Mobile:** Multi-select service picker

### 16. Promoted Listings
- Providers pay for priority placement
- "Sponsored" badge on listings
- Configurable bid amounts
- **Backend:** `PromotedListing` entity, payment integration
- **Mobile:** Sponsored section in search results

### 17. Service Packages
- Bundle related services at discounted rate
- Example: "Home Deep Clean" = Cleaning + Pest Control
- One-click booking for package
- **Backend:** New `ServicePackage` entity
- **Mobile:** Package cards in category screen

### 18. Service Area Map
- Visual map showing provider's service radius
- Customer can see coverage area
- Filter by providers covering their location
- **Mobile:** Map integration on provider profile

### 19. Provider Verification Video
- Short video verification (30s intro)
- Admin reviews for enhanced trust badge
- Optional, not required for basic verification
- **Backend:** Video storage + admin review workflow
- **Mobile:** Video recording/playback

### 20. Customer Support Chat
- In-app support ticket system
- Admin responds via admin panel
- Ticket categories (booking issue, payment, other)
- **Backend:** New `SupportTicket` entity
- **Mobile:** Support screen with ticket history
