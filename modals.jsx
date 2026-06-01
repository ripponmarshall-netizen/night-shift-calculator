/* modals.jsx — DayModal, SettingsModal, AutofillModal, RatesOnboardingBanner */
const { useState: useStateM } = React;

/* ============ Day modal ============ */
function DayModal({ dayKey, entry, mode, defaultDist, onClose, onChange, onClear }) {
  const { ref: dialogRef, closing, close } = useModalDismiss(onClose);
  const date = fromYmd(dayKey);
  const autoHolName = holidayName(date);
  const isAutoHoliday = !!autoHolName;
  const isHol = entry.holiday === null ? isAutoHoliday : entry.holiday;
  const toggle = (k) => onChange((e) => {
    const next = { ...e, [k]: !e[k], dist: { ...e.dist } };
    // first-time turning on: apply default distance for advanced
    if (!e[k] && mode === "advanced") next.dist[k] = defaultDist || "S";
    // turning off: drop any stale hours override so it can't silently re-apply
    if (e[k] && e.hours && e.hours[k] != null) {
      const hours = { ...e.hours };
      delete hours[k];
      next.hours = Object.keys(hours).length ? hours : undefined;
    }
    return next;
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
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Edit day</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginTop: 2 }}>
              {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </div>
            {autoHolName && <div className="mono" style={{ fontSize: 11, color: "var(--holiday)", marginTop: 2 }}>● {autoHolName}</div>}
          </div>
          <button onClick={close} style={iconBtn()} aria-label="Close">✕</button>
        </div>

        <DayToggle label="7AM shift" hours="8h" color="var(--am)" active={entry.am7} onClick={() => toggle("am7")} />
        {entry.am7 && <HoursRow keyName="am7" entry={entry} onChange={setHours} />}
        {mode === "advanced" && entry.am7 && <DistRow value={entry.dist.am7} onChange={(v) => setDist("am7", v)} />}
        <DayToggle label="3PM shift" hours="7h" color="var(--sp1)" active={entry.pm3} onClick={() => toggle("pm3")} />
        {entry.pm3 && <HoursRow keyName="pm3" entry={entry} onChange={setHours} />}
        {mode === "advanced" && entry.pm3 && <DistRow value={entry.dist.pm3} onChange={(v) => setDist("pm3", v)} />}
        <DayToggle label="10PM shift" hours="9h · crosses midnight" color="var(--sp2)" active={entry.pm10} onClick={() => toggle("pm10")} />
        {entry.pm10 && <HoursRow keyName="pm10" entry={entry} onChange={setHours} hint="total · crosses midnight" />}
        {mode === "advanced" && entry.pm10 && <DistRow value={entry.dist.pm10} onChange={(v) => setDist("pm10", v)} />}

        <div style={{ height: 1, background: "var(--line-soft)", margin: "12px 0" }} />

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 12px", gap: 8,
          background: "var(--bg-2)", borderRadius: 10,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Public holiday</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 2 }}>
              {entry.holiday === null ? (isAutoHoliday ? "Auto · holiday" : "Auto · regular") : (isHol ? "Override · holiday" : "Override · regular")}
            </div>
          </div>
          <SegToggle
            small
            options={[{ v: "auto", l: "Auto" }, { v: "off", l: "Regular" }, { v: "on", l: "Holiday" }]}
            value={entry.holiday === null ? "auto" : entry.holiday ? "on" : "off"}
            onChange={(v) => setHoliday(v === "auto" ? null : v === "on")}
          />
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

function DayToggle({ label, hours, color, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12,
      width: "100%", padding: "12px 12px",
      background: active ? "color-mix(in oklab, " + color + " 14%, transparent)" : "var(--bg-2)",
      border: `1px solid ${active ? "color-mix(in oklab, " + color + " 50%, transparent)" : "var(--line)"}`,
      borderRadius: 10, color: "var(--ink)",
      marginBottom: 8, cursor: "pointer", textAlign: "left",
      transition: "background 0.12s, border-color 0.12s",
      fontFamily: "inherit",
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: 6,
        border: `1.5px solid ${active ? color : "var(--line)"}`,
        background: active ? color : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {active && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6.5L4.8 9L10 3.5" stroke="var(--bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 2 }}>{hours}</div>
      </div>
    </button>
  );
}

