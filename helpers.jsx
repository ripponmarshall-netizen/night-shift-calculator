/* helpers.jsx — date utils, JM holidays (with Easter calc), aggregate, storage */
/* Pure JS, no JSX — kept Node-loadable so calc.test.js can require() it. */

const SHIFT_HOURS = { am7: 8, pm3: 7, pm10_start: 2, pm10_next: 7 };
const PM10_TOTAL = SHIFT_HOURS.pm10_start + SHIFT_HOURS.pm10_next; // 9h, crosses midnight
/* Standard hours for a shift key (pm10 is the total across midnight). */
function stdHours(key) { return key === "pm10" ? PM10_TOTAL : SHIFT_HOURS[key]; }
/* Effective hours actually worked for a shift. An entry may carry an optional
   sparse override: hours: { am7?, pm3?, pm10? } (string or number). Absent,
   blank, or invalid => the standard hours, so old entries stay backward
   compatible. pm10 override is the TOTAL across midnight (default 9). */
function effHours(e, key) {
  const v = e && e.hours && e.hours[key];
  return (v == null || v === "" || !(Number(v) >= 0)) ? stdHours(key) : Number(v);
}
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
const APP_VERSION = "3.3";
// One credit line and contact address, shared by every footer and About.
const APP_CREDIT = "Workflow Coaching and Optimisation · Portland Division";
const CONTACT_EMAIL = "ripponmarshall@yahoo.com";
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

  const list = [
    { date: new Date(year, 0, 1), name: "New Year's Day" },
    { date: ashWed, name: "Ash Wednesday" },
    { date: goodFri, name: "Good Friday" },
    { date: easterMon, name: "Easter Monday" },
    { date: new Date(year, 4, 23), name: "Labour Day" },
    { date: new Date(year, 7, 1), name: "Emancipation Day" },
    { date: new Date(year, 7, 6), name: "Independence Day" },
    { date: heroesDay, name: "National Heroes Day" },
    { date: new Date(year, 11, 25), name: "Christmas Day" },
    { date: new Date(year, 11, 26), name: "Boxing Day" },
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
const fmtShort = (n) => {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  const s = a >= 1000
    ? "$" + (a / 1000).toLocaleString("en-JM", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "k"
    : "$" + a.toLocaleString("en-JM", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return v < 0 && s !== "$0" ? "−" + s : s;
};
const fmtH = (n) => (Number(n) || 0).toLocaleString("en-JM", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
      [`Holiday ×2 · ${fmtH(totals.holidayHours)}h`, fmt(totals.holidayPay)],
      [`Overtime ×1.5 · ${fmtH(totals.otHours)}h`, fmt(totals.overtimePay)],
    ], fmt(totals.extraSubtotal)),
    "",
    rule("═"),
    row("GROSS TOTAL", fmt(totals.grand), 2),
  ];
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
   or a second shift on a working day). Empty when no rotation is saved. */
