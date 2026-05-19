/* app.jsx — main app with bottom taskbar (live total + Quick/Detailed/History), desktop 2-col, cross-check highlights */

const { useState, useEffect, useMemo, useRef, useCallback } = React;

function App() {
  const initial = loadState();
  const [mode, setMode] = useState(initial.mode || "basic");
  const [view, setView] = useState("calc");
  const [periodAnchor, setPeriodAnchor] = useState(initial.periodAnchor || ymd(new Date()));
  const [entries, setEntries] = useState(initial.entries || {});
  const [basicDistance, setBasicDistance] = useState(initial.basicDistance || "S");
  const [defaultDist, setDefaultDist] = useState(initial.defaultDist || "S");
  const [counts, setCounts] = useState(initial.counts || { pm3: "", pm10: "", am7: "" });
  const [basePay, setBasePay] = useState(initial.basePay || { monthly: "", compulsory: "" });
  const [rates, setRates] = useState(initial.rates || DEFAULT_RATES);
  const [tax, setTax] = useState(initial.tax || DEFAULT_TAX);
  const [ratesHistory, setRatesHistory] = useState(initial.ratesHistory || []);
  const [templates, setTemplates] = useState(initial.templates || []);
  const [snapshots, setSnapshots] = useState(initial.snapshots || []);
  const [theme, setTheme] = useState(initial.theme || "dark");
  const [onboarded, setOnboarded] = useState(initial.onboarded ?? false);
  const [openDay, setOpenDay] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autofillOpen, setAutofillOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [reconcileTarget, setReconcileTarget] = useState(null);
  const [highlightDays, setHighlightDays] = useState(null);
  const [clipboard, setClipboard] = useState(null);

  const period = useMemo(() => periodFor(fromYmd(periodAnchor)), [periodAnchor]);
  const effectiveRates = useMemo(() => ratesAt(period, ratesHistory, rates), [period, ratesHistory, rates]);

  useEffect(() => {
    saveState({ mode, periodAnchor, entries, basicDistance, defaultDist, counts, basePay, rates, tax, ratesHistory, templates, snapshots, theme, onboarded });
  }, [mode, periodAnchor, entries, basicDistance, defaultDist, counts, basePay, rates, tax, ratesHistory, templates, snapshots, theme, onboarded]);

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    const meta = document.getElementById("theme-color-meta");
    if (meta) meta.setAttribute("content", theme === "light" ? "#faf9f7" : "#0b0b0c");
  }, [theme]);

  const totals = useMemo(
    () => aggregate(entries, period, mode, basicDistance, counts, basePay, effectiveRates),
    [entries, period, mode, basicDistance, counts, basePay, effectiveRates]
  );

  const setEntry = (key, updater) => {
    setEntries((prev) => {
      const next = { ...prev };
      const cur = prev[key] ? { ...prev[key], dist: { ...prev[key].dist } } : blankDay();
      const updated = updater(cur);
      const empty = !updated.am7 && !updated.pm3 && !updated.pm10 && updated.holiday === null;
      if (empty) delete next[key]; else next[key] = updated;
      return next;
    });
  };

  const saveSnapshot = () => {
    const snap = {
      at: new Date().toISOString(),
      period: periodLabel(period),
      periodKey: periodKey(period),
      mode,
      basicDistance,
      totals: stripFunctions(totals),
      counts,
      basePay,
      tax: { ...tax },
    };
    setSnapshots((prev) => {
      // de-dupe by periodKey: replace existing
      const filtered = prev.filter((s) => s.periodKey !== snap.periodKey);
      return [...filtered, snap];
    });
    flashTotal();
  };

  const deleteSnapshot = (at) => setSnapshots((prev) => prev.filter((s) => s.at !== at));
  const clearSnapshots = () => { if (confirm("Delete all snapshots?")) setSnapshots([]); };

  /* templates */
  const saveTemplate = (tpl) => setTemplates((prev) => [...prev, tpl]);
  const deleteTemplate = (id) => setTemplates((prev) => prev.filter((t) => t.id !== id));
  const applyTemplateToPeriod = (tpl, opts) => {
    const fill = applyTemplate(tpl, period, { preserve: opts?.preserve, existing: entries });
    setEntries((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(fill)) {
        if (opts?.preserve && prev[k] && (prev[k].am7 || prev[k].pm3 || prev[k].pm10)) continue;
        next[k] = v;
      }
      return next;
    });
  };

  /* reconciliation */
  const saveReconcile = (snapId, recon) => {
    setSnapshots((prev) => prev.map((s) => s.at === snapId ? { ...s, reconcile: recon } : s));
  };

  /* ICS export */
  const exportICS = () => {
    const periodEntries = {};
    for (const d of periodDays(period)) {
      const k = ymd(d);
      if (entries[k]) periodEntries[k] = entries[k];
    }
    if (Object.keys(periodEntries).length === 0) {
      alert("No shifts logged for this period.");
      return;
    }
    const ics = toICS(periodEntries);
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `night-shift-${periodAnchor}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* clipboard (long-press to copy day shifts) */
  const copyDay = (key) => {
    const e = entries[key];
    if (!e || (!e.am7 && !e.pm3 && !e.pm10)) return false;
    setClipboard({ srcKey: key, entry: { ...e, dist: { ...e.dist } } });
    return true;
  };
  const pasteDay = (key) => {
    if (!clipboard) return false;
    setEntries((prev) => ({ ...prev, [key]: { ...clipboard.entry, dist: { ...clipboard.entry.dist }, holiday: null } }));
    return true;
  };
  const cancelCopy = () => setClipboard(null);

  const reset = () => {
    if (!confirm("Reset current period inputs (calendar, counts, base pay)? Rates and snapshots are kept.")) return;
    setEntries({});
    setCounts({ pm3: "", pm10: "", am7: "" });
    setBasePay({ monthly: "", compulsory: "" });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ mode, periodAnchor, entries, basicDistance, defaultDist, counts, basePay, rates, snapshots }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `night-shift-${periodAnchor}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importJson = () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "application/json";
    inp.onchange = async () => {
      const f = inp.files?.[0]; if (!f) return;
      try {
        const obj = JSON.parse(await f.text());
        if (obj.mode) setMode(obj.mode);
        if (obj.periodAnchor) setPeriodAnchor(obj.periodAnchor);
        if (obj.entries) setEntries(obj.entries);
        if (obj.basicDistance) setBasicDistance(obj.basicDistance);
        if (obj.defaultDist) setDefaultDist(obj.defaultDist);
        if (obj.counts) setCounts(obj.counts);
        if (obj.basePay) setBasePay(obj.basePay);
        if (obj.rates) setRates(obj.rates);
        if (obj.snapshots) setSnapshots(obj.snapshots);
      } catch (e) { alert("Could not import file."); }
    };
    inp.click();
  };

  const copySummary = () => {
    const t = totals;
    const txt = [
      `Night Shift — ${periodLabel(period)}`,
      `SP1 ${fmt(t.sp1)}  SP2 ${fmt(t.sp2)}  Meal ${fmt(t.meal)}  Taxi ${fmt(t.taxi)}`,
      `Allowance ${fmt(t.allowanceSubtotal)}  Base ${fmt(t.baseSubtotal)}  Extra ${fmt(t.extraSubtotal)}`,
      `Total ${fmt(t.grand)}`,
    ].join("\n");
    navigator.clipboard?.writeText(txt);
    alert("Copied to clipboard.");
  };

  const applyAutofill = (opts) => {
    const fill = autofillPattern(period, opts);
    setEntries((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(fill)) {
        if (opts.preserve && prev[k] && (prev[k].am7 || prev[k].pm3 || prev[k].pm10)) continue;
        next[k] = v;
      }
      return next;
    });
    setAutofillOpen(false);
  };

  const onWarningClick = () => {
    // highlight all calendar days briefly, scroll to calendar
    const allKeys = new Set(periodDays(period).map(ymd));
    setHighlightDays(allKeys);
    setTimeout(() => setHighlightDays(null), 3000);
    const cal = document.getElementById("calendar-section");
    if (cal) cal.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* taskbar interactions */
  const onTab = (id) => {
    if (id === "history") { setView("history"); return; }
    setView("calc");
    if (id === "basic" || id === "advanced") setMode(id);
  };
  const activeTab = view === "history" ? "history" : view === "about" ? "about" : mode;

  /* flash total animation hook */
  const totalChipRef = useRef(null);
  const flashTotal = () => {
    if (!totalChipRef.current) return;
    totalChipRef.current.classList.remove("flash");
    void totalChipRef.current.offsetWidth;
    totalChipRef.current.classList.add("flash");
  };

  return (
    <div data-screen-label={view === "history" ? "History" : view === "about" ? "About" : "Calculator"}
         style={{ paddingBottom: `calc(120px + var(--safe-bottom))` }}>
      <Header view={view} mode={mode} onSettings={() => setSettingsOpen(true)} period={period} setPeriodAnchor={setPeriodAnchor} />

      {!onboarded && (
        <RatesOnboardingBanner
          onOpen={() => { setSettingsOpen(true); setOnboarded(true); }}
          onDismiss={() => setOnboarded(true)}
        />
      )}

      {view === "calc" && (
        <CalcView
          period={period} entries={entries} mode={mode}
          counts={counts} setCounts={setCounts}
          basePay={basePay} setBasePay={setBasePay}
          basicDistance={basicDistance} setBasicDistance={setBasicDistance}
          defaultDist={defaultDist} setDefaultDist={setDefaultDist}
          totals={totals}
          tax={tax}
          clipboard={clipboard}
          highlightDays={highlightDays}
          onShiftPeriod={(d) => setPeriodAnchor(ymd(shiftPeriod(period, d).start))}
          onOpenDay={(d) => setOpenDay(ymd(d))}
          onAutofill={() => setAutofillOpen(true)}
          onTemplates={() => setTemplatesOpen(true)}
          onSaveSnapshot={saveSnapshot}
          onCopyShare={copySummary}
          onExportICS={exportICS}
          onReset={reset}
          onExport={exportJson}
          onImport={importJson}
          onWarningClick={onWarningClick}
          copyDay={copyDay}
          pasteDay={pasteDay}
          cancelCopy={cancelCopy}
        />
      )}

      {view === "history" && (
        <SnapshotsView
          snapshots={snapshots}
          theme={theme}
          onDelete={deleteSnapshot}
          onClear={clearSnapshots}
          onBack={() => setView("calc")}
          onReconcile={(snap) => setReconcileTarget(snap)}
        />
      )}

      {view === "about" && <AboutView onBack={() => setView("calc")} />}

      <Taskbar
        activeTab={activeTab}
        onTab={onTab}
        total={totals.grand}
        hasInputs={Object.keys(entries).length > 0}
        snapshotCount={snapshots.length}
        totalChipRef={totalChipRef}
        onAboutToggle={() => setView(view === "about" ? "calc" : "about")}
      />

      {openDay && (
        <DayModal
          dayKey={openDay}
          entry={entries[openDay] || blankDay()}
          mode={mode}
          defaultDist={defaultDist}
          onClose={() => setOpenDay(null)}
          onChange={(updater) => setEntry(openDay, updater)}
          onClear={() => { setEntries((p) => { const n = { ...p }; delete n[openDay]; return n; }); setOpenDay(null); }}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          rates={rates} setRates={(r) => { setRates(r); setSettingsOpen(false); }}
          tax={tax} setTax={(t) => { setTax(t); setSettingsOpen(false); }}
          ratesHistory={ratesHistory} setRatesHistory={setRatesHistory}
          theme={theme} setTheme={setTheme}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {autofillOpen && <AutofillModal period={period} defaultDist={defaultDist} onApply={applyAutofill} onClose={() => setAutofillOpen(false)} />}
      {templatesOpen && (
        <TemplatesModal
          templates={templates}
          onSave={saveTemplate}
          onDelete={deleteTemplate}
          onApply={applyTemplateToPeriod}
          currentEntries={entries}
          period={period}
          onClose={() => setTemplatesOpen(false)}
        />
      )}
      {reconcileTarget && (
        <ReconcileModal
          snapshot={reconcileTarget}
          onSave={(recon) => saveReconcile(reconcileTarget.at, recon)}
          onClose={() => setReconcileTarget(null)}
        />
      )}

      <GlobalStyle />
    </div>
  );
}

/* ============ Header ============ */
function Header({ view, mode, onSettings, period, setPeriodAnchor }) {
  const subtitle = view === "history" ? "History" : view === "about" ? "About" : mode === "basic" ? "Quick" : "Detailed";
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 30,
      background: "rgba(11,11,12,0.85)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      borderBottom: "1px solid var(--line-soft)",
    }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "calc(var(--safe-top) + 14px) 20px 10px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.12em", color: "var(--ink-faint)", textTransform: "uppercase" }}>
            Pay calculator · {subtitle}
          </div>
          <h1 style={{ margin: "2px 0 0", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em" }}>Night Shift Calculator</h1>
        </div>
        <button onClick={onSettings} title="Rates settings" aria-label="Settings" style={iconBtn()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </div>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 20px 10px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-dim)", flex: 1, minWidth: 0 }}>
          Period · <span style={{ color: "var(--ink)" }}>{periodLabel(period)}</span>
        </div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>Rates effective May 2026</div>
      </div>
    </header>
  );
}

