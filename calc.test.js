const assert = require("assert");
const {
  aggregate,
  calcTax,
  estimateNet,
  DEFAULT_TAX,
  summaryText,
  fmtShort,
  CONTACT_EMAIL,
  ratesAt,
  periodFor,
  fromYmd,
  clearPeriodEntries,
  loadState,
  saveState,
  STORAGE,
  autofillPattern,
  rotationEntries,
  totalsError,
  totalsEntries,
  mergePeriodFill,
  ymd,
  fmt,
  rotationSlot,
  extraShiftKeys,
  rotationStats,
  am7InPeriod,
  shiftDuty,
  isLeave,
  isGivenAway,
  worksShift,
  LEAVE_KEYS,
  DUTY_KEYS,
  DUTY_TYPES,
  toICS,
  hasShifts,
  fillDays,
  rateEntryAt,
  applyTemplate,
  extractTemplateFromWeek,
  fmtH0,
  blankDay,
  DEFAULT_RATES,
} = require("./helpers.jsx");

function round2(n) {
  return Math.round(n * 100) / 100;
}

function validateBasic(all3, all10, extra10After3) {
  return extra10After3 <= Math.min(all3, all10);
}

function computeBasic(all3, all10, extra10After3) {
  const SP1 = 66.6,
    SP2 = 200,
    MEAL = 950,
    TAXI = 950;
  return round2(
    all3 * SP1 +
      all10 * SP2 +
      (all3 + all10) * MEAL +
      Math.max(0, all3 + all10 - extra10After3 * 2) * TAXI,
  );
}

function computeEstimatedNetPay(grossMonthly) {
  const PAYE_THRESHOLD_MONTHLY = 1902360 / 12;
  const PAYE_BAND_LIMIT_MONTHLY = 6000000 / 12;
  const PAYE_RATE_LOWER = 0.25;
  const PAYE_RATE_UPPER = 0.3;
  const NIS_RATE = 0.03;
  const NIS_ANNUAL_CAP = 5000000;
  const NHT_RATE = 0.02;
  const EDU_TAX_RATE = 0.0225;
  const gross = Math.max(0, grossMonthly);
  const nisMonthlyCap = NIS_ANNUAL_CAP / 12;
  const nisMonthly = Math.min(gross, nisMonthlyCap) * NIS_RATE;
  const nhtMonthly = gross * NHT_RATE;
  // Education Tax base excludes NIS (and pension); mirrors calcTax in helpers.jsx.
  const eduTaxMonthly = Math.max(0, gross - nisMonthly) * EDU_TAX_RATE;
  // PAYE chargeable income deducts only the threshold and NIS — NHT and
  // Education Tax are NOT deductible from the PAYE base (JM rules).
  const chargeableIncome = Math.max(
    0,
    gross - PAYE_THRESHOLD_MONTHLY - nisMonthly,
  );
  const bandWidth = PAYE_BAND_LIMIT_MONTHLY - PAYE_THRESHOLD_MONTHLY;
  const lowerBand = Math.min(chargeableIncome, bandWidth);
  const upperBand = Math.max(0, chargeableIncome - bandWidth);
  const payeMonthly = lowerBand * PAYE_RATE_LOWER + upperBand * PAYE_RATE_UPPER;
  return round2(gross - nisMonthly - nhtMonthly - eduTaxMonthly - payeMonthly);
}

// Existing sanity checks
assert.strictEqual(computeBasic(0, 0, 0), 0);
assert.strictEqual(computeBasic(1, 1, 0), 4066.6);
assert.strictEqual(computeBasic(2, 2, 2), 4333.2);
assert.strictEqual(validateBasic(3, 2, 2), true);
assert.strictEqual(validateBasic(3, 2, 3), false);
assert.strictEqual(computeEstimatedNetPay(0), 0);
assert.strictEqual(computeEstimatedNetPay(50000), 46408.75);
assert.strictEqual(computeEstimatedNetPay(200000), 176767.5);
assert.strictEqual(computeEstimatedNetPay(800000), 582163.75);

// Direct coverage of the shipping tax engine (calcTax) — guards the real
// function rather than a parallel reimplementation.
const taxNear = (g, expected) =>
  assert.ok(
    Math.abs(calcTax(g, DEFAULT_TAX).net - expected) < 0.01,
    `calcTax(${g}).net = ${calcTax(g, DEFAULT_TAX).net}, expected ~${expected}`,
  );
taxNear(0, 0);
taxNear(50000, 46408.75);
taxNear(200000, 176767.5);
taxNear(800000, 582163.75);

// computeEstimatedNetPay must mirror calcTax (pension = 0) at every level.
for (const g of [0, 50000, 200000, 800000, 1234567]) {
  assert.ok(
    Math.abs(computeEstimatedNetPay(g) - calcTax(g, DEFAULT_TAX).net) < 0.01,
    `tax model drift at ${g}: ${computeEstimatedNetPay(g)} vs ${calcTax(g, DEFAULT_TAX).net}`,
  );
}

// Disabling tax returns gross unchanged.
assert.strictEqual(
  calcTax(200000, { ...DEFAULT_TAX, enabled: false }).net,
  200000,
);

// Upgrade-plan section 2: test coverage expansion for allowance combinations
assert.strictEqual(computeBasic(3, 0, 0), 5899.8); // SP1-only
assert.strictEqual(computeBasic(0, 4, 0), 8400); // SP2-only
assert.strictEqual(computeBasic(5, 5, 3), 14633); // mixed shifts + reduced taxi trips
assert.strictEqual(computeBasic(7, 2, 0), 17966.2);
assert.strictEqual(computeBasic(7, 2, 2), 14166.2);

// edge cases: zero counts and extra10After3 values beyond effective taxi reduction range
assert.strictEqual(computeBasic(0, 5, 0), 10500);
assert.strictEqual(computeBasic(5, 0, 0), 9833);
assert.strictEqual(computeBasic(1, 1, 8), 2166.6); // taxi floor at zero, never negative

// validation boundaries
assert.strictEqual(validateBasic(0, 0, 0), true);
assert.strictEqual(validateBasic(1, 0, 0), true);
assert.strictEqual(validateBasic(1, 0, 1), false);

// PAYE band threshold boundary checks
const PAYE_BAND_LIMIT_MONTHLY = 6000000 / 12;
const PAYE_THRESHOLD_MONTHLY = 1902360 / 12;
const NIS_RATE = 0.03;
const NHT_RATE = 0.02;
const EDU_TAX_RATE = 0.0225;
const taxableDeductionRate = NIS_RATE + NHT_RATE + EDU_TAX_RATE;
const grossAtUpperBandStart =
  (PAYE_THRESHOLD_MONTHLY + PAYE_BAND_LIMIT_MONTHLY) /
  (1 - taxableDeductionRate);

const netAtUpperBandStart = computeEstimatedNetPay(grossAtUpperBandStart);
const netAboveUpperBandStart = computeEstimatedNetPay(
  grossAtUpperBandStart + 1000,
);
assert.ok(netAboveUpperBandStart > netAtUpperBandStart);

// Holiday-hours rule: only the 2nd+ shift on a holiday day earns holiday pay.
// The first shift in time order (carryover 10PM → 7AM → 3PM → 10PM) is regular.
const HOL_PERIOD = { start: new Date(2026, 4, 16), end: new Date(2026, 5, 15) };
const HOL_COUNTS = { am7: "", pm3: "", pm10: "" };
const HOL_BASEPAY = { monthly: 173330, compulsory: 0 }; // hourlyRate = 1000 exactly
const HOL_RATES = {
  sp1: 66.6,
  sp2: 200,
  meal: 950,
  taxiShort: 950,
  taxiLong: 2000,
  threshold: 173.33,
};
const D = (opts = {}) => ({
  am7: !!opts.am7,
  pm3: !!opts.pm3,
  pm10: !!opts.pm10,
  holiday: opts.holiday ?? null,
  dist: { am7: "S", pm3: "S", pm10: "S" },
  ...(opts.hours ? { hours: opts.hours } : {}),
});
const HOL = "2026-05-23"; // Labour Day (JM)
const PREV = "2026-05-22";
const PLAIN = "2026-05-20";
const agg = (entries) =>
  aggregate(
    entries,
    HOL_PERIOD,
    "basic",
    "S",
    HOL_COUNTS,
    HOL_BASEPAY,
    HOL_RATES,
  );
const agg2 = (entries, rates, basePay) =>
  aggregate(entries, HOL_PERIOD, "basic", "S", HOL_COUNTS, basePay, rates);
