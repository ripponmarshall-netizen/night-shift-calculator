/* helpers.jsx — date utils, JM holidays (with Easter calc), aggregate, storage */
/* Pure JS, no JSX — kept Node-loadable so calc.test.js can require() it. */

const SHIFT_HOURS = { am7: 8, pm3: 7, pm10_start: 2, pm10_next: 7 };
const PM10_TOTAL = SHIFT_HOURS.pm10_start + SHIFT_HOURS.pm10_next; // 9h, crosses midnight
/* Standard hours for a shift key (pm10 is the total across midnight). */
function stdHours(key) { return key === "pm10" ? PM10_TOTAL : SHIFT_HOURS[key]; }
/* Effective hours actually worked for a shift. An entry may carry an optional
   sparse override: hours: { am7?, pm3?, pm10? } (string or number). Absent,
   blank, or invalid => the standard hours, so old entries stay backward
   compatible. pm10 override is the TOTAL across midnight (default 9). One
   shift can't run past a day, so anything over 24h (a typo like "77" for
   7.7, or a hand-edited backup) counts as 24. */
const MAX_SHIFT_HOURS = 24;
function effHours(e, key) {
  const v = e && e.hours && e.hours[key];
  return (v == null || v === "" || !(Number(v) >= 0)) ? stdHours(key) : Math.min(MAX_SHIFT_HOURS, Number(v));
}
/* Per-shift duty marks. An entry may carry a sparse map
   duty: { am7?, pm3?, pm10? } naming one of these keys; absent => a regular
   shift. Each mark has a `pay` rule:
   - "full": worked and paid as normal, only recorded (orderly duty, and
     exchange for: covering someone else's shift in a swap).
   - "hours": leave. The shift's hours count as ordinary hours (total and
     overtime, never holiday ×2) but earn no SP1, SP2, meal or taxi.
   - "none": exchange leave. Someone else covers the shift, so it has no
     hours and no allowances at all; the day counts as not worked. */
const LEAVE_TYPES = {
  vacation: { label: "Vacation leave", short: "Vacation", code: "VL", pay: "hours" },
  departmental: { label: "Departmental leave", short: "Departmental", code: "DL", pay: "hours" },
  sick: { label: "Sick leave", short: "Sick", code: "SL", pay: "hours" },
  timeoff: { label: "Time off", short: "Time off", code: "TO", pay: "hours" },
};
const DUTY_TYPES = {
  orderly: { label: "Orderly duty", short: "Orderly", code: "ORD", pay: "full" },
  exchangeFor: { label: "Exchange for", short: "Exchange for", code: "EXF", pay: "full" },
  ...LEAVE_TYPES,
  exchangeLeave: { label: "Exchange leave", short: "Exchange leave", code: "EXL", pay: "none" },
};
const DUTY_KEYS = Object.keys(DUTY_TYPES);
const LEAVE_KEYS = Object.keys(LEAVE_TYPES);
/* The duty mark on one shift, or null for a regular shift (also for a shift
   that isn't on, or an unknown value from an imported file). */
function shiftDuty(e, key) {
  const v = e && e[key] && e.duty && e.duty[key];
  return v && Object.prototype.hasOwnProperty.call(DUTY_TYPES, v) ? v : null;
}
const isLeave = (v) => !!v && Object.prototype.hasOwnProperty.call(LEAVE_TYPES, v);
/* Exchange leave: the shift was given away, so nothing about it is paid. */
const isGivenAway = (v) => !!v && DUTY_TYPES[v]?.pay === "none";
/* A shift that is ticked and actually worked (not given away). */
const worksShift = (e, key) => !!(e && e[key]) && !isGivenAway(shiftDuty(e, key));
/* Any shift ticked on a day (a day can carry only a holiday override). */
const hasShifts = (e) => !!e && !!(e.am7 || e.pm3 || e.pm10);

/* The three shifts in time order, with the label and colour every screen
   uses for them. */
const SHIFTS = [
  { k: "am7", label: "7AM", color: "var(--am)" },
  { k: "pm3", label: "3PM", color: "var(--sp1)" },
  { k: "pm10", label: "10PM", color: "var(--sp2)" },
];
const SHIFT_LABEL = { am7: "7AM", pm3: "3PM", pm10: "10PM" };

const DEFAULT_RATES = {
  sp1: 66.6,        // 4 hrs × $16.65/hr per 3PM shift
  sp2: 200,         // 8 hrs × $25/hr per 10PM shift
  meal: 950,
  taxiShort: 950,
  taxiLong: 2000,
  threshold: 173.33,
};
const STORAGE = "nsc:v3";
// Shown in the footer on every screen. Bump with each release (see README).
const APP_VERSION = "3.24";
// One credit line and contact address, shared by every footer and About.
const APP_CREDIT = "Workflow Coaching and Optimisation · Portland Division";
const CONTACT_EMAIL = "ripponmarshall@yahoo.com";
// The Jamaica Fire Brigade logo, beside index.html. It shows in the footer
// and on About only once the file is there (see JfbLogo in components.jsx).
const JFB_LOGO = "jfb-logo.png";
const MIGRATION = "nsc-rates-2026-05b";

/* JM tax defaults — TAJ 2025/26 (threshold effective 1 April 2026). */
const DEFAULT_TAX = {
  enabled: true,
  nis: 3,                       // %
  nisCapMonthly: 5000000 / 12,  // $5,000,000 annual cap
  nht: 2,                       // %
  eduTax: 2.25,                 // % of (gross - NIS - pension)
  payeThreshold: 1902360 / 12,  // $1,902,360 annual tax-free threshold
  payeRate1: 25,                // % above threshold up to break point
  payeBreak2: 6000000 / 12,     // $6,000,000 annual break point
  payeRate2: 30,                // % above break point
  pension: 0,                   // % of gross (user editable, often 0–10%)
};

/* ----- date ----- */
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromYmd = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
/* Parse an effective-from date (a "YYYY-MM-DD" from <input type="date">) as a
   LOCAL midnight, matching how period.start is built. Using new Date(string) on
   a date-only ISO string would parse it as UTC midnight and shift the day. */
const effDate = (s) => fromYmd(String(s).slice(0, 10));
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const monthName = (m) => ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m];
const monthNameLong = (m) => ["January","February","March","April","May","June","July","August","September","October","November","December"][m];

/* Pay period: 16th → 15th */
function periodFor(date) {
  const d = new Date(date);
  if (d.getDate() >= 16) return { start: new Date(d.getFullYear(), d.getMonth(), 16), end: new Date(d.getFullYear(), d.getMonth() + 1, 15) };
  return { start: new Date(d.getFullYear(), d.getMonth() - 1, 16), end: new Date(d.getFullYear(), d.getMonth(), 15) };
}
function shiftPeriod(period, delta) {
  const ref = new Date(period.start.getFullYear(), period.start.getMonth() + delta, 16);
  return periodFor(ref);
}
function periodLabel(period) {
  return `${monthName(period.start.getMonth())} ${period.start.getDate()} – ${monthName(period.end.getMonth())} ${period.end.getDate()}, ${period.end.getFullYear()}`;
}
function periodKey(period) { return ymd(period.start); }
function periodDays(period) {
  const out = [];
  for (let d = new Date(period.start); d <= period.end; d = addDays(d, 1)) out.push(new Date(d));
  return out;
}

