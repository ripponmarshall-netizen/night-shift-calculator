# WCO JFB Night Shift Calculator

Calculating night shifts means keeping track of multiple allowances across different shift types, distances, and schedules — and doing that mental arithmetic at the end of a long period is tedious and error-prone.

The **WCO JFB Night Shift Calculator** is a tool built by L/Cpl. R. Marshall for the Portland Division and any other JFB personnel to calculate their night shift allowances quickly and accurately. Instead of manually tallying up your SP1, SP2, Meal, and Taxi allowance, you log your shifts on the calendar and the app does the rest — giving you a clear breakdown, a live running total, snapshot history, and reconciliation against your pay slip.

---

## What It Calculates

- **SP1** — your 3PM shift allowance
- **SP2** — your 10PM shift allowance
- **Meal** — meal allowance based on shifts worked
- **Taxi** — transport allowance based on distance and shift count (with same-day 3PM+10PM auto-deduction)
- **Base pay** — Monthly Basic + Compulsory Assignment
- **Extra hours** — overtime over the 173.33h threshold (×1.5) and holiday pay (×2)
- **Estimated net** — JM tax model (NIS, NHT, Education Tax, PAYE bands, optional pension)

---

## App Architecture

The app is a single-page PWA. UI is built with React 18 + Babel-standalone loaded from CDN, so there is no build step — every `.jsx` file is fetched directly by the browser and transpiled in place.

| File             | Purpose                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `index.html`     | App shell, script loaders, service-worker registration                                                                       |
| `styles.css`     | Theme tokens (dark + light), typography, base reset                                                                          |
| `helpers.jsx`    | Date utilities, JM holidays (Easter computus), aggregate engine, JM tax model, rate history, templates, iCal export, storage |
| `components.jsx` | Shared primitives (Card, SectionHead, SegToggle, button styles, AnimatedNumber)                                              |
| `modals.jsx`     | Day editor, Settings (rates/tax/past rates/theme/backup), Autofill rotation, Onboarding banner                               |
| `templates.jsx`  | Saved-week templates (save / apply / delete)                                                                                 |
| `calendar.jsx`   | Period calendar with shift bands, long-press copy/paste, holiday chips                                                       |
| `summary.jsx`    | Hero estimated-gross card, collapsible accordions, math popovers                                                             |
| `share.jsx`      | Snapshot detail rendered to a shareable canvas (PNG download + clipboard copy)                                               |
| `reconcile.jsx`  | Pay-slip variance modal against any snapshot                                                                                 |
| `ytd.jsx`        | Year-to-date dashboard (totals, hours, OT, composition bar, monthly bars)                                                    |
| `snapshots.jsx`  | Snapshot history list, sparkline, deltas, detail view                                                                        |
| `home.jsx`       | Home page: 3-step setup (pay → commute → shifts by rotation or totals) and an at-a-glance result                             |
| `app.jsx`        | Root component — state, persistence, 3-tab taskbar, header, taxi-distance card, two-column desktop layout                    |
| `sw.js`          | Cache-first service worker (offline support)                                                                                 |
| `manifest.json`  | PWA manifest                                                                                                                 |
| `calc.test.js`   | Standalone math sanity tests (run via `node calc.test.js`)                                                                   |

State persists in `localStorage` under `nsc:v3`. No data leaves the device.

---

## Using the App

### The simple way (Home)

The app opens on **Home**. Tap **Start** and answer three questions:

1. **Your pay:** Monthly Basic and Compulsory Assignment (leave blank for allowances only).
2. **Your commute:** Short or Long taxi distance.
3. **Your shifts**, either:
   - **My rotation:** tap any day you work a 7AM on the period calendar. The standard 7AM → 3PM → 10PM → off cycle fills the whole period from that day, including the days before it, and public holidays apply automatically.
   - **My totals:** just the number of 3PM, 10PM and 7AM shifts (plus any same-day 3PM + 10PM days). Shifts are spread across the period's regular (non-holiday) days for the math; holiday pay isn't included from totals.