function extraShiftKeys(entry, slot) {
  if (!slot || !entry) return [];
  return ["am7", "pm3", "pm10"].filter((k) => entry[k] && k !== slot);
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

/* Validate shift totals against the period. Returns an error string or null.
   `pairs` = days with both a 3PM and a 10PM (these get the taxi deduction). */
function totalsError(period, t) {
  const n = (v) => Math.max(0, Math.trunc(Number(v) || 0));
  const pm3 = n(t.pm3), pm10 = n(t.pm10), am7 = n(t.am7), pairs = n(t.pairs);
  const len = regularDays(period).length;
  if (pairs > Math.min(pm3, pm10)) return "Back-to-back days can't exceed your 3PM or 10PM count.";
  if (am7 + pm3 + pm10 - pairs > len) return `That's more shift days than the ${len} working days in this period.`;
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
  const out = {};
  const d0 = dist || "S";
  seq.forEach((kind, i) => {
    const d = days[Math.floor((i * days.length) / seq.length)];
    const e = blankDay();
    e.dist = { am7: d0, pm3: d0, pm10: d0 };
    if (kind === "pair") { e.pm3 = true; e.pm10 = true; } else e[kind] = true;
    out[ymd(d)] = e;
  });
  return out;
}

/* Merge generated entries into the saved map for one period. replace=true
   clears the period's days first (other periods are never touched);
   replace=false only fills days that have no shifts yet. */
function mergePeriodFill(entries, period, fill, replace) {
  const base = replace ? clearPeriodEntries(entries, period) : { ...entries };
  for (const [k, v] of Object.entries(fill)) {
    const cur = base[k];
    if (!replace && cur && (cur.am7 || cur.pm3 || cur.pm10)) continue;
    base[k] = v;
  }
  return base;
}

/* ----- aggregate (calculation engine) ----- */
function aggregate(entries, period, mode, basicDistance, counts, basePay, rates) {
  let calPm3 = 0, calPm10 = 0, cal7am = 0, sameDayPair = 0;
  let shortPm3 = 0, longPm3 = 0, shortPm10 = 0, longPm10 = 0, shortAm7 = 0, longAm7 = 0;
  let totalHours = 0, holidayHours = 0;
  let sameDayPairLegSum = 0; // sum of actual leg rates for same-day 3PM+10PM pairs (advanced mode)

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

  const days = periodDays(period);
  const dayHours = {}; // key -> hours for stripe viz
  const dayHolidayHours = {};

  for (const d of days) {
    const key = ymd(d);
    const e = entries[key];
    if (!e) continue;
    const isHol = e.holiday == null ? isJamaicaHoliday(d) : e.holiday;
    let h = 0, hHol = 0;

    // Holiday pay (×2) applies only to the 2nd+ shift on a holiday day; the
    // first shift in time order is regular. Time order on this calendar day:
    // a 10PM carried over from the previous day (starts 00:00) → 7AM → 3PM → 10PM.
    const prevEntry = entries[ymd(addDays(d, -1))];
    const carryoverFromPrev = !!(prevEntry && prevEntry.pm10);
    let firstSeg;
    if (carryoverFromPrev) firstSeg = "carryover";
    else if (e.am7) firstSeg = "am7";
    else if (e.pm3) firstSeg = "pm3";
    else if (e.pm10) firstSeg = "pm10_start";
    else firstSeg = null;

    // Allowance credit (SP1/SP2/meal/taxi): a shift counts as a FULL shift only
    // when more than half its standard hours were worked. Half or less earns no
    // allowance, but the actual hours below still count toward totals/overtime.
    const credit = {
      am7:  e.am7  && effHours(e, "am7")  > stdHours("am7")  / 2,
      pm3:  e.pm3  && effHours(e, "pm3")  > stdHours("pm3")  / 2,
      pm10: e.pm10 && effHours(e, "pm10") > stdHours("pm10") / 2,
    };

    if (e.am7) {
      if (credit.am7) cal7am++;
      const ha = effHours(e, "am7");
      h += ha;
      if (isHol && firstSeg !== "am7") hHol += ha;
      if (credit.am7) { if (e.dist?.am7 === "L") longAm7++; else shortAm7++; }
    }
    if (e.pm3) {
      if (credit.pm3) calPm3++;
      const hp3 = effHours(e, "pm3");
      h += hp3;
      if (isHol && firstSeg !== "pm3") hHol += hp3;
      if (credit.pm3) { if (e.dist?.pm3 === "L") longPm3++; else shortPm3++; }
    }
    if (e.pm10) {
      if (credit.pm10) calPm10++;
      // Single editable total; split the pre-midnight vs carryover legs
      // proportionally so the holiday rule scales (default 9 → 2h pre-midnight).
      const tot = effHours(e, "pm10");
      const ratio = PM10_TOTAL > 0 ? tot / PM10_TOTAL : 0;
      const startSeg = SHIFT_HOURS.pm10_start * ratio;
      h += tot;
      // The carryover leg starts at 00:00 next day, so it is always that day's
      // first segment and never earns holiday pay; only the pre-midnight leg can.
      if (isHol && firstSeg !== "pm10_start") hHol += startSeg;
      if (credit.pm10) { if (e.dist?.pm10 === "L") longPm10++; else shortPm10++; }
      if (credit.pm10 && credit.pm3) {
        sameDayPair++;
        const r3  = (e.dist?.pm3  === "L") ? R.taxiLong : R.taxiShort;
        const r10 = (e.dist?.pm10 === "L") ? R.taxiLong : R.taxiShort;
        sameDayPairLegSum += r3 + r10;
      }
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
  const otHours = Math.max(0, nonHolidayHours - R.threshold);
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
    grand,
    mismatch, hasMismatch,
    rates, mode, basicDistance,
  };
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

/* ----- Rate history lookup ----- */
function ratesAt(period, ratesHistory, currentRates) {
  if (!ratesHistory || ratesHistory.length === 0) return currentRates;
  const target = period.start;
  // Newest date first; on a date tie the entry saved last wins (an older
  // backup can still hold two entries for one date).
  const sorted = ratesHistory
    .map((entry, i) => ({ entry, i }))
    .sort((a, b) => effDate(b.entry.effectiveFrom) - effDate(a.entry.effectiveFrom) || b.i - a.i);
  for (const { entry } of sorted) {
    if (effDate(entry.effectiveFrom) <= target) return entry.rates;
  }
  return currentRates;
}

/* ----- Templates ----- */
// Template shape: { id, name, days: { 0..6: { am7, pm3, pm10, dist: {am7,pm3,pm10} } } }
function applyTemplate(template, period, opts) {
  const out = {};
  const days = periodDays(period);
  for (const d of days) {
    if (opts?.preserve && opts.existing && opts.existing[ymd(d)] && (opts.existing[ymd(d)].am7 || opts.existing[ymd(d)].pm3 || opts.existing[ymd(d)].pm10)) continue;
    const dow = d.getDay();
    const t = template.days[dow];
    if (!t || (!t.am7 && !t.pm3 && !t.pm10)) continue;
    const e = blankDay();
    e.am7 = !!t.am7;
    e.pm3 = !!t.pm3;
    e.pm10 = !!t.pm10;
    e.dist = { am7: t.dist?.am7 || "S", pm3: t.dist?.pm3 || "S", pm10: t.dist?.pm10 || "S" };
    out[ymd(d)] = e;
  }
  return out;
}

function extractTemplateFromWeek(entries, period) {
  // Take week starting Monday from period; build day-of-week pattern from first 7 days with data
  const days = periodDays(period);
  const tdays = {};
  for (const d of days) {
    const dow = d.getDay();
    const e = entries[ymd(d)];
    if (!e) continue;
    if (tdays[dow]) continue; // first occurrence wins
    tdays[dow] = { am7: !!e.am7, pm3: !!e.pm3, pm10: !!e.pm10, dist: { ...(e.dist || {}) } };
  }
  return tdays;
}

/* ----- iCal export ----- */
function toICS(entries, periodKeyOrAll) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Night Shift Calculator//EN",
    "CALSCALE:GREGORIAN",
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
        "SUMMARY:7AM shift",
        "END:VEVENT");
    }
    if (e.pm3) {
      lines.push("BEGIN:VEVENT",
        `UID:nsc-${key}-pm3@nightshift`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=${tz}:${fmtDt(d, 15)}`,
        `DTEND;TZID=${tz}:${fmtDt(d, 22)}`,
        "SUMMARY:3PM shift",
        "END:VEVENT");
    }
    if (e.pm10) {
      lines.push("BEGIN:VEVENT",
        `UID:nsc-${key}-pm10@nightshift`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=${tz}:${fmtDt(d, 22)}`,
        `DTEND;TZID=${tz}:${fmtDt(next, 7)}`,
        "SUMMARY:10PM shift",
        "END:VEVENT");
    }
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

const _exports = {
  SHIFT_HOURS, PM10_TOTAL, stdHours, effHours, DEFAULT_RATES, DEFAULT_TAX, STORAGE, APP_VERSION,
  APP_CREDIT, CONTACT_EMAIL,
  pad, ymd, fromYmd, effDate, addDays, sameDay, monthName, monthNameLong,
  periodFor, shiftPeriod, periodLabel, periodKey, periodDays,
  easterSunday, jamaicaHolidays, holidayName, isJamaicaHoliday, holidaysInPeriod,
  fmt, fmtShort, fmtH, summaryText,
  blankDay, clearPeriodEntries, autofillPattern, aggregate,
  rotationEntries, totalsError, totalsEntries, mergePeriodFill,
  ROTATION_SLOTS, rotationSlot, extraShiftKeys, rotationStats, am7InPeriod,
  calcTax, ratesAt, applyTemplate, extractTemplateFromWeek, toICS,
  loadState, saveState,
};

if (typeof window !== "undefined") Object.assign(window, _exports);
if (typeof module !== "undefined" && module.exports) module.exports = _exports;