/* ----- Easter (Anonymous Gregorian) ----- */
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const _holidayCache = {};
function jamaicaHolidays(year) {
  if (_holidayCache[year]) return _holidayCache[year];
  const easter = easterSunday(year);
  const goodFri = addDays(easter, -2);
  const easterMon = addDays(easter, 1);
  const ashWed = addDays(easter, -46);
  // Heroes Day: 3rd Monday of October
  const octFirst = new Date(year, 9, 1);
  const offset = (1 - octFirst.getDay() + 7) % 7;
  const heroesDay = new Date(year, 9, 1 + offset + 14);

  // Weekend dates move to the weekday that's kept as the public holiday
  // (Holidays (Public General) Act; the Ministry of Labour applies it each
  // year): New Year's, Emancipation, Independence and Christmas Day move
  // from a Sunday to the Monday; Labour Day from a Saturday or a Sunday to
  // the Monday. Christmas on a Sunday makes Monday the 26th and Tuesday the
  // 27th the holidays; Boxing Day on a Sunday moves to Monday the 27th.
  // Saturdays otherwise stay put.
  const observed = (m, d, name, saturdayToo) => {
    const date = new Date(year, m, d);
    const dow = date.getDay();
    const shift = dow === 0 ? 1 : saturdayToo && dow === 6 ? 2 : 0;
    return { date: addDays(date, shift), name: shift ? `${name} (observed)` : name };
  };
  const xmasSunday = new Date(year, 11, 25).getDay() === 0;
  const list = [
    observed(0, 1, "New Year's Day"),
    { date: ashWed, name: "Ash Wednesday" },
    { date: goodFri, name: "Good Friday" },
    { date: easterMon, name: "Easter Monday" },
    observed(4, 23, "Labour Day", true),
    observed(7, 1, "Emancipation Day"),
    observed(7, 6, "Independence Day"),
    { date: heroesDay, name: "National Heroes Day" },
    observed(11, 25, "Christmas Day"),
    xmasSunday
      ? { date: new Date(year, 11, 27), name: "Boxing Day (observed)" }
      : observed(11, 26, "Boxing Day"),
  ];
  const map = {};
  for (const h of list) map[ymd(h.date)] = h.name;
  _holidayCache[year] = { list, map };
  return _holidayCache[year];
}
function holidayName(d) { return jamaicaHolidays(d.getFullYear()).map[ymd(d)] || null; }
function isJamaicaHoliday(d) { return !!holidayName(d); }
function holidaysInPeriod(period) {
  const years = new Set([period.start.getFullYear(), period.end.getFullYear()]);
  const out = [];
  for (const y of years) {
    for (const h of jamaicaHolidays(y).list) {
      if (h.date >= period.start && h.date <= period.end) out.push(h);
    }
  }
  return out.sort((a, b) => a.date - b.date);
}