function DistRow({ value, onChange }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", margin: "-4px 0 8px 38px" }}>
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, margin: "-4px 0 8px 38px" }}>
      <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>
        Hours worked{hint ? ` · ${hint}` : ""}
      </span>
      <input
        inputMode="decimal" value={raw} placeholder={String(std)}
        onChange={(e) => onChange(keyName, e.target.value)}
        aria-label={`Hours worked for ${keyName}`}
        style={{ width: 64, background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 9px", color: "var(--ink)", fontSize: 14, outline: "none", fontFamily: "inherit", textAlign: "right" }}
      />
      <span className="mono" style={{ fontSize: 11, color: "var(--ink-faint)" }}>h</span>
    </div>
  );
}

/* ============ Settings ============ */
function SettingsModal({ rates, setRates, tax, setTax, ratesHistory, setRatesHistory, theme, setTheme, onClose }) {
  const [tab, setTab] = useStateM("rates");
  const { ref: dialogRef, closing, close } = useModalDismiss(onClose);
  return (
    <div onClick={close} className={"nsc-backdrop" + (closing ? " is-closing" : "")} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div ref={dialogRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className={"nsc-modal nsc-center" + (closing ? " is-closing" : "")} style={{ width: "100%", maxWidth: 520, maxHeight: "88vh", overflow: "auto", background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 18, padding: 18, outline: "none" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Settings</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginTop: 2 }}>Configuration</div>
          </div>
          <button onClick={close} style={iconBtn()}>✕</button>
        </div>
        <div style={{ marginBottom: 14 }}>
          <SegToggle options={[
            { v: "rates", l: "Rates" },
            { v: "tax", l: "Tax" },
            { v: "history", l: "Rate history" },
            { v: "theme", l: "Theme" },
          ]} value={tab} onChange={setTab} small />
        </div>
        <div style={{ display: tab === "rates" ? "block" : "none" }}><RatesTab rates={rates} setRates={setRates} /></div>
        <div style={{ display: tab === "tax" ? "block" : "none" }}><TaxTab tax={tax} setTax={setTax} /></div>
        <div style={{ display: tab === "history" ? "block" : "none" }}><RateHistoryTab ratesHistory={ratesHistory} setRatesHistory={setRatesHistory} currentRates={rates} /></div>
        <div style={{ display: tab === "theme" ? "block" : "none" }}><ThemeTab theme={theme} setTheme={setTheme} /></div>
      </div>
    </div>
  );
}

const ratesToDraft = (r) => {
  const out = {};
  for (const k of Object.keys(r)) out[k] = String(r[k]);
  return out;
};

function RatesTab({ rates, setRates }) {
  const [draft, setDraft] = useStateM(() => ratesToDraft(rates));
  const [saved, setSaved] = useStateM(false);
  const [errors, setErrors] = useStateM({});
  const set = (k, v) => {
    setSaved(false);
    setErrors((e) => { if (!e[k]) return e; const n = { ...e }; delete n[k]; return n; });
    setDraft((p) => ({ ...p, [k]: sanitizeDecimal(v) }));
  };
  const save = () => {
    const num = {};
    const errs = {};
    for (const k of Object.keys(draft)) {
      const v = Number(draft[k]);
      if (draft[k] === "" || !Number.isFinite(v) || v < 0) errs[k] = "Must be ≥ 0";
      else num[k] = v;
    }
    if (!(Number(draft.threshold) > 0)) errs.threshold = "Must be > 0";
    if (Object.keys(errs).length) { setErrors(errs); setSaved(false); return; }
    setErrors({});
    setRates(num);
    setSaved(true);
  };
  const hasErrors = Object.keys(errors).length > 0;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <RateInput label="SP1 (3PM, per shift)" value={draft.sp1} onChange={(v) => set("sp1", v)} error={errors.sp1} />
        <RateInput label="SP2 (10PM, per shift)" value={draft.sp2} onChange={(v) => set("sp2", v)} error={errors.sp2} />
        <RateInput label="Meal (per shift)" value={draft.meal} onChange={(v) => set("meal", v)} error={errors.meal} />
        <RateInput label="Threshold (hours)" value={draft.threshold} onChange={(v) => set("threshold", v)} error={errors.threshold} />
        <RateInput label="Taxi — Short" value={draft.taxiShort} onChange={(v) => set("taxiShort", v)} error={errors.taxiShort} />
        <RateInput label="Taxi — Long" value={draft.taxiLong} onChange={(v) => set("taxiLong", v)} error={errors.taxiLong} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end", alignItems: "center" }}>
        {hasErrors ? <span className="mono" style={{ fontSize: 11.5, color: "var(--warn)", marginRight: "auto" }}>Fix highlighted fields</span>
          : saved && <span className="mono" style={{ fontSize: 11.5, color: "var(--ok)", marginRight: "auto" }}>Saved ✓</span>}
        <button onClick={() => { setDraft(ratesToDraft(DEFAULT_RATES)); setSaved(false); setErrors({}); }} style={ghostBtn()}>Defaults</button>
        <button onClick={save} style={primaryBtn()}>Save</button>
      </div>
    </div>
  );
}