const holNear = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 0.01);

// 1. Non-holiday baseline: nothing counts as holiday hours.
let r = agg({ [PLAIN]: D({ am7: 1, pm3: 1, pm10: 1 }) });
assert.strictEqual(r.holidayHours, 0);
holNear(r.holidayPay, 0);

// 2. Lone 10PM on a holiday → first/only shift, no holiday hours.
r = agg({ [HOL]: D({ pm10: 1, holiday: true }) });
assert.strictEqual(r.holidayHours, 0);

// 3. Lone 7AM on a holiday → first/only shift, no holiday hours.
r = agg({ [HOL]: D({ am7: 1, holiday: true }) });
assert.strictEqual(r.holidayHours, 0);

// 4. 7AM + 3PM on a holiday → 3PM is the 2nd shift (7h).
r = agg({ [HOL]: D({ am7: 1, pm3: 1, holiday: true }) });
assert.strictEqual(r.holidayHours, 7);
holNear(r.holidayPay, 14000);

// 5. 7AM + 3PM + 10PM on a holiday → 3PM (7h) + 10PM start (2h) = 9h.
r = agg({ [HOL]: D({ am7: 1, pm3: 1, pm10: 1, holiday: true }) });
assert.strictEqual(r.holidayHours, 9);
holNear(r.holidayPay, 18000);
assert.strictEqual(r.dayHolidayHours[HOL], 9);
assert.strictEqual(r.totalHours, 24); // am7 8 + pm3 7 + pm10 9
assert.strictEqual(r.nonHolidayHours, 15); // 24h total − 9h holiday

// 6. 3PM + 10PM on a holiday → 3PM is first, only 10PM start (2h) counts.
r = agg({ [HOL]: D({ pm3: 1, pm10: 1, holiday: true }) });
assert.strictEqual(r.holidayHours, 2);
holNear(r.holidayPay, 4000);

// 7. 10PM the day before a holiday, then 7AM on the holiday: the carryover is
//    the holiday's first segment, so 7AM (8h) is the 2nd shift and earns holiday.
//    The carryover never adds holiday hours to the previous day.
r = agg({
  [PREV]: D({ pm10: 1, holiday: false }),
  [HOL]: D({ am7: 1, holiday: true }),
});
assert.strictEqual(r.holidayHours, 8);
holNear(r.holidayPay, 16000);
assert.strictEqual(r.dayHolidayHours[PREV], 0);

// Partial-hours rule: actual hours always count toward total/overtime/holiday
// hours, but a shift earns its full per-shift allowance only when MORE THAN half
// its standard hours were worked (half or less => no allowance credit).

// Backward compat: an entry with no hours override uses the standard hours.
r = agg({ [PLAIN]: D({ am7: 1 }) });
assert.strictEqual(r.totalHours, 8);
assert.strictEqual(r.cal.am7, 1);

// Worked more than half (6h of 8h): full allowance credit, actual hours total.
r = agg({ [PLAIN]: D({ am7: 1, hours: { am7: 6 } }) });
assert.strictEqual(r.totalHours, 6);
assert.strictEqual(r.cal.am7, 1);

// Worked exactly half (4h of 8h) or less: hours count, but no allowance credit.
r = agg({ [PLAIN]: D({ am7: 1, hours: { am7: 4 } }) });
assert.strictEqual(r.totalHours, 4);
assert.strictEqual(r.cal.am7, 0);
r = agg({ [PLAIN]: D({ am7: 1, hours: { am7: 3 } }) });
assert.strictEqual(r.totalHours, 3);
assert.strictEqual(r.cal.am7, 0);

// A half-or-less pm3 shift earns no SP1/meal; a >half one does.
let rNone = agg({ [PLAIN]: D({ pm3: 1, hours: { pm3: 3 } }) }); // 3 <= 3.5
let rFull = agg({ [PLAIN]: D({ pm3: 1, hours: { pm3: 4 } }) }); // 4 > 3.5
assert.strictEqual(rNone.cal.pm3, 0);
holNear(rNone.sp1, 0);
assert.strictEqual(rFull.cal.pm3, 1);
holNear(rFull.sp1, HOL_RATES.sp1);

// Invalid/blank override falls back to the standard hours.
r = agg({ [PLAIN]: D({ pm3: 1, hours: { pm3: "" } }) });
assert.strictEqual(r.totalHours, 7);
r = agg({ [PLAIN]: D({ pm3: 1, hours: { pm3: "abc" } }) });
assert.strictEqual(r.totalHours, 7);

// pm10 partial on a holiday (am7 + pm10, am7 is first/regular): pm10 total 6h,
// ratio 6/9, pre-midnight leg = 2*6/9 = 1.333h earns holiday pay.
r = agg({ [HOL]: D({ am7: 1, pm10: 1, holiday: true, hours: { pm10: 6 } }) });
holNear(r.holidayHours, (2 * 6) / 9);
assert.strictEqual(r.totalHours, 8 + 6);
assert.strictEqual(r.cal.pm10, 1); // 6 > 4.5 => full allowance credit

// pm10 worked half or less (4h <= 4.5) earns no allowance credit.
r = agg({ [PLAIN]: D({ pm10: 1, hours: { pm10: 4 } }) });
assert.strictEqual(r.cal.pm10, 0);
assert.strictEqual(r.totalHours, 4);

// Input-validation guards: bad rates/tax (via Settings, import, or corrupted
// storage) must never yield NaN/Infinity or negative pay.
const GUARD_RATES = {
  sp1: 66.6,
  sp2: 200,
  meal: 950,
  taxiShort: 950,
  taxiLong: 2000,
  threshold: 173.33,
};
const oneShift = { [PLAIN]: D({ am7: 1, pm3: 1 }) }; // 15h on a non-holiday day

// threshold = 0 must not divide into Infinity/NaN (was: hourlyRate=Infinity → NaN grand).
let g = agg2(
  oneShift,
  { ...GUARD_RATES, threshold: 0 },
  { monthly: 173330, compulsory: 0 },
);
assert.ok(Number.isFinite(g.hourlyRate), "hourlyRate finite when threshold=0");
assert.ok(Number.isFinite(g.holidayPay), "holidayPay finite when threshold=0");
assert.ok(Number.isFinite(g.grand), "grand finite when threshold=0");

// Negative threshold falls back to default; OT is not inflated.
g = agg2(
  oneShift,
  { ...GUARD_RATES, threshold: -100 },
  { monthly: 173330, compulsory: 0 },
);
assert.strictEqual(g.otHours, 0);

// Negative allowance rates clamp to 0 (never a negative allowance).
g = agg2(
  oneShift,
  { ...GUARD_RATES, sp1: -100, meal: -50 },
  { monthly: 0, compulsory: 0 },
);
assert.ok(g.sp1 >= 0 && g.meal >= 0 && g.allowanceSubtotal >= 0);

// Negative base pay is treated as 0.
g = agg2(oneShift, GUARD_RATES, { monthly: -5000, compulsory: -100 });
assert.strictEqual(g.monthlyBasic, 0);
assert.strictEqual(g.compulsory, 0);
assert.ok(g.hourlyRate >= 0 && g.holidayPay >= 0);

// Tax rate > 100% can't deduct more than gross from that line.
let tr = calcTax(100000, { ...DEFAULT_TAX, nis: 150 });
assert.ok(tr.nis <= 100000, "NIS clamped so it can't exceed gross");

// Negative tax rate can't create a refund (negative deduction).
tr = calcTax(100000, { ...DEFAULT_TAX, nis: -10 });
assert.ok(tr.nis >= 0, "NIS deduction never negative");
assert.ok(tr.deductions >= 0, "total deductions never negative");

// summaryText: tidy breakdown with a Total line; Estimated Net only when
// provided; never emits NaN/undefined.
const stTotals = agg2(oneShift, GUARD_RATES, {
  monthly: 173330,
  compulsory: 0,
});
const stWithNet = summaryText(stTotals, "May 16 – Jun 15, 2026", 150000);
assert.ok(stWithNet.includes("GROSS TOTAL"));
assert.ok(stWithNet.includes("Estimated Net"));
assert.ok(!/NaN|undefined/.test(stWithNet));
const stNoNet = summaryText(stTotals, "May 16 – Jun 15, 2026");
assert.ok(!stNoNet.includes("Estimated Net"));