/* ----- format ----- */
// Negative amounts read "−$500.00" (not "$-500.00"), e.g. pay-slip variances.
const fmt = (n) => {
  const v = Number(n) || 0;
  const s = "$" + Math.abs(v).toLocaleString("en-JM", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 && s !== "$0.00" ? "−" + s : s;
};
/* Short money for chart labels: $950, $1.5k, $541.0k, $2.61M. A year's
   earnings run past a million, so they read $2.1M rather than $2,100.0k
   (anything that would round to 1,000.0k counts as a million). */
const fmtShort = (n) => {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  const s = a >= 999950
    ? "$" + (a / 1e6).toLocaleString("en-JM", { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + "M"
    : a >= 999.5
    ? "$" + (a / 1000).toLocaleString("en-JM", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "k"
    : "$" + a.toLocaleString("en-JM", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return v < 0 && s !== "$0" ? "−" + s : s;
};
const fmtH = (n) => (Number(n) || 0).toLocaleString("en-JM", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/* Hours without trailing zeros: 183, 7.5, 183.33. */
const fmtH0 = (n) => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-JM", { maximumFractionDigits: 2 });
/* Hours as whole hours and minutes: 16h 40m, 9h, 45m, 0m. The space is a
   no-break space, so a value never splits across two lines. */
function fmtHM(n) {
  const m = Math.max(0, Math.round((Number(n) || 0) * 60));
  const h = Math.floor(m / 60), r = m % 60;
  if (!h) return `${r}m`;
  return h.toLocaleString("en-JM") + "h" + (r ? `\u00a0${r}m` : "");
}
/* The same, compact for a calendar cell: 13h40, 9h, 45m. */
function fmtHMc(n) {
  const t = fmtHM(n);
  return t.includes("h") ? t.replace(/\u00a0(\d+)m$/, "$1") : t;
}
/* Overtime can be counted in hours (decimal, the default) or to the minute.
   The choice travels with the rates handed to aggregate() as otUnit, so a
   result (and a saved one) always shows hours the way it worked them out. */
const OT_UNITS = ["hours", "minutes"];
const inMinutes = (rates) => rates?.otUnit === "minutes";
/* A duration in the unit its result was counted in: "16h 40m" or "16.67h". */
const fmtDur = (n, rates) => (inMinutes(rates) ? fmtHM(n) : `${fmtH0(n)}h`);

/* ----- shareable plain-text summary -----
   One source of truth for the "Copy summary" text (used by the live view and
   snapshot detail). Right-aligns values to a fixed column so it reads as a tidy
   breakdown when pasted. `net` is optional (estimated net after tax). */
function summaryText(totals, periodStr, net) {
  const W = 38;
  // Right-aligns `value` to column W, with optional left indent on the label.
  const row = (label, value, indent = 0) => {
    const l = " ".repeat(indent) + label;
    const v = String(value);
    return l + " ".repeat(Math.max(1, W - l.length - v.length)) + v;
  };
  const rule = (ch) => ch.repeat(W);
  const now = new Date();
  const generated = `${monthName(now.getMonth())} ${now.getDate()}, ${now.getFullYear()}`;
  const hrs = (n) => (inMinutes(totals.rates) ? fmtHM(n) : `${fmtH(n)}h`);
  // One section: a header, its line items, a thin divider, then its subtotal.
  const section = (title, items, subtotal) => [
    title,
    ...items.map(([label, value]) => row(label, value, 2)),
    "  " + rule("─").slice(2),
    row("Subtotal", subtotal, 2),
  ];

  const lines = [
    rule("═"),
    "   NIGHT SHIFT — PAY STATEMENT",
    `   Period: ${periodStr}`,
    `   Generated: ${generated}`,
    rule("═"),
    "",
    ...section("ALLOWANCES", [
      ["SP1 · 3PM", fmt(totals.sp1)],
      ["SP2 · 10PM", fmt(totals.sp2)],
      ["Meal", fmt(totals.meal)],
      ["Taxi", fmt(totals.taxi)],
    ], fmt(totals.allowanceSubtotal)),
    "",
    ...section("BASE PAY", [
      ["Monthly Basic", fmt(totals.monthlyBasic)],
      ["Compulsory", fmt(totals.compulsory)],
    ], fmt(totals.baseSubtotal)),
    "",
    ...section("EXTRA HOURS", [
      [`Holiday ×2 · ${hrs(totals.holidayHours)}`, fmt(totals.holidayPay)],
      [`Overtime ×1.5 · ${hrs(totals.otHours)}`, fmt(totals.overtimePay)],
    ], fmt(totals.extraSubtotal)),
  ];
  // Extra shifts (outside the rotation) are a record of time, not a pay
  // line: their hours are already in the total that overtime comes from.
  const nExtra = Number(totals.extraShifts) || 0;
  if (nExtra > 0) {
    lines.push(row(`Extra shifts ×${nExtra}`, fmtHM(totals.extraHours), 2), "    (already in total hours)");
  }
  lines.push("");
  // Leave, orderly duty and exchanges: a record of the shifts, no money of
  // their own (their effect is already in the lines above).
  const dutyItems = DUTY_KEYS
    .filter((k) => Number(totals.duties?.[k]) > 0)
    .map((k) => {
      const n = Number(totals.duties[k]);
      return [DUTY_TYPES[k].label, `${n} shift${n === 1 ? "" : "s"}`];
    });
  if (dutyItems.length) {
    lines.push("LEAVE & DUTIES", ...dutyItems.map(([label, value]) => row(label, value, 2)));
    const notes = [];
    if (Number(totals.leaveShifts) > 0) notes.push(row("Leave hours (no allowances)", hrs(totals.leaveHours), 2));
    if (Number(totals.exchangedShifts) > 0) notes.push(row("Exchanged away (not paid)", hrs(totals.exchangedHours), 2));
    if (notes.length) lines.push("  " + rule("─").slice(2), ...notes);
    lines.push("");
  }
  lines.push(rule("═"), row("GROSS TOTAL", fmt(totals.grand), 2));
  if (net != null && Number.isFinite(net) && Math.round(net) !== Math.round(totals.grand)) {
    lines.push(row("Estimated Net", fmt(net), 2));
  }
  lines.push(rule("═"), "— Night Shift Calculator · Estimate only");
  return lines.join("\n");
}

/* ----- entries ----- */
// optional hours: { am7?, pm3?, pm10? } — actual hours worked (string/number).
// Absent/blank/invalid => SHIFT_HOURS default. pm10 = TOTAL across midnight (9).
function blankDay() { return { am7: false, pm3: false, pm10: false, holiday: null, dist: { am7: "S", pm3: "S", pm10: "S" } }; }

/* Day entries from a backup file, in the shape every screen reads: date
   keys only, a day object with true/false shifts, a holiday of null / true /
   false, a distance per shift, and hours and duty maps kept only when they
   hold something. Anything else is dropped rather than left to break the
   calendar or the math. */
function sanitizeEntries(m) {
  const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  const out = {};
  if (!isObj(m)) return out;
  for (const [k, e] of Object.entries(m)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !isObj(e)) continue;
    const d = blankDay();
    for (const s of ["am7", "pm3", "pm10"]) {
      d[s] = !!e[s];
      if (e.dist?.[s] === "L") d.dist[s] = "L";
    }
    if (typeof e.holiday === "boolean") d.holiday = e.holiday;
    const sub = (o, ok) => {
      const r = {};
      if (isObj(o)) for (const s of ["am7", "pm3", "pm10"]) if (ok(o[s])) r[s] = o[s];
      return Object.keys(r).length ? r : undefined;
    };
    const hours = sub(e.hours, (v) => (typeof v === "string" || typeof v === "number") && String(v) !== "" && Number(v) >= 0);
    const duty = sub(e.duty, (v) => typeof v === "string" && Object.prototype.hasOwnProperty.call(DUTY_TYPES, v));
    if (hours) d.hours = hours;
    if (duty) d.duty = duty;
    if (hasShifts(d) || d.holiday != null) out[k] = d;
  }
  return out;
}

/* Remove only the entries displayed in a pay period. Entries are stored in one
   date-keyed map across periods, so replacing the whole map would destroy
   shifts logged for earlier or later periods. */
function clearPeriodEntries(entries, period) {
  const out = { ...entries };
  for (const d of periodDays(period)) delete out[ymd(d)];
  return out;
}

/* ----- autofill rotation -----
   Standard rotation is a 4-day cycle: 7AM → 3PM → 10PM → rest. The 10PM shift
   ends at 07:00 the next morning, so the day after a 10PM is always a rest
   day; the next 7AM begins on the day after that. */
function autofillPattern(period, opts) {
  // opts: { startKey, pattern: "rotation"|"am7"|"pm3"|"pm10", days: "rest"|7|14, defaultDist, phase? }
  // phase (0–3, default 0) is where in the rotation the start day falls:
  // 0 = 7AM, 1 = 3PM, 2 = 10PM, 3 = rest. Omitted => today's behaviour.
  const days = periodDays(period);
  const startIdx = Math.max(0, days.findIndex((d) => ymd(d) === opts.startKey));
  const count = opts.days === "rest" ? days.length - startIdx : Math.min(opts.days, days.length - startIdx);
  const rotation = ["am7", "pm3", "pm10", null]; // null = rest
  const phase = ((Math.trunc(Number(opts.phase) || 0) % 4) + 4) % 4;
  const out = {};
  for (let i = 0; i < count; i++) {
    const slot = opts.pattern === "rotation" ? rotation[(i + phase) % 4] : opts.pattern;
    if (!slot) continue; // rest day in the rotation
    const d = days[startIdx + i];
    const e = blankDay();
    e.dist = { am7: opts.defaultDist, pm3: opts.defaultDist, pm10: opts.defaultDist };
    e[slot] = true;
    out[ymd(d)] = e;
  }
  return out;
}

/* ----- simple (Home) setup -----
   The Home wizard never computes pay itself: it turns plain answers into
   ordinary calendar entries, and aggregate() does the math exactly as it does
   for the calendar. Two input methods:
   - rotation: the standard 7AM → 3PM → 10PM → rest cycle, anchored on any day
     the person works a 7AM. The cycle runs both ways from that day, so the
     whole period is filled, including the days before it. Real dates, so
     public holidays apply as usual.
   - totals: shift counts only. Shifts are spread across the period's regular
     (non-holiday) days in rotation order. With no real dates, holiday pay
     can't be known, so none is guessed. */

const dayOffset = (from, to) => Math.round((to - from) / 86400000);

/* Rotation entries for the whole period, given one day the person works a
   7AM: a "YYYY-MM-DD" key (any date, inside the period or not) or a day
   offset from the period start. Day 0 sits at rotation index (-offset) mod 4. */
function rotationEntries(period, am7Anchor, dist) {
  const off = typeof am7Anchor === "string"
    ? dayOffset(period.start, fromYmd(am7Anchor))
    : Math.trunc(Number(am7Anchor) || 0);
  return autofillPattern(period, {
    startKey: ymd(period.start), pattern: "rotation", days: "rest",
    defaultDist: dist || "S", phase: ((-off % 4) + 4) % 4,
  });
}

/* ----- saved rotation -----
   The person's rotation is stored as one anchor: any "YYYY-MM-DD" they work a
   7AM. The 4-day cycle runs unbroken across pay periods, so the same anchor
   gives the slot for any date. Display only; pay is never derived from it. */
const ROTATION_SLOTS = ["am7", "pm3", "pm10", "off"];

/* The rotation slot for a date key: "am7" | "pm3" | "pm10" | "off", or null
   when no rotation is saved. */
function rotationSlot(key, anchor) {
  if (!anchor) return null;
  const i = dayOffset(fromYmd(anchor), fromYmd(key));
  return ROTATION_SLOTS[((i % 4) + 4) % 4];
}

/* Shifts on a day that the rotation doesn't call for (an off day's shift,
   or a second shift on a working day). A shift given away on exchange leave
   isn't worked, so it's never extra. Empty when no rotation is saved. */
function extraShiftKeys(entry, slot) {
  if (!slot || !entry) return [];
  return ["am7", "pm3", "pm10"].filter((k) => k !== slot && worksShift(entry, k));
}

/* Per-period rotation facts for the UI: extra shift count and off days. */
function rotationStats(entries, period, anchor) {
  let extra = 0, off = 0;
  if (!anchor) return { extra, off };
  for (const d of periodDays(period)) {
    const k = ymd(d);
    const slot = rotationSlot(k, anchor);
    extra += extraShiftKeys(entries[k], slot).length;
    if (slot === "off") off++;
  }
  return { extra, off };
}

/* The first day in the period the rotation puts on a 7AM (for pickers). */
function am7InPeriod(period, anchor) {
  if (!anchor) return null;
  const d = periodDays(period).find((x) => rotationSlot(ymd(x), anchor) === "am7");
  return d ? ymd(d) : null;
}

/* Days the totals path may place shifts on: every day that isn't a public
   holiday, so no holiday pay is ever implied by the placement. */
function regularDays(period) {
  return periodDays(period).filter((d) => !isJamaicaHoliday(d));
}
/* The night before a public holiday: a 10PM there runs into the holiday
   and earns holiday hours, so the totals path keeps 10PMs off these days. */
const holidayEve = (d) => isJamaicaHoliday(addDays(d, 1));

/* Validate shift totals against the period. Returns an error string or null.
   `pairs` = days with both a 3PM and a 10PM (these get the taxi deduction). */
function totalsError(period, t) {
  const n = (v) => Math.max(0, Math.trunc(Number(v) || 0));
  const pm3 = n(t.pm3), pm10 = n(t.pm10), am7 = n(t.am7), pairs = n(t.pairs);
  const days = regularDays(period);
  const len = days.length;
  const nights = days.filter((d) => !holidayEve(d)).length;
  if (pairs > Math.min(pm3, pm10)) return "Back-to-back days can't exceed your 3PM or 10PM count.";
  if (am7 + pm3 + pm10 - pairs > len) return `That's more shift days than the ${len} working days in this period.`;
  if (pm10 > nights) return `That's more 10PM shifts than the ${nights} nights in this period that don't run into a public holiday.`;
  return null;
}

/* Place shift totals on the calendar: one shift (or one 3PM+10PM pair) per
   day, interleaved in rotation order and spaced evenly across the period's
   regular days. Returns {} when the totals are invalid (see totalsError). */
function totalsEntries(period, t, dist) {
  if (totalsError(period, t)) return {};
  const n = (v) => Math.max(0, Math.trunc(Number(v) || 0));
  const pairs = n(t.pairs);
  const left = { am7: n(t.am7), pm3: n(t.pm3) - pairs, pm10: n(t.pm10) - pairs, pair: pairs };
  const order = ["am7", "pm3", "pm10", "pair"];
  const seq = [];
  while (order.some((k) => left[k] > 0)) {
    for (const k of order) if (left[k] > 0) { seq.push(k); left[k]--; }
  }
  const days = regularDays(period);
  const slots = seq.map((kind, i) => ({ kind, d: days[Math.floor((i * days.length) / seq.length)] }));
  // A 10PM that lands the night before a holiday swaps with the nearest
  // 7AM or 3PM on an ordinary night, or else moves to the nearest free
  // ordinary night (totalsError makes sure there is one).
  const nightly = (k) => k === "pm10" || k === "pair";
  const near = (i) => (a, b) => Math.abs(a.i - i) - Math.abs(b.i - i);
  slots.forEach((s, i) => {
    if (!nightly(s.kind) || !holidayEve(s.d)) return;
    const swap = slots.map((o, j) => ({ o, i: j }))
      .filter(({ o }) => !nightly(o.kind) && !holidayEve(o.d)).sort(near(i))[0];
    if (swap) { [s.kind, swap.o.kind] = [swap.o.kind, s.kind]; return; }
    const used = new Set(slots.map((o) => ymd(o.d)));
    const free = days.map((d, j) => ({ d, i: j }))
      .filter(({ d }) => !used.has(ymd(d)) && !holidayEve(d)).sort(near(days.indexOf(s.d)))[0];
    if (free) s.d = free.d;
  });
  const out = {};
  const d0 = dist || "S";
  slots.forEach(({ kind, d }) => {
    const e = blankDay();
    e.dist = { am7: d0, pm3: d0, pm10: d0 };
    if (kind === "pair") { e.pm3 = true; e.pm10 = true; } else e[kind] = true;
    out[ymd(d)] = e;
  });
  return out;
}

/* Write generated days into the saved map. keep=true leaves days that
   already have shifts alone; otherwise each generated day replaces its date.
   Days the fill doesn't cover are never touched. With keep, a day holding
   only a holiday override is filled but keeps that override (it's the
   person's own choice; dropping it would silently change holiday pay). */
function fillDays(entries, fill, keep) {
  const out = { ...entries };
  for (const [k, v] of Object.entries(fill)) {
    const cur = out[k];
    if (keep && hasShifts(cur)) continue;
    out[k] = keep && cur && cur.holiday != null && v && v.holiday == null ? { ...v, holiday: cur.holiday } : v;
  }
  return out;
}

/* Merge generated entries into the saved map for one period. replace=true
   clears the period's days first (other periods are never touched);
   replace=false only fills days that have no shifts yet. */
function mergePeriodFill(entries, period, fill, replace) {
  return replace
    ? { ...clearPeriodEntries(entries, period), ...fill }
    : fillDays(entries, fill, true);
}

/* ----- aggregate (calculation engine) ----- */
/* anchor (optional): the saved rotation, so shifts outside it can be counted
   as extra shifts. rates.otUnit "minutes" counts every shift to the whole
   minute and overtime on whole minutes over the threshold. */
function aggregate(entries, period, mode, basicDistance, counts, basePay, rates, anchor) {
  let calPm3 = 0, calPm10 = 0, cal7am = 0, sameDayPair = 0;
  let shortPm3 = 0, longPm3 = 0, shortPm10 = 0, longPm10 = 0, shortAm7 = 0, longAm7 = 0;
  let totalHours = 0, holidayHours = 0;
  let sameDayPairLegSum = 0; // sum of actual leg rates for same-day 3PM+10PM pairs (advanced mode)
  // Shifts per duty mark, the hours on leave, and the shifts (and their
  // hours) given away on exchange leave, which are never counted.
  const duties = {};
  for (const k of DUTY_KEYS) duties[k] = 0;
  let leaveShifts = 0, leaveHours = 0, exchangedShifts = 0, exchangedHours = 0;
  // Shifts outside the rotation, and their hours, per shift and in all.
  const extraBy = { am7: { n: 0, h: 0 }, pm3: { n: 0, h: 0 }, pm10: { n: 0, h: 0 } };
  let extraShifts = 0, extraHours = 0;

  // Normalize rates so corrupted storage or imported data can never produce
  // negative pay or a divide-by-zero. threshold must stay > 0 (it divides).
  const nn = (v) => Math.max(0, Number(v) || 0);
  const R = {
    sp1: nn(rates.sp1),
    sp2: nn(rates.sp2),
    meal: nn(rates.meal),
    taxiShort: nn(rates.taxiShort),
    taxiLong: nn(rates.taxiLong),
    threshold: Number(rates.threshold) > 0 ? Number(rates.threshold) : DEFAULT_RATES.threshold,
  };
  // Counting in minutes: each shift's hours go to the nearest whole minute
  // (6.67h is 6h 40m), so the sums below are exact minutes.
  const byMin = inMinutes(rates);
  const toMin = (h) => Math.round(h * 60);
  const hrsOf = (e, k) => (byMin ? toMin(effHours(e, k)) / 60 : effHours(e, k));

  const days = periodDays(period);
  const dayHours = {}; // key -> hours for stripe viz
  const dayHolidayHours = {};

  for (const d of days) {
    const key = ymd(d);
    const e = entries[key];
    if (!e) continue;
    const isHol = e.holiday == null ? isJamaicaHoliday(d) : e.holiday;
    let h = 0, hHol = 0;

    // Only shifts actually worked count below; one given away on exchange
    // leave is as if it weren't on the calendar (no hours, no allowance).
    const work = { am7: worksShift(e, "am7"), pm3: worksShift(e, "pm3"), pm10: worksShift(e, "pm10") };

    // Holiday pay (×2) covers every hour worked on a public holiday, the
    // rotation's own shift included. A 10PM crosses midnight, so each part
    // goes by the day it lands on: the hours before midnight by this day,
    // the rest by the next day (a holiday too, or not).
    const nextDate = addDays(d, 1);
    const nextEntry = entries[ymd(nextDate)];
    const nextHol = nextEntry?.holiday == null ? isJamaicaHoliday(nextDate) : nextEntry.holiday;

    // Allowance credit (SP1/SP2/meal/taxi): a shift counts as a FULL shift only
    // when more than half its standard hours were worked. Half or less earns no
    // allowance, but the actual hours below still count toward totals/overtime.
    // A shift on leave earns no allowance either. Its hours count as ordinary
    // hours (total and overtime), never holiday hours, even on a holiday.
    const credit = {}, onLeave = {};
    for (const k of ["am7", "pm3", "pm10"]) {
      const duty = shiftDuty(e, k);
      onLeave[k] = isLeave(duty);
      if (duty) duties[duty]++;
      if (e[k] && onLeave[k]) { leaveShifts++; leaveHours += hrsOf(e, k); }
      if (e[k] && !work[k]) { exchangedShifts++; exchangedHours += hrsOf(e, k); }
      credit[k] = work[k] && !onLeave[k] && effHours(e, k) > stdHours(k) / 2;
    }

    if (work.am7) {
      if (credit.am7) cal7am++;
      const ha = hrsOf(e, "am7");
      h += ha;
      if (isHol && !onLeave.am7) hHol += ha;
      if (credit.am7) { if (e.dist?.am7 === "L") longAm7++; else shortAm7++; }
    }
    if (work.pm3) {
      if (credit.pm3) calPm3++;
      const hp3 = hrsOf(e, "pm3");
      h += hp3;
      if (isHol && !onLeave.pm3) hHol += hp3;
      if (credit.pm3) { if (e.dist?.pm3 === "L") longPm3++; else shortPm3++; }
    }
    if (work.pm10) {
      if (credit.pm10) calPm10++;
      // Single editable total; split the pre-midnight vs carryover legs
      // proportionally so the holiday rule scales (default 9 → 2h pre-midnight).
      const tot = hrsOf(e, "pm10");
      const ratio = PM10_TOTAL > 0 ? tot / PM10_TOTAL : 0;
      const startSeg = byMin ? toMin(SHIFT_HOURS.pm10_start * ratio) / 60 : SHIFT_HOURS.pm10_start * ratio;
      h += tot;
      // Both legs stay on this (start) day's total, holiday hours included.
      if (!onLeave.pm10) {
        if (isHol) hHol += startSeg;
        if (nextHol) hHol += tot - startSeg;
      }
      if (credit.pm10) { if (e.dist?.pm10 === "L") longPm10++; else shortPm10++; }
      if (credit.pm10 && credit.pm3) {
        sameDayPair++;
        const r3  = (e.dist?.pm3  === "L") ? R.taxiLong : R.taxiShort;
        const r10 = (e.dist?.pm10 === "L") ? R.taxiLong : R.taxiShort;
        sameDayPairLegSum += r3 + r10;
      }
    }

    for (const k of extraShiftKeys(e, rotationSlot(key, anchor))) {
      const hx = hrsOf(e, k);
      extraBy[k].n++; extraBy[k].h += hx;
      extraShifts++; extraHours += hx;
    }

    totalHours += h;
    holidayHours += hHol;
    dayHours[key] = h;
    dayHolidayHours[key] = hHol;
  }

  const usedPm3 = calPm3, usedPm10 = calPm10;

  const sp1 = usedPm3 * R.sp1;
  const sp2 = usedPm10 * R.sp2;
  const meal = (usedPm3 + usedPm10) * R.meal;

  let taxiGross = 0;
  let taxiDeduct = 0;
  if (mode === "basic") {
    const rate = basicDistance === "L" ? R.taxiLong : R.taxiShort;
    // Taxi covers 3PM (finishes 10PM) and 10PM (finishes 7AM next morning)
    // shifts only. 7AM shifts are daytime commutes — no taxi allowance.
    taxiGross = (usedPm3 + usedPm10) * rate;
    taxiDeduct = sameDayPair * 2 * rate;
  } else {
    taxiGross =
      (shortPm3 + shortPm10) * R.taxiShort +
      (longPm3 + longPm10) * R.taxiLong;
    // Detailed mode: deduct exactly the two paired legs at their own distances.
    taxiDeduct = sameDayPairLegSum;
  }
  const taxi = Math.max(0, taxiGross - taxiDeduct);

  const allowanceSubtotal = sp1 + sp2 + meal + taxi;

  const monthlyBasic = Math.max(0, Number(basePay.monthly) || 0);
  const compulsory = Math.max(0, Number(basePay.compulsory) || 0);
  const baseSubtotal = monthlyBasic + compulsory;

  const hourlyRate = monthlyBasic > 0 ? monthlyBasic / R.threshold : 0;
  const nonHolidayHours = Math.max(0, totalHours - holidayHours);
  // In minutes, the threshold is whole minutes too (173.33h is 173h 20m),
  // and the difference is taken in integer minutes so no float dust is paid.
  const otHours = byMin
    ? Math.max(0, toMin(nonHolidayHours) - toMin(R.threshold)) / 60
    : Math.max(0, nonHolidayHours - R.threshold);
  const holidayPay = holidayHours * hourlyRate * 2;
  const overtimePay = otHours * hourlyRate * 1.5;
  const extraSubtotal = holidayPay + overtimePay;

  const grand = allowanceSubtotal + baseSubtotal + extraSubtotal;

  // A count left blank (or missing, e.g. from an imported file) isn't a
  // cross-check, so it can never flag a mismatch.
  const given = (v) => v != null && v !== "";
  const c = counts || {};
  const mismatch = {
    pm3: given(c.pm3) && Number(c.pm3) !== calPm3,
    pm10: given(c.pm10) && Number(c.pm10) !== calPm10,
    am7: given(c.am7) && Number(c.am7) !== cal7am,
  };
  const hasMismatch = mismatch.pm3 || mismatch.pm10 || mismatch.am7;

  return {
    cal: { pm3: calPm3, pm10: calPm10, am7: cal7am, sameDayPair, shortPm3, longPm3, shortPm10, longPm10, shortAm7, longAm7 },
    dayHours, dayHolidayHours,
    sp1, sp2, meal, taxi, taxiGross, taxiDeduct,
    allowanceSubtotal,
    monthlyBasic, compulsory, baseSubtotal,
    totalHours, holidayHours, nonHolidayHours, otHours, hourlyRate,
    holidayPay, overtimePay, extraSubtotal,
    duties, leaveShifts, leaveHours, exchangedShifts, exchangedHours,
    extraShifts, extraHours, extraBy,
    grand,
    mismatch, hasMismatch,
    rates, mode, basicDistance,
  };
}

/* ----- crew (several people on the same shift) -----
   The crew shares one shift calendar (crew.entries). Each member keeps only
   the days that differ for them in member.days: a day entry (leave, a swap,
   an extra shift), or null for a crew day they didn't work. Their own pay
   and taxi distance go with them. Pay is the same aggregate() run on each
   member's merged calendar, with one Short/Long distance per person. */
function blankCrew() { return { entries: {}, members: [], rotationAnchor: null, sortBy: "name", watch: "", station: "" }; }
function newMember(name, empNo) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: String(name || "").trim(), empNo: String(empNo || "").trim(), rank: "",
    basePay: { monthly: "", compulsory: "" }, dist: "S", days: {},
  };
}

/* One member's calendar: the crew's days with theirs laid over them. */
function memberEntries(crewEntries, member) {
  const out = { ...(crewEntries || {}) };
  for (const [k, v] of Object.entries(member?.days || {})) {
    if (v) out[k] = v; else delete out[k];
  }
  return out;
}
function memberTotals(crewEntries, member, period, rates, anchor) {
  return aggregate(memberEntries(crewEntries, member), period, "basic", member?.dist === "L" ? "L" : "S", null, member?.basePay || {}, rates, anchor);
}

/* Two day entries that pay the same: the same shifts, duty marks, hours and
   holiday setting. Per-shift distance is ignored (crew pay is Short/Long). */
function sameEntry(a, b) {
  const hol = (e) => (e && e.holiday != null ? !!e.holiday : null);
  if (hol(a) !== hol(b)) return false;
  return ["am7", "pm3", "pm10"].every((k) => {
    if (!!a?.[k] !== !!b?.[k]) return false;
    return !a?.[k] || (shiftDuty(a, k) === shiftDuty(b, k) && effHours(a, k) === effHours(b, k));
  });
}

/* Set one day for a member. A day that matches the crew's drops the
   override; an emptied day the crew works is kept as null (not worked). */
function setMemberDay(crewEntries, member, key, entry) {
  const days = { ...(member.days || {}) };
  const crewDay = crewEntries?.[key];
  const empty = !hasShifts(entry) && (entry?.holiday == null);
  if (empty ? !crewDay : sameEntry(entry, crewDay)) delete days[key];
  else days[key] = empty ? null : entry;
  return { ...member, days };
}

/* Days in the period where a member differs from the crew, oldest first. */
function memberDiffKeys(member, period) {
  const inPeriod = new Set(periodDays(period).map(ymd));
  return Object.keys(member?.days || {}).filter((k) => inPeriod.has(k)).sort();
}

/* Members ordered by name or employee number (numbers compare naturally,
   so "#9" comes before "#10"); people missing that field go last. */
function sortMembers(members, by) {
  const field = by === "empNo" ? "empNo" : "name";
  const cmp = (a, b) => String(a).localeCompare(String(b), "en", { numeric: true, sensitivity: "base" });
  return [...(members || [])].sort((a, b) => {
    const x = a[field] || "", y = b[field] || "";
    if (!x !== !y) return x ? -1 : 1;
    return cmp(x, y) || cmp(a.name || "", b.name || "") || cmp(a.empNo || "", b.empNo || "");
  });
}

/* Accept a crew from storage or a backup file only in the expected shape, so
   a hand-edited file can't break the Crew screen. null when unusable. */
function sanitizeCrew(c) {
  const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  if (!isObj(c)) return null;
  const isKey = (k) => /^\d{4}-\d{2}-\d{2}$/.test(k);
  const dayMap = (m, allowNull) => {
    const out = {};
    if (!isObj(m)) return out;
    for (const [k, v] of Object.entries(m)) {
      if (!isKey(k)) continue;
      if (isObj(v)) out[k] = v;
      else if (allowNull && v === null) out[k] = null;
    }
    return out;
  };
  const str = (v, n) => (typeof v === "string" || typeof v === "number" ? String(v).slice(0, n) : "");
  const money = (v) => str(v, 20).replace(/[^0-9.]/g, "");
  const seen = new Set();
  const members = (Array.isArray(c.members) ? c.members : []).filter(isObj).map((m, i) => {
    let id = str(m.id, 40) || `m${i}`;
    if (seen.has(id)) id = `${id}-${i}`;
    seen.add(id);
    return {
      id, name: str(m.name, 60), empNo: str(m.empNo, 30), rank: str(m.rank, 40),
      basePay: { monthly: money(m.basePay?.monthly), compulsory: money(m.basePay?.compulsory) },
      dist: m.dist === "L" ? "L" : "S",
      days: dayMap(m.days, true),
    };
  });
  return {
    entries: dayMap(c.entries, false),
    members,
    rotationAnchor: typeof c.rotationAnchor === "string" && isKey(c.rotationAnchor) ? c.rotationAnchor : null,
    sortBy: c.sortBy === "empNo" ? "empNo" : "name",
    watch: str(c.watch, 30), station: str(c.station, 40),
  };
}

/* A crew day copied from someone's own calendar: the shifts and the
   holiday setting only. Their leave, swaps and short hours are personal. */
function crewDayFrom(e) {
  if (!hasShifts(e) && e?.holiday == null) return null;
  const d = blankDay();
  for (const k of ["am7", "pm3", "pm10"]) d[k] = !!e[k];
  d.holiday = e.holiday == null ? null : !!e.holiday;
  return d;
}

/* How each duty mark is written on the JFB record sheet. */
const SHEET_CODES = { departmental: "D/L", vacation: "V/L", sick: "S/L", timeoff: "T/O", exchangeLeave: "Exc", exchangeFor: "Exc", orderly: "Ord" };
/* A date as the record sheet writes it: 19/6/26. */
const dmy = (d) => `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
/* "June 16, 2026 - July 15, 2026", as the record sheet's period line. */
function periodLong(period) {
  const f = (d) => `${monthNameLong(d.getMonth())} ${d.getDate()}, ${d.getFullYear()}`;
  return `${f(period.start)} - ${f(period.end)}`;
}

/* A person's shifts laid out for the record sheet: each shift's dates, split
   into regular time (the rotation's shift for that day) and overtime (shifts
   outside it). With a rotation, col is the 4-day cycle the date falls in, so
   each column reads 7AM → 3PM → 10PM like the paper sheet; without one,
   every shift is regular time. Each item: { d: "19/6/26", code: "D/L" | "" }. */
function shiftSheet(entries, period, anchor) {
  const blank = () => ({ am7: [], pm3: [], pm10: [] });
  const regular = blank(), overtime = blank();
  let cycleStart = null;
  if (anchor) {
    const off = dayOffset(fromYmd(anchor), period.start);
    cycleStart = addDays(period.start, -(((off % 4) + 4) % 4));
  }
  for (const d of periodDays(period)) {
    const key = ymd(d), e = entries[key];
    if (!hasShifts(e)) continue;
    const slot = rotationSlot(key, anchor);
    for (const k of ["am7", "pm3", "pm10"]) {
      if (!e[k]) continue;
      const duty = shiftDuty(e, k);
      const item = { d: dmy(d), code: duty ? SHEET_CODES[duty] : "" };
      if (cycleStart) item.col = Math.floor(dayOffset(cycleStart, d) / 4);
      (slot && slot !== k ? overtime : regular)[k].push(item);
    }
  }
  return { regular, overtime };
}

/* One row per person for the crew report, in the given order. */
function crewRows(crew, period, rates, tax) {
  return sortMembers(crew.members, crew.sortBy).map((m) => {
    const t = memberTotals(crew.entries, m, period, rates, crew.rotationAnchor);
    const hasBasic = Number(t.monthlyBasic) > 0 && !!tax?.enabled;
    return {
      member: m, totals: t, net: hasBasic ? estimateNet(t, tax).net : null,
      sheet: shiftSheet(memberEntries(crew.entries, m), period, crew.rotationAnchor),
    };
  });
}

/* The crew's result for one period, as saved to History (the save adds its
   own `at`). The per-day hour maps and each person's day overrides only
   drive the screens, so they're left out; the sheet keeps what the Word
   record sheets need. Pass rows already worked out to save a second pass. */
function crewSnapshot(crew, period, rates, tax, rows) {
  return {
    periodKey: periodKey(period), period: periodLabel(period),
    watch: crew.watch || "", station: crew.station || "",
    rows: (rows || crewRows(crew, period, rates, tax)).map(({ member: m, totals, net, sheet }) => {
      const { dayHours, dayHolidayHours, mismatch, ...kept } = totals;
      return {
        member: { id: m.id, name: m.name, empNo: m.empNo, rank: m.rank || "", dist: m.dist },
        totals: { ...kept, rates: { ...totals.rates } }, net, sheet,
      };
    }),
  };
}
/* What a crew save is compared on to tell whether it's still current: who,
   their shifts, and every line of pay that reaches a report (a tax change
   moves only Est. net; a rate change can move money between lines). */
const SIG_FIELDS = ["sp1", "sp2", "meal", "taxi", "baseSubtotal", "holidayPay", "overtimePay", "grand", "otHours", "holidayHours"];
function crewSnapSig(snap) {
  const c = (v) => Math.round((Number(v) || 0) * 100);
  return JSON.stringify([
    snap?.watch || "", snap?.station || "",
    (snap?.rows || []).map((r) => [r.member?.id, r.member?.name, r.member?.empNo, r.member?.rank, r.member?.dist,
      SIG_FIELDS.map((k) => c(r.totals?.[k])), r.net == null ? null : c(r.net), r.totals?.duties, r.sheet]),
  ]);
}

/* Saved crew periods from storage or a backup file, in the shape the
   History screen and the Word export read. Rows missing their totals are
   dropped, totals keep only numbers, and one save per period is kept (the
   latest), each with its own `at` to be found by. */
function sanitizeCrewHistory(list) {
  const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  if (!Array.isArray(list)) return [];
  // Numbers only, one level down for the cal / duties / rates maps.
  const nums = (o, deep) => {
    const out = {};
    for (const [k, v] of Object.entries(isObj(o) ? o : {})) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
      else if (deep && isObj(v)) out[k] = nums(v, false);
      // otUnit (inside rates) keeps hours shown in the unit they were counted in.
      else if (typeof v === "string" && (k === "mode" || k === "basicDistance" || k === "otUnit")) out[k] = v.slice(0, 10);
    }
    return out;
  };
  const str = (v, n) => (typeof v === "string" || typeof v === "number" ? String(v).slice(0, n) : "");
  const items = (a) => (Array.isArray(a) ? a.filter(isObj).map((it) => ({
    d: str(it.d, 12), code: str(it.code, 6), ...(Number.isInteger(it.col) && it.col >= 0 ? { col: it.col } : {}),
  })) : []);
  const part = (p) => ({ am7: items(p?.am7), pm3: items(p?.pm3), pm10: items(p?.pm10) });
  const seenAt = new Set();
  const all = list.filter((s) => isObj(s) && typeof s.periodKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.periodKey)).map((s, i) => {
    let at = str(s.at, 40);
    // A unique stand-in that still reads as a date (1970, plus i ms).
    if (!at || seenAt.has(at)) at = new Date(i).toISOString();
    seenAt.add(at);
    return { ...s, at };
  });
  const latest = {};
  for (const s of all) if (!latest[s.periodKey] || String(s.at) > String(latest[s.periodKey].at)) latest[s.periodKey] = s;
  return all.filter((s) => latest[s.periodKey] === s).map((s) => ({
    at: s.at,
    periodKey: s.periodKey, period: str(s.period, 60) || periodLabel(periodFor(fromYmd(s.periodKey))),
    watch: str(s.watch, 30), station: str(s.station, 40),
    rows: (Array.isArray(s.rows) ? s.rows : []).filter((r) => isObj(r) && isObj(r.totals) && isObj(r.totals.cal)).map((r) => ({
      member: {
        id: str(r.member?.id, 40), name: str(r.member?.name, 60), empNo: str(r.member?.empNo, 30),
        rank: str(r.member?.rank, 40), dist: r.member?.dist === "L" ? "L" : "S",
      },
      totals: nums(r.totals, true),
      net: Number.isFinite(r.net) ? r.net : null,
      sheet: { regular: part(r.sheet?.regular), overtime: part(r.sheet?.overtime) },
    })),
  }));
}

/* The crew as a CSV spreadsheet, one row per person. Amounts are plain
   numbers (no $ or commas) so a spreadsheet can add them up. A cell that
   starts like a formula is prefixed with ' so it's shown, never run. */
function crewCsv(rows, periodStr) {
  const cell = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const n2 = (v) => (Math.round((Number(v) || 0) * 100) / 100).toFixed(2);
  const head = ["Period", "Name", "Employee no.", "Rank", "Taxi", "7AM", "3PM", "10PM", "Leave shifts", "Exchanged out", "Hours",
    "SP1", "SP2", "Meal", "Taxi allowance", "Allowances", "Monthly basic", "Compulsory", "Holiday pay", "Overtime pay", "Gross", "Est. net"];
  const lines = [head.map(cell).join(",")];
  for (const { member: m, totals: t, net } of rows) {
    lines.push([
      periodStr, m.name, m.empNo, m.rank || "", m.dist === "L" ? "Long" : "Short",
      t.cal.am7, t.cal.pm3, t.cal.pm10, t.leaveShifts, t.exchangedShifts, n2(t.totalHours),
      n2(t.sp1), n2(t.sp2), n2(t.meal), n2(t.taxi), n2(t.allowanceSubtotal),
      n2(t.monthlyBasic), n2(t.compulsory), n2(t.holidayPay), n2(t.overtimePay), n2(t.grand),
      net == null ? "" : n2(net),
    ].map(cell).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

/* The crew as plain text for pasting into a message: one block per person,
   then the crew's totals. */
function crewText(rows, periodStr) {
  const W = 38;
  const row = (label, value, indent = 2) => {
    const l = " ".repeat(indent) + label;
    const v = String(value);
    return l + " ".repeat(Math.max(1, W - l.length - v.length)) + v;
  };
  const rule = (ch) => ch.repeat(W);
  const lines = [rule("═"), "   NIGHT SHIFT — WATCH SUMMARY", `   Period: ${periodStr}`, `   ${rows.length} ${rows.length === 1 ? "person" : "people"}`, rule("═")];
  let allow = 0, gross = 0;
  for (const { member: m, totals: t, net } of rows) {
    allow += Number(t.allowanceSubtotal) || 0; gross += Number(t.grand) || 0;
    lines.push("", (m.rank ? `${m.rank} ` : "") + (m.name || "Unnamed") + (m.empNo ? ` · #${m.empNo}` : ""));
    lines.push(`  7AM ${t.cal.am7} · 3PM ${t.cal.pm3} · 10PM ${t.cal.pm10} · ${fmtDur(t.totalHours, t.rates)}`);
    const off = [t.leaveShifts > 0 && `${t.leaveShifts} on leave`, t.exchangedShifts > 0 && `${t.exchangedShifts} exchanged out`].filter(Boolean);
    if (off.length) lines.push("  " + off.join(" · "));
    lines.push(row("Allowances", fmt(t.allowanceSubtotal)));
    if (Number(t.monthlyBasic) > 0 || Number(t.compulsory) > 0) {
      lines.push(row("Base pay", fmt(t.baseSubtotal)));
      if (t.extraSubtotal > 0) lines.push(row("Holiday + overtime", fmt(t.extraSubtotal)));
      lines.push(row("Gross", fmt(t.grand)));
      if (net != null) lines.push(row("Est. net", fmt(net)));
    }
  }
  lines.push("", rule("═"), row("WATCH ALLOWANCES", fmt(allow)), row("WATCH GROSS", fmt(gross)), rule("═"), "— Night Shift Calculator · Estimate only");
  return lines.join("\n");
}

/* ----- storage -----
   One-shot migration: when MIGRATION changes, rates and tax are force-reset to
   the new defaults. Everything else (entries, snapshots, templates, base pay,
   rates history, theme) is preserved. */
function loadState() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(STORAGE) || "{}"); } catch { s = {}; }
  if (!s || typeof s !== "object" || Array.isArray(s)) s = {};
  if (s._migratedAt !== MIGRATION) {
    s.rates = { ...DEFAULT_RATES };
    s.tax = { ...DEFAULT_TAX };
    s._migratedAt = MIGRATION;
    try { localStorage.setItem(STORAGE, JSON.stringify(s)); } catch {}
  }
  return s;
}
function saveState(s) {
  // Keep the one-shot migration marker through normal App saves. Without it,
  // every reload would treat persisted state as stale and reset custom rates.
  try { localStorage.setItem(STORAGE, JSON.stringify({ ...s, _migratedAt: MIGRATION })); } catch {}
}

