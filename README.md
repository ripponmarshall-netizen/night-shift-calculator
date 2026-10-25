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
  - **Count overtime in hours or minutes** (Settings → Rates). _Hours_ (the default) uses decimal hours (6.5h). _Minutes_ counts every shift to the whole minute, takes the threshold as whole minutes (173.33h is 173h 20m), pays overtime per minute (hourly rate ÷ 60 × 1.5), shows time as hours and minutes everywhere, and lets you type a short shift as hours and minutes in the day editor. A saved result keeps the unit it was worked out in.
  - **Extra shifts** (shifts outside a saved rotation) are listed on their own with their time in hours and minutes, per shift type and in all, apart from the overtime figure. Their time is already part of total hours, so it's never paid on top.
- **Leave & duties** — mark any shift as vacation, departmental or sick leave, time off, orderly duty, or one side of a shift swap:
  - **Leave** (VL, DL, SL, TO) keeps the shift's hours as ordinary hours (total and overtime; never holiday ×2, even on a public holiday) but drops its SP1, SP2, meal and taxi.
  - **Exchange leave** (EXL): someone else covers your shift. It loses all its hours and allowances, as if it weren't worked (it also never counts as an extra shift or as a day's first shift for the holiday rule).
  - **Orderly duty** (ORD) and **Exchange for** (EXF, covering someone else's shift) are paid as normal shifts and only recorded.
- **Estimated net** — JM tax model (NIS, NHT, Education Tax, PAYE bands, optional pension). Meal and taxi allowances are tax-free, so deductions are worked out on the rest of the gross

---

## App Architecture

The app is a single-page PWA. UI is built with React 18 (production build) + Babel-standalone loaded from CDN, so there is no build step — every `.jsx` file is fetched directly by the browser and transpiled in place. `index.html` applies the saved theme before first paint and shows a loading screen while the scripts load: a fire truck drives a night road on springy suspension (headlight on, lights flashing, bobbing over a bump). Its moving parts (suspension, body, light bar, wheels) are separate layers rather than groups inside one SVG, so the GPU keeps them moving while the main thread is busy compiling the app. Once the app mounts, the truck floors it off the road, picking up from the speed it was cruising at, the app logo drops in under gravity and bounces to rest, its clock hands wind round, and the logo and title leap up into the header while the page drops in beneath them. The flight is worked out frame by frame from damped springs (across and up have their own timing, so the logo never stalls at the top of its arc), lands exactly on the header logo, and the page's totals count up as it appears (a plain fade with reduced motion).

Motion across the app runs on damped springs: `styles.css` defines `--ease-bouncy`, `--ease-snappy`, `--ease-soft` and `--ease-wobbly`, CSS `linear()` easings sampled from a spring simulation (with a cubic-bezier fallback for older browsers), so pills, chevrons, ticks, dialogs and cards overshoot and settle like real objects. Bottom sheets can be pulled down to close; a flick flies them off at the finger's speed and a short pull springs back (`useSheetDrag` / `springTo` in `components.jsx`).

On an iPad (from 744px wide, an iPad mini held upright) the screens go two columns, each as wide as a phone: Home puts the result and pay settings beside the calendar, Watch the watch calendar beside the people and totals (a person's page: their calendar beside their details and pay), and History the year to date beside the saved periods. On a screen tall enough, the calendar (or year to date) stays pinned while the other column scrolls. Phones keep the single column. The layout lives in `styles.css` (`.nsc-page`, `.nsc-split`, `.has-side`).

| File             | Purpose                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.html`     | App shell, script loaders, service-worker registration                                                                                                                         |
| `styles.css`     | Theme tokens (dark + light), typography, base reset                                                                                                                            |
| `helpers.jsx`    | Date utilities, JM holidays (Easter computus), aggregate engine, JM tax model, rate history, templates, iCal export, storage                                                   |
| `components.jsx` | Shared primitives (Card, SegToggle, buttons, ModalFrame, PeriodNav, ChoiceCard, AnimatedNumber, SplitBar, chart cursor, animated list rows), toasts with Undo, confirm, footer |
| `modals.jsx`     | Day editor, Settings (rates/tax/past rates/theme/backup, saved as you type), Auto-fill                                                                                         |
| `templates.jsx`  | Saved-week templates (save / apply / delete)                                                                                                                                   |
| `calendar.jsx`   | Period calendar with labelled shift chips, rotation off days, extra-shift colour, long-press copy/paste, holiday chips; Home's version folds shut                              |
| `summary.jsx`    | Home's pay card: estimated total, after-tax fold, fold-out Allowances / Base pay / Extra hours / Leave & duties rows, math popovers                                            |
| `share.jsx`      | Snapshot detail rendered to a shareable canvas (PNG download + clipboard copy)                                                                                                 |
| `reconcile.jsx`  | Pay-slip variance modal against any snapshot                                                                                                                                   |
| `ytd.jsx`        | Year-to-date dashboard (count-up totals, hours, OT, monthly columns with readout, composition bar)                                                                             |
| `snapshots.jsx`  | Snapshot history list, scrubbable trend line, deltas, detail view                                                                                                              |
| `home.jsx`       | Home page: pay card, foldable calendar, pay settings (taxi, monthly pay, roster check), 3-step setup, one-tap rotation fill for a new period                                   |
| `crew.jsx`       | Watch tab: several people on the same shift — shared watch calendar, per-person days/pay/taxi, watch totals, copy summary and CSV export                                       |
| `crewdoc.jsx`    | Watch as Word record sheets (.docx): one JFB Regular and Overtime Record Sheet per person, built in the browser with no library                                                |
| `app.jsx`        | Root component — state, persistence, 3-tab taskbar with floating total, header, About guide, two-column iPad and desktop layout                                                |
| `sw.js`          | Cache-first service worker; precaches app files and the pinned React/Babel CDN scripts so the app starts offline                                                               |
| `manifest.json`  | PWA manifest (PNG icons first, SVG after); `apple-touch-icon.png` is the iPhone Home Screen icon (iOS only takes a PNG)                                                        |
| `calc.test.js`   | Standalone math sanity tests (run via `node calc.test.js`)                                                                                                                     |

State persists in `localStorage` under `nsc:v3`. No data leaves the device.

---

## Using the App

### The simple way (Home)

The app opens on **Home**. Tap **Start** and answer three questions:

1. **Your pay:** Monthly Basic and Compulsory Assignment (leave blank for allowances only).
2. **Your commute:** Short or Long taxi distance.
3. **Your shifts**, either:
   - **My rotation:** tap any day you work a 7AM on the period calendar. The standard 7AM → 3PM → 10PM → off cycle fills the whole period from that day, including the days before it, and public holidays apply automatically (a holiday that falls on a weekend is kept on the weekday the Holidays Act moves it to, e.g. Labour Day 2026 on Monday 25 May).
   - **My totals:** just the number of 3PM, 10PM and 7AM shifts (plus any same-day 3PM + 10PM days). Shifts are spread across the period's regular (non-holiday) days for the math; holiday pay isn't included from totals.

   - If this period already has days logged, **My rotation** keeps them and only fills the empty days (Auto-fill does the same). Kept shifts that fall outside the new rotation show as extra, and the setup tells you how many before you finish. Switch keep off to replace the period instead. **My totals** always replaces the period.
   - Choosing **My rotation** saves it. The 4-day cycle (7AM → 3PM → 10PM → **Off**) runs on across pay periods, so the calendar marks your off days and shows any shift outside the rotation as an **extra** shift in pink with a `+` (e.g. `+3PM`). **My totals** doesn't follow a rotation, so it clears the saved one.

The live estimate updates as you answer and stays pinned to the bottom of the screen with the **Next** / **See my pay** buttons (the tab bar hides during setup). **See my pay** fills the calendar on Home with your answers, and everything on Home works from that calendar. Tap **Setup** above the calendar to answer the questions again, or tap days to fine-tune them.

If you leave your monthly pay blank, the big number is labelled **Estimated allowances** (not gross pay), with a link to add your pay. No after-tax figure is shown until a monthly basic is set: deductions depend on your whole month's pay, so taxing allowances alone would overstate your take-home.

After setup, Home shows your pay at the top, then **Your shifts** (the calendar): tap any day to fix it (leave, a swap, an extra shift). Today is marked on every calendar. When a new pay period starts and a rotation is saved, Home offers **Fill my rotation**, one tap to carry the cycle into the new period.

The phone's **Back** button closes an open dialog or the Home setup first, then returns to Home from any other screen. Bottom sheets (the day editor, a saved result) can also be pulled down to close. The app always opens on today's pay period, and if it was left open in the background into a new pay period it moves on to the new one when you come back (unless you'd browsed to another period on purpose).

### Day by day (Home)

The bottom bar has three tabs: **Home**, **Watch** and **History**. Home is one page, top to bottom: your pay, **Your shifts** (the calendar) and your pay settings. Settings (gear icon) holds rates, tax, past rates, theme and **Backup**. **About** (footer, or Settings) has a step-by-step guide to every screen, the pay rules with the current rates, and a key to every shift label.

1. **Check your rates** in Settings. The defaults are the current JFB rates; the setup wizard shows which rates it's using. Settings save as you type.
2. **Log your shifts on the calendar** (**Your shifts** on Home). Tap a day to toggle 7AM / 3PM / 10PM, adjust hours, and override holiday status. Coloured chips show shift type. Tap **Your shifts** to fold the calendar down to one line (it shows the shift count and hours); it stays folded or open on that device.
   - **Duty** (under each ticked shift → Change), grouped by what it does to pay: _Worked_ (Regular, Orderly, Exchange for), _Leave_ (Vacation, Departmental, Sick, Time off) and _Swapped out_ (Exchange leave). Leave shows on the calendar as a dashed chip with its code (VL, DL, SL, TO); exchange leave as a faint dotted **EXL** chip with `0h`; orderly and exchange for as solid **ORD** / **EXF** chips. The pay card gets a **Leave & duties** row that opens to list them, and **About** has a key to every label.
3. **Pick a taxi distance** in the settings card under the calendar:
   - **Short** or **Long**: one distance for every shift this period.
   - **Varies**: set Short/Long per shift in the day editor. New shifts start with the distance you had selected. Long shifts show a striped bar.
4. **Use shortcuts when you can** (the buttons above the calendar).
   - **Auto-fill**: rotation fill (tap any day you work a 7AM, as in the Home setup), single-shift patterns, partial periods, keep existing days. A rotation fill saves the rotation.
   - **Setup**: the three setup questions again.
   - **Templates**: save the current week pattern and apply it to any period with one tap.
   - **Long-press a day** with shifts to copy it, then tap empty days to paste.
5. **Read the result** at the top of Home. Tap **Allowances**, **Base pay** or **Extra hours** to open its lines, and `ƒ` on a line to see the math. Tap **after tax** under the total for the deductions. Once the total scrolls away (while you work on the calendar) it floats above the tab bar; tap it to jump back up.
6. **Taxi distance**, **Your monthly pay** and **Check against roster** fold away in the card under the calendar, one open at a time. Open them to change the taxi, edit base pay, or type your roster counts and have the calendar checked against them (counts never change the math). **Add your monthly pay** under the total opens the pay row for you.
7. **Save to History** when you're done. The button shows whether this period is already saved, or has **changed** since you saved it (**Save changes**). Saving again replaces that period's saved result. History shows ▲/▼ vs the previous period, exports a shareable PNG, and lets you **Check against pay slip** for any saved period. Deleting a saved result can be undone from the toast.
8. **Backup** (Settings): save/restore a JSON backup (restoring asks first), download the period's shifts as `.ics`, or reset the period (asks first, and can be undone).

### Several people on the same shift (Watch)

The **Watch** tab works out the same pay for everyone on your watch, organised by name and employee number. (In the code and backups it is still called `crew`.)

1. **Set the watch's shifts** on the watch calendar: **Fill rotation** (the same 7AM picker as Home), **Copy my shifts** (your own calendar's shifts and holiday settings, without your leave, swaps or short hours), or tap days to edit them.
2. **Add each person** with their name, employee number and rank. A number used twice is flagged. Sort the list by **Name** or **Emp. no.**
3. **Open a person** to set their monthly basic, compulsory assignment and Short/Long taxi, and tap any day to mark their leave, a swap or an extra shift. Days that differ from the watch are listed under **Different from the watch**, each with **Match watch** to undo it.
4. **Watch totals** adds everyone up. **Save to History** keeps the watch's result for the period (saving again replaces it, and the button shows **Save changes** when the watch has changed since). **Copy summary** gives a plain-text breakdown per person; **Download CSV** gives one spreadsheet row per person.
5. **Word record sheets** downloads a `.docx` with one JFB _Regular and Overtime Record Sheet_ per person on legal paper: watch, employee no., rank, name, station, the dated shifts under Regular Time and Overtime (leave and exchanges marked D/L, V/L, S/L, T/O, Exc, Ord in red), S/P 1, S/P 2, M/A and T/A, overtime hours (T&H ×1.5, D ×2), leave taken, and blank remarks and signature lines. Set the **Watch name** and **Station** once above the button. With a watch rotation saved, each 4-day cycle gets its own column and shifts outside the rotation go under Overtime; without one, every shift is Regular Time.
6. **History → Saved watches** lists each saved watch period; open one to download its Word sheets or CSV again, copy its summary, or delete it (with Undo).

Each person is calculated by the same engine as your own pay, using the rates for the period on screen. Changing the watch calendar updates everyone except on the days they have their own changes. Watch data is included in Backup and stays on this device.

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
Workflow Coaching and Optimisation · Portland Division

## Contact

Questions, issues, or a rate that looks wrong? Email **[ripponmarshall@yahoo.com](mailto:ripponmarshall@yahoo.com)**. Say which pay period and screen you were on; a screenshot helps.

The same address is in the footer of every screen and on the in-app **About** page.

---

## Disclaimers & Disclosures

### Data & Privacy

This app does not collect or transmit data to any server. All calculations are performed locally on your device. Inputs persist in `localStorage` (key `nsc:v3`) so state survives between sessions on the same device/browser profile. No personal information, shift data, or financial figures are sent off-device; this includes the names and employee numbers you add on the Watch tab. **Settings → Backup → Reset this period** clears one period's shifts and roster counts (your monthly pay, rates and History are kept). To remove everything, clear site data in your browser.

### Accuracy

This calculator is a personal productivity tool. Every effort has been made to keep the math correct, but users are responsible for verifying results against official pay records and entitlements. The app does not constitute official payroll advice.

### AI Assistance

This app was developed with assistance from Claude, an AI assistant made by Anthropic. The concept, design decisions, calculations, and content were directed and verified by L/Cpl. R. Marshall.

### Affiliation

This is an unofficial tool created independently by L/Cpl. R. Marshall of Portland Division. It is not an official app of the Jamaica Fire Brigade (JFB) or any affiliated organisation, and it has not been made, checked or endorsed by the JFB. The JFB name and logo are the property of the Jamaica Fire Brigade and appear only to show who the app is for. Its results are not JFB pay records.

### JFB logo

The app shows the JFB logo from `jfb-logo.png` (next to `index.html`) in the footer of every screen and at the top of **About**, always beside the words saying the app is unofficial. Without that file nothing shows, so the logo can be added or removed without touching the code. A PNG with a transparent background, about 256px tall, reads well on both themes. Get the JFB's permission before adding it. After replacing the file with a new version, bump `CACHE` in `sw.js` so installed copies pick it up.

---

## Basic Checks

Run the local sanity checks before deploying:

```bash
./check.sh
```

Validates `manifest.json` formatting, ensures core app files exist and are non-empty, and runs the math sanity tests in `calc.test.js`.

## Release Checklist

1. Confirm default rates in `helpers.jsx` (`DEFAULT_RATES`, `DEFAULT_TAX`) and the "Rates effective" label in `app.jsx`.
2. Bump `APP_VERSION` in `helpers.jsx` (shown in the footer on every screen). The credit line and contact address are `APP_CREDIT` and `CONTACT_EMAIL` in the same file.
3. Run `./check.sh`.
4. Bump the service worker cache version in `sw.js` (`const CACHE`).
5. Verify install / offline behaviour and the snapshot share-as-PNG output manually.
