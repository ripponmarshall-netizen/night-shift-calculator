/* helpers.jsx — date utils, JM holidays (with Easter calc), aggregate, storage */

const SHIFT_HOURS = { am7: 8, pm3: 7, pm10_start: 2, pm10_next: 7 };
const DEFAULT_RATES = {
  sp1: 66.6,        // 4 hrs × $16.65/hr per 3PM shift
  sp2: 200,         // 8 hrs × $25/hr per 10PM shift
  meal: 500,
  taxiShort: 950,
  taxiLong: 2000,
  threshold: 173.33,
};
const STORAGE = "nsc:v3";
const MIGRATION = "nsc-rates-2026-05";

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
const fmt = (n) => "$" + (Number(n) || 0).toLocaleString("en-JM", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1000) return "$" + (v / 1000).toLocaleString("en-JM", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "k";
  return "$" + v.toLocaleString("en-JM", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};
const fmtH = (n) => (Number(n) || 0).toLocaleString("en-JM", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ----- entries ----- */
function blankDay() { return { am7: false, pm3: false, pm10: false, holiday: null, dist: { am7: "S", pm3: "S", pm10: "S" } }; }

/* ----- autofill rotation -----
   Standard rotation is a 4-day cycle: 7AM → 3PM → 10PM → rest. The 10PM shift
   ends at 07:00 the next morning, so the day after a 10PM is always a rest
   day; the next 7AM begins on the day after that. */
function autofillPattern(period, opts) {
  // opts: { startKey, pattern: "rotation"|"am7"|"pm3"|"pm10", days: "rest"|7|14, defaultDist }
  const days = periodDays(period);
  const startIdx = Math.max(0, days.findIndex((d) => ymd(d) === opts.startKey));
  const count = opts.days === "rest" ? days.length - startIdx : Math.min(opts.days, days.length - startIdx);
  const rotation = ["am7", "pm3", "pm10", null]; // null = rest
  const out = {};
  for (let i = 0; i < count; i++) {
    const slot = opts.pattern === "rotation" ? rotation[i % 4] : opts.pattern;
    if (!slot) continue; // rest day in the rotation
    const d = days[startIdx + i];
    const e = blankDay();
    e.dist = { am7: opts.defaultDist, pm3: opts.defaultDist, pm10: opts.defaultDist };
    e[slot] = true;
    out[ymd(d)] = e;
  }
  return out;
}

/* ----- aggregate (calculation engine) ----- */
function aggregate(entries, period, mode, basicDistance, counts, basePay, rates) {
  let calPm3 = 0, calPm10 = 0, cal7am = 0, sameDayPair = 0;
  let shortPm3 = 0, longPm3 = 0, shortPm10 = 0, longPm10 = 0, shortAm7 = 0, longAm7 = 0;
  let totalHours = 0, holidayHours = 0;

  const days = periodDays(period);
  const dayHours = {}; // key -> hours for stripe viz
  const dayHolidayHours = {};

  for (const d of days) {
    const key = ymd(d);
    const e = entries[key];
    if (!e) continue;
    const isHol = e.holiday === null ? isJamaicaHoliday(d) : e.holiday;
    let h = 0, hHol = 0;

    if (e.am7) {
      cal7am++;
      h += SHIFT_HOURS.am7;
      if (isHol) hHol += SHIFT_HOURS.am7;
      if (e.dist?.am7 === "L") longAm7++; else shortAm7++;
    }
    if (e.pm3) {
      calPm3++;
      h += SHIFT_HOURS.pm3;
      if (isHol) hHol += SHIFT_HOURS.pm3;
      if (e.dist?.pm3 === "L") longPm3++; else shortPm3++;
    }
    if (e.pm10) {
      calPm10++;
      h += SHIFT_HOURS.pm10_start;
      if (isHol) hHol += SHIFT_HOURS.pm10_start;
      const nextDate = addDays(d, 1);
      const nextEntry = entries[ymd(nextDate)];
      const nextHol = nextEntry && nextEntry.holiday !== null ? nextEntry.holiday : isJamaicaHoliday(nextDate);
      h += SHIFT_HOURS.pm10_next; // attributed to this day for total; holiday goes to next day's bucket
      if (nextHol) hHol += SHIFT_HOURS.pm10_next;
      if (e.dist?.pm10 === "L") longPm10++; else shortPm10++;
      if (e.pm3) sameDayPair++;
    }

    totalHours += h;
    holidayHours += hHol;
    dayHours[key] = h;
    dayHolidayHours[key] = hHol;
  }

  const usedPm3 = calPm3, usedPm10 = calPm10, usedAm7 = cal7am;

  const sp1 = usedPm3 * rates.sp1;
  const sp2 = usedPm10 * rates.sp2;
  const meal = (usedPm3 + usedPm10) * rates.meal;

  let taxiGross = 0;
  if (mode === "basic") {
    const rate = basicDistance === "L" ? rates.taxiLong : rates.taxiShort;
    taxiGross = (usedPm3 + usedPm10 + usedAm7) * rate;
  } else {
    taxiGross =
      (shortPm3 + shortPm10 + shortAm7) * rates.taxiShort +
      (longPm3 + longPm10 + longAm7) * rates.taxiLong;
  }
  const deductRate = mode === "basic"
    ? (basicDistance === "L" ? rates.taxiLong : rates.taxiShort)
    : rates.taxiShort;
  const taxiDeduct = sameDayPair * 2 * deductRate;
  const taxi = Math.max(0, taxiGross - taxiDeduct);

  const allowanceSubtotal = sp1 + sp2 + meal + taxi;

  const monthlyBasic = Number(basePay.monthly) || 0;
  const compulsory = Number(basePay.compulsory) || 0;
  const baseSubtotal = monthlyBasic + compulsory;

  const hourlyRate = monthlyBasic > 0 ? monthlyBasic / rates.threshold : 0;
  const nonHolidayHours = Math.max(0, totalHours - holidayHours);
  const otHours = Math.max(0, nonHolidayHours - rates.threshold);
  const holidayPay = holidayHours * hourlyRate * 2;
  const overtimePay = otHours * hourlyRate * 1.5;
  const extraSubtotal = holidayPay + overtimePay;

  const grand = allowanceSubtotal + baseSubtotal + extraSubtotal;

  const mismatch = {
    pm3: counts.pm3 !== "" && Number(counts.pm3) !== calPm3,
    pm10: counts.pm10 !== "" && Number(counts.pm10) !== calPm10,
    am7: counts.am7 !== "" && Number(counts.am7) !== cal7am,
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
  if (s._migratedAt !== MIGRATION) {
    s.rates = { ...DEFAULT_RATES };
    s.tax = { ...DEFAULT_TAX };
    s._migratedAt = MIGRATION;
    try { localStorage.setItem(STORAGE, JSON.stringify(s)); } catch {}
  }
  return s;
}
function saveState(s) {
  try { localStorage.setItem(STORAGE, JSON.stringify(s)); } catch {}
}

/* ----- JM tax calculator (monthly) ----- */
function calcTax(grossMonthly, tx) {
  if (!grossMonthly || grossMonthly <= 0 || !tx?.enabled) {
    return { net: grossMonthly || 0, deductions: 0, lines: [] };
  }
  const lines = [];
  // NIS — capped
  const nisBase = Math.min(grossMonthly, tx.nisCapMonthly);
  const nis = nisBase * (tx.nis / 100);
  lines.push({ label: "NIS", pct: tx.nis, base: nisBase, value: nis, note: grossMonthly > tx.nisCapMonthly ? "capped" : null });
  // NHT
  const nht = grossMonthly * (tx.nht / 100);
  lines.push({ label: "NHT", pct: tx.nht, base: grossMonthly, value: nht });
  // Education tax — on (gross - NIS - pension)
  const pension = grossMonthly * (tx.pension / 100);
  const eduBase = Math.max(0, grossMonthly - nis - pension);
  const eduTax = eduBase * (tx.eduTax / 100);
  lines.push({ label: "Education Tax", pct: tx.eduTax, base: eduBase, value: eduTax });
  if (pension > 0) lines.push({ label: "Pension", pct: tx.pension, base: grossMonthly, value: pension });
  // PAYE — over threshold; bracket 2 over break point
  const taxable = Math.max(0, grossMonthly - tx.payeThreshold - nis - pension);
  let paye = 0;
  // For PAYE we apply bracket logic on gross above threshold:
  // bracket1: from threshold to break2 at rate1; bracket2: above break2 at rate2
  const aboveThreshold = Math.max(0, grossMonthly - tx.payeThreshold - nis - pension);
  const bracket1Width = Math.max(0, tx.payeBreak2 - tx.payeThreshold);
  const inBracket1 = Math.min(aboveThreshold, bracket1Width);
  const inBracket2 = Math.max(0, aboveThreshold - bracket1Width);
  const paye1 = inBracket1 * (tx.payeRate1 / 100);
  const paye2 = inBracket2 * (tx.payeRate2 / 100);
  paye = paye1 + paye2;
  if (paye1 > 0) lines.push({ label: `Income Tax @ ${tx.payeRate1}%`, pct: tx.payeRate1, base: inBracket1, value: paye1 });
  if (paye2 > 0) lines.push({ label: `Income Tax @ ${tx.payeRate2}%`, pct: tx.payeRate2, base: inBracket2, value: paye2 });
  const deductions = nis + nht + eduTax + pension + paye;
  return { net: grossMonthly - deductions, deductions, lines, nis, nht, eduTax, pension, paye };
}

/* ----- Rate history lookup ----- */
function ratesAt(period, ratesHistory, currentRates) {
  if (!ratesHistory || ratesHistory.length === 0) return currentRates;
  const target = period.start;
  const sorted = [...ratesHistory].sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom));
  for (const entry of sorted) {
    if (new Date(entry.effectiveFrom) <= target) return entry.rates;
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

Object.assign(window, {
  SHIFT_HOURS, DEFAULT_RATES, DEFAULT_TAX, STORAGE,
  pad, ymd, fromYmd, addDays, sameDay, monthName, monthNameLong,
  periodFor, shiftPeriod, periodLabel, periodKey, periodDays,
  easterSunday, jamaicaHolidays, holidayName, isJamaicaHoliday, holidaysInPeriod,
  fmt, fmtShort, fmtH,
  blankDay, autofillPattern, aggregate,
  calcTax, ratesAt, applyTemplate, extractTemplateFromWeek, toICS,
  loadState, saveState,
});