/* ----- JM tax calculator (monthly) ----- */
function calcTax(grossMonthly, tx) {
  if (!grossMonthly || grossMonthly <= 0 || !tx?.enabled) {
    return { net: grossMonthly || 0, deductions: 0, lines: [] };
  }
  const lines = [];
  // Clamp config so a bad rate can't deduct more than gross, and no deduction
  // can go negative (which would inflate net pay). Percentages are bounded to
  // [0, 100]; caps and thresholds to >= 0.
  const pct = (v) => Math.min(100, Math.max(0, Number(v) || 0));
  const nonNeg = (v) => Math.max(0, Number(v) || 0);
  const nisPct = pct(tx.nis), nhtPct = pct(tx.nht), eduPct = pct(tx.eduTax), pensionPct = pct(tx.pension);
  const rate1 = pct(tx.payeRate1), rate2 = pct(tx.payeRate2);
  const nisCap = nonNeg(tx.nisCapMonthly), payeThreshold = nonNeg(tx.payeThreshold), payeBreak2 = nonNeg(tx.payeBreak2);
  // NIS — capped
  const nisBase = Math.min(grossMonthly, nisCap);
  const nis = nisBase * (nisPct / 100);
  lines.push({ label: "NIS", pct: nisPct, base: nisBase, value: nis, note: grossMonthly > nisCap ? "capped" : null });
  // NHT
  const nht = grossMonthly * (nhtPct / 100);
  lines.push({ label: "NHT", pct: nhtPct, base: grossMonthly, value: nht });
  // Education tax — on (gross - NIS - pension)
  const pension = grossMonthly * (pensionPct / 100);
  const eduBase = Math.max(0, grossMonthly - nis - pension);
  const eduTax = eduBase * (eduPct / 100);
  lines.push({ label: "Education Tax", pct: eduPct, base: eduBase, value: eduTax });
  if (pension > 0) lines.push({ label: "Pension", pct: pensionPct, base: grossMonthly, value: pension });
  // PAYE — bracket 1 from threshold to break point at rate1, bracket 2 above
  // the break point at rate2. Chargeable income deducts NIS and pension; NHT
  // and Education Tax are not deducted from the PAYE base.
  const aboveThreshold = Math.max(0, grossMonthly - payeThreshold - nis - pension);
  const bracket1Width = Math.max(0, payeBreak2 - payeThreshold);
  const inBracket1 = Math.min(aboveThreshold, bracket1Width);
  const inBracket2 = Math.max(0, aboveThreshold - bracket1Width);
  const paye1 = inBracket1 * (rate1 / 100);
  const paye2 = inBracket2 * (rate2 / 100);
  const paye = paye1 + paye2;
  if (paye1 > 0) lines.push({ label: `Income Tax @ ${rate1}%`, pct: rate1, base: inBracket1, value: paye1 });
  if (paye2 > 0) lines.push({ label: `Income Tax @ ${rate2}%`, pct: rate2, base: inBracket2, value: paye2 });
  const deductions = nis + nht + eduTax + pension + paye;
  return { net: grossMonthly - deductions, deductions, lines, nis, nht, eduTax, pension, paye };
}