// ratesAt: effective-from dates are parsed as LOCAL midnight (like period.start),
// so a rate effective on the same date a period starts must apply on that date —
// regardless of the host machine's timezone.
const currentRates = {
  sp1: 1,
  sp2: 1,
  meal: 1,
  taxiShort: 1,
  taxiLong: 1,
  threshold: 173.33,
};
const aprRates = { ...currentRates, sp1: 50 };
const mayRates = { ...currentRates, sp1: 99 };
const history = [
  { effectiveFrom: "2026-04-16", rates: aprRates },
  { effectiveFrom: "2026-05-16", rates: mayRates },
];
// Period starting on the May boundary date picks the May rates (boundary is inclusive).
assert.strictEqual(
  ratesAt(periodFor(fromYmd("2026-05-16")), history, currentRates).sp1,
  99,
  "ratesAt: period starting on effective date uses that date's rates",
);
// Period starting on the April boundary date picks the April rates.
assert.strictEqual(
  ratesAt(periodFor(fromYmd("2026-04-16")), history, currentRates).sp1,
  50,
  "ratesAt: April period uses April rates",
);
// A future-only effective date falls back to currentRates.
assert.strictEqual(
  ratesAt(
    periodFor(fromYmd("2026-03-16")),
    [{ effectiveFrom: "2026-05-16", rates: mayRates }],
    currentRates,
  ).sp1,
  1,
  "ratesAt: future-only history falls back to current rates",
);
// Empty/absent history returns current rates.
assert.strictEqual(
  ratesAt(periodFor(fromYmd("2026-05-16")), [], currentRates).sp1,
  1,
);

// Resetting the current period must preserve shifts stored for other periods.
const resetPeriod = periodFor(fromYmd("2026-05-20"));
const entriesAcrossPeriods = {
  "2026-05-15": D({ pm3: 1 }), // preceding period
  "2026-05-16": D({ am7: 1 }), // current period boundary
  "2026-06-15": D({ pm10: 1 }), // current period boundary
  "2026-06-16": D({ pm3: 1 }), // following period
};
assert.deepStrictEqual(clearPeriodEntries(entriesAcrossPeriods, resetPeriod), {
  "2026-05-15": entriesAcrossPeriods["2026-05-15"],
  "2026-06-16": entriesAcrossPeriods["2026-06-16"],
});

// Normal saves must retain the one-shot migration marker; otherwise a reload
// resets customized rates and tax settings back to defaults every session.
const stored = new Map();
global.localStorage = {
  getItem: (key) => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, value),
};
const customRates = { ...GUARD_RATES, sp1: 4321 };
const customTax = { ...DEFAULT_TAX, pension: 7 };
saveState({ rates: customRates, tax: customTax });
let persisted = loadState();
assert.deepStrictEqual(persisted.rates, customRates);
assert.deepStrictEqual(persisted.tax, customTax);
assert.ok(persisted._migratedAt, "saveState persists the migration marker");

// Malformed-but-valid JSON storage must recover safely instead of crashing.
stored.set(STORAGE, "null");
persisted = loadState();
assert.deepStrictEqual(persisted.rates, {
  sp1: 66.6,
  sp2: 200,
  meal: 950,
  taxiShort: 950,
  taxiLong: 2000,
  threshold: 173.33,
});
assert.deepStrictEqual(persisted.tax, DEFAULT_TAX);

// ----- Simple (Home) setup: rotation phase, totals placement, merge -----
// Omitting phase must reproduce the original autofill output exactly.
const AF_OPTS = {
  startKey: "2026-05-16",
  pattern: "rotation",
  days: "rest",
  defaultDist: "S",
};
assert.deepStrictEqual(
  autofillPattern(HOL_PERIOD, AF_OPTS),
  autofillPattern(HOL_PERIOD, { ...AF_OPTS, phase: 0 }),
);
const shiftOn = (entries, key) => {
  const e = entries[key];
  if (!e) return null;
  return e.am7 ? "am7" : e.pm3 ? "pm3" : e.pm10 ? "pm10" : null;
};
// First 7AM on day k of the period: the days before it are the tail of the
// previous cycle (k=1: rest; k=2: 10PM, rest; k=3: 3PM, 10PM, rest).
const expectedStarts = [
  ["am7", "pm3", "pm10", null, "am7"],
  [null, "am7", "pm3", "pm10", null],
  ["pm10", null, "am7", "pm3", "pm10"],
  ["pm3", "pm10", null, "am7", "pm3"],
];
const firstDays = [
  "2026-05-16",
  "2026-05-17",
  "2026-05-18",
  "2026-05-19",
  "2026-05-20",
];
expectedStarts.forEach((expected, k) => {
  const rot = rotationEntries(HOL_PERIOD, k, "L");
  assert.deepStrictEqual(
    firstDays.map((key) => shiftOn(rot, key)),
    expected,
    `rotation with first 7AM on day ${k}`,
  );
  for (const e of Object.values(rot)) {
    assert.strictEqual(e.holiday, null, "rotation keeps real holidays");
    assert.deepStrictEqual(e.dist, { am7: "L", pm3: "L", pm10: "L" });
  }
});
// Rotation from the wizard == the same rotation from Auto-fill (same engine).
{
  const viaWizard = rotationEntries(HOL_PERIOD, 1, "S");
  const viaAutofill = autofillPattern(HOL_PERIOD, {
    startKey: "2026-05-17",
    pattern: "rotation",
    days: "rest",
    defaultDist: "S",
  });
  assert.deepStrictEqual(
    viaWizard,
    Object.assign({}, viaAutofill), // day 0 (16th) is a rest day either way
  );
}

// Totals: exact counts land on the calendar, one shift/pair per day.
{
  const t = { pm3: 8, pm10: 7, am7: 8, pairs: 0 };
  assert.strictEqual(totalsError(HOL_PERIOD, t), null);
  const te = totalsEntries(HOL_PERIOD, t, "S");
  const r = agg(te);
  assert.strictEqual(r.cal.pm3, 8);
  assert.strictEqual(r.cal.pm10, 7);
  assert.strictEqual(r.cal.am7, 8);
  assert.strictEqual(r.cal.sameDayPair, 0);
  assert.strictEqual(r.holidayHours, 0, "totals never guess holiday pay");
  assert.strictEqual(Object.keys(te).length, 23);
  // Allowances match the documented Quick contract.
  holNear(r.sp1, 8 * 66.6);
  holNear(r.sp2, 7 * 200);
  holNear(r.meal, 15 * 950);
  holNear(r.taxi, 15 * 950);
  // Every placed day is inside the period, never on a public holiday, and
  // keeps the automatic holiday flag (no override that could stick later).
  const inPeriod = new Set(
    Array.from({ length: 31 }, (_, i) => ymd(new Date(2026, 4, 16 + i))),
  );
  for (const [k, e] of Object.entries(te)) {
    assert.ok(inPeriod.has(k), `${k} inside period`);
    assert.notStrictEqual(k, HOL, "totals never land on a public holiday");
    assert.strictEqual(e.holiday, null);
  }
}
// Totals with back-to-back 3PM+10PM days apply the same-day taxi deduction.
{
  const te = totalsEntries(
    HOL_PERIOD,
    { pm3: 5, pm10: 5, am7: 0, pairs: 2 },
    "L",
  );
  const r = aggregate(
    te,
    HOL_PERIOD,
    "basic",
    "L",
    HOL_COUNTS,
    HOL_BASEPAY,
    HOL_RATES,
  );
  assert.strictEqual(r.cal.pm3, 5);
  assert.strictEqual(r.cal.pm10, 5);
  assert.strictEqual(r.cal.sameDayPair, 2);
  holNear(r.taxi, (10 - 2 * 2) * 2000);
}
// Invalid totals are rejected and produce no entries.
assert.ok(totalsError(HOL_PERIOD, { pm3: 1, pm10: 3, am7: 0, pairs: 2 }));
assert.ok(totalsError(HOL_PERIOD, { pm3: 20, pm10: 20, am7: 0, pairs: 0 }));
assert.deepStrictEqual(
  totalsEntries(HOL_PERIOD, { pm3: 20, pm10: 20, am7: 0, pairs: 0 }, "S"),
  {},
);
// A full period of single shifts fits exactly: 31 days minus Labour Day = 30
// working days. One more shift day is rejected. Even fully packed, no holiday
// hours appear (the day after a 10PM is never a holiday with a shift).
{
  const full = { pm3: 10, pm10: 10, am7: 10, pairs: 0 };
  assert.strictEqual(totalsError(HOL_PERIOD, full), null);
  const te = totalsEntries(HOL_PERIOD, full, "S");
  assert.strictEqual(Object.keys(te).length, 30);
  assert.strictEqual(te[HOL], undefined);
  assert.strictEqual(agg(te).holidayHours, 0);
  assert.ok(totalsError(HOL_PERIOD, { ...full, am7: 11 }));
}

