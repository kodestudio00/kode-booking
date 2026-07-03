-- ============================================================
-- Kode Studio booking system — Supabase setup
-- Run this once in Supabase: SQL Editor → New Query → paste → Run
-- ============================================================

-- 1. The bookings table.
create table bookings (
  id uuid primary key default gen_random_uuid(),
  ref text not null,
  service_id text not null,
  service_name text not null,
  duration integer not null,
  price numeric not null default 0,
  booking_date date not null,
  booking_time text not null,        -- stored as "HH:MM", e.g. "14:30"
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  notes text,
  created_at timestamptz not null default now(),

  -- THE IMPORTANT PART: the database itself refuses two bookings
  -- for the same date + time, no matter how fast they arrive.
  constraint unique_slot unique (booking_date, booking_time)
);

-- 2. Lock the table down. By default, nobody can read or write anything.
alter table bookings enable row level security;

-- 3. Allow anyone (your website visitors) to INSERT a new booking.
--    They still can't read the table directly — see the functions below.
create policy "Anyone can create a booking"
  on bookings for insert
  with check (true);

-- 4. A safe function that only reveals which time slots are taken on a
--    given date — never customer names, emails, or phone numbers.
--    This is what the widget calls to build the calendar.
create or replace function get_taken_slots(for_date date)
returns table (booking_time text)
language sql
security definer
as $$
  select booking_time from bookings where booking_date = for_date;
$$;

-- 5. Let the public (anon) role call that function.
grant execute on function get_taken_slots(date) to anon;

-- ============================================================
-- Optional but recommended: a private view for YOU to see full
-- booking details (name, email, phone) when logged into Supabase.
-- Regular website visitors cannot access this — only you, from
-- the Supabase dashboard's Table Editor.
-- ============================================================