const taxToDraft = (t) => {
  const out = {};
  for (const k of Object.keys(t)) out[k] = typeof t[k] === "boolean" ? t[k] : String(t[k]);
  return out;
};

const TAX_PCT_KEYS = new Set(["nis", "nht", "eduTax", "payeRate1", "payeRate2", "pension"]);

function TaxTab({ tax, setTax }) {
  const [draft, setDraft] = useStateM(() => taxToDraft(tax));
  const [saved, setSaved] = useStateM(false);
  const [errors, setErrors] = useStateM({});
  const set = (k, v) => {
    setSaved(false);
    setErrors((e) => { if (!e[k]) return e; const n = { ...e }; delete n[k]; return n; });
    setDraft((p) => ({ ...p, [k]: typeof v === "boolean" ? v : sanitizeDecimal(v) }));
  };
  const save = () => {
    const out = {};
    const errs = {};
    for (const k of Object.keys(draft)) {
      if (typeof draft[k] === "boolean") { out[k] = draft[k]; continue; }
      const v = Number(draft[k]);
      if (draft[k] === "" || !Number.isFinite(v) || v < 0) errs[k] = "Must be ≥ 0";
      else if (TAX_PCT_KEYS.has(k) && v > 100) errs[k] = "0–100%";
      else out[k] = v;
    }
    if (Object.keys(errs).length) { setErrors(errs); setSaved(false); return; }
    setErrors({});
    setTax(out);
    setSaved(true);
  };
  const hasErrors = Object.keys(errors).length > 0;
  return (
    <div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", cursor: "pointer" }}>
        <input type="checkbox" checked={draft.enabled} onChange={(e) => set("enabled", e.target.checked)} style={{ accentColor: "var(--accent)" }} />
        <span style={{ fontSize: 13.5 }}>Calculate Jamaica payroll deductions (NIS, NHT, Education Tax, PAYE)</span>
      </label>
      {draft.enabled && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
            <RateInput label="NIS %" value={draft.nis} onChange={(v) => set("nis", v)} error={errors.nis} />
            <RateInput label="NIS cap (monthly)" value={draft.nisCapMonthly} onChange={(v) => set("nisCapMonthly", v)} error={errors.nisCapMonthly} />
            <RateInput label="NHT %" value={draft.nht} onChange={(v) => set("nht", v)} error={errors.nht} />
            <RateInput label="Education Tax %" value={draft.eduTax} onChange={(v) => set("eduTax", v)} error={errors.eduTax} />
            <RateInput label="PAYE threshold (monthly)" value={draft.payeThreshold} onChange={(v) => set("payeThreshold", v)} error={errors.payeThreshold} />
            <RateInput label="PAYE rate (lower) %" value={draft.payeRate1} onChange={(v) => set("payeRate1", v)} error={errors.payeRate1} />
            <RateInput label="PAYE break point" value={draft.payeBreak2} onChange={(v) => set("payeBreak2", v)} error={errors.payeBreak2} />
            <RateInput label="PAYE rate (upper) %" value={draft.payeRate2} onChange={(v) => set("payeRate2", v)} error={errors.payeRate2} />
            <RateInput label="Pension % (if any)" value={draft.pension} onChange={(v) => set("pension", v)} error={errors.pension} />
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 10, lineHeight: 1.5 }}>
            Defaults follow Jamaica's 2024/2025 brackets. Verify against your most recent pay slip. Estimates only.
          </div>
        </>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end", alignItems: "center" }}>
        {hasErrors ? <span className="mono" style={{ fontSize: 11.5, color: "var(--warn)", marginRight: "auto" }}>Fix highlighted fields</span>
          : saved && <span className="mono" style={{ fontSize: 11.5, color: "var(--ok)", marginRight: "auto" }}>Saved ✓</span>}
        <button onClick={() => { setDraft(taxToDraft(DEFAULT_TAX)); setSaved(false); setErrors({}); }} style={ghostBtn()}>Defaults</button>
        <button onClick={save} style={primaryBtn()}>Save</button>
      </div>
    </div>
  );
}