/* Estimated net for a period's totals. Meal and taxi allowances are tax-free,
   so deductions are worked out on the rest of the gross (basic, compulsory,
   SP1/SP2, holiday and overtime pay) and taken off the full total. */
function estimateNet(totals, tx) {
  const grand = Number(totals?.grand) || 0;
  const exempt = Math.max(0, Number(totals?.meal) || 0) + Math.max(0, Number(totals?.taxi) || 0);
  const taxable = Math.max(0, grand - exempt);
  const r = calcTax(taxable, tx);
  return { ...r, taxable, exempt, net: grand - r.deductions };
}

/* ----- backup lists -----
   Past rates, templates and saved results from a backup file, kept only in
   the shape the screens read. A hand-edited or foreign file could otherwise
   hold an entry with no rates, no days or no totals, which would crash
   Settings, Templates or History the moment it's drawn. */
const isPlainObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/* Every rate a number >= 0 (a missing one falls back to its default, so it
   can't quietly pay $0); the threshold must stay above 0. */
function sanitizeRates(r) {
  const out = { ...DEFAULT_RATES };
  if (!isPlainObj(r)) return out;
  for (const k of Object.keys(DEFAULT_RATES)) {
    const n = Number(r[k]);
    if (r[k] !== "" && r[k] != null && Number.isFinite(n) && n >= 0 && (k !== "threshold" || n > 0)) out[k] = n;
  }
  return out;
}