// mergePeriodFill: replace clears only this period; keep fills empty days only.
{
  const saved = {
    "2026-05-15": D({ pm3: 1 }), // previous period — never touched
    "2026-05-16": D({ pm10: 1 }), // logged day in this period
    "2026-05-20": D({ am7: 1 }),
  };
  const fill = {
    "2026-05-16": D({ am7: 1 }),
    "2026-05-17": D({ pm3: 1 }),
  };
  assert.deepStrictEqual(mergePeriodFill(saved, HOL_PERIOD, fill, true), {
    "2026-05-15": saved["2026-05-15"],
    "2026-05-16": fill["2026-05-16"],
    "2026-05-17": fill["2026-05-17"],
  });
  assert.deepStrictEqual(mergePeriodFill(saved, HOL_PERIOD, fill, false), {
    "2026-05-15": saved["2026-05-15"],
    "2026-05-16": saved["2026-05-16"],
    "2026-05-17": fill["2026-05-17"],
    "2026-05-20": saved["2026-05-20"],
  });
}

// Rotation anchored on ANY 7AM day: the cycle runs both ways, so the days
// before the chosen date are filled too (not just the days after it).
{
  // Anchor on May 22 (offset 6). 22 = 7AM → 21 rest, 20 10PM, 19 3PM, 18 7AM,
  // 17 rest, 16 10PM; forward 23 3PM, 24 10PM, 25 rest, 26 7AM.
  const rot = rotationEntries(HOL_PERIOD, "2026-05-22", "S");
  const want = {
    "2026-05-16": "pm10",
    "2026-05-17": null,
    "2026-05-18": "am7",
    "2026-05-19": "pm3",
    "2026-05-20": "pm10",
    "2026-05-21": null,
    "2026-05-22": "am7",
    "2026-05-23": "pm3",
    "2026-05-24": "pm10",
    "2026-05-25": null,
    "2026-05-26": "am7",
  };
  for (const [k, v] of Object.entries(want)) {
    assert.strictEqual(shiftOn(rot, k), v, `anchor May 22 → ${k}`);
  }
  // Same rotation from an equivalent anchor 4 days earlier, a numeric offset,
  // or a 7AM date outside the period (last period / next period).
  assert.deepStrictEqual(rotationEntries(HOL_PERIOD, "2026-05-18", "S"), rot);
  assert.deepStrictEqual(rotationEntries(HOL_PERIOD, 6, "S"), rot);
  assert.deepStrictEqual(rotationEntries(HOL_PERIOD, "2026-05-14", "S"), rot);
  assert.deepStrictEqual(rotationEntries(HOL_PERIOD, "2026-06-15", "S"), rot);
  // Every day of the period is covered by the cycle: 31 days → 23 shift days.
  assert.strictEqual(Object.keys(rot).length, 23);
}

// Missing count keys (e.g. an imported file) are "not entered": no mismatch.
{
  const r = aggregate(
    { [PLAIN]: D({ pm3: 1 }) },
    HOL_PERIOD,
    "basic",
    "S",
    {},
    HOL_BASEPAY,
    HOL_RATES,
  );
  assert.strictEqual(r.hasMismatch, false);
  const r2 = aggregate(
    { [PLAIN]: D({ pm3: 1 }) },
    HOL_PERIOD,
    "basic",
    "S",
    { pm3: "2" },
    HOL_BASEPAY,
    HOL_RATES,
  );
  assert.strictEqual(r2.mismatch.pm3, true);
  assert.strictEqual(r2.mismatch.pm10, false);
}

// Saved rotation: slot for any date from one 7AM anchor, both directions and
// across pay periods; it matches what rotationEntries generates.
{
  const A = "2026-05-22"; // a 7AM
  assert.strictEqual(rotationSlot("2026-05-22", A), "am7");
  assert.strictEqual(rotationSlot("2026-05-23", A), "pm3");
  assert.strictEqual(rotationSlot("2026-05-24", A), "pm10");
  assert.strictEqual(rotationSlot("2026-05-25", A), "off");
  assert.strictEqual(rotationSlot("2026-05-21", A), "off");
  assert.strictEqual(rotationSlot("2026-05-18", A), "am7");
  assert.strictEqual(rotationSlot("2026-07-01", A), "am7"); // 40 days on
  assert.strictEqual(
    rotationSlot("2026-06-29", A),
    rotationSlot("2026-06-29", "2026-06-27"),
  );
  assert.strictEqual(rotationSlot("2026-05-22", null), null);

  const rot = rotationEntries(HOL_PERIOD, A, "S");
  for (const [k, e] of Object.entries(rot)) {
    const on = ["am7", "pm3", "pm10"].filter((x) => e[x]);
    assert.deepStrictEqual(
      on,
      [rotationSlot(k, A)],
      `rotation matches slot on ${k}`,
    );
  }
  // every day the generator leaves empty is an off day
  for (
    let d = new Date(HOL_PERIOD.start);
    d <= HOL_PERIOD.end;
    d.setDate(d.getDate() + 1)
  ) {
    if (!rot[ymd(d)]) assert.strictEqual(rotationSlot(ymd(d), A), "off");
  }

  // extras: a shift on an off day, and a second shift on a working day
  assert.deepStrictEqual(extraShiftKeys({ pm3: true }, "off"), ["pm3"]);
  assert.deepStrictEqual(extraShiftKeys({ pm3: true, pm10: true }, "pm3"), [
    "pm10",
  ]);
  assert.deepStrictEqual(extraShiftKeys({ am7: true }, "am7"), []);
  assert.deepStrictEqual(extraShiftKeys({ am7: true }, null), []);

  const withExtra = { ...rot, "2026-05-25": D({ am7: 1 }) };
  withExtra["2026-05-23"] = D({ pm3: 1, pm10: 1 });
  const st = rotationStats(withExtra, HOL_PERIOD, A);
  assert.strictEqual(st.extra, 2);
  assert.strictEqual(st.off, 31 - Object.keys(rot).length);
  assert.deepStrictEqual(rotationStats(withExtra, HOL_PERIOD, null), {
    extra: 0,
    off: 0,
  });

  assert.strictEqual(am7InPeriod(HOL_PERIOD, "2026-07-01"), "2026-05-18");
  assert.strictEqual(am7InPeriod(HOL_PERIOD, null), null);
}

// ratesAt: two Past rates entries with the same date — the one saved last
// wins (older backups can hold such duplicates).
assert.strictEqual(
  ratesAt(
    periodFor(fromYmd("2026-09-20")),
    [
      { effectiveFrom: "2026-04-01", rates: { sp1: 1 } },
      { effectiveFrom: "2026-04-01", rates: { sp1: 2 } },
      { effectiveFrom: "2026-01-01", rates: { sp1: 3 } },
    ],
    { sp1: 0 },
  ).sp1,
  2,
);

// Money formatting: negatives get a leading minus, no "-0.00".
assert.strictEqual(fmt(-500), "−$500.00");
assert.strictEqual(fmt(1234.5), "$1,234.50");
assert.strictEqual(fmt(-0.001), "$0.00");
assert.strictEqual(fmtShort(-1500), "−$1.5k");
assert.strictEqual(fmtShort(1500), "$1.5k");
assert.strictEqual(fmtShort(-0.2), "$0");

// Footnotes: the copied summary ends with the same "Estimate only" note the
// app shows, and the contact address is set.
assert.ok(stNoNet.endsWith("— Night Shift Calculator · Estimate only"));
assert.ok(/^[^@\s]+@[^@\s]+\.[a-z]+$/.test(CONTACT_EMAIL));

// Meal and taxi are tax-free: deductions are on the rest of the gross and
// come off the full total.
{
  const t = { grand: 200000, meal: 9500, taxi: 9500 };
  const r = estimateNet(t, DEFAULT_TAX);
  const taxedOnly = calcTax(181000, DEFAULT_TAX);
  assert.strictEqual(r.taxable, 181000);
  assert.strictEqual(r.exempt, 19000);
  assert.ok(Math.abs(r.deductions - taxedOnly.deductions) < 0.005);
  assert.ok(Math.abs(r.net - (200000 - taxedOnly.deductions)) < 0.005);
  // Less tax than treating the whole gross as taxable.
  assert.ok(r.net > calcTax(200000, DEFAULT_TAX).net);
  // Nothing taxable (allowances only): no deductions at all.
  const allMealTaxi = estimateNet(
    { grand: 1900, meal: 950, taxi: 950 },
    DEFAULT_TAX,
  );
  assert.strictEqual(allMealTaxi.deductions, 0);
  assert.strictEqual(allMealTaxi.net, 1900);
  // Tax switched off: net is the gross.
  assert.strictEqual(
    estimateNet(t, { ...DEFAULT_TAX, enabled: false }).net,
    200000,
  );
  // Legacy snapshot totals without meal/taxi: everything is taxable.
  assert.ok(
    Math.abs(
      estimateNet({ grand: 200000 }, DEFAULT_TAX).net -
        calcTax(200000, DEFAULT_TAX).net,
    ) < 0.005,
  );
}

