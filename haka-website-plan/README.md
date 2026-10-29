# HAKKA Restaurant: Website Fix, Two-Location Rebuild & Booking Plugin

**Status:** Working plan · **Created:** 29 Oct 2026 · **Owner:** Kiel
**Sites:** hakkarestaurant.com (main) · order.hakkarestaurant.com (online ordering)
**Platform:** WordPress + WooCommerce (Elementor). We keep this stack and rebuild *on* it, as the audit recommends.
**Source:** *HAKKA Restaurant – Technical & Strategic Audit* (4-page PDF)

> This folder is temporary. Move it to the right place when you have GitHub access again.

---

## Overview

| Workstream | What | Section |
|---|---|---|
| **1. Fix** | Every defect in the audit, on both sites | §1 |
| **2. SEO & tracking** | Meta titles/descriptions, schema, GA4, Meta Pixel, all location-aware | §2 |
| **3. Two locations** | Location tabs for **Port of Spain** and **Brentwood**, each with its own look and feel | §3 |
| **4. Booking plugin** | Custom HAKKA reservations plugin covering both locations, replacing Amelia | §4 |

The order matters. Fix first: those are live defects customers see today. Then we restructure for two locations. SEO goes in last, so we write it once, per location.

---

## §1 Fixes from the audit

Tick each box once it's fixed **and checked on the live site**. "Effort" is a rough estimate: **S** under 30 minutes, **M** a few hours, **L** a day or more.

### 1A. hakkarestaurant.com: broken links and routing

| # | Issue | Fix | Effort | ☐ |
|---|---|---|---|---|
| M-01 | **"Our Story" page is blank** (`/hakka-story/`): an empty Elementor layout | Write the brand heritage copy and add photos (from the Ironside Media shoot in Drive › *Hakka*). Mention **both** locations. | M | ☐ |
| M-02 | **Instagram feed shows raw shortcode** `[instagram-feed feed=3]` on `/hakka-social/` | Re-authorize Smash Balloon, or point the shortcode at the correct feed ID. Consider one feed per location if each has its own account. | S | ☐ |
| M-03 | **Phone link broken** in the homepage 4-box strip (打电话): `http://+1-868-334-2552` | Change to `tel:+18683342552`. It becomes location-aware in §3. | S | ☐ |
| M-04 | **Dead buttons** on `/celebrations/` ("Select Pickup" / "Select Delivery" are `href="#"`) | Link to `https://order.hakkarestaurant.com/`, carrying the location (§3). | S | ☐ |
| M-05 | **Booking links are inconsistent**: the header and hero go to `/reservations/`, the homepage quick-links go to `/celebrations/` | Point every booking button to `/reservations/`. That page becomes the new booking plugin (§4). | S | ☐ |
| M-06 | **"Get Directions" starts from a fixed point in Trincity** (10.6201088, -61.3613568) | Brentwood: use `https://maps.app.goo.gl/bJTW3FgporBSnryh9`. Port of Spain: create its Google Maps place link. Directions must not have a fixed starting point. | S | ☐ |

### 1B. hakkarestaurant.com: security and mixed content (HTTP vs. HTTPS)

