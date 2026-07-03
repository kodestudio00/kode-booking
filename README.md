# Kode Studio — Booking Widget

A self-contained, Setmore-style booking widget: pick a service → pick a date
and time → enter details → get a confirmation with an "Add to calendar" file.
No frameworks, no build step — just HTML, CSS and vanilla JS.

## Files

- `booking-widget.css` — all styles, scoped under `.kb-widget` so it won't clash with your site's existing CSS.
- `booking-widget.js` — the widget engine. Exposes one global: `KodeBooking`.
- `index.html` — a working demo/example page.

## 1. Add it to a page

Drop this into any HTML page, anywhere you want the widget to appear:

```html
<link rel="stylesheet" href="booking-widget.css">

<div id="kode-booking"></div>

<script src="booking-widget.js"></script>
<script>
  KodeBooking.init('#kode-booking', {
    businessName: 'Kode Studio',
    tagline: 'Book a session with our team',
    services: [
      { id: 'consult', name: 'Free Consultation', duration: 30, price: 0 },
      { id: 'design',  name: 'Design Session',     duration: 60, price: 75 },
    ],
  });
</script>
```

That's it — you can put this on a dedicated `/booking` page, in a modal, or
in a sidebar. You can also run `KodeBooking.init()` more than once on the
same page (e.g. two different `<div>`s with different `storageKey`s) if you
ever need two separate booking flows.

The widget also pulls three Google Fonts (Space Grotesk, Inter, JetBrains
Mono) — see the `<link>` tags at the top of `index.html`. If you'd rather
self-host fonts, just replace those with your own `@font-face` rules; the
CSS variables `--kb-font-display`, `--kb-font-body`, `--kb-font-mono` in
`booking-widget.css` control which fonts the widget uses.

## 2. Configure it for your business

Everything is one config object passed to `KodeBooking.init()`:

| Option | What it does |
|---|---|
| `businessName` | Shown in the widget header |
| `tagline` | Small line under the business name |
| `services` | Array of `{ id, name, duration (minutes), price }` |
| `workingHours` | Object keyed `0`–`6` (Sun–Sat), each `{ start, end }` in 24h `"HH:MM"`, or `null` for closed |
| `slotIntervalMinutes` | Spacing between bookable start times (e.g. 15, 30, 60) |
| `minNoticeHours` | Stops same-hour walk-in bookings — e.g. `2` hides slots less than 2 hours away |
| `maxAdvanceDays` | How far into the future people can book |
| `currency` | Symbol shown next to prices |
| `onBooked` | Function called with the finished booking object — this is your hook into email/backend, see below |
| `storageKey` | Namespace for where bookings are stored locally (see below) |

## 3. Important — read this before going live

Out of the box, the widget stores bookings in the visitor's own browser
(`localStorage`) purely so the demo works with **zero setup**: double-booking
prevention, the calendar of taken slots, etc. all work correctly for one
visitor in one browser.

**This does not sync between visitors or devices.** Two different customers
on two different phones won't see each other's bookings, so they *could*
both grab the same slot. For a real, live booking page you need a small
backend to be the single source of truth. You have two easy paths:

### Option A — quickest: a form/email service (no server code)
Use something like **Formspree**, **EmailJS**, or **Getform** to email you
(and optionally the customer) the moment a booking is confirmed. Wire it up
inside `onBooked`:

```js
onBooked: function (booking) {
  fetch('https://formspree.io/f/your-form-id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(booking),
  });
}
```

This gets you email notifications quickly, but it won't stop double-booking
across devices — good for a low-traffic business getting started.

### Option B — proper fix: a tiny backend
Stand up a small API (a few endpoints: `GET /availability`, `POST /bookings`)
backed by a database — **Supabase**, **Firebase**, or your own Node/PHP
server all work fine. Then:

1. Replace the `Store` object at the top of `booking-widget.js` — swap
   `isSlotTaken` and `add` for `fetch()` calls to your API instead of
   `localStorage`.
2. Your server checks for conflicts before saving, so two people truly can't
   grab the same slot.
3. Send confirmation emails from the server (e.g. with Resend, Postmark, or
   SendGrid) right after saving.

I kept the storage logic in one small `Store` object specifically so this
swap is contained — you shouldn't need to touch the rendering code at all.

Happy to build out either option with you when you're ready — just tell me
which one fits your setup (e.g. what you're hosting the site on) and I'll
write the actual backend code.

## 4. Viewing bookings stored locally (for testing)

While you're testing with the default `localStorage` mode, you can inspect
what's been booked from the browser console:

```js
KodeBooking.getBookings(); // returns an array of booking objects
```

## 5. Customizing the look

All colors, spacing and fonts are CSS custom properties at the top of
`.kb-widget` in `booking-widget.css` — e.g. `--kb-accent`, `--kb-bg`,
`--kb-radius`. Change those and the whole widget re-themes; you don't need
to hunt through individual rules.