/* ============ Calc view (with desktop 2-col layout) ============ */
function CalcView(props) {
  const {
    period, entries, mode, counts, setCounts, basePay, setBasePay,
    basicDistance, setBasicDistance, defaultDist, setDefaultDist,
    totals, tax, clipboard, highlightDays,
    onShiftPeriod, onOpenDay, onAutofill, onTemplates, onSaveSnapshot, onCopyShare,
    onExportICS, onReset, onExport, onImport, onWarningClick,
    copyDay, pasteDay, cancelCopy,
  } = props;

  return (
    <main className="calc-grid" style={{ maxWidth: 1180, margin: "0 auto", padding: "16px 20px 0" }}>
      <div className="calc-left" id="calendar-section">
        <Calendar
          period={period}
          entries={entries}
          mode={mode}
          totals={totals}
          highlight={highlightDays}
          onShift={onShiftPeriod}
          onOpenDay={onOpenDay}
          onAutofill={onAutofill}
          onTemplates={onTemplates}
          defaultDist={defaultDist}
          setDefaultDist={setDefaultDist}
          clipboard={clipboard}
          copyDay={copyDay}
          pasteDay={pasteDay}
          cancelCopy={cancelCopy}
        />
      </div>
      <div className="calc-right">
        <ShiftCountsCard
          mode={mode}
          counts={counts}
          setCounts={setCounts}
          basicDistance={basicDistance}
          setBasicDistance={setBasicDistance}
          totals={totals}
          onWarningClick={onWarningClick}
        />

        <BasePayCard basePay={basePay} setBasePay={setBasePay} />

        <LiveSummary
          totals={totals}
          mode={mode}
          basicDistance={basicDistance}
          tax={tax}
          onSaveSnapshot={onSaveSnapshot}
          onCopyShare={onCopyShare}
        />

        <Card>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={onExportICS} style={ghostBtn()}>⤓ Export .ics</button>
            <button onClick={onExport} style={ghostBtn()}>Export JSON</button>
            <button onClick={onImport} style={ghostBtn()}>Import</button>
            <button onClick={onReset} style={ghostBtn()}>Reset period</button>
          </div>
        </Card>

        <div style={{ padding: "8px 4px 0", textAlign: "center" }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-faint)" }}>Workflow Coaching and Optimisation Co.</div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 2 }}>Portland Division · v3.0</div>
        </div>
      </div>
    </main>
  );
}

