# HAKKA Reservations Plugin: Build Spec

**For:** the build session (hakkarestaurant.com only) · **Written:** 30 Oct 2026
**Replaces:** MotoPress Appointment Booking on `/reservations/`
**Plan reference:** `README.md` §4 in this folder

---

## 0. What exists today (reviewed on the live site)

| Item | Current state |
|---|---|
| Stack | WordPress 7.1.4, Grand Restaurant theme, Elementor 4.3.5, Rank Math, SiteGround caching, Post SMTP, WPConsent |
| Booking | **MotoPress Appointment Booking** (Lite 2.4.8 + Pro 2.1.0, with Twilio SMS, Square, Google Analytics and Checkout Fields add-ons). The booking form is the Elementor `appointment-form` widget on `/reservations/` (page ID 379). |
| MotoPress setup | 1 location ("HAKKA Restaurant"), 1 employee ("HAKKA Staff"), 3 services (Dining, Event, Corporate Event). Time step 30 min. Default status *pending*, confirmation mode *manual*, payments off, timezone UTC-4, terms page 1327. |
| Opening hours shown on site | Mon–Thu 11am–11pm · Fri–Sat 11am–12am (midnight, fixed this session) · Sun 11am–11pm. One theme setting still says "10:00am - 11:00PM". |
| Current slot length | Per the owner: **1 hour** |
| Other forms | Contact Form 7 and JetFormBuilder (catering form) |
| Email | Post SMTP is installed. The site admin email is `kieljoseph@hotmail.com`. |
| WooCommerce | **Not installed** on this site. It lives on order.hakkarestaurant.com, which is out of scope for this build. |

---

## 1. Requirements (from the owner)

1. A plugin with a **backend** where the admin can **select a location and link it to an email**, so each location's bookings go to its own email.
2. Two locations: **HAKKA Port of Spain** and **HAKKA Brentwood**.
3. **Backend options for everything else**, including time slots. Default slot = **1 hour**.
4. **Different opening and closing hours for different days.** Weekends and Friday open at different times than weekdays.
5. **No deposits.**
6. **WhatsApp** confirmations. The WhatsApp Business account already exists.
7. A **password-protected front-end screen** where staff see bookings and **confirm** them.
8. **Email by location:** the email sent to the guest and the alert sent to staff both use the chosen location's email identity.

---

## 2. Plugin basics

- **Name:** HAKKA Reservations · **Folder/slug:** `hakka-reservations` · **Text domain:** `hakka-reservations`
- Prefix everything `hkr_` (functions, options, tables, hooks, CSS classes)
- Requires PHP 7.4+ and WordPress 6.0+ (the site runs 7.1.4 and PHP 8.3)
- Plain WordPress code, no build tooling required. Admin screens use the WordPress Settings API and standard admin UI.
- All strings translatable. All output escaped. All input sanitized. Nonces on every form and AJAX/REST write. Capability checks on every admin action.
- Timezone: always use `America/Port_of_Spain` (UTC-4, no daylight saving)

---

## 3. Admin backend (wp-admin → "Reservations")

Menu: **Reservations** with sub-pages: *Bookings · Locations · Settings · Messages & Email · WhatsApp · Reports*.

### 3.1 Locations (the core screen)

A list of locations, with **Add / Edit / Deactivate**. Each location has these fields, grouped into tabs:

**General**
| Field | Type | Notes |
|---|---|---|
| Name | text | e.g. "HAKKA Port of Spain" |
| Slug | text | `port-of-spain`, `brentwood`. Used in `?loc=` links and shortcodes. |
| Active | toggle | Inactive locations are hidden from the form |
| Accepts online bookings | toggle | |
| Address | textarea | |
| Phone | text | |
| Google Maps link | url | |
| Display order | number | |

**Email routing (the point of this plugin)**
| Field | Type | Notes |
|---|---|---|
| **Booking notification email(s)** | text, comma-separated | Staff alerts for *this* location go here |
| **From name** | text | e.g. "HAKKA Port of Spain" |
| **From email** | email | Guest emails are sent from this address |
| **Reply-to email** | email | Defaults to From email |
| BCC (optional) | email | |
| Test button | button | "Send test email to this location" |

**Opening hours (different for each day)**
- A row for each day, Monday to Sunday, with:
  - **Open / Closed** toggle
  - **One or more time ranges** (Open time → Close time), with "Add another range" for split service such as lunch and dinner
  - Close time can be **12:00am / midnight** (treated as the end of that day)
- Pre-loaded defaults (editable): Mon–Thu 11:00am–11:00pm · Fri–Sat 11:00am–12:00am · Sun 11:00am–11:00pm
- A "Copy these hours to…" helper (copy Monday to all weekdays, copy one day to another)
- **Special dates** table: a date (or date range) with an override, either *Closed* (holiday) or *Custom hours* (e.g. Christmas Eve), plus an optional note

