/* modals.jsx — DayModal, SettingsModal, AutofillModal */
const { useState: useStateM } = React;

/* ============ Day modal ============ */
function DayModal({ dayKey, entry, mode, slot, defaultDist, onClose, onChange, onClear }) {
  const { ref: dialogRef, closing, close } = useModalDismiss(onClose);
  const date = fromYmd(dayKey);
  const autoHolName = holidayName(date);
  const isAutoHoliday = !!autoHolName;
  const isHol = entry.holiday == null ? isAutoHoliday : entry.holiday;
  const [showHol, setShowHol] = useStateM(entry.holiday != null);
  const toggle = (k) => onChange((e) => {
    const next = { ...e, [k]: !e[k], dist: { ...e.dist } };
    // Turning on: use the distance in effect, in every mode, so a later switch
    // to "Varies" keeps a Long commuter's shifts Long.
    if (!e[k]) next.dist[k] = defaultDist || "S";
    // turning off: drop any stale hours override or duty mark so neither can
    // silently re-apply when the shift is ticked again
    if (e[k] && e.hours && e.hours[k] != null) {
      const hours = { ...e.hours };
      delete hours[k];
      next.hours = Object.keys(hours).length ? hours : undefined;
    }
    if (e[k] && e.duty && e.duty[k] != null) {
      const duty = { ...e.duty };
      delete duty[k];
      next.duty = Object.keys(duty).length ? duty : undefined;
    }
    return next;
  });
  const setDuty = (k, v) => onChange((e) => {
    const duty = { ...(e.duty || {}) };
    if (v) duty[k] = v; else delete duty[k];
    return { ...e, duty: Object.keys(duty).length ? duty : undefined };
  });
  const setHoliday = (v) => onChange((e) => ({ ...e, holiday: v }));
  const setDist = (k, v) => onChange((e) => ({ ...e, dist: { ...e.dist, [k]: v } }));
  const setHours = (k, raw) => onChange((e) => {
    const v = sanitizeDecimal(raw);
    const hours = { ...(e.hours || {}) };
    if (v === "") delete hours[k]; else hours[k] = v;
    return { ...e, hours: Object.keys(hours).length ? hours : undefined };
  });

  return (
    <div onClick={close} className={"nsc-backdrop" + (closing ? " is-closing" : "")} style={{
      position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.55)",
      backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center",
      padding: "0 12px 12px",
    }}>
      <div ref={dialogRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className={"nsc-modal nsc-sheet" + (closing ? " is-closing" : "")} style={{
        width: "100%", maxWidth: 540,
        background: "var(--bg-1)", border: "1px solid var(--line)",
        borderRadius: 18, padding: 16,
        marginBottom: `calc(96px + var(--safe-bottom))`,
        outline: "none",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div className="label">Edit day</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginTop: 2 }}>
              {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </div>
            {autoHolName && <div style={{ fontSize: 12.5, color: "var(--holiday)", marginTop: 2 }}>● {autoHolName}</div>}
            {slot && (
              <div style={{ fontSize: 12.5, color: "var(--ink-dim)", marginTop: 4 }}>
                Rotation: <span style={{ color: "var(--ink)", fontWeight: 600 }}>{slot === "off" ? "Off day" : `${ROTATION_LABEL[slot]} day`}</span>
                {slot === "off" ? " · any shift here is extra" : ""}
              </div>
            )}
          </div>
          <button onClick={close} style={iconBtn()} aria-label="Close">✕</button>
        </div>

        {DAY_SHIFTS.map((sh) => (
          <ShiftBlock key={sh.k} sh={sh} entry={entry} mode={mode} slot={slot}
            onToggle={() => toggle(sh.k)} onHours={setHours}
            onDist={(v) => setDist(sh.k, v)} onDuty={(v) => setDuty(sh.k, v)} />
        ))}

        <div style={{ height: 1, background: "var(--line-soft)", margin: "12px 0" }} />

        {/* Holidays are set automatically; the override stays folded away
            unless it's in use. */}
        <div style={{ padding: "10px 12px", background: "var(--bg-2)", borderRadius: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontSize: 14 }}>
              Public holiday: <span style={{ fontWeight: 600 }}>{isHol ? "Yes" : "No"}</span>
              <span style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>{entry.holiday == null ? " · automatic" : " · set by you"}</span>
            </div>
            {!showHol && (
              <button onClick={() => setShowHol(true)} style={linkBtn}>Change</button>
            )}
          </div>
          {showHol && (
            <div style={{ marginTop: 10 }}>
              <SegToggle
                small full
                options={[{ v: "auto", l: "Automatic" }, { v: "off", l: "Not a holiday" }, { v: "on", l: "Holiday" }]}
                value={entry.holiday == null ? "auto" : entry.holiday ? "on" : "off"}
                onChange={(v) => setHoliday(v === "auto" ? null : v === "on")}
              />
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={onClear} style={ghostBtn()}>Clear day</button>
          <div style={{ flex: 1 }} />
          <button onClick={close} style={primaryBtn()}>Done</button>
        </div>
      </div>
    </div>
  );
}

const ROTATION_LABEL = { am7: "7AM", pm3: "3PM", pm10: "10PM" };
const DAY_SHIFTS = [
  { k: "am7", label: "7AM shift", hours: "8h", color: "var(--am)" },
  { k: "pm3", label: "3PM shift", hours: "7h", color: "var(--sp1)" },
  { k: "pm10", label: "10PM shift", hours: "9h · crosses midnight", color: "var(--sp2)", hint: "total" },
];

/* One shift in the day editor: the tick box, then (while it's on) its
   hours, taxi distance and duty, sliding open under it. */
function ShiftBlock({ sh, entry, mode, slot, onToggle, onHours, onDist, onDuty }) {
  const on = !!entry[sh.k];
  const duty = shiftDuty(entry, sh.k);
  return (
    <div>
      <DayToggle label={sh.label} hours={sh.hours} color={sh.color} active={on} duty={duty}
        extra={!!slot && slot !== sh.k} onClick={onToggle} />
      <Collapse open={on}>
        <div style={{ paddingBottom: 2 }}>
          <HoursRow keyName={sh.k} entry={entry} onChange={onHours} hint={sh.hint} />
          {mode === "advanced" && <DistRow value={entry.dist?.[sh.k] || "S"} onChange={onDist} />}
          <DutyRow value={duty} onChange={onDuty} shift={ROTATION_LABEL[sh.k]} />
        </div>
      </Collapse>
    </div>
  );
}

/* Leave or orderly duty for one shift. Folded to one line like the holiday
   setting; leave keeps the hours but drops SP1, SP2, meal and taxi. */
const DUTY_OPTIONS = [{ v: null, l: "Regular" }, ...DUTY_KEYS.map((k) => ({ v: k, l: DUTY_TYPES[k].short }))];
function DutyRow({ value, onChange, shift }) {
  const [open, setOpen] = useStateM(!!value);
  const leave = isLeave(value);
  return (
    <div style={{ margin: "0 0 10px", padding: "8px 10px", background: "var(--bg-2)", borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 24 }}>
        <span style={{ fontSize: 13 }}>
          <span style={{ color: "var(--ink-dim)" }}>Duty: </span>
          <span style={{ fontWeight: 600 }}>{value ? DUTY_TYPES[value].label : "Regular shift"}</span>
        </span>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} style={linkBtn}>{open ? "Hide" : "Change"}</button>
      </div>
      <Collapse open={open}>
        <div role="radiogroup" aria-label={`Duty for the ${shift} shift`} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(88px, 1fr))", gap: 6, paddingTop: 8 }}>
          {DUTY_OPTIONS.map((o) => {
            const active = (value || null) === o.v;
            return (
              <button key={o.l} role="radio" aria-checked={active} onClick={() => onChange(o.v)} className="nsc-chip" style={{
                padding: "8px 4px", borderRadius: 8, minWidth: 0,
                border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
                background: active ? "var(--ink)" : "var(--bg-1)",
                color: active ? "var(--bg)" : "var(--ink-dim)",
                fontSize: 12, fontWeight: active ? 600 : 500, cursor: "pointer", fontFamily: "inherit",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{o.l}</button>
            );
          })}
        </div>
      </Collapse>
      <Collapse open={leave}>
        <div style={{ fontSize: 12, color: "var(--ink-faint)", lineHeight: 1.45, paddingTop: 6 }}>
          On leave: the hours count as ordinary hours (never holiday ×2), but no SP1, SP2, meal or taxi for this shift.
        </div>
      </Collapse>
    </div>
  );
}
const linkBtn = {
  background: "transparent", border: "none", color: "var(--ink-dim)", fontSize: 13, cursor: "pointer",
  fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 3, padding: 0,
};

/* extra: this shift isn't on the rotation for the day, so ticking it marks
   an extra shift (shown in the extra colour). */
function DayToggle({ label, hours, color, active, extra, duty, onClick }) {
  if (extra) color = "var(--extra)";
  const leave = active && isLeave(duty);
  return (
    <button onClick={onClick} aria-pressed={active} className="nsc-daytoggle" style={{
      display: "flex", alignItems: "center", gap: 12,
      width: "100%", padding: "12px 12px",
      background: active ? "color-mix(in oklab, " + color + " 14%, transparent)" : "var(--bg-2)",
      border: `1px solid ${active ? "color-mix(in oklab, " + color + " 50%, transparent)" : "var(--line)"}`,
      borderRadius: 10, color: "var(--ink)",
      marginBottom: 8, cursor: "pointer", textAlign: "left",
      transition: "background 0.18s, border-color 0.18s, transform 0.12s",
      fontFamily: "inherit",
    }}>
      <span className={"nsc-check" + (active ? " is-on" : "")} style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
        border: `1.5px solid ${active ? color : "var(--line)"}`,
        background: active ? color : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {active && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path className="nsc-tick" d="M2 6.5L4.8 9L10 3.5" stroke="var(--bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>
          {label}
          {extra && active && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: "var(--extra)" }}>EXTRA</span>}
          {active && duty && (
            <span className="nsc-pop" style={{
              marginLeft: 8, fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 999, whiteSpace: "nowrap",
              color: leave ? "var(--ink)" : color,
              border: `1px solid ${leave ? "var(--line)" : "color-mix(in oklab, " + color + " 50%, transparent)"}`,
            }}>{DUTY_TYPES[duty].label}</span>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-faint)", marginTop: 2 }}>{leave ? `${hours} · no allowances` : hours}</div>
      </div>
    </button>
  );
}

function DistRow({ value, onChange }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, margin: "0 0 8px 38px" }}>
      <span style={{ fontSize: 12.5, color: "var(--ink-dim)" }}>Taxi</span>
      <SegToggle small options={[{ v: "S", l: "Short" }, { v: "L", l: "Long" }]} value={value} onChange={onChange} />
    </div>
  );
}

