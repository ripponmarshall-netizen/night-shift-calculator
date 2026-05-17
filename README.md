# WCO JFB Night Shift Calculator

Calculating night shifts means keeping track of multiple allowances across different shift types, distances, and schedules — and doing that mental arithmetic at the end of a long period is tedious and error-prone.

The **WCO JFB Night Shift Calculator** is a simple tool built by L/Cpl. R. Marshall for the Portland Division and any other JFB personnel to calculate their night shift allowances quickly and accurately. Instead of manually tallying up your SP1, SP2, Meal, and Taxi allowance, you enter your shift numbers and the app does the rest — giving you a clear breakdown and total in seconds.

---

## What It Calculates

- **SP1** — your 3PM shift allowance
- **SP2** — your 10PM shift allowance
- **Meal** — meal allowance based on total shifts worked
- **Taxi** — transport allowance based on distance and shift count

---

## Who It's For

This app is for JFB members who need to calculate their night shift allowances. Whether you work short or long distance routes, or a mix of both, the calculator handles standard and advanced calculations in one place.

---

## How to Use the App

1. **Open the calculator and confirm rates**  
   At the top of the screen, check the **Rates effective** date so you know which allowance rates are being applied.

2. **Choose your calculation mode**
   - **Basic mode**: Shift counts are auto-derived from the calendar. Select **Short** or **Long** distance for the whole period.
   - **Advanced mode**: Shift counts are still calendar-derived, while distance is split per shift (Short/Long) from day selections.

3. **Set your calendar days (recommended for accuracy)**
   - Use the pay-period calendar (16th to 15th) to mark what you worked each day.
   - Tap a day to assign one or more shift types (7AM / 3PM / 10PM).
   - Mark holiday work where needed (built-in holidays are already recognized, and custom holiday overrides are supported).
   - Optionally enable **Auto-fill next shift days** to follow the 7AM → 3PM → 10PM rotation pattern.
   - Use the previous/next arrows to move across pay periods.

4. **Enter base pay inputs**
   - Fill in **Monthly Basic Allowance**.
   - Fill in **Compulsory Assignment Allowance**.

5. **Review the Live Summary before saving**
   The app recalculates instantly and shows:
   - Allowances: SP1, SP2, Meal, Taxi, and distance tag
   - Base pay totals
   - Extra-hours breakdown: total/holiday/non-holiday hours, overtime-over-threshold hours, hourly rate, holiday pay (×2), overtime pay (×1.5)
   - **Estimated Total Pay**

6. **Fix any mismatch warnings**
   If any shift in Advanced mode is missing a Short/Long distance assignment, a cross-check warning appears. Complete the assignment before finalising your snapshot.

7. **Save a snapshot of results**
   Tap **Save Snapshot** to generate the Results page with:
   - Allowance subtotal
   - Base pay subtotal
   - Extra-hours subtotal
   - Final estimated total
   - Pay-period label and any cross-check notes

8. **Use utility actions when needed**
   - **Reset**: Clears current inputs and state.
   - **Export**: Downloads your current calculator data as JSON.
   - **Import**: Restores previously exported JSON data.

9. **Use built-in help and reference pages**
   - Tap **?** for quick help.
   - Use **About** and **Disclaimers** links at the bottom for context, data/privacy notes, and usage caveats.

> Tip: Install the app to your home screen for faster access and better offline use between shifts.

---

### Basic Mode Input Contract (tied to existing logic)

To keep **Basic** simple while preserving calculation parity with **Advanced**, Basic should call the same allowance engine and only change how inputs are collected:

- **SP1 shifts** = count of 3PM shifts for the selected period
- **SP2 shifts** = count of 10PM shifts for the selected period
- **Meal claims** = total meal units for the period
- **Taxi trips** = total taxi units for the period
- **Taxi distance** = one period-wide selector (Short or Long)

Basic should pass those aggregate values into the existing allowance formulas already used by Advanced (`SP1_RATE`, `SP2_RATE`, `MEAL_RATE`, `TAXI_SHORT`, `TAXI_LONG`) so both modes always produce identical results when given equivalent inputs.

Recommended calculation mapping:

- `rSP1 = sp1Count * SP1_RATE`
- `rSP2 = sp2Count * SP2_RATE`
- `rMeal = mealCount * MEAL_RATE`
- `rTaxi = taxiTripCount * (distance === Short ? TAXI_SHORT : TAXI_LONG)`
- `allowanceTotal = rSP1 + rSP2 + rMeal + rTaxi`

This keeps Basic as a quick-entry view while remaining fully tied to the existing logic.

## Created By

**L/Cpl. R. Marshall**
Workflow Coaching and Optimisation

---

## Disclaimers & Disclosures

### Data & Privacy

This app does not collect or transmit data to any server. All calculations are performed locally on your device. Your inputs are stored locally in your browser (localStorage) so your state can persist between sessions on the same device/browser profile. No personal information, shift data, or financial figures are sent off-device at any point. You can clear local data at any time using **Reset**, or move it using **Export/Import**.

### Accuracy

This calculator is intended as a personal productivity tool to assist with allowance calculations. While every effort has been made to ensure the calculations are accurate, users are responsible for verifying their results against official pay records and entitlements. The app does not constitute official payroll advice.

### AI Assistance

This app was developed with assistance from Claude, an AI assistant made by Anthropic, and Perplexity Computer by Perplexity. The concept, design decisions, data inputs, calculations, and content were directed and verified by L/Cpl. R. Marshall. Claude was used to write, review, and refine the code throughout the development process. All calculation logic and allowance rates were specified and confirmed by the developer.

### Affiliation

This is an unofficial tool created independently by L/Cpl. R. Marshall of Portland Division. It is not an official product of the JFB, or any affiliated organisation, and is provided as-is for the convenience of personnel.

## Basic Checks

Run the local sanity checks before deploying:

```bash
./check.sh
```

This validates `manifest.json` formatting and ensures core app files exist and are non-empty.

## Release Checklist

1. Update rates and effective date in `app.js`.
2. Run `./check.sh`.
3. Bump service worker cache version in `sw.js`.
4. Verify install/offline behavior and copy-results output manually.