function sanitizeRatesHistory(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((e) => isPlainObj(e) && typeof e.effectiveFrom === "string" && DATE_KEY.test(e.effectiveFrom.slice(0, 10)))
    .map((e) => ({ effectiveFrom: e.effectiveFrom.slice(0, 10), rates: sanitizeRates(e.rates) }));
}

function sanitizeTemplates(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  return list.filter((t) => isPlainObj(t) && isPlainObj(t.days)).map((t, i) => {
    let id = typeof t.id === "string" && t.id ? t.id.slice(0, 40) : `tpl-${i}`;
    if (seen.has(id)) id = `${id}-${i}`;
    seen.add(id);
    const days = {};
    for (let dow = 0; dow < 7; dow++) {
      const d = t.days[dow];
      if (!isPlainObj(d) || !hasShifts(d)) continue;
      const dist = {};
      for (const k of ["am7", "pm3", "pm10"]) dist[k] = d.dist?.[k] === "L" ? "L" : "S";
      days[dow] = { am7: !!d.am7, pm3: !!d.pm3, pm10: !!d.pm10, dist };
    }
    return { ...t, id, name: typeof t.name === "string" && t.name.trim() ? t.name.slice(0, 60) : "Template", days };
  });
}

/* Saved results need their totals and a unique `at` (History finds, opens
   and deletes each one by it). */
