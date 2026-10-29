# Haka Restaurant: Website Rebuild & Two-Location Plan

**Status:** Draft working plan · **Created:** 29 Oct 2026 · **Owner:** Kiel
**Sites in scope:** main site (hakkarestaurant.com) and online ordering (order.hakkarestaurant.com), both on WordPress + WooCommerce

> This folder is temporary. Move it to its proper repo or path when you have GitHub access again.

---

## 0. Before we start: open items

| # | Item | Why it matters |
|---|------|----------------|
| 0.1 | **Find the earlier audit document.** I searched your Google Drive and Gmail and couldn't find it. Paste or link it so its findings can go into Section 2. | That audit is the "fix" list. Section 2 is a placeholder until we have it. |
| 0.2 | **Confirm the domain spelling.** You wrote *hakarestaurant.com*, but your email is *@hakkarestaurant.com*. | We need the right domain for DNS, SSL, redirects and SEO. |
| 0.3 | **Get admin access and a full backup of both sites** (files and database). | We need it before any rebuild work. |
| 0.4 | **Get the facts for each location:** address, phone, WhatsApp, hours, map pin, menu and price differences, delivery zones, seating capacity, table layout. | These drive the location tabs, the booking plugin and checkout. |
| 0.5 | **Gather brand assets for each location:** logo variants, photos (the Ironside Media shoot in Drive › *Hakka*), colour accents, and any interior or vibe differences. | We need these for the "look and feel" of each location. |

I couldn't reach either site from this cloud session, because outbound access to those domains is blocked here. Do the live-site audit in Phase 1 from your own machine.

---

## 1. Goals

1. **Rebuild and clean up** both sites. Fix everything from the audit, plus anything new we find.
2. **Run two locations, Port of Spain and Brentwood**, with clear tabs. Each tab gets its own look, information, menu and ordering.
3. **Add table booking** with a custom plugin that knows about both locations.
4. Keep online ordering working the whole time. No downtime on order.hakkarestaurant.com during service hours.

---

## 2. Fixes from the earlier audit (placeholder)

> Fill this in from the audit document (item 0.1). Give each finding a row.

| ID | Site | Page / area | Issue | Fix | Priority | Status |
|----|------|-------------|-------|-----|----------|--------|
| A-01 | | | | | | ☐ |
| A-02 | | | | | | ☐ |

**Standard checks we'll run on both sites anyway:**
- [ ] WordPress core, theme and plugin updates. Remove unused plugins and themes.
- [ ] PHP version, Site Health, PHP error log
- [ ] SSL, plus www/non-www and http→https redirects. Check the order subdomain's cookies and sessions.
- [ ] Page speed: image sizes (WebP), caching, lazy-loading, render-blocking CSS/JS
- [ ] Mobile layout on every key page
- [ ] Broken links, 404s, placeholder or lorem text, outdated hours, prices and phone numbers
- [ ] SEO: titles, meta descriptions, Open Graph images, sitemap, robots.txt, `Restaurant` + `LocalBusiness` schema **for each location**
- [ ] Google Business Profile for each location, linked to the matching location page
- [ ] Accessibility basics: contrast, alt text, focus states, form labels
- [ ] WooCommerce: payment gateways, tax, emails (branding + location details), order statuses, test orders
- [ ] Legal pages: privacy, terms, refund policy, cookie notice
- [ ] Analytics and conversion tracking (orders + bookings), set up per location

---

## 3. Two locations: Port of Spain | Brentwood