// Editable actual hours for a shift. Blank = standard hours (shown as placeholder).
// A partial shift's hours count toward total/overtime; only > half a shift earns
// the per-shift allowance.
function HoursRow({ keyName, entry, onChange, hint }) {
  const std = stdHours(keyName);
  const raw = entry.hours && entry.hours[keyName] != null ? String(entry.hours[keyName]) : "";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, margin: "0 0 8px 38px" }}>
      <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
        Hours worked{hint ? ` · ${hint}` : ""}
      </span>
      <input
        inputMode="decimal" value={raw} placeholder={String(std)}
        onChange={(e) => onChange(keyName, e.target.value)}
        aria-label={`Hours worked for ${ROTATION_LABEL[keyName]} shift`}
        style={{ width: 64, background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 9px", color: "var(--ink)", fontSize: 14, outline: "none", fontFamily: "inherit", textAlign: "right" }}
      />
      <span className="mono" style={{ fontSize: 11, color: "var(--ink-faint)" }}>h</span>
    </div>
  );
}

/* ============ Settings ============ */
function SettingsModal({ rates, setRates, tax, setTax, ratesHistory, setRatesHistory, theme, setTheme, ratesEffective, onExportICS, onReset, onExport, onImport, onAbout, onClose }) {
  const [tab, setTab] = useStateM("rates");
  const { ref: dialogRef, closing, close } = useModalDismiss(onClose);
  return (
    <div onClick={close} className={"nsc-backdrop" + (closing ? " is-closing" : "")} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div ref={dialogRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className={"nsc-modal nsc-center" + (closing ? " is-closing" : "")} style={{ width: "100%", maxWidth: 520, maxHeight: "88vh", overflow: "auto", background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 18, padding: 18, outline: "none" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Settings</div>
          <button onClick={close} style={iconBtn()} aria-label="Close">✕</button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <SegToggle fit options={[
            { v: "rates", l: "Rates" },
            { v: "tax", l: "Tax" },
            { v: "history", l: "Past rates" },
            { v: "theme", l: "Theme" },
            { v: "data", l: "Backup" },
          ]} value={tab} onChange={setTab} small />
        </div>
        <div style={{ display: tab === "rates" ? "block" : "none" }}><RatesTab rates={rates} setRates={setRates} ratesEffective={ratesEffective} /></div>
        <div style={{ display: tab === "tax" ? "block" : "none" }}><TaxTab tax={tax} setTax={setTax} /></div>
        <div style={{ display: tab === "history" ? "block" : "none" }}><RateHistoryTab ratesHistory={ratesHistory} setRatesHistory={setRatesHistory} currentRates={rates} /></div>
        <div style={{ display: tab === "theme" ? "block" : "none" }}><ThemeTab theme={theme} setTheme={setTheme} /></div>
        <div style={{ display: tab === "data" ? "block" : "none" }}>
          <DataTab onExport={onExport} onImport={onImport} onExportICS={onExportICS} onReset={onReset} />
        </div>
        <div style={{ borderTop: "1px solid var(--line-soft)", marginTop: 16, paddingTop: 12, textAlign: "center" }}>
          <button onClick={onAbout} style={{ background: "transparent", border: "none", color: "var(--ink-dim)", fontSize: 13, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>
            About & disclaimers
          </button>
        </div>
      </div>
    </div>
  );
}

/* Backup and housekeeping, kept out of the everyday screens. */
function DataTab({ onExport, onImport, onExportICS, onReset }) {
  const item = (title, detail, onClick, danger) => (
    <button onClick={onClick} style={{
      display: "block", width: "100%", textAlign: "left", padding: "12px 14px", marginBottom: 8,
      background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 12,
      color: danger ? "var(--holiday)" : "var(--ink)", cursor: "pointer", fontFamily: "inherit",
    }}>
      <div style={{ fontSize: 14, fontWeight: 500 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: "var(--ink-faint)", marginTop: 2 }}>{detail}</div>
    </button>
  );
  return (
    <div>
      {item("Save a backup", "Download everything as a JSON file", onExport)}
      {item("Restore a backup", "Load a JSON file you saved before", onImport)}
      {item("Add shifts to my calendar", "Download this period as an .ics file", onExportICS)}
      {item("Reset this period", "Clears this period's shifts and roster counts. Pay, rates and History are kept.", onReset, true)}
      <div style={{ fontSize: 12, color: "var(--ink-faint)", lineHeight: 1.5, marginTop: 6 }}>
        Your data stays on this device. Save a backup before changing phones or clearing your browser.
      </div>
    </div>
  );
}

const ratesToDraft = (r) => {
  const out = {};
  for (const k of Object.keys(r)) out[k] = String(r[k]);
  return out;
};

/* Rates and tax save as you type: each valid field is applied straight away,
   and a field that isn't valid keeps its last saved value until it's fixed.
   Closing Settings never throws edits away. */
function RatesTab({ rates, setRates, ratesEffective }) {
  const [draft, setDraft] = useStateM(() => ratesToDraft(rates));
  const [errors, setErrors] = useStateM({});
  const set = (k, v) => {
    const raw = sanitizeDecimal(v);
    setDraft((p) => ({ ...p, [k]: raw }));
    const n = Number(raw);
    const err = raw === "" || !Number.isFinite(n) || n < 0 ? "Not saved. Must be 0 or more"
      : k === "threshold" && !(n > 0) ? "Not saved. Must be more than 0" : null;
    setErrors((e) => { const x = { ...e }; if (err) x[k] = err; else delete x[k]; return x; });
    if (!err) setRates((r) => ({ ...r, [k]: n }));
  };
  const resetDefaults = () => {
    const prev = rates;
    setRates({ ...DEFAULT_RATES });
    setDraft(ratesToDraft(DEFAULT_RATES));
    setErrors({});
    showToast("Rates reset to defaults", { action: { label: "Undo", onClick: () => { setRates(prev); setDraft(ratesToDraft(prev)); } } });
  };
  // A Past rates entry covering the open period takes precedence over these.
  const overridden = ratesEffective && ratesEffective !== "Current rates";
  return (
    <div>
      {overridden && (
        <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 10, fontSize: 12.5, lineHeight: 1.5, color: "var(--warn)", background: "color-mix(in oklab, var(--warn) 10%, transparent)", border: "1px solid color-mix(in oklab, var(--warn) 35%, transparent)" }}>
          The period you're viewing uses a saved rate from Past rates ({ratesEffective.replace("Rates effective ", "from ")}). Changes here only apply to periods before your first saved rate. To change this period, save a new entry in Past rates.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <RateInput label="SP1 (3PM, per shift)" unit="$" value={draft.sp1} onChange={(v) => set("sp1", v)} error={errors.sp1} />
        <RateInput label="SP2 (10PM, per shift)" unit="$" value={draft.sp2} onChange={(v) => set("sp2", v)} error={errors.sp2} />
        <RateInput label="Meal (per shift)" unit="$" value={draft.meal} onChange={(v) => set("meal", v)} error={errors.meal} />
        <RateInput label="Overtime after (monthly)" unit="h" value={draft.threshold} onChange={(v) => set("threshold", v)} error={errors.threshold} />
        <RateInput label="Taxi — Short" unit="$" value={draft.taxiShort} onChange={(v) => set("taxiShort", v)} error={errors.taxiShort} />
        <RateInput label="Taxi — Long" unit="$" value={draft.taxiLong} onChange={(v) => set("taxiLong", v)} error={errors.taxiLong} />
      </div>
      <SettingsFooter onDefaults={resetDefaults} />
    </div>
  );
}

function SettingsFooter({ onDefaults }) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
      <span style={{ fontSize: 12.5, color: "var(--ink-faint)", marginRight: "auto" }}>Changes save automatically.</span>
      <button onClick={onDefaults} style={{ ...ghostBtn(), whiteSpace: "nowrap" }}>Reset to defaults</button>
    </div>
  );
}

const taxToDraft = (t) => {
  const out = {};
  // Round for display: the NIS cap default is 5,000,000 / 12, which would
  // otherwise show as 416666.6666666667. The stored value stays exact until
  // the field is edited.
  for (const k of Object.keys(t)) {
    out[k] = typeof t[k] === "boolean" ? t[k]
      : typeof t[k] === "number" ? String(Math.round(t[k] * 100) / 100)
      : String(t[k]);
  }
  return out;
};

const TAX_PCT_KEYS = new Set(["nis", "nht", "eduTax", "payeRate1", "payeRate2", "pension"]);

function TaxTab({ tax, setTax }) {
  const [draft, setDraft] = useStateM(() => taxToDraft(tax));
  const [errors, setErrors] = useStateM({});
  const set = (k, v) => {
    if (typeof v === "boolean") {
      setDraft((p) => ({ ...p, [k]: v }));
      setTax((t) => ({ ...t, [k]: v }));
      return;
    }
    const raw = sanitizeDecimal(v);
    setDraft((p) => ({ ...p, [k]: raw }));
    const n = Number(raw);
    const err = raw === "" || !Number.isFinite(n) || n < 0 ? "Not saved. Must be 0 or more"
      : TAX_PCT_KEYS.has(k) && n > 100 ? "Not saved. Must be 0–100%" : null;
    setErrors((e) => { const x = { ...e }; if (err) x[k] = err; else delete x[k]; return x; });
    if (!err) setTax((t) => ({ ...t, [k]: n }));
  };
  const resetDefaults = () => {
    const prev = tax;
    setTax({ ...DEFAULT_TAX });
    setDraft(taxToDraft(DEFAULT_TAX));
    setErrors({});
    showToast("Tax reset to defaults", { action: { label: "Undo", onClick: () => { setTax(prev); setDraft(taxToDraft(prev)); } } });
  };
  const field = (k, label, unit) => <RateInput label={label} unit={unit} value={draft[k]} onChange={(v) => set(k, v)} error={errors[k]} />;
  return (
    <div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", cursor: "pointer" }}>
        <input type="checkbox" checked={draft.enabled} onChange={(e) => set("enabled", e.target.checked)} style={{ accentColor: "var(--accent)", width: 18, height: 18 }} />
        <span style={{ fontSize: 13.5 }}>Calculate Jamaica payroll deductions (NIS, NHT, Education Tax, PAYE)</span>
      </label>
      {draft.enabled && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
            {field("nis", "NIS", "%")}
            {field("nisCapMonthly", "NIS cap (monthly)", "$")}
            {field("nht", "NHT", "%")}
            {field("eduTax", "Education Tax", "%")}
            {field("payeThreshold", "PAYE threshold (monthly)", "$")}
            {field("payeRate1", "PAYE rate (lower)", "%")}
            {field("payeBreak2", "PAYE break point (monthly)", "$")}
            {field("payeRate2", "PAYE rate (upper)", "%")}
            {field("pension", "Pension (if any)", "%")}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 10, lineHeight: 1.5 }}>
            Defaults follow TAJ 2025/26 rates (tax-free threshold from 1 April 2026). Check against your latest pay slip. Estimates only.
          </div>
        </>
      )}
      <SettingsFooter onDefaults={resetDefaults} />
    </div>
  );
}

