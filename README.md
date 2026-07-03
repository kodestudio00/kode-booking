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

## 3. Backend — double-booking prevention (Supabase)

By default, if you leave `supabaseUrl` / `supabaseKey` blank, bookings only
save in the visitor's own browser (`localStorage`) — fine for testing, but
two different customers on two different devices could grab the same slot,
since neither browser knows about the other's booking.

Setting `supabaseUrl` and `supabaseKey` switches the widget to a real
Supabase (Postgres) database with a **unique constraint on (date, time)** —
the database itself physically refuses a duplicate booking, even if two
people submit at the exact same second. This is already wired up:

1. Run `supabase-setup.sql` once in your Supabase project's SQL Editor —
   it creates the `bookings` table, the uniqueness rule, and locks the
   table down with Row Level Security so visitors can create bookings but
   can never read anyone else's name, email, or phone number.
2. Copy your **Project URL** and **Publishable key** from
   Settings → API in Supabase.
3. Paste them into `supabaseUrl` / `supabaseKey` in `index.html`.

That's it — no server to run, no separate hosting. The widget talks
directly to Supabase's REST API over HTTPS.

**Viewing your bookings:** open your Supabase project → **Table Editor** →
`bookings`. That's the one place full customer details (name, email, phone)
are visible — the public widget deliberately can't read them back out.

**Email confirmations:** Supabase doesn't send emails on its own. The
cleanest way to add them is a small **Supabase Edge Function** triggered on
insert, or a service like Resend/Postmark called from that function. Ask me
when you're ready and I'll write it — it plugs into what's already here
without changing the widget itself.

**If you ever want to swap Supabase for something else** (your own Node
server, Firebase, etc.), all backend logic lives in one `Store` object near
the top of `booking-widget.js` — the rest of the widget only ever calls
`Store.getTakenSlots()` and `Store.add()`, so a future swap stays contained.

## 4. Customizing the look

All colors, spacing and fonts are CSS custom properties at the top of
`.kb-widget` in `booking-widget.css` — e.g. `--kb-accent`, `--kb-bg`,
`--kb-radius`. Change those and the whole widget re-themes; you don't need
to hunt through individual rules.