function RateHistoryTab({ ratesHistory, setRatesHistory, currentRates }) {
  const [date, setDate] = useStateM("");
  const list = [...(ratesHistory || [])].sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom));
  const addEntry = () => {
    if (!date) { alert("Pick an effective-from date."); return; }
    const entry = { effectiveFrom: date, rates: { ...currentRates } };
    setRatesHistory([...(ratesHistory || []), entry]);
    setDate("");
  };
  return (
    <div>
      <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-dim)", marginBottom: 12, lineHeight: 1.5 }}>
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
          {list.map((e, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              padding: "10px 12px",
              background: "var(--bg-2)", border: "1px solid var(--line-soft)", borderRadius: 10,
            }}>
              <div>
                <div className="mono" style={{ fontSize: 11.5, color: "var(--ink)" }}>Effective from {new Date(e.effectiveFrom).toLocaleDateString()}</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 2 }}>
                  SP1 {fmt(e.rates.sp1)} · SP2 {fmt(e.rates.sp2)} · Meal {fmt(e.rates.meal)}
                </div>
              </div>
              <button onClick={() => setRatesHistory(ratesHistory.filter((_, j) => j !== i))} style={iconBtn()} aria-label="Delete">✕</button>
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
      <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-dim)", marginBottom: 12 }}>Appearance</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <ThemeCard active={theme === "dark"} onClick={() => setTheme("dark")} label="Dark" preview={{ bg: "#0b0b0c", ink: "#f4f4f5", accent: "#e8a661" }} />
        <ThemeCard active={theme === "light"} onClick={() => setTheme("light")} label="Light" preview={{ bg: "#faf9f7", ink: "#1a1815", accent: "#a06226" }} />
        <ThemeCard active={theme === "auto"} onClick={() => setTheme("auto")} label="Auto" preview={{ bg: "linear-gradient(135deg, #0b0b0c 0%, #0b0b0c 49%, #faf9f7 51%, #faf9f7 100%)", ink: "#a1a1aa", accent: "#c98a44" }} />
      </div>
      <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 10 }}>
        Auto follows your device's system appearance.
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

function RateInput({ label, value, onChange, error }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
      <input
        inputMode="decimal" value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        aria-invalid={error ? "true" : undefined}
        style={{ width: "100%", background: "var(--bg-2)", border: `1px solid ${error ? "color-mix(in oklab, var(--warn) 55%, var(--line))" : "var(--line)"}`, borderRadius: 10, padding: "9px 12px", color: "var(--ink)", fontSize: 15, outline: "none", fontFamily: "inherit" }}
      />
      {error && <div className="mono" style={{ fontSize: 10, color: "var(--warn)", marginTop: 4 }}>{error}</div>}
    </div>
  );
}