function sanitizeSnapshots(list) {
  if (!Array.isArray(list)) return [];
  const seenAt = new Set();
  return list.filter((s) => isPlainObj(s) && isPlainObj(s.totals)).map((s, i) => {
    let at = typeof s.at === "string" && !Number.isNaN(Date.parse(s.at)) ? s.at : "";
    // A unique stand-in that still reads as a date (1970, plus i ms).
    if (!at || seenAt.has(at)) at = new Date(i).toISOString();
    seenAt.add(at);
    const out = { ...s, at };
    if (typeof out.periodKey !== "string" || !DATE_KEY.test(out.periodKey)) delete out.periodKey;
    if (typeof out.period !== "string") out.period = out.periodKey ? periodLabel(periodFor(fromYmd(out.periodKey))) : "Saved result";
    if (!isPlainObj(out.reconcile)) delete out.reconcile;
    return out;
  });
}

/* ----- Rate history lookup ----- */
/* The Past rates entry in force for a period, or null when none covers it
   (the current rates apply). Newest date first; on a date tie the entry
   saved last wins (an older backup can still hold two entries for one date). */
function rateEntryAt(period, ratesHistory) {
  if (!ratesHistory || ratesHistory.length === 0) return null;
  const sorted = ratesHistory
    .map((entry, i) => ({ entry, i }))
    .sort((a, b) => effDate(b.entry.effectiveFrom) - effDate(a.entry.effectiveFrom) || b.i - a.i);
  const hit = sorted.find(({ entry }) => effDate(entry.effectiveFrom) <= period.start);
  return hit ? hit.entry : null;
}
function ratesAt(period, ratesHistory, currentRates) {
  return rateEntryAt(period, ratesHistory)?.rates || currentRates;
}

