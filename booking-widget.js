/* ==========================================================================
   Kode Studio — Booking Widget engine
   No dependencies. Drop this file + booking-widget.css into any site.

   USAGE
   -----
   <div id="kode-booking"></div>
   <script src="booking-widget.js"></script>
   <script>
     KodeBooking.init('#kode-booking', {
       businessName: 'Kode Studio',
       // ...see CONFIG below for every option
     });
   </script>
   ========================================================================== */

(function (window) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 1. DEFAULT CONFIG — override any of this from init()
   * ------------------------------------------------------------------ */
  const DEFAULT_CONFIG = {
    businessName: 'Kode Studio',
    tagline: 'Book a session with us',

    // Each service: id must be unique. duration is in minutes.
    services: [
      { id: 'consult', name: 'Free Consultation', duration: 30, price: 0 },
      { id: 'design', name: 'Design Session', duration: 60, price: 75 },
      { id: 'build', name: 'Build & Review', duration: 90, price: 120 },
    ],

    // Working hours per weekday (0 = Sunday ... 6 = Saturday).
    // Omit a day (or set to null) to mark it closed.
    workingHours: {
      0: null,
      1: { start: '09:00', end: '17:00' },
      2: { start: '09:00', end: '17:00' },
      3: { start: '09:00', end: '17:00' },
      4: { start: '09:00', end: '17:00' },
      5: { start: '09:00', end: '15:00' },
      6: null,
    },

    slotIntervalMinutes: 30,   // spacing between bookable start times
    minNoticeHours: 2,          // can't book sooner than this from now
    maxAdvanceDays: 45,         // can't book further out than this
    currency: '$',

    // Called with the finished booking object after the user confirms.
    // Wire this up to your backend / email service. See README.
    onBooked: null,

    // Storage namespace (localStorage) — change if you run multiple
    // widgets on one domain and want separate booking logs.
    storageKey: 'kode_booking_demo',
  };

  /* ------------------------------------------------------------------ *
   * 2. STORAGE — swap this out for a real API call in production.
   *    See README "Connecting a real backend" section.
   * ------------------------------------------------------------------ */
  const Store = {
    _mem: [],
    _key: 'kode_booking_demo',

    init(key) {
      this._key = key;
      try {
        const raw = window.localStorage.getItem(this._key);
        this._mem = raw ? JSON.parse(raw) : [];
      } catch (e) {
        this._mem = []; // localStorage unavailable (privacy mode, sandboxed iframe, etc.)
      }
    },

    getAll() {
      return this._mem.slice();
    },

    add(booking) {
      this._mem.push(booking);
      this._persist();
    },

    isSlotTaken(dateStr, timeStr) {
      return this._mem.some((b) => b.date === dateStr && b.time === timeStr);
    },

    _persist() {
      try {
        window.localStorage.setItem(this._key, JSON.stringify(this._mem));
      } catch (e) {
        /* ignore — booking still works for this session */
      }
    },
  };

  /* ------------------------------------------------------------------ *
   * 3. DATE / TIME HELPERS
   * ------------------------------------------------------------------ */
  const pad2 = (n) => String(n).padStart(2, '0');
  const toDateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const parseTime = (t) => {
    const [h, m] = t.split(':').map(Number);
    return { h, m };
  };
  const minutesFrom = (t) => {
    const { h, m } = parseTime(t);
    return h * 60 + m;
  };
  const minutesToLabel = (mins) => {
    let h = Math.floor(mins / 60);
    const m = mins % 60;
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${pad2(m)} ${suffix}`;
  };
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function buildSlotsForDate(date, cfg) {
    const hours = cfg.workingHours[date.getDay()];
    if (!hours) return [];

    const now = new Date();
    const minNoticeMs = cfg.minNoticeHours * 60 * 60 * 1000;
    const earliestAllowed = new Date(now.getTime() + minNoticeMs);

    const startMin = minutesFrom(hours.start);
    const endMin = minutesFrom(hours.end);
    const step = cfg.slotIntervalMinutes;
    const svcDuration = cfg._selectedDuration || step;

    const slots = [];
    for (let t = startMin; t + svcDuration <= endMin; t += step) {
      const slotDate = new Date(date);
      slotDate.setHours(Math.floor(t / 60), t % 60, 0, 0);
      if (slotDate < earliestAllowed) continue;
      slots.push({ minutes: t, label: minutesToLabel(t), value: `${pad2(Math.floor(t/60))}:${pad2(t%60)}` });
    }
    return slots;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  /* ------------------------------------------------------------------ *
   * 4. ICS FILE (add-to-calendar) — generated client-side, no dependency
   * ------------------------------------------------------------------ */
  function buildIcs(booking, cfg) {
    const [y, mo, d] = booking.date.split('-').map(Number);
    const { h, m } = parseTime(booking.time);
    const start = new Date(y, mo - 1, d, h, m);
    const end = new Date(start.getTime() + booking.duration * 60000);
    const fmt = (dt) => `${dt.getFullYear()}${pad2(dt.getMonth()+1)}${pad2(dt.getDate())}T${pad2(dt.getHours())}${pad2(dt.getMinutes())}00`;
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `SUMMARY:${booking.serviceName} — ${cfg.businessName}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `DESCRIPTION:Booking with ${cfg.businessName} for ${booking.name}.`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  }

  function downloadIcs(booking, cfg) {
    const blob = new Blob([buildIcs(booking, cfg)], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cfg.businessName.replace(/\s+/g, '-').toLowerCase()}-booking.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ------------------------------------------------------------------ *
   * 5. WIDGET
   * ------------------------------------------------------------------ */
  function Widget(root, userConfig) {
    const cfg = Object.assign({}, DEFAULT_CONFIG, userConfig);
    cfg.workingHours = Object.assign({}, DEFAULT_CONFIG.workingHours, userConfig && userConfig.workingHours);
    Store.init(cfg.storageKey);

    const state = {
      step: 1, // 1 service, 2 date/time, 3 details, 4 confirmation
      service: null,
      viewMonth: (() => { const d = new Date(); d.setDate(1); return d; })(),
      selectedDate: null, // Date object
      selectedSlot: null, // { label, value }
      customer: { name: '', email: '', phone: '', notes: '' },
      lastBooking: null,
    };

    root.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'kb-widget';
    root.appendChild(el);

    render();

    /* ---------------- render dispatcher ---------------- */
    function render() {
      el.innerHTML = `
        ${renderHeader()}
        ${renderSteps()}
        <div class="kb-body">${renderStepBody()}</div>
        ${renderFooter()}
      `;
      bindEvents();
    }

    function renderHeader() {
      return `
        <div class="kb-header">
          <div class="kb-brand">
            <span class="kb-brand-mark">&lt;/&gt;</span>
          </div>
          <h2 class="kb-title">${escapeHtml(cfg.businessName)}</h2>
          <p class="kb-subtitle">${escapeHtml(cfg.tagline)}</p>
        </div>
      `;
    }

    function renderSteps() {
      const labels = ['choose_service', 'pick_time', 'your_details', 'confirmed'];
      return `
        <div class="kb-steps">
          ${labels.map((label, i) => {
            const n = i + 1;
            const cls = n === state.step ? 'is-active' : (n < state.step ? 'is-done' : '');
            return `<span class="kb-step ${cls}"><span class="kb-step-num">0${n}</span> // ${label}</span>${n < 4 ? '<span class="kb-step-sep">/</span>' : ''}`;
          }).join('')}
        </div>
      `;
    }

    function renderStepBody() {
      if (state.step === 1) return renderServiceStep();
      if (state.step === 2) return renderDateTimeStep();
      if (state.step === 3) return renderDetailsStep();
      return renderConfirmStep();
    }

    /* ---------------- step 1: service ---------------- */
    function renderServiceStep() {
      return `
        <p class="kb-panel-label">Select a service</p>
        <div class="kb-service-list">
          ${cfg.services.map((s) => `
            <button type="button" class="kb-service ${state.service && state.service.id === s.id ? 'is-selected' : ''}" data-service="${s.id}">
              <span>
                <p class="kb-service-name">${escapeHtml(s.name)}</p>
                <span class="kb-service-meta">${s.duration} min</span>
              </span>
              <span class="kb-service-price">${s.price > 0 ? cfg.currency + s.price : 'Free'}</span>
            </button>
          `).join('')}
        </div>
      `;
    }

    /* ---------------- step 2: date + time ---------------- */
    function renderDateTimeStep() {
      const vm = state.viewMonth;
      const year = vm.getFullYear();
      const month = vm.getMonth();
      const firstDow = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const today = new Date(); today.setHours(0,0,0,0);
      const maxDate = new Date(today.getTime() + cfg.maxAdvanceDays * 86400000);

      let cells = '';
      for (let i = 0; i < firstDow; i++) cells += `<div class="kb-day is-empty"></div>`;
      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(year, month, day);
        const disabled = d < today || d > maxDate || !cfg.workingHours[d.getDay()];
        const isSelected = state.selectedDate && toDateStr(state.selectedDate) === toDateStr(d);
        const isToday = toDateStr(d) === toDateStr(today);
        cells += `<button type="button" class="kb-day ${disabled ? 'is-disabled' : ''} ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}"
          ${disabled ? 'disabled' : `data-date="${toDateStr(d)}"`}>${day}</button>`;
      }

      const canGoPrev = !(year === today.getFullYear() && month === today.getMonth());

      let slotsHtml = '';
      if (state.selectedDate) {
        cfg._selectedDuration = state.service ? state.service.duration : cfg.slotIntervalMinutes;
        const slots = buildSlotsForDate(state.selectedDate, cfg).filter(
          (sl) => !Store.isSlotTaken(toDateStr(state.selectedDate), sl.value)
        );
        if (slots.length === 0) {
          slotsHtml = `<p class="kb-empty-note">// no times available this day — try another date</p>`;
        } else {
          slotsHtml = `<div class="kb-slots">${slots.map((sl) => `
            <button type="button" class="kb-slot ${state.selectedSlot && state.selectedSlot.value === sl.value ? 'is-selected' : ''}" data-slot="${sl.value}" data-label="${sl.label}">${sl.label}</button>
          `).join('')}</div>`;
        }
      }

      return `
        <p class="kb-panel-label">Pick a date &amp; time</p>
        <div class="kb-date-row">
          <button type="button" class="kb-nav-btn" data-nav="prev" ${!canGoPrev ? 'disabled' : ''} aria-label="Previous month">&larr;</button>
          <span class="kb-month-label">${MONTHS[month]} ${year}</span>
          <button type="button" class="kb-nav-btn" data-nav="next" aria-label="Next month">&rarr;</button>
        </div>
        <div class="kb-calendar">
          ${DOW.map((d) => `<div class="kb-dow">${d}</div>`).join('')}
          ${cells}
        </div>
        ${slotsHtml}
      `;
    }

    /* ---------------- step 3: details ---------------- */
    function renderDetailsStep() {
      return `
        <p class="kb-panel-label">Your details</p>
        ${renderMiniSummary()}
        <div class="kb-field" data-field="name">
          <label for="kb-name">Full name</label>
          <input id="kb-name" type="text" placeholder="Jane Doe" value="${escapeHtml(state.customer.name)}" />
          <p class="kb-field-error">Please enter your name.</p>
        </div>
        <div class="kb-field" data-field="email">
          <label for="kb-email">Email</label>
          <input id="kb-email" type="email" placeholder="jane@example.com" value="${escapeHtml(state.customer.email)}" />
          <p class="kb-field-error">Please enter a valid email.</p>
        </div>
        <div class="kb-field" data-field="phone">
          <label for="kb-phone">Phone (optional)</label>
          <input id="kb-phone" type="tel" placeholder="+27 00 000 0000" value="${escapeHtml(state.customer.phone)}" />
        </div>
        <div class="kb-field" data-field="notes">
          <label for="kb-notes">Notes (optional)</label>
          <textarea id="kb-notes" placeholder="Anything we should know beforehand?">${escapeHtml(state.customer.notes)}</textarea>
        </div>
      `;
    }

    function renderMiniSummary() {
      const d = state.selectedDate;
      const dateLabel = d ? `${DOW[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}` : '';
      return `
        <div class="kb-summary">
          <div class="kb-summary-row"><span>service</span><span>${escapeHtml(state.service.name)}</span></div>
          <div class="kb-summary-row"><span>date</span><span>${dateLabel}</span></div>
          <div class="kb-summary-row"><span>time</span><span>${state.selectedSlot.label}</span></div>
        </div>
      `;
    }

    /* ---------------- step 4: confirmation ---------------- */
    function renderConfirmStep() {
      const b = state.lastBooking;
      if (!b) return '';
      const d = new Date(b.date + 'T00:00:00');
      const dateLabel = `${DOW[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
      return `
        <div class="kb-confirm">
          <div class="kb-confirm-icon">&#10003;</div>
          <h3>You're booked in</h3>
          <p>A confirmation was sent to ${escapeHtml(b.email)}.</p>
          <div class="kb-summary">
            <div class="kb-summary-row"><span>service</span><span>${escapeHtml(b.serviceName)}</span></div>
            <div class="kb-summary-row"><span>date</span><span>${dateLabel}</span></div>
            <div class="kb-summary-row"><span>time</span><span>${b.timeLabel}</span></div>
            <div class="kb-summary-row"><span>name</span><span>${escapeHtml(b.name)}</span></div>
            <div class="kb-summary-row"><span>ref</span><span>${b.ref}</span></div>
          </div>
        </div>
      `;
    }

    /* ---------------- footer / nav buttons ---------------- */
    function renderFooter() {
      if (state.step === 1) {
        return `
          <div class="kb-footer">
            <button type="button" class="kb-btn kb-btn-primary" data-action="next" ${!state.service ? 'disabled' : ''}>Continue</button>
          </div>
        `;
      }
      if (state.step === 2) {
        return `
          <div class="kb-footer">
            <button type="button" class="kb-btn kb-btn-ghost" data-action="back">Back</button>
            <button type="button" class="kb-btn kb-btn-primary" data-action="next" ${!state.selectedSlot ? 'disabled' : ''}>Continue</button>
          </div>
        `;
      }
      if (state.step === 3) {
        return `
          <div class="kb-footer">
            <button type="button" class="kb-btn kb-btn-ghost" data-action="back">Back</button>
            <button type="button" class="kb-btn kb-btn-primary" data-action="confirm">Confirm booking</button>
          </div>
        `;
      }
      return `
        <div class="kb-footer">
          <button type="button" class="kb-btn kb-btn-ghost" data-action="ics">Add to calendar</button>
          <button type="button" class="kb-btn kb-btn-primary" data-action="restart">Book another</button>
        </div>
      `;
    }

    /* ---------------- events ---------------- */
    function bindEvents() {
      el.querySelectorAll('[data-service]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.service = cfg.services.find((s) => s.id === btn.dataset.service);
          state.selectedSlot = null; // duration may have changed
          render();
        });
      });

      el.querySelectorAll('[data-nav]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const delta = btn.dataset.nav === 'next' ? 1 : -1;
          state.viewMonth = new Date(state.viewMonth.getFullYear(), state.viewMonth.getMonth() + delta, 1);
          render();
        });
      });

      el.querySelectorAll('[data-date]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const [y, m, d] = btn.dataset.date.split('-').map(Number);
          state.selectedDate = new Date(y, m - 1, d);
          state.selectedSlot = null;
          render();
        });
      });

      el.querySelectorAll('[data-slot]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.selectedSlot = { value: btn.dataset.slot, label: btn.dataset.label };
          render();
        });
      });

      const backBtn = el.querySelector('[data-action="back"]');
      if (backBtn) backBtn.addEventListener('click', () => { state.step -= 1; render(); });

      const nextBtn = el.querySelector('[data-action="next"]');
      if (nextBtn) nextBtn.addEventListener('click', () => { state.step += 1; render(); });

      const confirmBtn = el.querySelector('[data-action="confirm"]');
      if (confirmBtn) confirmBtn.addEventListener('click', onConfirm);

      const restartBtn = el.querySelector('[data-action="restart"]');
      if (restartBtn) restartBtn.addEventListener('click', () => {
        state.step = 1; state.service = null; state.selectedDate = null;
        state.selectedSlot = null; state.customer = { name: '', email: '', phone: '', notes: '' };
        state.lastBooking = null; render();
      });

      const icsBtn = el.querySelector('[data-action="ics"]');
      if (icsBtn) icsBtn.addEventListener('click', () => downloadIcs(state.lastBooking, cfg));

      // keep customer fields in state as the user types
      ['name', 'email', 'phone', 'notes'].forEach((field) => {
        const input = el.querySelector(`#kb-${field}`);
        if (input) input.addEventListener('input', () => { state.customer[field] = input.value; });
      });
    }

    function onConfirm() {
      const { name, email } = state.customer;
      let valid = true;

      const nameField = el.querySelector('[data-field="name"]');
      const emailField = el.querySelector('[data-field="email"]');
      nameField.classList.toggle('has-error', !name.trim());
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
      emailField.classList.toggle('has-error', !emailOk);
      if (!name.trim() || !emailOk) valid = false;
      if (!valid) return;

      // Re-check the slot hasn't been taken since it was selected
      const dateStr = toDateStr(state.selectedDate);
      if (Store.isSlotTaken(dateStr, state.selectedSlot.value)) {
        alert('Sorry, that slot was just booked by someone else. Please pick another time.');
        state.selectedSlot = null;
        state.step = 2;
        render();
        return;
      }

      const booking = {
        ref: 'KB-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
        serviceId: state.service.id,
        serviceName: state.service.name,
        duration: state.service.duration,
        price: state.service.price,
        date: dateStr,
        time: state.selectedSlot.value,
        timeLabel: state.selectedSlot.label,
        name: state.customer.name.trim(),
        email: state.customer.email.trim(),
        phone: state.customer.phone.trim(),
        notes: state.customer.notes.trim(),
        createdAt: new Date().toISOString(),
      };

      Store.add(booking);
      state.lastBooking = booking;
      state.step = 4;
      render();

      if (typeof cfg.onBooked === 'function') {
        try { cfg.onBooked(booking); } catch (e) { console.error('onBooked handler error:', e); }
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * 6. PUBLIC API
   * ------------------------------------------------------------------ */
  const KodeBooking = {
    init(selector, userConfig) {
      const root = typeof selector === 'string' ? document.querySelector(selector) : selector;
      if (!root) {
        console.error('KodeBooking.init: could not find element for', selector);
        return null;
      }
      return new Widget(root, userConfig || {});
    },
    /** Read all bookings currently stored (for a simple admin view). */
    getBookings(storageKey) {
      Store.init(storageKey || DEFAULT_CONFIG.storageKey);
      return Store.getAll();
    },
  };

  window.KodeBooking = KodeBooking;
})(window);