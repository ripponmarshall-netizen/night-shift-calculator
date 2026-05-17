const assert = require('assert');

function round2(n){ return Math.round(n*100)/100; }

function validateBasic(all3, all10, extra10After3){
  return extra10After3 <= Math.min(all3, all10);
}

function computeBasic(all3, all10, extra10After3){
  const SP1=66.6, SP2=200, MEAL=950, TAXI=950;
  return round2(all3*SP1 + all10*SP2 + (all3+all10)*MEAL + Math.max(0, all3+all10-extra10After3*2)*TAXI);
}

function computeEstimatedNetPay(grossMonthly){
  const PAYE_THRESHOLD_MONTHLY = 1902360 / 12;
  const PAYE_BAND_LIMIT_MONTHLY = 6000000 / 12;
  const PAYE_RATE_LOWER = 0.25;
  const PAYE_RATE_UPPER = 0.30;
  const NIS_RATE = 0.03;
  const NIS_ANNUAL_CAP = 5000000;
  const NHT_RATE = 0.02;
  const EDU_TAX_RATE = 0.0225;
  const gross = Math.max(0, grossMonthly);
  const nisMonthlyCap = NIS_ANNUAL_CAP / 12;
  const nisMonthly = Math.min(gross, nisMonthlyCap) * NIS_RATE;
  const nhtMonthly = gross * NHT_RATE;
  const eduTaxMonthly = gross * EDU_TAX_RATE;
  const chargeableIncome = Math.max(0, gross - PAYE_THRESHOLD_MONTHLY - nisMonthly - nhtMonthly - eduTaxMonthly);
  const lowerBand = Math.min(chargeableIncome, PAYE_BAND_LIMIT_MONTHLY);
  const upperBand = Math.max(0, chargeableIncome - PAYE_BAND_LIMIT_MONTHLY);
  const payeMonthly = (lowerBand * PAYE_RATE_LOWER) + (upperBand * PAYE_RATE_UPPER);
  return round2(gross - nisMonthly - nhtMonthly - eduTaxMonthly - payeMonthly);
}

// Existing sanity checks
assert.strictEqual(computeBasic(0,0,0),0);
assert.strictEqual(computeBasic(1,1,0),4066.6);
assert.strictEqual(computeBasic(2,2,2),4333.2);
assert.strictEqual(validateBasic(3,2,2), true);
assert.strictEqual(validateBasic(3,2,3), false);
assert.strictEqual(computeEstimatedNetPay(0),0);
assert.strictEqual(computeEstimatedNetPay(50000),46375);
assert.strictEqual(computeEstimatedNetPay(200000),178757.5);
assert.strictEqual(computeEstimatedNetPay(800000),600009);

// Upgrade-plan section 2: test coverage expansion for allowance combinations
assert.strictEqual(computeBasic(3,0,0),5899.8); // SP1-only
assert.strictEqual(computeBasic(0,4,0),8400);   // SP2-only
assert.strictEqual(computeBasic(5,5,3),14633);  // mixed shifts + reduced taxi trips
assert.strictEqual(computeBasic(7,2,0),17966.2);
assert.strictEqual(computeBasic(7,2,2),14166.2);

// edge cases: zero counts and extra10After3 values beyond effective taxi reduction range
assert.strictEqual(computeBasic(0,5,0),10500);
assert.strictEqual(computeBasic(5,0,0),9833);
assert.strictEqual(computeBasic(1,1,8),2166.6); // taxi floor at zero, never negative

// validation boundaries
assert.strictEqual(validateBasic(0,0,0), true);
assert.strictEqual(validateBasic(1,0,0), true);
assert.strictEqual(validateBasic(1,0,1), false);

// PAYE band threshold boundary checks
const PAYE_BAND_LIMIT_MONTHLY = 6000000 / 12;
const PAYE_THRESHOLD_MONTHLY = 1902360 / 12;
const NIS_RATE = 0.03;
const NHT_RATE = 0.02;
const EDU_TAX_RATE = 0.0225;
const taxableDeductionRate = NIS_RATE + NHT_RATE + EDU_TAX_RATE;
const grossAtUpperBandStart = (PAYE_THRESHOLD_MONTHLY + PAYE_BAND_LIMIT_MONTHLY) / (1 - taxableDeductionRate);

const netAtUpperBandStart = computeEstimatedNetPay(grossAtUpperBandStart);
const netAboveUpperBandStart = computeEstimatedNetPay(grossAtUpperBandStart + 1000);
assert.ok(netAboveUpperBandStart > netAtUpperBandStart);

console.log('calc tests passed');
