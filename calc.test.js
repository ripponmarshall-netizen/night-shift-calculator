const assert = require("assert");
const {
  aggregate,
  calcTax,
  DEFAULT_TAX,
  summaryText,
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
holNear(r.holidayHours, 2 * 6 / 9);
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

// summaryText: tidy breakdown with a Total line; Est. net only when provided;
// never emits NaN/undefined.
const stTotals = agg2(oneShift, GUARD_RATES, {
  monthly: 173330,
  compulsory: 0,
});
const stWithNet = summaryText(stTotals, "May 16 – Jun 15, 2026", 150000);
assert.ok(stWithNet.includes("TOTAL (est. gross)"));
assert.ok(stWithNet.includes("Est. net"));
assert.ok(!/NaN|undefined/.test(stWithNet));
const stNoNet = summaryText(stTotals, "May 16 – Jun 15, 2026");
assert.ok(!stNoNet.includes("Est. net"));

console.log("calc tests passed");