// Leave and orderly duty, marked per shift.
{
  const withDuty = (opts, duty) => ({ ...D(opts), duty });
  const base = agg({ [PLAIN]: D({ pm3: 1, pm10: 1 }) });

  // Every leave type: hours kept, no SP1/SP2/meal/taxi for that shift.
  for (const kind of LEAVE_KEYS) {
    const r = agg({ [PLAIN]: withDuty({ pm3: 1 }, { pm3: kind }) });
    assert.strictEqual(r.sp1, 0, kind);
    assert.strictEqual(r.meal, 0, kind);
    assert.strictEqual(r.taxi, 0, kind);
    assert.strictEqual(r.cal.pm3, 0, kind);
    assert.strictEqual(r.totalHours, 7, kind);
    assert.strictEqual(r.leaveHours, 7, kind);
    assert.strictEqual(r.leaveShifts, 1, kind);
    assert.strictEqual(r.duties[kind], 1, kind);
    assert.ok(isLeave(kind));
  }

  // Leave on one shift of a 3PM+10PM day: the 10PM keeps its SP2, meal
  // and taxi, and with no paid pair there's no same-day taxi deduction.
  let r = agg({ [PLAIN]: withDuty({ pm3: 1, pm10: 1 }, { pm3: "sick" }) });
  assert.strictEqual(r.sp1, 0);
  holNear(r.sp2, HOL_RATES.sp2);
  holNear(r.meal, HOL_RATES.meal);
  holNear(r.taxi, HOL_RATES.taxiShort);
  assert.strictEqual(r.cal.sameDayPair, 0);
  assert.strictEqual(r.totalHours, base.totalHours);

  // Leave hours still count toward overtime.
  const many = {};
  for (let i = 0; i < 20; i++) {
    const k = ymd(new Date(2026, 4, 24 + i)); // clear of Labour Day
    many[k] = withDuty({ pm10: 1 }, { pm10: "vacation" });
  }
  r = agg(many);
  assert.strictEqual(r.totalHours, 180);
  holNear(r.otHours, 180 - 173.33);
  assert.strictEqual(r.sp2, 0);
  assert.strictEqual(r.leaveShifts, 20);

  // On a holiday, leave hours are ordinary hours, never holiday ×2. The
  // worked shift keeps the holiday rule as before.
  r = agg({ [HOL]: D({ am7: 1, pm3: 1, holiday: true }) });
  assert.strictEqual(r.holidayHours, 7); // 3PM is the 2nd shift
  r = agg({
    [HOL]: withDuty({ am7: 1, pm3: 1, holiday: true }, { pm3: "sick" }),
  });
  assert.strictEqual(r.holidayHours, 0);
  assert.strictEqual(r.nonHolidayHours, 15);
  holNear(r.holidayPay, 0);
  r = agg({
    [PREV]: D({ pm10: 1 }),
    [HOL]: withDuty({ pm10: 1, holiday: true }, { pm10: "vacation" }),
  });
  assert.strictEqual(r.holidayHours, 0);

  // Orderly duty is a worked shift: allowances paid as normal.
  r = agg({
    [PLAIN]: withDuty({ pm3: 1, pm10: 1 }, { pm3: "orderly", pm10: "orderly" }),
  });
  holNear(r.grand, base.grand);
  assert.strictEqual(r.duties.orderly, 2);
  assert.strictEqual(r.leaveShifts, 0);

  // A mark on a shift that isn't on, or an unknown value, is ignored.
  r = agg({
    [PLAIN]: withDuty({ pm3: 1, pm10: 1 }, { am7: "sick", pm3: "bogus" }),
  });
  holNear(r.grand, base.grand);
  assert.strictEqual(r.leaveShifts, 0);
  assert.strictEqual(
    shiftDuty(withDuty({ pm3: 1 }, { am7: "sick" }), "am7"),
    null,
  );

  // Summary text lists leave; calendar export names it.
  r = agg({ [PLAIN]: withDuty({ pm3: 1, pm10: 1 }, { pm3: "sick" }) });
  const txt = summaryText(r, "May 16 – Jun 15, 2026", null);
  assert.ok(/LEAVE & DUTIES/.test(txt));
  assert.ok(/Sick leave\s+1 shift/.test(txt));
  assert.ok(!/NaN|undefined/.test(txt));
  assert.ok(!/LEAVE & DUTIES/.test(summaryText(base, "x", null)));
  assert.ok(
    /SUMMARY:3PM shift \(Sick leave\)/.test(
      toICS({ [PLAIN]: withDuty({ pm3: 1 }, { pm3: "sick" }) }),
    ),
  );
}

// Exchange leave and exchange for: a shift swap between two people.
{
  const withDuty = (opts, duty) => ({ ...D(opts), duty });
  const none = agg({});
  const base = agg({ [PLAIN]: D({ pm3: 1, pm10: 1 }) });

  // Every duty mark has a known pay rule, and the codes are unique.
  for (const k of DUTY_KEYS) {
    assert.ok(["full", "hours", "none"].includes(DUTY_TYPES[k].pay), k);
  }
  const codes = DUTY_KEYS.map((k) => DUTY_TYPES[k].code);
  assert.strictEqual(new Set(codes).size, codes.length);
  assert.ok(isGivenAway("exchangeLeave"));
  assert.ok(!isGivenAway("exchangeFor"));
  assert.ok(!isGivenAway("vacation"));
  assert.ok(!isLeave("exchangeLeave"));

  // Exchange leave: no hours and no allowances, as if not on the calendar.
  let r = agg({
    [PLAIN]: withDuty(
      { pm3: 1, pm10: 1 },
      { pm3: "exchangeLeave", pm10: "exchangeLeave" },
    ),
  });
  holNear(r.grand, none.grand);
  assert.strictEqual(r.totalHours, 0);
  assert.strictEqual(r.sp1 + r.sp2 + r.meal + r.taxi, 0);
  assert.strictEqual(r.cal.pm3 + r.cal.pm10, 0);
  assert.strictEqual(r.exchangedShifts, 2);
  assert.strictEqual(r.exchangedHours, 16);
  assert.strictEqual(r.duties.exchangeLeave, 2);
  assert.strictEqual(r.leaveShifts, 0);
  assert.strictEqual(r.dayHours[PLAIN], 0);

  // One leg of a 3PM+10PM day given away: the 10PM is paid alone, with no
  // same-day pair deduction.
  r = agg({ [PLAIN]: withDuty({ pm3: 1, pm10: 1 }, { pm3: "exchangeLeave" }) });
  assert.strictEqual(r.sp1, 0);
  holNear(r.sp2, HOL_RATES.sp2);
  holNear(r.taxi, HOL_RATES.taxiShort);
  assert.strictEqual(r.cal.sameDayPair, 0);
  assert.strictEqual(r.totalHours, 9);

  // An hours override on a given-away shift is ignored.
  r = agg({
    [PLAIN]: {
      ...withDuty({ am7: 1 }, { am7: "exchangeLeave" }),
      hours: { am7: "12" },
    },
  });
  assert.strictEqual(r.totalHours, 0);

  // Exchange for: covering someone else's shift is paid in full.
  r = agg({
    [PLAIN]: withDuty(
      { pm3: 1, pm10: 1 },
      { pm3: "exchangeFor", pm10: "exchangeFor" },
    ),
  });
  holNear(r.grand, base.grand);
  assert.strictEqual(r.totalHours, base.totalHours);
  assert.strictEqual(r.duties.exchangeFor, 2);
  assert.strictEqual(r.exchangedShifts, 0);

  // Holiday order: a given-away first shift doesn't make the next one the
  // "second" shift of the day, so the 3PM is regular, not ×2.
  r = agg({
    [HOL]: withDuty(
      { am7: 1, pm3: 1, holiday: true },
      { am7: "exchangeLeave" },
    ),
  });
  assert.strictEqual(r.holidayHours, 0);
  assert.strictEqual(r.totalHours, 7);
  // A given-away 10PM the night before isn't a carryover either.
  r = agg({
    [PREV]: withDuty({ pm10: 1 }, { pm10: "exchangeLeave" }),
    [HOL]: D({ am7: 1, holiday: true }),
  });
  assert.strictEqual(r.holidayHours, 0);
  assert.strictEqual(r.totalHours, 8);
  // ...while a worked one still is (the 7AM becomes the 2nd shift).
  r = agg({
    [PREV]: withDuty({ pm10: 1 }, { pm10: "exchangeFor" }),
    [HOL]: D({ am7: 1, holiday: true }),
  });
  assert.strictEqual(r.holidayHours, 8);

  // Rotation: a shift given away is never an extra; one worked for someone
  // else on an off day is.
  const ANCHOR = "2026-05-17"; // 7AM; so 05-20 is an off day
  assert.strictEqual(rotationSlot(PLAIN, ANCHOR), "off");
  assert.deepStrictEqual(
    extraShiftKeys(withDuty({ pm3: 1 }, { pm3: "exchangeLeave" }), "off"),
    [],
  );
  assert.deepStrictEqual(
    extraShiftKeys(withDuty({ pm3: 1 }, { pm3: "exchangeFor" }), "off"),
    ["pm3"],
  );
  assert.ok(!worksShift(withDuty({ pm3: 1 }, { pm3: "exchangeLeave" }), "pm3"));
  assert.ok(worksShift(withDuty({ pm3: 1 }, { pm3: "exchangeFor" }), "pm3"));
  assert.ok(!worksShift(undefined, "pm3"));

  // Summary text and calendar export name both.
  r = agg({
    [PLAIN]: withDuty(
      { pm3: 1, pm10: 1 },
      { pm3: "exchangeLeave", pm10: "exchangeFor" },
    ),
  });
  const txt = summaryText(r, "May 16 – Jun 15, 2026", null);
  assert.ok(/Exchange leave\s+1 shift/.test(txt));
  assert.ok(/Exchange for\s+1 shift/.test(txt));
  assert.ok(/Exchanged away \(not paid\)\s+7\.00h/.test(txt));
  assert.ok(!/NaN|undefined/.test(txt));
  assert.ok(
    /SUMMARY:3PM shift \(Exchange leave\)/.test(
      toICS({ [PLAIN]: withDuty({ pm3: 1 }, { pm3: "exchangeLeave" }) }),
    ),
  );
}