/* ============ Counts card ============ */
function ShiftCountsCard({ mode, counts, setCounts, basicDistance, setBasicDistance, totals, onWarningClick }) {
  const setC = (k, v) => setCounts((p) => ({ ...p, [k]: v.replace(/[^0-9]/g, "") }));
  return (
    <Card>
      <SectionHead title="Shift Counts" subtitle="Cross-check vs calendar" />

      {mode === "basic" ? (
        <>
          <div style={{ marginBottom: 12 }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Distance</div>
            <SegToggle
              options={[{ v: "S", l: "Short — $950" }, { v: "L", l: "Long — $2,000" }]}
              value={basicDistance} onChange={setBasicDistance}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <CountInput label="3PM" color="var(--sp1)" value={counts.pm3} onChange={(v) => setC("pm3", v)} expected={totals.cal.pm3} flag={totals.mismatch.pm3} />
            <CountInput label="10PM" color="var(--sp2)" value={counts.pm10} onChange={(v) => setC("pm10", v)} expected={totals.cal.pm10} flag={totals.mismatch.pm10} />
            <CountInput label="7AM" color="var(--am)" value={counts.am7} onChange={(v) => setC("am7", v)} expected={totals.cal.am7} flag={totals.mismatch.am7} />
          </div>
        </>
      ) : (
        <>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>From calendar (S / L)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
            <DistCell label="3PM" color="var(--sp1)" s={totals.cal.shortPm3} l={totals.cal.longPm3} />
            <DistCell label="10PM" color="var(--sp2)" s={totals.cal.shortPm10} l={totals.cal.longPm10} />
            <DistCell label="7AM" color="var(--am)" s={totals.cal.shortAm7} l={totals.cal.longAm7} />
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Cross-check (optional)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <CountInput label="3PM" color="var(--sp1)" value={counts.pm3} onChange={(v) => setC("pm3", v)} expected={totals.cal.pm3} flag={totals.mismatch.pm3} />
            <CountInput label="10PM" color="var(--sp2)" value={counts.pm10} onChange={(v) => setC("pm10", v)} expected={totals.cal.pm10} flag={totals.mismatch.pm10} />
            <CountInput label="7AM" color="var(--am)" value={counts.am7} onChange={(v) => setC("am7", v)} expected={totals.cal.am7} flag={totals.mismatch.am7} />
          </div>
        </>
      )}

      {totals.hasMismatch && (
        <button onClick={onWarningClick} style={{
          marginTop: 12, padding: "10px 12px", borderRadius: 10,
          background: "color-mix(in oklab, var(--warn) 12%, transparent)",
          border: "1px solid color-mix(in oklab, var(--warn) 40%, transparent)",
          color: "var(--warn)", fontSize: 12.5, display: "flex", alignItems: "center", gap: 8,
          width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
        }}>
          <span aria-hidden>⚠</span>
          <span style={{ flex: 1 }}>Entered counts don't match the calendar. Tap to review days.</span>
          <span style={{ fontSize: 11, opacity: 0.8 }}>→</span>
        </button>
      )}
    </Card>
  );
}

function CountInput({ label, color, value, onChange, expected, flag }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
        <span className="mono" style={{ fontSize: 11, color: "var(--ink-dim)" }}>{label}</span>
        <span style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 10, color: flag ? "var(--warn)" : "var(--ink-faint)" }}>cal {expected}</span>
      </div>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        style={{
          width: "100%",
          background: "var(--bg-1)",
          border: `1px solid ${flag ? "color-mix(in oklab, var(--warn) 50%, var(--line))" : "var(--line)"}`,
          borderRadius: 10, padding: "10px 12px", color: "var(--ink)",
          fontSize: 16, outline: "none", fontFamily: "inherit",
        }}
      />
    </div>
  );
}
function DistCell({ label, color, s, l }) {
  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
        <span className="mono" style={{ fontSize: 11, color: "var(--ink-dim)" }}>{label}</span>
      </div>
      <div className="mono" style={{ fontSize: 12.5 }}>
        <span style={{ color: "var(--ink)" }}>S {s}</span>
        <span style={{ color: "var(--ink-faint)" }}> · </span>
        <span style={{ color: "var(--ink)" }}>L {l}</span>
      </div>
    </div>
  );
}