**Slots and capacity**
| Field | Default | Notes |
|---|---|---|
| Slot length (minutes) | **60** | The booking duration and the step between start times. Options: 30 / 45 / 60 / 90 / 120, or custom. |
| Start-time step (minutes) | 60 | How often a slot starts (e.g. every 30 min). Default equals the slot length. |
| Last booking before close (minutes) | 60 | The latest start time is close time minus this |
| Max covers (guests) per slot | 40 | Total guests booked at the same start time |
| Max bookings per slot | blank = unlimited | |
| Min party size | 1 | |
| Max party size (online) | 10 | Larger parties see "Please call us" or are sent as a request |
| Large-party threshold | blank | Parties at or above this always need manual confirmation |
| Minimum notice (hours) | 2 | |
| Book up to (days ahead) | 60 | |
| Change/cancel cutoff (hours before) | 2 | |
| **Per-day overrides** | | Each day can optionally override slot length, covers per slot and max party size |

**Confirmation**
| Field | Default |
|---|---|
| Confirmation mode | **Manual** (staff confirm). Options: manual / auto-confirm every booking / auto-confirm up to N guests |
| Auto-confirm up to N guests | blank |

**Staff access**
| Field | Notes |
|---|---|
| Staff screen password | One password for *this* location's staff screen (stored hashed) |
| Reminder timing | Hours before the booking (default 24) |

### 3.2 Settings (global)
- Business name · default country code (+1 868) · date/time format
- **Terms and cancellation text**, plus a page link (reuse page 1327)
- Booking form fields: toggle on/off and required/optional for *Occasion*, *Seating preference*, *High chair*, *Dietary / allergy notes*, *Special requests*; editable list of occasion and seating options
- Spam protection: honeypot (always on), rate limit (bookings per IP per hour), optional Cloudflare Turnstile keys
- Staff screen: page URL (default `/staff/bookings/`), session length, failed-login lockout
- Data retention: delete or anonymise guest data after N months
- Uninstall: keep or delete data

### 3.3 Messages & Email
- Templates for: *request received (guest) · confirmed · declined / new time suggested · reminder · cancelled · staff new-booking alert · staff change/cancel alert*
- Each has a subject and an HTML body with placeholders: `{guest_name} {party_size} {date} {time} {end_time} {location_name} {location_address} {location_phone} {location_map_link} {booking_ref} {manage_link} {notes} {occasion}`
- A **preview** and **send test** button for each
- Calendar file (`.ics`) attached to the confirmation email
- All sending goes through `wp_mail()` (Post SMTP delivers it), **setting From/Reply-To/BCC from the booking's location**. Never send one location's booking from or to another location's address.

### 3.4 WhatsApp
- Settings: *Enable WhatsApp*, access token, phone number ID and business account ID (stored encrypted or at least never echoed back), API version
- **Per-location sender**: choose which WhatsApp number/phone number ID is used for each location (or "use shared number")
- Template mapping: each message type → the approved Meta template name and language, plus the order of placeholders
- A **test message** button
- Failures are logged, and the guest email still goes out
- The guest ticks an opt-in checkbox on the form. No opt-in = no WhatsApp.

### 3.5 Bookings (admin list)
- WP-style table: reference, date/time, location, guest, party size, status, source, created
- Filters: location, status, date range. Search by name, phone, email, reference.
- Bulk actions: confirm, cancel, mark no-show, export CSV
- Edit screen: all fields, status, internal notes, history log (who changed what, when)
- "Add booking" for phone/walk-in
- Admins see all locations

### 3.6 Reports
- Covers and bookings per day/week per location, no-show and cancellation rates, busiest slots. CSV export.

---

## 4. Data model

Custom tables (created on activation, versioned for upgrades). Do not use post meta for bookings.

- `{prefix}hkr_locations`: id, name, slug, active, accepts_bookings, address, phone, map_url, sort_order, `settings` (JSON for slot/capacity/confirmation options), `hours` (JSON, per weekday), `special_dates` (JSON), notification_emails, from_name, from_email, reply_to, bcc, whatsapp_phone_id, staff_password_hash, timestamps
- `{prefix}hkr_bookings`: id, ref (unique, e.g. `HK-1042`), location_id, start_datetime, end_datetime, party_size, status (`pending|confirmed|seated|completed|no_show|cancelled|declined`), source (`web|phone|walkin|staff`), guest_name, guest_phone, guest_email, occasion, seating_pref, high_chair, guest_notes, internal_notes, whatsapp_optin, manage_token_hash, reminder_sent_at, created_at, updated_at, created_by
- `{prefix}hkr_booking_log`: id, booking_id, action, old_value, new_value, actor, created_at
- `{prefix}hkr_message_log`: id, booking_id, channel (`email|whatsapp`), template, to, status, error, created_at

Index `location_id, start_datetime` and `status`.

**Availability rule:** a slot is offered if the location is open, the date isn't blocked, the slot is within the notice/advance limits, and `SUM(party_size)` of non-cancelled bookings overlapping the slot, plus the new party, is within the covers limit. Check again in a transaction at booking time to avoid double-booking.