The live estimate updates as you answer. **See my pay** saves the answers into the same calendar and inputs the **Shifts** screen uses, so both screens always show the same numbers. Use **Update my shifts** to redo it, or **See the full breakdown** to fine-tune individual days.

The phone's **Back** button returns to Home from any other screen.

### The detailed way (Shifts)

The bottom bar has three tabs: **Home**, **Shifts** and **History**. Settings (gear icon) holds rates, tax, past rates, theme and **Backup**.

1. **Set your rates** the first time from Settings. The onboarding banner will prompt you.
2. **Log your shifts on the calendar** (Shifts tab). Tap a day to toggle 7AM / 3PM / 10PM, adjust hours, and override holiday status. Coloured bands show shift type; bar height scales with hours.
3. **Pick a taxi distance** under the calendar:
   - **Short** or **Long**: one distance for every shift this period.
   - **Varies**: set Short/Long per shift in the day editor. New shifts start with the distance you had selected. Long shifts show a striped bar.
4. **Use shortcuts when you can.**
   - **Auto-fill**: rotation fill (7AM → 3PM → 10PM, single-shift, partial periods, skip Sundays, preserve existing).
   - **Templates**: save the current week pattern and apply it to any period with one tap.
   - **Long-press a day** with shifts to copy it, then tap empty days to paste.
5. **Read the result.** The live total floats above the bar while you tap. The summary card breaks down Allowance / Base Pay / Extra Hours; tap a row to expand it and `ƒ` to see the math.
6. **Your monthly pay** and **Check against roster** fold away below the summary. Open them to edit base pay, or to type your roster counts and have the calendar checked against them (counts never change the math).
7. **Save to History** when you're done. Snapshots de-dupe per period, show ▲/▼ delta vs the previous period, and can be exported as a shareable PNG. **Reconcile** against your pay slip from any snapshot.
8. **Backup** (Settings): save/restore a JSON backup, download the period's shifts as `.ics`, or reset the period.

---

### Basic Mode Input Contract

Internally, **Short/Long** is `basic` mode and **Varies** is `advanced` mode. Both call the same allowance engine and only differ in how distance is collected:

- `rSP1 = pm3Count * SP1_RATE`
- `rSP2 = pm10Count * SP2_RATE`
- `rMeal = (pm3Count + pm10Count) * MEAL_RATE`
- Taxi: Short/Long uses a single period-wide distance; Varies sums per-shift distances. Same-day 3PM+10PM pairs auto-deduct two taxi units.
- `allowanceTotal = rSP1 + rSP2 + rMeal + rTaxi`

Both modes always produce identical results when given equivalent inputs.

---

## Created By

**L/Cpl. R. Marshall**
Workflow Coaching and Optimisation

---

## Disclaimers & Disclosures

### Data & Privacy

This app does not collect or transmit data to any server. All calculations are performed locally on your device. Inputs persist in `localStorage` (key `nsc:v3`) so state survives between sessions on the same device/browser profile. No personal information, shift data, or financial figures are sent off-device. Clear local data any time with **Settings → Backup → Reset this period**, or by clearing site data in your browser.

### Accuracy

This calculator is a personal productivity tool. Every effort has been made to keep the math correct, but users are responsible for verifying results against official pay records and entitlements. The app does not constitute official payroll advice.

### AI Assistance

This app was developed with assistance from Claude, an AI assistant made by Anthropic. The concept, design decisions, calculations, and content were directed and verified by L/Cpl. R. Marshall.

### Affiliation

This is an unofficial tool created independently by L/Cpl. R. Marshall of Portland Division. It is not an official product of the JFB or any affiliated organisation.

---

## Basic Checks

Run the local sanity checks before deploying:

```bash
./check.sh
```

Validates `manifest.json` formatting, ensures core app files exist and are non-empty, and runs the math sanity tests in `calc.test.js`.

## Release Checklist

1. Confirm default rates in `helpers.jsx` (`DEFAULT_RATES`, `DEFAULT_TAX`) and the "Rates effective" label in `app.jsx`.
2. Run `./check.sh`.
3. Bump the service worker cache version in `sw.js` (`const CACHE`).
4. Verify install / offline behaviour and the snapshot share-as-PNG output manually.