/* ============ base pay ============ */
function BasePayCard({ basePay, setBasePay }) {
  const setP = (k, v) => setBasePay((p) => ({ ...p, [k]: v.replace(/[^0-9.]/g, "") }));
  return (
    <Card>
      <SectionHead title="Base Pay Inputs" subtitle="Drives hourly rate for OT" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <MoneyInput label="Monthly Basic Allowance" value={basePay.monthly} onChange={(v) => setP("monthly", v)} />
        <MoneyInput label="Compulsory Assignment Allowance" value={basePay.compulsory} onChange={(v) => setP("compulsory", v)} />
      </div>
    </Card>
  );
}
function MoneyInput({ label, value, onChange }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-faint)", fontSize: 14 }}>$</span>
        <input
          inputMode="decimal" value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          style={{
            width: "100%", background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 10,
            padding: "10px 12px 10px 24px", color: "var(--ink)", fontSize: 16, outline: "none", fontFamily: "inherit"
          }}
        />
      </div>
    </div>
  );
}

/* ============ About ============ */
function AboutView({ onBack }) {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "20px 20px 0" }}>
      <Card>
        <SectionHead title="About" subtitle="Personal productivity tool" />
        <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--ink-dim)" }}>
          <p>The Night Shift Calculator combines allowances, base pay, and extra-hours pay in one workflow, with calendar-based shift logging, mismatch cross-checks, snapshot history for sharing, and import/export support.</p>
          <p style={{ marginTop: 12 }}><strong style={{ color: "var(--ink)" }}>Quick</strong> uses one distance for the whole period. <strong style={{ color: "var(--ink)" }}>Detailed</strong> lets you set Short or Long per shift, per day.</p>
          <p style={{ marginTop: 12 }}>Public holidays are auto-marked from the Jamaica calendar — Easter, Good Friday, Easter Monday, Ash Wednesday, Heroes Day, and all fixed-date holidays. Override per day from the day editor.</p>
          <p style={{ marginTop: 12, color: "var(--ink-faint)" }}>Verify all results against official pay records. This is not official payroll advice.</p>
          <p style={{ marginTop: 12, color: "var(--ink-faint)" }}>Data stays on this device. Use Reset to clear local data.</p>
        </div>
        <div style={{ marginTop: 12 }}>
          <button onClick={onBack} style={primaryBtn()}>← Back</button>
        </div>
      </Card>
    </main>
  );
}