### 3.1 What the customer sees
- **Main site:** a location switcher at the top of the homepage with two big tabs, **Port of Spain** and **Brentwood**. The header also gets a persistent "Your location: ___ ▾" control.
- Picking a tab switches:
  - hero image/video, colour accent and tagline (each location's "look and feel")
  - address, map, phone/WhatsApp, hours, holiday hours
  - menu (shared items + location-only items + location prices)
  - **Order Online** button → order site with that location pre-selected
  - **Book a Table** button → booking form with that location pre-selected
  - gallery, reviews and specials for that location
- The choice is remembered (cookie + WooCommerce session) and carried over to the order site.
- Each location gets its own URL for SEO and sharing: `/port-of-spain/` and `/brentwood/`. The homepage tabs link to them, and the root homepage shows a neutral "Choose your location" state, or the last location the visitor picked.

### 3.2 How we build it
- **Reuse what we already have.** `mc-multistore` (in this repo) already has:
  - an `mc_location` post type with details, hours, ordering intervals, staff and SEO meta boxes (`mc-multistore/mc-multistore/includes/class-mc-locations.php`)
  - an active-location session (`mc_active_location`, cookie `mc_loc_id`) and checkout validation (`mc-multistore/mc-multistore/mc-multistore.php`)
  - the `[mc_store_locator]` and `[mc_active_store_btn]` shortcodes
- **What to add:**
  - [ ] **Theme fields for each location** on `mc_location`: accent colour, hero media, logo variant, tagline, gallery. Output them as CSS custom properties (`--loc-accent`, etc.) so the whole page re-themes when the location changes.
  - [ ] **A `[mc_location_tabs]` shortcode or block** that renders the Port of Spain / Brentwood tab UI and sets the active location.
  - [ ] **Location-aware menu:** a product → location assignment (taxonomy or meta), per-location price overrides, and per-location stock or "86'd" availability.
  - [ ] **Cross-domain handoff:** main site → `order.` subdomain with `?loc=<id>`, which the order site reads into its session.
  - [ ] **Per-location store hours** enforced at checkout, which is already partly done. Check holiday closures.
  - [ ] **Routing orders to staff by location** in `mealcrafter-store-manager` and `mc-order-alerts`. Check that Brentwood staff only see Brentwood orders.
  - [ ] **Per-location receipts and emails:** address, phone, and the QR pickup code (`mealcrafter-qr-scanner`).
  - [ ] **Decide on loyalty** (`mealcrafter-loyalty`): are points shared across locations? (Recommended: yes.)

### 3.3 Things to fix that I spotted in this repo
- [ ] Two places register the `[mealcrafter]` shortcode: `mc-core/mc-core/mc-core.php:24` and `mc-core/mc-core/includes/class-mc-shortcodes.php:8`. Whichever loads last silently wins. Keep one.
- [ ] The plugins were committed as unzipped uploads, with no build or version control conventions. Before the rebuild, set up one plugin per folder with a changelog and version bumps.

---

## 4. Table booking plugin: `mealcrafter-bookings` (new)

### 4.1 Customer flow
1. Choose a **location** (pre-filled from the active location)
2. Choose **party size** → **date** → only the **time slots** that still have room
3. Enter **name, phone, email** and notes (occasion, allergies, high chair, seating preference)
4. Confirm. They get an on-screen confirmation, a branded email (+ optional SMS/WhatsApp) and an add-to-calendar link.
5. Manage the booking from a link in the email: cancel or change it, up to a cutoff.

### 4.2 Staff / admin
- **Settings for each location:** service periods (lunch/dinner), slot length, typical table turn time, max covers per slot, max party size online, lead time, how far ahead people can book, blackout dates, holiday hours
- **Tables (optional, phase 2):** table list with capacity, combinable tables, floor zones
- **Booking list and day view** for each location: statuses (pending → confirmed → seated → completed / no-show / cancelled), walk-ins, notes
- Staff see only their own location (reuse the staff assignment from `mc_location`)
- **Notifications:** new-booking alert to the location (reuse the `mc-order-alerts` sound/popup engine), plus a reminder to the customer 24h / 3h before
- **Large parties / events:** request-only bookings above N guests (manual approval), with an optional deposit through WooCommerce
- **Export:** CSV, plus basic reports (covers per day, no-show rate)

### 4.3 Technical outline
- Its own plugin in the MealCrafter family, depending on `mc-core` and `mc-multistore` (uses `mc_location`)
- A custom DB table `wp_mc_bookings` (not post meta) so slot lookups stay fast
- REST endpoints: `GET /mc/v1/bookings/availability`, `POST /mc/v1/bookings`, `PATCH /mc/v1/bookings/{token}`
- Front end: a `[mc_booking_form location="auto"]` shortcode or block
- Security: nonces, rate limiting, honeypot / Turnstile, a signed manage-booking token
- Timezone: America/Port_of_Spain (AST, UTC-4, no DST)
- Spam and no-show control: phone verification (optional), and blocklisting repeat no-shows

### 4.4 Questions to answer
- [ ] Do both locations take bookings, or only one?
- [ ] Do we need table-level assignment on day one, or is a covers-per-slot cap enough?
- [ ] Deposits or card holds for large parties?
- [ ] SMS/WhatsApp provider (Twilio, WhatsApp Business API) or email only?
- [ ] Does it need to sync with an existing system (OpenTable, Google Reserve)?

---

## 5. Phased plan

| Phase | Work | Output |
|-------|------|--------|
| **1. Discover** (week 1) | Get the audit back (0.1), backups, a staging copy of both sites, a live-site crawl, a plugin/theme inventory, and the location facts (0.4–0.5). | A complete fix list (Section 2) and staging sites |
| **2. Foundations** (week 1–2) | Updates, cleanup, speed, SSL/redirects, the `[mealcrafter]` shortcode clash, repo/version setup. | A clean, fast baseline on staging |
| **3. Two locations** (week 2–3) | `mc_location` theme fields, `[mc_location_tabs]`, `/port-of-spain/` + `/brentwood/` pages, location-aware menu, cross-domain handoff, staff routing. | Working location tabs on both sites |
| **4. Bookings** (week 3–4) | `mealcrafter-bookings` MVP: availability, form, emails, admin list, alerts. | Bookings live on staging |
| **5. Content & SEO** (week 4) | Copy and photos for each location, schema, Google Business Profiles, legal pages. | Content complete |
| **6. QA & launch** (week 5) | Test orders and bookings at both locations, mobile/accessibility pass, staff training, go-live off-peak, monitoring. | Live 🎉 |

---

## 6. Definition of done
- [ ] Every audit item is either fixed or deliberately deferred, with a reason
- [ ] A visitor can switch between Port of Spain and Brentwood. The look, info and menu update, and the choice carries over to ordering and booking.
- [ ] An order placed for Brentwood reaches only Brentwood staff, with the correct receipt and pickup details
- [ ] A booking can be made, confirmed, changed and cancelled at either location, and staff are alerted
- [ ] Mobile Lighthouse score ≥ 85 for performance and ≥ 95 for accessibility on the key pages
- [ ] Backups and an update routine are in place