// Shared helpers: hasShifts, fillDays, rateEntryAt, templates, ICS timezone.
{
  assert.ok(!hasShifts(null));
  assert.ok(!hasShifts({ holiday: true }));
  assert.ok(hasShifts({ pm10: true }));
  assert.strictEqual(fmtH0(183.333), "183.33");
  assert.strictEqual(fmtH0(7.5), "7.5");

  // fillDays: keep leaves logged days alone; never touches other days.
  const logged = { a: { pm3: true }, b: { holiday: true }, z: { am7: true } };
  const fill = { a: { am7: true }, b: { pm10: true } };
  const kept = fillDays(logged, fill, true);
  assert.deepStrictEqual(kept.a, { pm3: true });
  // A holiday-only day has no shifts, so it is filled, but its holiday
  // override is the person's own choice and must survive the fill (losing it
  // silently adds or removes holiday ×2 pay).
  assert.deepStrictEqual(kept.b, { pm10: true, holiday: true });
  const offHol = fillDays(
    { b: { holiday: false } },
    { b: { pm10: true, holiday: null } },
    true,
  );
  assert.strictEqual(offHol.b.holiday, false);
  assert.ok(offHol.b.pm10);
  // Fill-generated days still get no override of their own.
  assert.strictEqual(
    fillDays({}, { c: { am7: true, holiday: null } }, true).c.holiday,
    null,
  );
  // Through mergePeriodFill (keep mode) and the pay engine: a day marked as a
  // holiday before an auto-fill still pays holiday hours afterwards.
  {
    const p = periodFor(fromYmd("2026-06-20"));
    const fill = { "2026-06-17": { ...blankDay(), am7: true, pm3: true } };
    const merged = mergePeriodFill(
      { "2026-06-17": { holiday: true } },
      p,
      fill,
      false,
    );
    assert.strictEqual(merged["2026-06-17"].holiday, true);
    const r = aggregate(
      merged,
      p,
      "basic",
      "S",
      {},
      { monthly: 173330 },
      DEFAULT_RATES,
    );
    assert.strictEqual(r.holidayHours, 7); // 3PM is the 2nd shift
  }
  assert.deepStrictEqual(kept.z, { am7: true });
  assert.deepStrictEqual(fillDays(logged, fill, false).a, { am7: true });
  assert.deepStrictEqual(logged.a, { pm3: true }); // input not mutated

  // rateEntryAt agrees with ratesAt, and is null before the first entry.
  const hist = [
    { effectiveFrom: "2026-04-01", rates: { sp1: 1 } },
    { effectiveFrom: "2026-06-01", rates: { sp1: 2 } },
  ];
  const may = periodFor(fromYmd("2026-05-20"));
  assert.strictEqual(rateEntryAt(may, hist).rates.sp1, 1);
  assert.strictEqual(rateEntryAt(periodFor(fromYmd("2026-02-20")), hist), null);
  assert.strictEqual(rateEntryAt(may, []), null);

  // Templates: a day holding only a holiday override isn't the weekday's
  // pattern; the next one with shifts is.
  const tp = periodFor(fromYmd("2026-05-20")); // May 16 (Sat) – Jun 15
  const tdays = extractTemplateFromWeek(
    {
      "2026-05-18": { holiday: true }, // Monday, no shifts
      "2026-05-25": { am7: true, dist: { am7: "L" } }, // next Monday
    },
    tp,
  );
  assert.ok(tdays[1].am7);
  assert.strictEqual(Object.keys(tdays).length, 1);
  const applied = applyTemplate({ days: tdays }, tp);
  assert.ok(applied["2026-05-18"].am7 && applied["2026-06-15"].am7);
  assert.strictEqual(applied["2026-05-18"].dist.am7, "L");
  assert.strictEqual(Object.keys(applied).length, 5); // 5 Mondays

  // ICS declares the timezone its events use.
  const ics = toICS({ [PLAIN]: { pm10: true } });
  assert.ok(/BEGIN:VTIMEZONE\r\nTZID:America\/Jamaica/.test(ics));
  assert.ok(/TZOFFSETTO:-0500/.test(ics));
  assert.ok(/DTEND;TZID=America\/Jamaica:20260521T070000/.test(ics));
}