/* ============ Taskbar (with live total + tabs) ============ */
function Taskbar({ activeTab, onTab, total, hasInputs, snapshotCount, totalChipRef, onAboutToggle }) {
  const tabs = [
    { id: "basic", label: "Quick", icon: QuickIcon },
    { id: "advanced", label: "Detailed", icon: DetailedIcon },
    { id: "history", label: "History", icon: HistoryIcon, badge: snapshotCount },
  ];

  return (
    <nav aria-label="Calculator nav" style={{
      position: "fixed", left: 0, right: 0, bottom: 0,
      paddingBottom: "var(--safe-bottom)",
      zIndex: 40,
      pointerEvents: "none",
    }}>
      {/* Total chip — floats above tabs, only on calc view */}
      {activeTab !== "history" && activeTab !== "about" && (
        <div style={{ display: "flex", justifyContent: "center", padding: "0 16px 6px", pointerEvents: "none" }}>
          <div ref={totalChipRef} className="total-chip" style={{
            background: "rgba(20, 20, 24, 0.92)",
            backdropFilter: "blur(24px) saturate(140%)",
            WebkitBackdropFilter: "blur(24px) saturate(140%)",
            border: "1px solid color-mix(in oklab, var(--accent) 35%, var(--line))",
            borderRadius: 999,
            padding: "8px 14px",
            display: "inline-flex", alignItems: "center", gap: 10,
            boxShadow: "0 12px 32px -16px rgba(0,0,0,0.7)",
            pointerEvents: "auto",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: hasInputs ? "var(--accent)" : "var(--ink-faint)" }} />
            <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Est. Gross</span>
            <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.005em" }}>
              <AnimatedNumber value={total} format={fmt} />
            </span>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 540, margin: "0 auto", padding: "0 16px 14px", pointerEvents: "auto" }}>
        <div style={{
          background: "rgba(20, 20, 24, 0.92)",
          backdropFilter: "blur(24px) saturate(140%)",
          WebkitBackdropFilter: "blur(24px) saturate(140%)",
          border: "1px solid var(--line)",
          borderRadius: 18,
          padding: 5,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 4,
          boxShadow: "0 16px 40px -16px rgba(0,0,0,0.7), 0 2px 0 rgba(255,255,255,0.04) inset",
        }}>
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => onTab(t.id)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                  padding: "10px 6px 8px",
                  border: "none",
                  borderRadius: 14,
                  background: active ? "var(--ink)" : "transparent",
                  color: active ? "var(--bg)" : "var(--ink-dim)",
                  cursor: "pointer",
                  transition: "background 0.18s, color 0.18s, transform 0.1s",
                  position: "relative",
                  fontFamily: "inherit",
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.97)"}
                onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
                onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              >
                <Icon />
                <span style={{ fontSize: 11.5, fontWeight: active ? 600 : 500, letterSpacing: "0.01em" }}>{t.label}</span>
                {t.badge > 0 && !active && (
                  <span className="mono" style={{
                    position: "absolute", top: 6, right: 8,
                    fontSize: 9, fontWeight: 700,
                    padding: "1px 5px", borderRadius: 999,
                    background: "var(--accent)", color: "var(--accent-ink)",
                  }}>{t.badge}</span>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 6 }}>
          <button onClick={onAboutToggle} style={{
            background: "transparent", border: "none", color: "var(--ink-faint)",
            fontSize: 10.5, padding: "4px 8px", cursor: "pointer", fontFamily: "inherit",
            textDecoration: "underline", textUnderlineOffset: 3,
          }}>About & disclaimers</button>
        </div>
      </div>
    </nav>
  );
}

function QuickIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8 9h8M8 13h8M8 17h5"/>
  </svg>;
}
function DetailedIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h16M4 12h10M4 18h7"/><circle cx="19" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>
  </svg>;
}
function HistoryIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3.5 2"/>
  </svg>;
}

/* ============ Global style (desktop layout, flash) ============ */
function GlobalStyle() {
  return (
    <style>{`
      .calc-grid { display: block; }
      @media (min-width: 1024px) {
        .calc-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
          gap: 16px;
          align-items: start;
        }
        .calc-left { position: sticky; top: 96px; }
      }
      .total-chip.flash { animation: chipFlash 0.5s ease-out; }
      @keyframes chipFlash {
        0% { transform: scale(1); box-shadow: 0 12px 32px -16px rgba(0,0,0,0.7); }
        45% { transform: scale(1.06); box-shadow: 0 0 0 8px color-mix(in oklab, var(--accent) 25%, transparent), 0 12px 32px -16px rgba(0,0,0,0.7); }
        100% { transform: scale(1); box-shadow: 0 12px 32px -16px rgba(0,0,0,0.7); }
      }
    `}</style>
  );
}

/* ============ helpers ============ */
function stripFunctions(obj) {
  // Just spread the totals plain
  const { rates, ...rest } = obj;
  return { ...rest, rates: { ...rates } };
}

/* mount */
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
