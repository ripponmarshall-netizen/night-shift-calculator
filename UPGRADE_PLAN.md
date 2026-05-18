# Upgrade Plan (May 17, 2026)

This plan prioritizes low-risk upgrades that improve maintainability, correctness confidence, and release safety for the Night Shift Calculator.

## 1) Tooling and quality baseline (High priority)

1. Add an npm-based workflow with:
   - `npm run test` for existing unit tests (`calc.test.js`)
   - `npm run lint` (ESLint)
   - `npm run format:check` (Prettier)
2. Keep `./check.sh` as a lightweight release gate, but integrate it into CI.
3. Add a CI workflow (GitHub Actions) to run checks on push/PR.

**Outcome:** faster feedback and fewer manual regressions.

## 2) Test coverage expansion (High priority)

1. Expand tests around core allowance calculations:
   - SP1/SP2/Meal/Taxi combinations
   - edge cases for zero counts and mixed-distance assignments
2. Add tests for pay-period transitions (16th→15th boundary logic).
3. Add tests for holiday and overtime calculations, including threshold boundaries.

**Outcome:** safer future rate changes and logic refactors.

## 3) Configuration-driven rates and policy data (High priority)

1. Move hard-coded rates/effective date from app logic into a dedicated config object/file.
2. Centralize policy constants (thresholds, multipliers) and surface effective date in one canonical place.
3. Add a small validation guard at startup to catch malformed rate values.

**Outcome:** rate updates become quicker and less error-prone.

## 4) App structure and maintainability refactor (Medium priority)

1. Split `app.js` into modules by responsibility (calculation engine, calendar state, persistence, UI rendering).
2. Keep pure calculation functions side-effect free and exportable for tests.
3. Add lightweight JSDoc comments for key public functions.

**Outcome:** easier onboarding and cleaner change isolation.

## 5) PWA hardening and release hygiene (Medium priority)

1. Standardize cache-bump process by introducing a single `APP_VERSION` constant consumed by service worker cache naming.
2. Add a short manual QA checklist for offline mode and installability.
3. Verify icons/manifest metadata consistency (sizes, names, start URL).

**Outcome:** fewer stale-cache and install issues across releases.

## 6) UX and data-safety improvements (Medium priority)

1. Add import validation with user-friendly errors for malformed JSON snapshots.
2. Add a "last saved" timestamp in UI for user confidence.
3. Add optional confirmation prompts for destructive actions (reset/overwrite import).

**Outcome:** reduced accidental data loss and clearer user state.

## 7) Security and robustness sweep (Low-medium priority)

1. Audit DOM update paths to ensure untrusted input is never injected as HTML.
2. Add defensive parsing and numeric bounds checks for all persisted inputs.
3. Add a simple recovery path when localStorage is unavailable or corrupt.

**Outcome:** more resilient behavior under unexpected browser/device conditions.

---

## Suggested implementation order

1. Tooling + CI
2. Test coverage expansion
3. Config-driven rates/policy extraction
4. Modularization pass
5. PWA release hardening
6. UX/data-safety polish
7. Security robustness sweep

## Definition of done for first upgrade cycle

- CI green on push/PR
- `./check.sh` + unit tests pass consistently
- Rate/effective-date updates performed in one place
- No regression in core allowance totals for baseline scenarios

## Phase 1 completion status

**Status:** Completed on May 17, 2026.

Validated against phase-one goals:

- npm workflow exists with `npm test`, `npm run lint`, and `npm run format:check`.
- `./check.sh` remains as release gate and is included in CI.
- GitHub Actions CI (`.github/workflows/ci.yml`) runs lint, format check, unit tests, and `./check.sh` on push/PR.
- Rate and effective date are centralized in policy/config and surfaced in UI.
- Baseline checks pass locally (`npm run lint`, `npm run format:check`, `npm test`, `./check.sh`).

## Phase 2 verification status (Test coverage expansion)

**Status:** Not complete as of May 17, 2026.

Verification against phase-two goals:

- ✅ Allowance combination coverage exists in `calc.test.js` (SP1/SP2 mixed scenarios and taxi-reduction combinations).
- ✅ Edge cases around zero counts and taxi-floor behavior are covered in `calc.test.js`.
- ❌ Pay-period transition tests for 16th→15th boundary logic are not present.
- ❌ Holiday/overtime calculation tests (including 173.33-hour threshold boundary cases) are not present in automated tests.

Conclusion: phase two has started, but completion criteria are not yet met.

## Note on external planning context

A Perplexity shared session link was provided for planning context, but its content is not directly accessible from this environment. This plan is therefore based on repository audit and existing project documentation.

## Phase 3 verification status (Configuration-driven rates and policy data)

**Status:** Completed on May 18, 2026.

Verification against phase-three goals:

- ✅ Rates and effective date are centralized in `rates-config.js` under a single `policy` object (`policy.rates` + `policy.effectiveDate`) and consumed via `window.NS_POLICY`.
- ✅ Policy thresholds and multipliers are centralized in `rates-config.js` (`policy.thresholds`) and consumed from `app.js` through `THRESHOLDS`.
- ✅ Startup validation guard exists in `rates-config.js` (`validatePolicyConfig` + `assertFiniteNumber`) and runs immediately before exposing policy globally.

Conclusion: phase three completion criteria are met.

## Phase 4 verification status (App structure and maintainability refactor)

**Status:** Completed on May 18, 2026.

Verification against phase-four goals:

- ✅ App responsibilities are split into focused modules: calculation logic in `calculation-engine.js`, UI helpers in `ui-utils.js`, persistence helpers in `storage-utils.js`, and calendar/date helpers in `calendar-utils.js`, with `app.js` consuming these modules.
- ✅ Pure utility functions remain side-effect free and are exported through `window` namespaces for reuse and testing (`window.NSUIUtils`, `window.NSStorage`, `window.NSCalendarUtils`).
- ✅ Lightweight JSDoc comments were added for key public helper functions in the new modules.

Conclusion: phase four completion criteria are met.