// ----- Crew -----
{
  const H = require("./helpers.jsx");
  const p = periodFor(fromYmd("2026-05-20")); // May 16 – Jun 15
  const crewEntries = rotationEntries(p, "2026-05-16", "S");
  const solo = (m) =>
    aggregate(
      H.memberEntries(crewEntries, m),
      p,
      "basic",
      m.dist,
      null,
      m.basePay,
      DEFAULT_RATES,
    );

  // With no days of their own, a member is paid exactly as the crew calendar
  // logged as their own (same engine, Short/Long per person).
  const a = { ...H.newMember("A. Brown", "200"), dist: "L" };
  a.basePay = { monthly: "180000", compulsory: "5000" };
  const ta = H.memberTotals(crewEntries, a, p, DEFAULT_RATES);
  assert.strictEqual(
    ta.grand,
    aggregate(crewEntries, p, "basic", "L", null, a.basePay, DEFAULT_RATES)
      .grand,
  );
  assert.strictEqual(ta.basicDistance, "L");

  // A leave day replaces the crew's day; a null day removes it (not worked).
  const crewDay = crewEntries["2026-05-17"]; // 3PM
  assert.ok(crewDay.pm3);
  const leave = { ...crewDay, duty: { pm3: "vacation" } };
  const b = H.setMemberDay(crewEntries, H.newMember("B"), "2026-05-17", leave);
  assert.deepStrictEqual(Object.keys(b.days), ["2026-05-17"]);
  const tb = solo(b);
  assert.strictEqual(tb.cal.pm3, ta.cal.pm3 - 1);
  assert.strictEqual(tb.leaveShifts, 1);
  assert.strictEqual(tb.totalHours, ta.totalHours); // leave hours still count
  const off = H.setMemberDay(crewEntries, b, "2026-05-17", blankDay());
  assert.strictEqual(off.days["2026-05-17"], null);
  assert.strictEqual(
    H.memberEntries(crewEntries, off)["2026-05-17"],
    undefined,
  );
  assert.strictEqual(solo(off).totalHours, ta.totalHours - 7);
  // Setting the day back to the crew's drops the override.
  const back = H.setMemberDay(crewEntries, off, "2026-05-17", {
    ...crewDay,
    dist: { am7: "L", pm3: "L", pm10: "L" },
  });
  assert.deepStrictEqual(back.days, {});
  // Clearing a day the crew doesn't work leaves no override behind.
  const restDay = "2026-05-19"; // off in the rotation
  assert.ok(!crewEntries[restDay]);
  assert.deepStrictEqual(
    H.setMemberDay(crewEntries, back, restDay, blankDay()).days,
    {},
  );
  // An extra shift on an off day is theirs alone.
  const extra = H.setMemberDay(crewEntries, back, restDay, {
    ...blankDay(),
    pm10: true,
  });
  assert.strictEqual(solo(extra).cal.pm10, ta.cal.pm10 + 1);
  assert.deepStrictEqual(H.memberDiffKeys(extra, p), [restDay]);
  assert.deepStrictEqual(
    H.memberDiffKeys(extra, periodFor(fromYmd("2026-07-01"))),
    [],
  );

  // sameEntry ignores distance and blank hours, not duty or real hours.
  assert.ok(H.sameEntry({ pm3: true }, { pm3: true, hours: { pm3: "" } }));
  assert.ok(!H.sameEntry({ pm3: true }, { pm3: true, hours: { pm3: "3" } }));
  assert.ok(!H.sameEntry({ pm3: true }, leave));
  assert.ok(!H.sameEntry({ pm3: true }, { pm3: true, holiday: true }));

  // Sorting: by name, or by employee number in natural order, blanks last.
  const ms = [
    { id: "1", name: "Cole", empNo: "10" },
    { id: "2", name: "adams", empNo: "9" },
    { id: "3", name: "Baker", empNo: "" },
  ];
  assert.deepStrictEqual(
    H.sortMembers(ms, "name").map((m) => m.id),
    ["2", "3", "1"],
  );
  assert.deepStrictEqual(
    H.sortMembers(ms, "empNo").map((m) => m.id),
    ["2", "1", "3"],
  );
  assert.strictEqual(ms[0].id, "1"); // input not reordered

  // Storage and backups: only the expected shape gets through.
  assert.strictEqual(H.sanitizeCrew(null), null);
  assert.strictEqual(H.sanitizeCrew([]), null);
  const clean = H.sanitizeCrew({
    entries: {
      "2026-05-16": { am7: true },
      junk: { pm3: true },
      "2026-05-17": 5,
    },
    members: [
      {
        id: "x",
        name: "N",
        empNo: 12,
        basePay: { monthly: "1,000" },
        dist: "Z",
        days: { "2026-05-16": null, bad: null },
      },
      { id: "x", name: "Dup id" },
      "nope",
    ],
    rotationAnchor: "soon",
    sortBy: "empNo",
  });
  assert.deepStrictEqual(Object.keys(clean.entries), ["2026-05-16"]);
  assert.strictEqual(clean.members.length, 2);
  assert.notStrictEqual(clean.members[0].id, clean.members[1].id);
  assert.strictEqual(clean.members[0].empNo, "12");
  assert.strictEqual(clean.members[0].basePay.monthly, "1000");
  assert.strictEqual(clean.members[0].dist, "S");
  assert.deepStrictEqual(clean.members[0].days, { "2026-05-16": null });
  assert.strictEqual(clean.rotationAnchor, null);
  assert.strictEqual(clean.sortBy, "empNo");
  assert.deepStrictEqual(H.sanitizeCrew(H.blankCrew()), H.blankCrew());

  // Copying someone's day to the crew keeps shifts and holiday, not their
  // leave or short hours.
  const copied = H.crewDayFrom({
    pm3: true,
    holiday: false,
    duty: { pm3: "sick" },
    hours: { pm3: "2" },
  });
  assert.ok(copied.pm3 && copied.holiday === false);
  assert.strictEqual(copied.duty, undefined);
  assert.strictEqual(copied.hours, undefined);
  assert.strictEqual(H.crewDayFrom(undefined), null);

  // Reports: one CSV row per person in the crew's order, plain numbers, and
  // a name that looks like a formula is never run by a spreadsheet.
  const crew = {
    entries: crewEntries,
    members: [
      { ...a, name: '=HYPERLINK("x")' },
      { ...H.newMember("Lee, K.", "100") },
    ],
    sortBy: "empNo",
  };
  const rows = H.crewRows(crew, p, DEFAULT_RATES, DEFAULT_TAX);
  assert.deepStrictEqual(
    rows.map((r) => r.member.empNo),
    ["100", "200"],
  );
  assert.strictEqual(rows[0].net, null); // no monthly basic: no net
  assert.ok(rows[1].net > 0 && rows[1].net < rows[1].totals.grand);
  const csv = H.crewCsv(rows, "May 16 – Jun 15, 2026").split("\r\n");
  assert.strictEqual(csv.length, 4); // header, 2 people, trailing newline
  assert.ok(csv[1].includes('"Lee, K."'));
  assert.ok(csv[2].includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(csv[2].includes(rows[1].totals.grand.toFixed(2)));
  assert.ok(!/\$/.test(csv.join("")));
  const txt = H.crewText(rows, "May 16 – Jun 15, 2026");
  assert.ok(txt.includes("2 people"));
  assert.ok(txt.includes("Lee, K. · #100"));
  assert.ok(
    txt.includes(fmt(rows[0].totals.grand + rows[1].totals.grand)),
    "crew gross is the sum of everyone's",
  );
}

// ----- Crew record sheets and History -----
{
  const H = require("./helpers.jsx");
  const D = require("./crewdoc.jsx");
  const p = periodFor(fromYmd("2026-06-20")); // Jun 16 – Jul 15
  const crew = H.blankCrew();
  crew.watch = "D WATCH";
  crew.station = "Port Antonio";
  crew.rotationAnchor = "2026-06-19";
  crew.entries = rotationEntries(p, "2026-06-19", "S");
  const a = {
    ...H.newMember("Lloyd <Johnson> & Co", "87004"),
    rank: "A/Asst Supt",
  };
  a.days["2026-07-01"] = {
    ...crew.entries["2026-07-01"],
    duty: { am7: "departmental" },
  };
  a.days["2026-07-03"] = {
    ...crew.entries["2026-07-03"],
    duty: { pm10: "exchangeLeave" },
  };
  a.days["2026-07-04"] = {
    ...blankDay(),
    pm10: true,
    duty: { pm10: "exchangeFor" },
  };
  crew.members = [a, H.newMember("Roydel Weir", "02176")];

  // The sheet: rotation shifts are regular time, one 4-day cycle per column
  // (the cycle holding Jun 16 started on the 15th), dated d/m/yy with codes.
  const sheet = H.shiftSheet(
    H.memberEntries(crew.entries, a),
    p,
    crew.rotationAnchor,
  );
  assert.deepStrictEqual(sheet.regular.pm3[0], {
    d: "16/6/26",
    code: "",
    col: 0,
  });
  assert.deepStrictEqual(sheet.regular.am7[0], {
    d: "19/6/26",
    code: "",
    col: 1,
  });
  assert.ok(
    sheet.regular.am7.some(
      (x) => x.d === "1/7/26" && x.code === "D/L" && x.col === 4,
    ),
  );
  assert.ok(
    sheet.regular.pm10.some((x) => x.d === "3/7/26" && x.code === "Exc"),
  );
  // A shift outside the rotation is overtime, in its cycle's column.
  assert.deepStrictEqual(sheet.overtime.pm10, [
    { d: "4/7/26", code: "Exc", col: 4 },
  ]);
  assert.strictEqual(sheet.regular.pm10.slice(-1)[0].d, "15/7/26");
  // No rotation: everything is regular time, in date order.
  const flat = H.shiftSheet(H.memberEntries(crew.entries, a), p, null);
  assert.strictEqual(flat.overtime.pm10.length, 0);
  assert.strictEqual(flat.regular.pm10.length, sheet.regular.pm10.length + 1);
  assert.strictEqual(flat.regular.pm10[0].col, undefined);
  assert.strictEqual(H.periodLong(p), "June 16, 2026 - July 15, 2026");

  // A crew save keeps what History and the Word sheets need, survives a
  // storage round trip, and its signature changes with the crew.
  const snap = H.crewSnapshot(crew, p, DEFAULT_RATES, DEFAULT_TAX);
  assert.strictEqual(snap.periodKey, "2026-06-16");
  assert.strictEqual(snap.rows.length, 2);
  assert.strictEqual(snap.rows[0].member.rank, "A/Asst Supt");
  assert.strictEqual(snap.rows[0].totals.dayHours, undefined);
  assert.strictEqual(snap.rows[0].member.days, undefined);
  const stored = H.sanitizeCrewHistory(
    JSON.parse(JSON.stringify([snap, { periodKey: "nope" }, null])),
  );
  assert.strictEqual(stored.length, 1);
  assert.strictEqual(H.crewSnapSig(stored[0]), H.crewSnapSig(snap));
  assert.deepStrictEqual(H.sanitizeCrewHistory("x"), []);
  const moved = { ...crew, members: [{ ...a, days: {} }, crew.members[1]] };
  assert.notStrictEqual(
    H.crewSnapSig(H.crewSnapshot(moved, p, DEFAULT_RATES, DEFAULT_TAX)),
    H.crewSnapSig(snap),
  );
  assert.strictEqual(
    H.crewSnapSig(H.crewSnapshot(crew, p, DEFAULT_RATES, DEFAULT_TAX)),
    H.crewSnapSig(snap),
  );
  // A tax change moves only Est. net; the save must read as changed.
  assert.notStrictEqual(
    H.crewSnapSig(
      H.crewSnapshot(
        {
          ...crew,
          members: crew.members.map((m) => ({
            ...m,
            basePay: { monthly: "150000", compulsory: "" },
          })),
        },
        p,
        DEFAULT_RATES,
        { ...DEFAULT_TAX, pension: 5 },
      ),
    ),
    H.crewSnapSig(
      H.crewSnapshot(
        {
          ...crew,
          members: crew.members.map((m) => ({
            ...m,
            basePay: { monthly: "150000", compulsory: "" },
          })),
        },
        p,
        DEFAULT_RATES,
        DEFAULT_TAX,
      ),
    ),
  );
  // Imports: one save per period (the latest), each with its own `at`, and
  // totals keep only numbers.
  const raw = JSON.parse(JSON.stringify(snap));
  delete raw.at;
  raw.rows[0].totals.sp1 = "abc";
  raw.rows[0].totals.cal.am7 = {};
  const twice = H.sanitizeCrewHistory([
    raw,
    { ...raw, periodKey: "2026-05-16" },
    { ...raw, periodKey: "2026-05-16", at: "2026-06-01T00:00:00.000Z" },
  ]);
  assert.strictEqual(twice.length, 2);
  assert.strictEqual(new Set(twice.map((x) => x.at)).size, 2);
  assert.ok(!Number.isNaN(new Date(twice[0].at).getTime()));
  assert.strictEqual(
    twice.find((x) => x.periodKey === "2026-05-16").at,
    "2026-06-01T00:00:00.000Z",
  );
  assert.strictEqual(twice[0].rows[0].totals.sp1, undefined);
  assert.strictEqual(twice[0].rows[0].totals.cal.am7, undefined);
  assert.ok(!H.crewCsv(twice[0].rows, "p").includes("object"));
  // Rank, watch and station come through sanitizeCrew.
  const kept = H.sanitizeCrew(JSON.parse(JSON.stringify(crew)));
  assert.strictEqual(kept.watch, "D WATCH");
  assert.strictEqual(kept.members[0].rank, "A/Asst Supt");

  // The .docx: a valid stored ZIP (CRC checked) with the five parts Word
  // needs, one page per person, text escaped.
  assert.strictEqual(D.crc32(Buffer.from("123456789")), 0xcbf43926);
  const bytes = Buffer.from(D.crewDocx(snap));
  const files = {};
  const eocd = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let at = bytes.readUInt32LE(eocd + 16);
  for (let i = 0; i < bytes.readUInt16LE(eocd + 10); i++) {
    assert.strictEqual(bytes.readUInt32LE(at), 0x02014b50);
    const size = bytes.readUInt32LE(at + 20);
    const nameLen = bytes.readUInt16LE(at + 28);
    const name = bytes.toString("utf8", at + 46, at + 46 + nameLen);
    const local = bytes.readUInt32LE(at + 42);
    const start = local + 30 + bytes.readUInt16LE(local + 26);
    const data = bytes.subarray(start, start + size);
    assert.strictEqual(D.crc32(data), bytes.readUInt32LE(at + 16), name);
    files[name] = data.toString("utf8");
    at += 46 + nameLen;
  }
  assert.deepStrictEqual(Object.keys(files).sort(), [
    "[Content_Types].xml",
    "_rels/.rels",
    "word/_rels/document.xml.rels",
    "word/document.xml",
    "word/styles.xml",
  ]);
  const doc = files["word/document.xml"];
  assert.strictEqual((doc.match(/<w:pageBreakBefore\/>/g) || []).length, 1);
  assert.ok(doc.includes("Lloyd &lt;Johnson&gt; &amp; Co"));
  assert.ok(doc.includes("T&amp;H:") && !/T&H/.test(doc));
  assert.ok(doc.includes("Period: June 16, 2026 - July 15, 2026"));
  assert.ok(doc.includes(">D WATCH<") && doc.includes(">Port Antonio<"));
  assert.ok(doc.includes('w:h="20160"')); // legal paper
  assert.strictEqual(
    D.crewDocxName(snap),
    "D-WATCH-record-sheets-2026-06-16.docx",
  );
  assert.strictEqual(
    D.crewDocxName({ ...snap, watch: "" }),
    "crew-record-sheets-2026-06-16.docx",
  );
  // Every date box row has its 7 boxes, however many dates there are.
  const many = {
    ...snap.rows[0],
    sheet: {
      regular: {
        am7: Array.from({ length: 20 }, (_, i) => ({
          d: `${i + 1}/6/26`,
          code: "",
        })),
      },
      overtime: {},
    },
  };
  assert.ok(D.documentXml({ ...snap, rows: [many] }).includes("20/6/26"));
}

// ----- Service worker -----
let swChecks = Promise.resolve();
// Offline start needs every file index.html loads to be precached, and the
// precache list must only name files that exist (a typo is a silent miss).
{
  const fs = require("fs");
  const path = require("path");
  const vm = require("vm");
  const swSrc = fs.readFileSync(path.join(__dirname, "sw.js"), "utf8");
  const assets = JSON.parse(
    swSrc.match(/const ASSETS = (\[[\s\S]*?\]);/)[1].replace(/,\s*\]/, "]"),
  );
  for (const a of assets) {
    if (a === "./") continue;
    assert.ok(
      fs.existsSync(path.join(__dirname, a)),
      `sw.js precaches missing file ${a}`,
    );
  }
  const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  const local = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((u) => !/^https?:/.test(u));
  for (const u of local) {
    assert.ok(
      assets.includes("./" + u.replace(/^\.\//, "")),
      `index.html loads ${u} but sw.js doesn't precache it`,
    );
  }

  // The app shell is network-first. A failed response (404/5xx during a
  // deploy) must not replace the cached index.html, or the next offline start
  // opens an error page instead of the app.
  const handlers = {};
  const puts = [];
  const cache = {
    put: (k, v) => {
      puts.push([k, v]);
      return Promise.resolve();
    },
  };
  const ctx = {
    self: {
      addEventListener: (t, fn) => {
        handlers[t] = fn;
      },
      location: { origin: "https://x.test" },
    },
    caches: {
      open: () => Promise.resolve(cache),
      match: () => Promise.resolve(undefined),
    },
    URL,
    Promise,
    fetch: null,
  };
  vm.runInNewContext(swSrc, ctx);
  const navigate = async (status) => {
    puts.length = 0;
    ctx.fetch = () =>
      Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        clone() {
          return this;
        },
      });
    let responded;
    handlers.fetch({
      request: { method: "GET", url: "https://x.test/night-shift-calculator/" },
      respondWith: (p) => {
        responded = p;
      },
    });
    await responded;
    await new Promise((r) => setTimeout(r, 0));
    return puts.length;
  };
  swChecks = (async () => {
    assert.strictEqual(await navigate(200), 1, "a good index.html is cached");
    assert.strictEqual(
      await navigate(404),
      0,
      "a 404 index.html is not cached",
    );
    assert.strictEqual(
      await navigate(503),
      0,
      "a 503 index.html is not cached",
    );
  })();
}

swChecks.then(
  () => console.log("calc tests passed"),
  (err) => {
    console.error(err);
    process.exitCode = 1;
  },
);
