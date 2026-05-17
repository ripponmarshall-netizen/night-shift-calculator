(function (window) {
  'use strict';

  /**
   * Compute estimated net monthly pay using statutory deductions.
   * @param {number} grossMonthly
   * @param {number} nonTaxableMonthly
   * @param {object} tax
   * @returns {{netMonthly:number,payeMonthly:number,nisMonthly:number,nhtMonthly:number,eduTaxMonthly:number}}
   */
  function computeEstimatedNetPay(grossMonthly, nonTaxableMonthly, tax) {
    const gross = Math.max(0, grossMonthly);
    const nonTaxable = Math.max(0, nonTaxableMonthly || 0);
    const taxableGross = Math.max(0, gross - nonTaxable);
    const nisMonthlyCap = tax.NIS_ANNUAL_CAP / 12;
    const nisMonthly = Math.min(taxableGross, nisMonthlyCap) * tax.NIS_RATE;
    const nhtMonthly = taxableGross * tax.NHT_RATE;
    const eduTaxMonthly = taxableGross * tax.EDU_TAX_RATE;
    const chargeableIncome = Math.max(0, taxableGross - tax.PAYE_THRESHOLD_MONTHLY - nisMonthly - nhtMonthly - eduTaxMonthly);
    const lowerBand = Math.min(chargeableIncome, tax.PAYE_BAND_LIMIT_MONTHLY);
    const upperBand = Math.max(0, chargeableIncome - tax.PAYE_BAND_LIMIT_MONTHLY);
    const payeMonthly = (lowerBand * tax.PAYE_RATE_LOWER) + (upperBand * tax.PAYE_RATE_UPPER);
    const netMonthly = gross - nisMonthly - nhtMonthly - eduTaxMonthly - payeMonthly;
    return {
      netMonthly: round2(netMonthly),
      payeMonthly: round2(payeMonthly),
      nisMonthly: round2(nisMonthly),
      nhtMonthly: round2(nhtMonthly),
      eduTaxMonthly: round2(eduTaxMonthly)
    };
  }

  /**
   * Compute allowances from pre-counted shift values.
   * @param {{sp1Count:number,sp2Count:number,mealCount:number,shortTaxiUnits:number,longTaxiUnits:number}} counts
   * @param {{SP1_RATE:number,SP2_RATE:number,MEAL_RATE:number,TAXI_SHORT:number,TAXI_LONG:number}} rates
   */
  function computeAllowanceFromCounts(counts, rates) {
    const rSP1 = round2(counts.sp1Count * rates.SP1_RATE);
    const rSP2 = round2(counts.sp2Count * rates.SP2_RATE);
    const rMeal = round2(counts.mealCount * rates.MEAL_RATE);
    const rTaxi = round2((counts.shortTaxiUnits * rates.TAXI_SHORT) + (counts.longTaxiUnits * rates.TAXI_LONG));
    return {
      rSP1: rSP1,
      rSP2: rSP2,
      rMeal: rMeal,
      rTaxi: rTaxi,
      total: round2(rSP1 + rSP2 + rMeal + rTaxi)
    };
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  window.NSCalcEngine = {
    computeEstimatedNetPay: computeEstimatedNetPay,
    computeAllowanceFromCounts: computeAllowanceFromCounts
  };
})(window);