**Hours rule:** a day's close time of midnight means 24:00 of that same day. Friday 11:00–24:00 is valid and the last slot is computed from it.

---

## 5. Front end

### 5.1 Booking form
- Shortcode `[hakka_booking location="auto"]` plus an Elementor-friendly wrapper (a plain shortcode widget is enough)
- Steps: **Location → Party size → Date → Time slot → Details → Confirm**
- Location is read from `?loc=` or the visitor's saved choice (cookie `hkr_loc`), and can be changed
- Date picker greys out closed days and blocked dates. Time slots are the buttons for the chosen location and date, showing only slots with room.
- Fields: full name, phone, email, WhatsApp opt-in, occasion, seating preference, high chair, dietary/allergy notes, special requests, terms checkbox
- Over the max party size: show "Please call {phone}" or send a request for approval
- Accessible, mobile-first, styled to match the site (black/red theme, Poppins), CSS variables for colours
- After submit: success message with the reference, plus emails and WhatsApp as above

### 5.2 Manage link (guest)
- Signed token link from the email lets the guest view, cancel, or request a change, up to the cutoff

### 5.3 Staff screen
- Page created on activation: `/staff/bookings/` (shortcode `[hakka_staff_bookings]`), `noindex`, excluded from caching and sitemaps
- **Login:** pick location + enter that location's password. Manager password sees all locations. Hashed, rate-limited, lockout after repeated failures, session expires after the configured time. Uses its own cookie/session, not WordPress users.
- **Today view** (default) with date navigation and a live-refresh (polling) list. Pending count badge.
- Each booking shows time, name, party size, phone (call and WhatsApp links), occasion, seating, allergy notes, special requests, status
- Actions: **Confirm · Decline / suggest another time (with message) · Seated · Completed · No-show · Cancel · Edit · Add internal note**
- **Add booking** (walk-in / phone)
- Sound and pop-up alert when a new booking arrives (while the page is open)
- Search and filter by status and date

---

## 6. Notifications flow

| Event | Guest | Staff (location email) |
|---|---|---|
| Booking submitted | Email + WhatsApp "request received" | Email alert (+ sound on staff screen) |
| Staff confirm | Email + WhatsApp "confirmed" + `.ics` | |
| Staff decline / new time | Email + WhatsApp | |
| Guest cancels or changes | Email confirmation | Email alert |
| Reminder (default 24h before) | Email + WhatsApp | |

Auto-confirm (if enabled for the location) sends "confirmed" immediately.

---

## 7. Migration from MotoPress
1. Build and test the new plugin with MotoPress still live
2. Export MotoPress's future bookings (REST route `/motopress/appointment/v1/bookings/reservations` or the `mpa_*` data) and import into `hkr_bookings` as the Brentwood location, **confirming with the owner** which existing bookings are real
3. Replace the `appointment-form` widget on `/reservations/` (page 379) with `[hakka_booking]`
4. Leave MotoPress deactivated, not deleted, for a few weeks. Then remove it, and its Twilio, Square, Google Analytics and Checkout Fields add-ons.
5. Update the "Make Reservation" buttons across the site (they already point to `/reservations/`)

---

## 8. Locations to create on first run
| Name | Slug | Hours (defaults, editable) | Email | WhatsApp |
|---|---|---|---|---|
| HAKKA Brentwood | `brentwood` | Mon–Thu 11am–11pm · Fri–Sat 11am–12am · Sun 11am–11pm | *(owner to provide)* | *(owner to provide)* |
| HAKKA Port of Spain | `port-of-spain` | *(owner to provide)* | *(owner to provide)* | *(owner to provide)* |

The Brentwood address is 200 South Brentwood Avenue, Chaguanas. The phone is +1 868 334 2552. The Port of Spain details are still needed.

---

## 9. Testing before launch
- Unit-level checks for: hours parsing (including midnight close, closed days and special dates), slot generation (60-minute and 30-minute), capacity maths, double-booking prevention
- Email routing: a booking at each location produces a guest email from that location's From address and a staff alert only to that location's email. No cross-sending.
- Staff screen: wrong password, lockout, one location can't see another's bookings
- Mobile and desktop form pass, keyboard use, screen-reader labels
- Test WhatsApp templates in Meta's sandbox before going live
- Caching: the form, availability and staff screen must never be served from the SiteGround cache (exclude their URLs/endpoints)

---

## 10. Open items for the owner
1. Email addresses for each location (From address and staff alert inboxes)
2. Port of Spain: address, phone, hours (each day), map link
3. WhatsApp: one number or one per location? Which number(s) are on the Business account, and are they connected to the Meta Cloud API? The message templates need Meta approval.
4. Confirm the **default slot length** at each location (1 hour assumed), and the covers limit per slot
5. Should small parties auto-confirm, or should staff always confirm? (MotoPress is manual today.)
6. Staff login: one password per location (the default in this spec), or individual accounts?
7. Large parties: from what size, and a request-only flow?
8. Is it OK to deactivate MotoPress once the new plugin is live, and are there existing bookings to import?