| # | Issue | Fix | Effort | ☐ |
|---|---|---|---|---|
| M-07 | Sitewide preloader GIF loads over `http://` (`/wp-content/uploads/2024/11/hakkabox-animated.gif`), so browsers don't show the padlock | Switch to `https://`. Check whether the preloader is even worth keeping, since it slows the first page load. | S | ☐ |
| M-08 | Food and drinks menu PDFs load over `http://`. The drinks PDF is called `55511_SpiceFusion_Brentwood_drink.pdf` (another brand's name). | Re-upload as `Hakka_Drinks_Menu_Brentwood.pdf` / `Hakka_Food_Menu_Brentwood.pdf` over HTTPS. Add the Port of Spain versions. | S | ☐ |
| M-09 | Order buttons on `/catering/` link to `http://order.hakkarestaurant.com` | Switch to `https://`. | S | ☐ |
| M-10 | *(Sitewide sweep)* Other `http://` links probably exist | Run Better Search Replace `http://hakkarestaurant.com` → `https://…` (and the same for `order.`) on both databases. Set "Force HTTPS" at the host or in Cloudflare. | S | ☐ |

### 1C. hakkarestaurant.com: copy, translation and typos

| # | Issue | Fix | Effort | ☐ |
|---|---|---|---|---|
| M-11 | The homepage "Order Now" Chinese label says **命令** (a military or computer "command") | Change to **点餐** or **立即点餐**. While we're there, have a native speaker check every other Chinese label. | S | ☐ |
| M-12 | Typo: "Caramel Cheesecak Flan" | Change to "Caramel Cheesecake Flan". | S | ☐ |
| M-13 | `/reservations/` lists Friday–Saturday hours as **11am – 12pm** | Change to **11am – 12am (midnight)**. Hours become per location in §3. | S | ☐ |
| M-14 | The `/menu/` intro has lowercase proper nouns ("chinese", "indian", "tangra", "at HAKKA") | Correct the capitalization and grammar. | S | ☐ |
| M-15 | The footer copyright sits in an `<h1>`, says **2025**, and the address repeats "BRENTWOOD" twice | Change the tag to `<p>`, use a dynamic year (`[year]` or `date('Y')`), and show both location addresses correctly. | S | ☐ |

### 1D. order.hakkarestaurant.com

| # | Issue | Fix | Effort | ☐ |
|---|---|---|---|---|
| O-01 | Customers can see the **"Uncategorized"** category | Move those products into real categories and hide empty categories from the category bar. | S | ☐ |
| O-02 | **The mobile menu shows two link lists.** The working one sends "Make A Reservation" to the homepage. The second list is all `href="#"`. | Delete the dead list. Point "Make A Reservation" to `https://hakkarestaurant.com/reservations/`. | S | ☐ |
| O-03 | **Dead buttons on `/find-us/`**: "Restaurant Booking" and "Contact us" have empty `href=""` | Point them to the reservations page and to `tel:`. `/find-us/` will show both locations (§3). | S | ☐ |
| O-04 | **The admin username `adminhakkar` is visible** on `/privacy-policy/`, linked to its author archive. That makes password-guessing attacks easier. | Hide author and date info on pages, block `/author/` archives and `?author=` lookups, and change the display name. Ideally create a new admin with a different username and remove this one. Add 2FA and login rate-limiting. | M | ☐ |
| O-05 | The privacy policy has **12 table-of-contents links pointing to `hakkaexpress.com`** | Rewrite them as same-page links (`#section`). | S | ☐ |
| O-06 | Footer copyright is in an `<h1>` and says **2025** | Change to `<p>` with a dynamic year. | S | ☐ |

### 1E. Hardening (needed for "rebuild", not listed in the audit)

| ☐ | Item |
|---|---|
| ☐ | Full backup of both sites (files + DB) **before any change**, plus a staging copy of each |
| ☐ | Update WordPress core, the theme and all plugins. Remove unused plugins and themes. |
| ☐ | Confirm Cloudflare WAF is on for both domains. Add a security plugin (login limits, 2FA, file-change alerts). |
| ☐ | Run a test order with each payment gateway (Fygaro / the second gateway named in the audit) after the updates |
| ☐ | Speed pass: convert images to WebP, enable caching, review the preloader, lazy-load media. Target mobile Lighthouse ≥ 85. |
| ☐ | Check mobile layout on every key page |
| ☐ | Set up a weekly update and backup routine |

---

## §2 SEO and tracking

The audit found **no meta descriptions, no schema and no tracking** on either site. Google is currently showing text like *"Calculating fare… Unable to calculate delivery fare"* in search results.

### 2A. Titles and meta descriptions (Rank Math or Yoast)

The audit's wording assumes one location (Brentwood). Updated for two:

| Page | Title tag | Meta description |
|---|---|---|
| Home | HAKKA Restaurant \| Chinese, Indian & Thai \| Port of Spain & Chaguanas | Authentic Tangra-style Hakka Chinese, Indian and Thai cuisine in Port of Spain and Brentwood, Chaguanas. Book a table or order online. |
| Brentwood | HAKKA Brentwood \| Chinese, Indian & Thai Dining in Chaguanas | Visit HAKKA at 200 South Brentwood Avenue, Chaguanas. Tangra-style Hakka, Indian & Thai, cocktails, celebrations. Book or order online. |
| Port of Spain | HAKKA Port of Spain \| Chinese, Indian & Thai Dining | *(Fill in the address.)* Tangra-style Hakka, Indian & Thai in Port of Spain. Book a table or order online for pickup or delivery. |
| Menu | Our Menu \| HAKKA Restaurant & Bar | Explore Chicken 65, Momos, Konjee Crispy Chicken, Pad Thai, Thai curries and handcrafted cocktails. |
| Reservations | Book a Table \| HAKKA Port of Spain & Brentwood | Reserve online at HAKKA Port of Spain or Brentwood. Lunch, dinner, date nights and group celebrations. |
| Order subdomain | Order Online for Delivery or Pickup \| HAKKA Restaurant | Order your favourite HAKKA dishes for pickup or delivery from Port of Spain or Brentwood. |

### 2B. Restaurant schema (JSON-LD), one block per location

- A `Restaurant` entity for **Brentwood**. Use the audit's block: 200 South Brentwood Avenue, Chaguanas, TT; geo 10.5046519, -61.4055212; +1-868-334-2552. Add `openingHoursSpecification`, `menu` and `hasMap`.
- A `Restaurant` entity for **Port of Spain** with its own address, geo coordinates, phone and hours (still needed, see §5).
- Optionally an `Organization` entity ("HAKKA Restaurant") that lists both locations as `department` / `subOrganization`.
- Each location page outputs its own schema. The homepage outputs the organization plus both locations.
- Fix the audit's `"acceptsReservations": "True"` → use `true` (a boolean) or the reservations URL.

### 2C. Tracking

| ☐ | Item |
|---|---|
| ☐ | Google Tag Manager on both domains (one container, cross-domain linking main ↔ order) |
| ☐ | GA4 with WooCommerce e-commerce events (`view_item`, `add_to_cart`, `begin_checkout`, `purchase`) and a **`location` parameter** |
| ☐ | Meta Pixel + Conversions API (Facebook for WooCommerce) |
| ☐ | A **booking-complete** conversion event from the new booking plugin (§4) |
| ☐ | Google Ads conversion tag, if ads are planned |
| ☐ | Google Search Console + sitemap for both domains |
| ☐ | **A separate Google Business Profile for each location**, linked to that location's page |

---

## §3 Two locations: Port of Spain | Brentwood

### 3A. What the customer sees

**Homepage**
- A large two-tab switcher near the top: **[ Port of Spain ] [ Brentwood ]**
- Picking a tab changes the **whole look and feel** without reloading the page:
  - Hero photo or video and the tagline
  - Accent colour and decorative details (for example, Port of Spain more urban and modern, Brentwood warmer). Decide this together with the photos.
  - Address, map, phone/WhatsApp, opening hours and holiday hours
  - Featured dishes and specials, plus the menu PDFs
  - Gallery, reviews and the Instagram feed
  - **Order Online** → `order.hakkarestaurant.com/?loc=port-of-spain` (or `brentwood`)
  - **Book a Table** → `/reservations/?loc=…`
- The site remembers the choice (cookie). A returning visitor sees their location first.
- The header shows a small "📍 Brentwood ▾" switcher on every page.

**Location pages:** `/port-of-spain/` and `/brentwood/`
- Full pages for each location. The tabs link here, and each gets its own Google Business Profile and schema (§2).
- Anyone landing from Google sees that location's look right away.

**Pages that become location-aware**

| Page | Change |
|---|---|
| `/reservations/` | Location picker at the top, then the new booking form (§4) |
| `/menu/` | Location toggle. Shared dishes plus location-only items and prices (if they differ) |
| `/celebrations/`, `/catering/` | Location picker on the enquiry and order buttons |
| `/hakka-story/` | The brand story, ending in a "Visit us" block with both locations |
| Footer | Both addresses, phones and hours side by side |
| order. `/find-us/` | Both locations, each with map, hours, phone and booking link |

### 3B. Ordering site (order.hakkarestaurant.com)

- On first visit, or when the link includes `?loc=`, ask or set **"Ordering from: Port of Spain / Brentwood"** before anything goes in the cart.
- Separate pickup/delivery settings, delivery zones, hours and lead times for each location
- Products available per location (hide items that location doesn't sell), with per-location price overrides if needed
- Order emails, receipts and printed kitchen tickets show the right location's address and phone
- Each location's kitchen only receives its own orders: check kitchen display and printer routing
- Switching location with items in the cart warns before clearing unavailable items

### 3C. How we build the look and feel

- Set up each location once, in one place: an admin screen with hero media, accent colours, logo variant, tagline, address, geo coordinates, phone, hours, map link, menu PDFs, Instagram feed ID and Google Business Profile link.
- The page reads those settings as CSS variables (`--loc-accent`, `--loc-hero`…), so switching tabs re-themes the page instantly.
- Build the shared sections once in Elementor (global widgets / templates), not duplicated per location, so a fix applies to both.
- Phone, address and hours come from those settings everywhere, so M-03, M-13 and M-15 can't drift again.

---

## §4 Custom booking plugin: "HAKKA Reservations"

**Replaces:** the Amelia booking widget currently on `/reservations/`. Before switching, export Amelia's existing future bookings and import them into the new system.

### 4A. Guest flow
1. **Location**, pre-selected from the tab or cookie, and easy to change
2. **Party size → date → time.** Only times that still have space are shown, using that location's hours.
3. **Details:** name, phone (TT format), email, occasion (birthday, anniversary, date night, business), dietary notes, seating preference, high chair
4. **Confirmation** on screen + branded email (+ WhatsApp/SMS if we turn it on) + an add-to-calendar file
5. A **manage-booking link** in the email to change or cancel, up to a cutoff (for example, 2 hours before)
6. Groups above a set size (for example, 10 or more) or celebration packages become a **request** that staff approve, with an optional **deposit** paid through WooCommerce and the existing gateway

### 4B. Staff / admin
- **Settings for each location:** service periods (lunch/dinner), slot interval, table turn time, max covers per slot, max online party size, minimum notice, how far ahead people can book, blackout dates and holiday hours
- **Today view** for each location: timeline/list, statuses *pending → confirmed → seated → completed / no-show / cancelled*, walk-ins, internal notes
- **Staff see only their own location.** Managers see both.
- **Alerts:** a sound/pop-up on the host stand for new bookings, an email to the location's manager, and a reminder to the guest 24 hours before
- **Guest history:** visit count, no-show count, notes ("prefers booth", "nut allergy")
- **Reports:** covers per day per location, no-show rate, busiest slots. CSV export.
- *(Phase 2)* A table map: tables with capacity, joinable tables, zones (patio, bar, private room), and assigning bookings to tables

### 4C. Technical outline
- A standalone WordPress plugin on hakkarestaurant.com. Its own database tables keep availability lookups fast at dinner rush.
- Locations come from the settings in §3C, so there's one source of truth.
- REST endpoints for availability, create and manage. Front end as an Elementor widget plus a `[hakka_booking]` shortcode.
- Security: nonces, rate limiting, Cloudflare Turnstile/honeypot, signed manage-links. No admin or usernames exposed (lesson from O-04).
- Timezone: America/Port_of_Spain (UTC-4, no daylight saving)
- Emails sent through a proper SMTP or transactional service (not PHP mail) so they don't land in spam
- GA4 and Meta "booking complete" events (§2C)

### 4D. Questions to decide
- [ ] Do both locations take reservations from day one?
- [ ] Is a covers-per-slot limit enough to start with, or do we need table assignment immediately?
- [ ] Deposits: for which party sizes or events, and how much?
- [ ] Should WhatsApp/SMS confirmations and reminders go out? Which provider?
- [ ] Should guests be able to choose a seating area (bar, patio, private room)?
- [ ] What happens to Amelia afterward: remove it completely, or keep it for anything else?

---

## §5 Information needed from the business

| ☐ | Item |
|---|---|
| ☐ | **Port of Spain:** full address, Google Maps place link, geo coordinates, phone/WhatsApp, email, opening hours, holiday hours |
| ☐ | **Brentwood:** confirm address, phone and hours (including Fri–Sat 11am–12am) |
| ☐ | Are the menu and prices the same at both locations? If not, the differences. New menu PDFs for each location. |
| ☐ | Delivery zones, fees and minimums for each location. Pickup lead times. |
| ☐ | Seating capacity and service periods per location (for bookings) |
| ☐ | The look and feel for each location: photos/video, any interior or brand differences, preferred accent colours |
| ☐ | Brand story copy for `/hakka-story/` (or bullet points we can write from) |
| ☐ | Instagram accounts: one shared account or one per location? Smash Balloon login. |
| ☐ | Admin access to both sites, the host, Cloudflare, Google (Search Console, GA4, Business Profiles) and Meta Business |

---

## §6 Phased schedule

| Phase | Work | Output |
|---|---|---|
| **0. Prep** (days 1–2) | Backups, staging copies, access (§5), updates (§1E) | Safe sandbox |
| **1. Quick fixes** (days 2–4) | Everything in §1A–1D. Most of it is small, so push it straight to live after a staging check. | All audit defects closed |
| **2. Location foundation** (week 2) | Location settings (§3C), header switcher, `/brentwood/` + `/port-of-spain/` pages, footer, `/find-us/` | Both locations visible |
| **3. Homepage tabs & theming** (week 2–3) | Tab switcher, per-location look and feel, location-aware menu, celebrations and catering pages | The "two-tab" experience |
| **4. Ordering by location** (week 3) | Location gate, per-location products/zones/hours, kitchen routing, receipts | Orders reach the right kitchen |
| **5. Booking plugin** (week 3–5) | Build → test on staging → import Amelia bookings → switch over | Reservations live for both locations |
| **6. SEO & tracking** (week 5) | §2: meta, schema, GTM/GA4/Pixel, Search Console, Business Profiles | Measurable and findable |
| **7. QA & launch** (week 5–6) | Test orders and bookings at each location, mobile and speed pass, staff training | Live |

---

## §7 Finished means
- [ ] Every box in §1 is ticked and checked on the live site
- [ ] Nothing loads over `http://`, and no admin username is visible anywhere
- [ ] A visitor can switch Port of Spain ↔ Brentwood and the look, info, menu, order link and booking link all follow
- [ ] A Port of Spain order only reaches the Port of Spain kitchen, with the correct receipt
- [ ] A booking can be made, changed and cancelled at both locations, and staff get alerts
- [ ] Each location has a meta title and description, schema and a Google Business Profile, and GA4/Pixel record purchases and bookings
- [ ] Mobile Lighthouse score ≥ 85 for performance and ≥ 95 for accessibility on the key pages