/* ----- Templates ----- */
// Template shape: { id, name, days: { 0..6: { am7, pm3, pm10, dist: {am7,pm3,pm10} } } }
function applyTemplate(template, period) {
  const out = {};
  for (const d of periodDays(period)) {
    const t = template.days[d.getDay()];
    if (!hasShifts(t)) continue;
    const e = blankDay();
    e.am7 = !!t.am7;
    e.pm3 = !!t.pm3;
    e.pm10 = !!t.pm10;
    e.dist = { am7: t.dist?.am7 || "S", pm3: t.dist?.pm3 || "S", pm10: t.dist?.pm10 || "S" };
    out[ymd(d)] = e;
  }
  return out;
}

/* Day-of-week pattern from the period: the first day of each weekday that
   has shifts (a day holding only a holiday override doesn't count). */
function extractTemplateFromWeek(entries, period) {
  const tdays = {};
  for (const d of periodDays(period)) {
    const dow = d.getDay();
    const e = entries[ymd(d)];
    if (!hasShifts(e) || tdays[dow]) continue;
    tdays[dow] = { am7: !!e.am7, pm3: !!e.pm3, pm10: !!e.pm10, dist: { ...(e.dist || {}) } };
  }
  return tdays;
}

/* ----- iCal export ----- */
function toICS(entries) {
  // A TZID must be defined in the file itself (RFC 5545), or Apple Calendar
  // and Outlook may read the times as floating or UTC. Jamaica keeps UTC−5
  // all year, with no daylight saving.
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Night Shift Calculator//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VTIMEZONE",
    "TZID:America/Jamaica",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:-0500",
    "TZOFFSETTO:-0500",
    "TZNAME:EST",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const fmtDt = (d, h, m) => {
    const dt = new Date(d);
    dt.setHours(h, m || 0, 0, 0);
    const y = dt.getFullYear();
    const mo = pad(dt.getMonth() + 1);
    const da = pad(dt.getDate());
    const hh = pad(dt.getHours());
    const mm = pad(dt.getMinutes());
    return `${y}${mo}${da}T${hh}${mm}00`;
  };
  const tz = "America/Jamaica";
  const dutyNote = (e, k) => { const d = shiftDuty(e, k); return d ? ` (${DUTY_TYPES[d].label})` : ""; };
  for (const [key, e] of Object.entries(entries)) {
    if (!e) continue;
    const d = fromYmd(key);
    const next = addDays(d, 1);
    if (e.am7) {
      lines.push("BEGIN:VEVENT",
        `UID:nsc-${key}-am7@nightshift`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=${tz}:${fmtDt(d, 7)}`,
        `DTEND;TZID=${tz}:${fmtDt(d, 15)}`,
        `SUMMARY:7AM shift${dutyNote(e, "am7")}`,
        "END:VEVENT");
    }
    if (e.pm3) {
      lines.push("BEGIN:VEVENT",
        `UID:nsc-${key}-pm3@nightshift`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=${tz}:${fmtDt(d, 15)}`,
        `DTEND;TZID=${tz}:${fmtDt(d, 22)}`,
        `SUMMARY:3PM shift${dutyNote(e, "pm3")}`,
        "END:VEVENT");
    }
    if (e.pm10) {
      lines.push("BEGIN:VEVENT",
        `UID:nsc-${key}-pm10@nightshift`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=${tz}:${fmtDt(d, 22)}`,
        `DTEND;TZID=${tz}:${fmtDt(next, 7)}`,
        `SUMMARY:10PM shift${dutyNote(e, "pm10")}`,
        "END:VEVENT");
    }
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

const _exports = {
  SHIFT_HOURS, PM10_TOTAL, MAX_SHIFT_HOURS, stdHours, effHours,
  LEAVE_TYPES, DUTY_TYPES, DUTY_KEYS, LEAVE_KEYS, shiftDuty, isLeave, isGivenAway, worksShift, hasShifts,
  SHIFTS, SHIFT_LABEL, DEFAULT_RATES, DEFAULT_TAX, STORAGE, APP_VERSION,
  APP_CREDIT, CONTACT_EMAIL, JFB_LOGO,
  pad, ymd, fromYmd, effDate, addDays, sameDay, monthName, monthNameLong,
  periodFor, shiftPeriod, periodLabel, periodKey, periodDays,
  easterSunday, jamaicaHolidays, holidayName, isJamaicaHoliday, holidaysInPeriod,
  fmt, fmtShort, fmtH, fmtH0, fmtHM, fmtHMc, fmtDur, OT_UNITS, inMinutes, summaryText,
  blankDay, sanitizeEntries, clearPeriodEntries, autofillPattern, aggregate,
  rotationEntries, totalsError, totalsEntries, fillDays, mergePeriodFill,
  ROTATION_SLOTS, rotationSlot, extraShiftKeys, rotationStats, am7InPeriod,
  sanitizeRates, sanitizeRatesHistory, sanitizeTemplates, sanitizeSnapshots,
  calcTax, estimateNet, rateEntryAt, ratesAt, applyTemplate, extractTemplateFromWeek, toICS,
  blankCrew, newMember, memberEntries, memberTotals, sameEntry, setMemberDay, memberDiffKeys,
  sortMembers, sanitizeCrew, crewDayFrom, crewRows, crewCsv, crewText,
  SHEET_CODES, dmy, periodLong, shiftSheet, crewSnapshot, crewSnapSig, sanitizeCrewHistory,
  loadState, saveState,
};

if (typeof window !== "undefined") Object.assign(window, _exports);
if (typeof module !== "undefined" && module.exports) module.exports = _exports;