function RateHistoryTab({ ratesHistory, setRatesHistory, currentRates }) {
  const [date, setDate] = useStateM("");
  const list = [...(ratesHistory || [])].sort((a, b) => effDate(b.effectiveFrom) - effDate(a.effectiveFrom));
  const addEntry = () => {
    if (!date) { showToast("Pick the date these rates started first"); return; }
    const entry = { effectiveFrom: date, rates: { ...currentRates } };
    // One entry per date: saving the same date again replaces it. Two entries
    // with one date would tie in ratesAt(), and the older one would win.
    const others = (ratesHistory || []).filter((x) => String(x.effectiveFrom).slice(0, 10) !== date);
    setRatesHistory([...others, entry]);
    setDate("");
  };
  return (
    <div>
      <div style={{ fontSize: 12.5, color: "var(--ink-dim)", marginBottom: 12, lineHeight: 1.5 }}>
        Save the current rates with an effective-from date. Past periods use the rates active at the time, so historic snapshots stay correct when rates change.
      </div>
      {list.length === 0 ? (
        <div style={{
          padding: "16px", textAlign: "center",
          border: "1px dashed var(--line)", borderRadius: 10,
          color: "var(--ink-faint)", fontSize: 12.5,
        }}>
          No history yet — current rates apply to all periods.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((e) => (
            <div key={`${e.effectiveFrom}-${ratesHistory.indexOf(e)}`} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              padding: "10px 12px",
              background: "var(--bg-2)", border: "1px solid var(--line-soft)", borderRadius: 10,
            }}>
              <div>
                <div className="mono" style={{ fontSize: 11.5, color: "var(--ink)" }}>Effective from {effDate(e.effectiveFrom).toLocaleDateString()}</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 2 }}>
                  SP1 {fmt(e.rates.sp1)} · SP2 {fmt(e.rates.sp2)} · Meal {fmt(e.rates.meal)}
                </div>
              </div>
              {/* Delete by identity: `list` is sorted, so its index doesn't match ratesHistory's. */}
              <button onClick={() => setRatesHistory(ratesHistory.filter((x) => x !== e))} style={iconBtn()} aria-label="Delete">✕</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{
          flex: 1, background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 10,
          padding: "9px 12px", color: "var(--ink)", fontSize: 14, fontFamily: "inherit",
        }} />
        <button onClick={addEntry} style={primaryBtn()}>Save current rates</button>
      </div>
    </div>
  );
}

