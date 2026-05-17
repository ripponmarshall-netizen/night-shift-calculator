(function () {
  const RATE_KEYS = [
    "SP1_RATE",
    "SP2_RATE",
    "MEAL_RATE",
    "TAXI_SHORT",
    "TAXI_LONG",
  ];
  const THRESHOLD_KEYS = [
    "HOURS_THRESHOLD",
    "HOLIDAY_MULT",
    "OVERTIME_MULT",
    "PAYE_THRESHOLD_MONTHLY",
    "PAYE_BAND_LIMIT_MONTHLY",
    "PAYE_RATE_LOWER",
    "PAYE_RATE_UPPER",
    "NIS_RATE",
    "NIS_ANNUAL_CAP",
    "NHT_RATE",
    "EDU_TAX_RATE",
  ];

  const policy = {
    effectiveDate: "2026-05-10",
    rates: {
      SP1_RATE: 66.6,
      SP2_RATE: 200,
      MEAL_RATE: 950,
      TAXI_SHORT: 950,
      TAXI_LONG: 2000,
    },
    thresholds: {
      HOURS_THRESHOLD: 173.33,
      HOLIDAY_MULT: 2,
      OVERTIME_MULT: 1.5,
      PAYE_THRESHOLD_MONTHLY: 1902360 / 12,
      PAYE_BAND_LIMIT_MONTHLY: 6000000 / 12,
      PAYE_RATE_LOWER: 0.25,
      PAYE_RATE_UPPER: 0.3,
      NIS_RATE: 0.03,
      NIS_ANNUAL_CAP: 5000000,
      NHT_RATE: 0.02,
      EDU_TAX_RATE: 0.0225,
    },
  };

  function assertFiniteNumber(obj, key) {
    if (typeof obj[key] !== "number" || !Number.isFinite(obj[key])) {
      throw new Error("Invalid policy value for " + key);
    }
  }

  function validatePolicyConfig(config) {
    if (!config || !config.rates || !config.thresholds) {
      throw new Error("Invalid policy config structure");
    }
    RATE_KEYS.forEach(function (key) {
      assertFiniteNumber(config.rates, key);
    });
    THRESHOLD_KEYS.forEach(function (key) {
      assertFiniteNumber(config.thresholds, key);
    });
    if (
      typeof config.effectiveDate !== "string" ||
      !config.effectiveDate.trim()
    ) {
      throw new Error("Invalid policy effectiveDate");
    }
  }

  validatePolicyConfig(policy);
  window.NS_POLICY = policy;
})();