/* ============ Autofill ============ */
function AutofillModal({ period, defaultDist, existing, onApply, onClose }) {
  const { ref: dialogRef, closing, close } = useModalDismiss(onClose);
  const days = periodDays(period);
  const [startKey, setStartKey] = useStateM(ymd(period.start));
  const [pattern, setPattern] = useStateM("rotation");
  const [span, setSpan] = useStateM("rest");
  const [dist, setDist] = useStateM(defaultDist || "S");
  const [preserve, setPreserve] = useStateM(true);

  const preview = autofillPattern(period, { startKey, pattern, days: span, defaultDist: dist });
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
          <div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Auto-fill</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginTop: 2 }}>Pattern</div>
          </div>
          <button onClick={close} style={iconBtn()}>✕</button>
        </div>

        <FieldLabel>Pattern</FieldLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          <PatternCard active={pattern === "rotation"} onClick={() => setPattern("rotation")}
            title="Standard rotation" desc="7AM → 3PM → 10PM → rest, repeating" />
          <PatternCard active={pattern === "am7"} onClick={() => setPattern("am7")} title="7AM only" desc="8h shifts" color="var(--am)" />
          <PatternCard active={pattern === "pm3"} onClick={() => setPattern("pm3")} title="3PM only" desc="7h shifts" color="var(--sp1)" />
          <PatternCard active={pattern === "pm10"} onClick={() => setPattern("pm10")} title="10PM only" desc="9h, crosses midnight" color="var(--sp2)" />
        </div>

        <FieldLabel>Start</FieldLabel>
        <select value={startKey} onChange={(e) => setStartKey(e.target.value)} style={selectStyle}>
          {days.map((d) => <option key={ymd(d)} value={ymd(d)}>
            {d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </option>)}
        </select>

        <FieldLabel>Fill</FieldLabel>
        <SegToggle options={[
          { v: 7, l: "Next 7 days" },
          { v: 14, l: "14 days" },
          { v: "rest", l: "Rest of period" },
        ]} value={span} onChange={setSpan} />

        <FieldLabel>Distance default</FieldLabel>
        <SegToggle options={[{ v: "S", l: "Short" }, { v: "L", l: "Long" }]} value={dist} onChange={setDist} />

        <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, cursor: "pointer", padding: "8px 0" }}>
          <input type="checkbox" checked={preserve} onChange={(e) => setPreserve(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
          <span style={{ fontSize: 13.5 }}>Preserve days that already have shifts</span>
        </label>

        <div style={{
          marginTop: 14, padding: "10px 12px", background: "var(--bg-2)", borderRadius: 10,
          fontSize: 12.5, color: "var(--ink-dim)",
        }}>
          Will create <span className="mono" style={{ color: "var(--ink)", fontWeight: 600 }}>{fillCount}</span> day{fillCount === 1 ? "" : "s"} of shifts.
          {preserve && " Existing days won't be overwritten."}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
          <button onClick={close} style={ghostBtn()}>Cancel</button>
          <button onClick={() => onApply({ startKey, pattern, days: span, defaultDist: dist, preserve })} style={accentBtn()}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function PatternCard({ active, onClick, title, desc, color }) {
  return (
    <button onClick={onClick} style={{
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
      <span className="mono" style={{ fontSize: 11, color: "var(--ink-faint)" }}>{desc}</span>
    </button>
  );
}

function FieldLabel({ children }) {
  return <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "10px 0 6px" }}>{children}</div>;
}

const selectStyle = {
  width: "100%", background: "var(--bg-2)", border: "1px solid var(--line)",
  borderRadius: 10, padding: "10px 12px", color: "var(--ink)", fontSize: 14, fontFamily: "inherit",
};

/* ============ Rates onboarding banner ============ */
function RatesOnboardingBanner({ onOpen, onDismiss }) {
  return (
    <div style={{
      maxWidth: 720, margin: "12px auto 0", padding: "12px 14px",
      background: "color-mix(in oklab, var(--accent) 14%, transparent)",
      border: "1px solid color-mix(in oklab, var(--accent) 40%, transparent)",
      borderRadius: 12,
      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      marginInline: 20,
    }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>Set your pay rates first</div>
        <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-dim)", marginTop: 2, lineHeight: 1.45 }}>
          SP1, SP2, and Meal are placeholders. Open Settings to set them to your actual entitlements.
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={onOpen} style={accentBtn()}>Open Settings</button>
        <button onClick={onDismiss} style={ghostBtn()}>Dismiss</button>
      </div>
    </div>
  );
}

Object.assign(window, { DayModal, SettingsModal, AutofillModal, RatesOnboardingBanner });