function ThemeTab({ theme, setTheme }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 12 }}>Appearance</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <ThemeCard active={theme === "dark"} onClick={() => setTheme("dark")} label="Dark" preview={{ bg: "#161513", ink: "#f5f3ee", accent: "#e4875f" }} />
        <ThemeCard active={theme === "light"} onClick={() => setTheme("light")} label="Light" preview={{ bg: "#faf9f7", ink: "#1a1815", accent: "#a8502c" }} />
        <ThemeCard active={theme === "auto"} onClick={() => setTheme("auto")} label="Auto" preview={{ bg: "linear-gradient(135deg, #161513 0%, #161513 49%, #faf9f7 51%, #faf9f7 100%)", ink: "#aba79c", accent: "#c66c45" }} />
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 10 }}>
        Auto follows your phone's light or dark setting.
      </div>
    </div>
  );
}

function ThemeCard({ active, onClick, label, preview }) {
  return (
    <button onClick={onClick} style={{
      padding: 14, borderRadius: 12,
      background: active ? "var(--bg-2)" : "transparent",
      border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
      cursor: "pointer", fontFamily: "inherit", textAlign: "left",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{
        height: 50, borderRadius: 8, padding: 8,
        background: preview.bg,
        border: "1px solid var(--line-soft)",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: preview.accent }} />
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: preview.ink, opacity: 0.5 }} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{label}</div>
    </button>
  );
}

/* unit: "$" shows before the value; "%" or "h" after it. */
function RateInput({ label, value, onChange, error, unit }) {
  const pre = unit === "$";
  return (
    <div>
      <div className="label" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ position: "relative" }}>
        {unit && (
          <span aria-hidden style={{
            position: "absolute", top: "50%", transform: "translateY(-50%)",
            [pre ? "left" : "right"]: 12, color: "var(--ink-faint)", fontSize: 14, pointerEvents: "none",
          }}>{unit}</span>
        )}
        <input
          inputMode="decimal" value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          aria-invalid={error ? "true" : undefined}
          style={{
            width: "100%", background: "var(--bg-2)",
            border: `1px solid ${error ? "color-mix(in oklab, var(--warn) 55%, var(--line))" : "var(--line)"}`,
            borderRadius: 10, padding: `9px ${unit && !pre ? 30 : 12}px 9px ${pre ? 24 : 12}px`,
            color: "var(--ink)", fontSize: 16, outline: "none", fontFamily: "inherit",
          }}
        />
      </div>
      {error && <div style={{ fontSize: 11.5, color: "var(--warn)", marginTop: 4 }}>{error}</div>}
    </div>
  );
}

/* ============ Autofill ============ */
function AutofillModal({ period, mode, defaultDist, rotationAnchor, existing, onApply, onClose }) {
  const { ref: dialogRef, closing, close } = useModalDismiss(onClose);
  const days = periodDays(period);
  const [startKey, setStartKey] = useStateM(ymd(period.start));
  // Rotation: any day the person works a 7AM, picked on the same calendar as
  // the Home setup. Starts from the saved rotation when there is one.
  const [am7Key, setAm7Key] = useStateM(() => am7InPeriod(period, rotationAnchor) || ymd(period.start));
  const [pattern, setPattern] = useStateM("rotation");
  const [span, setSpan] = useStateM("rest");
  const [dist, setDist] = useStateM(defaultDist || "S");
  const [preserve, setPreserve] = useStateM(true);
  const isRotation = pattern === "rotation";

  const preview = isRotation
    ? rotationEntries(period, am7Key, dist)
    : autofillPattern(period, { startKey, pattern, days: span, defaultDist: dist });
  const hasShifts = (e) => !!e && (e.am7 || e.pm3 || e.pm10);
  const fillCount = Object.keys(preview).filter(
    (k) => !(preserve && hasShifts(existing?.[k]))
  ).length;

  return (
    <div onClick={close} className={"nsc-backdrop" + (closing ? " is-closing" : "")} style={{
      position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.55)",
      backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div ref={dialogRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className={"nsc-modal nsc-center" + (closing ? " is-closing" : "")} style={{
        width: "100%", maxWidth: 520, maxHeight: "88vh", overflow: "auto",
        background: "var(--bg-1)", border: "1px solid var(--line)",
        borderRadius: 18, padding: 18, outline: "none",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Auto-fill shifts</div>
          <button onClick={close} style={iconBtn()} aria-label="Close">✕</button>
        </div>

        <FieldLabel>Pattern</FieldLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          <PatternCard active={isRotation} onClick={() => setPattern("rotation")}
            title="Standard rotation" desc="4-day cycle with an off day" />
          <PatternCard active={pattern === "am7"} onClick={() => setPattern("am7")} title="7AM only" desc="8h shifts" color="var(--am)" />
          <PatternCard active={pattern === "pm3"} onClick={() => setPattern("pm3")} title="3PM only" desc="7h shifts" color="var(--sp1)" />
          <PatternCard active={pattern === "pm10"} onClick={() => setPattern("pm10")} title="10PM only" desc="9h, crosses midnight" color="var(--sp2)" />
        </div>

        {isRotation ? (
          <RotationPicker period={period} value={am7Key} onChange={setAm7Key} />
        ) : (
          <>
            <FieldLabel>Start</FieldLabel>
            <select value={startKey} onChange={(e) => setStartKey(e.target.value)} style={selectStyle} aria-label="Start day">
              {days.map((d) => <option key={ymd(d)} value={ymd(d)}>
                {d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </option>)}
            </select>

            <FieldLabel>Fill</FieldLabel>
            <SegToggle full options={[
              { v: 7, l: "7 days" },
              { v: 14, l: "14 days" },
              { v: "rest", l: "Rest of period" },
            ]} value={span} onChange={setSpan} />
          </>
        )}

        {/* Only matters when distance varies per shift; otherwise the
            period-wide Short/Long applies. */}
        {mode === "advanced" && (
          <>
            <FieldLabel>Taxi distance</FieldLabel>
            <SegToggle options={[{ v: "S", l: "Short" }, { v: "L", l: "Long" }]} value={dist} onChange={setDist} />
          </>
        )}

        <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, cursor: "pointer", padding: "8px 0" }}>
          <input type="checkbox" checked={preserve} onChange={(e) => setPreserve(e.target.checked)} style={{ accentColor: "var(--accent)", width: 18, height: 18 }} />
          <span style={{ fontSize: 13.5 }}>Keep days that already have shifts</span>
        </label>

        <div style={{
          marginTop: 14, padding: "10px 12px", background: "var(--bg-2)", borderRadius: 10,
          fontSize: 12.5, color: "var(--ink-dim)",
        }}>
          Will fill <span className="mono" style={{ color: "var(--ink)", fontWeight: 600 }}>{fillCount}</span> day{fillCount === 1 ? "" : "s"} with shifts.
          {preserve && " Days you've already logged won't change."}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
          <button onClick={close} style={ghostBtn()}>Cancel</button>
          <button onClick={() => onApply(isRotation
            ? { pattern, am7Key, defaultDist: dist, preserve }
            : { startKey, pattern, days: span, defaultDist: dist, preserve })} style={accentBtn()}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function PatternCard({ active, onClick, title, desc, color }) {
  return (
    <button onClick={onClick} aria-pressed={active} style={{
      padding: "12px 12px",
      borderRadius: 10,
      background: active ? "var(--bg-2)" : "transparent",
      border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
      color: "var(--ink)", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {color && <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />}
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{title}</span>
      </div>
      <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>{desc}</span>
    </button>
  );
}

function FieldLabel({ children }) {
  return <div className="label" style={{ margin: "12px 0 6px" }}>{children}</div>;
}

const selectStyle = {
  width: "100%", background: "var(--bg-2)", border: "1px solid var(--line)",
  borderRadius: 10, padding: "10px 12px", color: "var(--ink)", fontSize: 14, fontFamily: "inherit",
};

Object.assign(window, { DayModal, SettingsModal, AutofillModal });
