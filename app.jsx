/* app.jsx — main app with bottom taskbar (Home / Shifts / History + live total), desktop 2-col, cross-check highlights */

const { useState, useEffect, useMemo, useRef, useCallback } = React;

/* History-state key for in-app screens, so the phone's Back button returns to
   Home instead of leaving the app. Only one entry is ever pushed above Home;
   moves between non-Home screens replace it. */
const NAV_KEY = "nscView";

function App() {
  // Read storage once on mount, not on every render (each read parses the
  // whole saved state, snapshots included).
  const [initial] = useState(loadState);
  const [mode, setMode] = useState(initial.mode || "basic");
  const [view, setView] = useState("home");
  // Always open on today's pay period; the last-viewed one is not restored,
  // so a new month never opens on stale shifts.
  const [periodAnchor, setPeriodAnchor] = useState(() => ymd(new Date()));
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
  const [theme, setTheme] = useState(initial.theme || "auto");
  const [onboarded, setOnboarded] = useState(initial.onboarded ?? false);
  // Any date the person works a 7AM; drives Off days and extra-shift colour.
  const [rotationAnchor, setRotationAnchor] = useState(initial.rotationAnchor || null);
  const [openDay, setOpenDay] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autofillOpen, setAutofillOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [reconcileTarget, setReconcileTarget] = useState(null);
  const [highlightDays, setHighlightDays] = useState(null);
  const [clipboard, setClipboard] = useState(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);

  const period = useMemo(() => periodFor(fromYmd(periodAnchor)), [periodAnchor]);
  const effectiveRates = useMemo(() => ratesAt(period, ratesHistory, rates), [period, ratesHistory, rates]);
  const ratesEffectiveLabel = useMemo(() => {
    if (!ratesHistory || ratesHistory.length === 0) return "Current rates";
    const sorted = [...ratesHistory].sort((a, b) => effDate(b.effectiveFrom) - effDate(a.effectiveFrom));
    for (const e of sorted) {
      if (effDate(e.effectiveFrom) <= period.start) {
        return "Rates effective " + effDate(e.effectiveFrom).toLocaleDateString("en-US", { month: "short", year: "numeric" });
      }
    }
    return "Current rates";
  }, [ratesHistory, period]);

  useEffect(() => {
    saveState({ mode, periodAnchor, entries, basicDistance, defaultDist, counts, basePay, rates, tax, ratesHistory, templates, snapshots, theme, onboarded, rotationAnchor });
  }, [mode, periodAnchor, entries, basicDistance, defaultDist, counts, basePay, rates, tax, ratesHistory, templates, snapshots, theme, onboarded, rotationAnchor]);

  useEffect(() => {
    const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
    const apply = () => {
      const resolved = theme === "auto" ? (mq?.matches ? "light" : "dark") : theme;
      document.body.setAttribute("data-theme", resolved);
      // index.html sets it on <html> before the app loads (no flash of the
      // wrong theme); keep the two in step.
      document.documentElement.setAttribute("data-theme", resolved);
      const meta = document.getElementById("theme-color-meta");
      if (meta) meta.setAttribute("content", resolved === "light" ? "#faf9f7" : "#0f1013");
    };
    apply();
    if (theme === "auto" && mq) {
      mq.addEventListener?.("change", apply);
      return () => mq.removeEventListener?.("change", apply);
    }
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
      const empty = !updated.am7 && !updated.pm3 && !updated.pm10 && updated.holiday == null;
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
      // de-dupe by periodKey: replace existing, but keep its pay-slip
      // reconciliation so re-saving a period doesn't throw that work away.
      const old = prev.find((s) => s.periodKey === snap.periodKey);
      const filtered = prev.filter((s) => s.periodKey !== snap.periodKey);
      return [...filtered, old?.reconcile ? { ...snap, reconcile: old.reconcile } : snap];
    });
    flashTotal();
  };

  /* Is this period already in History, and does it still match? Compared on
     the result, so moving a shift to another day with the same pay isn't a
     change. */
  const saveStatus = useMemo(() => {
    const saved = snapshots.find((s) => s.periodKey === periodKey(period));
    if (!saved) return { state: "none" };
    const keys = ["grand", "allowanceSubtotal", "baseSubtotal", "extraSubtotal", "totalHours", "holidayHours"];
    const same = keys.every((k) => Math.abs((Number(saved.totals?.[k]) || 0) - (Number(totals[k]) || 0)) < 0.005);
    return { state: same ? "saved" : "changed", at: saved.at };
  }, [snapshots, period, totals]);

  /* Undo puts back only what was removed, so a period saved while the
     toast is up isn't wiped by restoring an older list. A restored result
     never replaces a newer save of the same period. */
  const restoreSnapshots = (removed) => setSnapshots((cur) => [
    ...cur,
    ...removed.filter((r) => !cur.some((c) => c.at === r.at || (r.periodKey && c.periodKey === r.periodKey))),
  ]);
  const deleteSnapshot = (at) => {
    const gone = snapshots.find((s) => s.at === at);
    setSnapshots((prev) => prev.filter((s) => s.at !== at));
    showToast(`Deleted ${gone?.period || "saved result"}`, { action: { label: "Undo", onClick: () => gone && restoreSnapshots([gone]) } });
  };
  const clearSnapshots = async () => {
    const ok = await askConfirm({
      title: "Delete all of History?",
      body: `This removes all ${snapshots.length} saved result${snapshots.length === 1 ? "" : "s"}, including any pay slip checks.`,
      confirmLabel: "Delete all", danger: true,
    });
    if (!ok) return;
    const prev = snapshots;
    setSnapshots([]);
    showToast("History cleared", { action: { label: "Undo", onClick: () => restoreSnapshots(prev) } });
  };

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
      showToast("No shifts logged for this period yet");
      return;
    }
    const ics = toICS(periodEntries);
    downloadBlob(new Blob([ics], { type: "text/calendar" }), `night-shift-${periodAnchor}.ics`);
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
    // Keep the target day's own holiday setting; it belongs to the date, not
    // to the shifts being pasted.
    setEntries((prev) => ({ ...prev, [key]: { ...clipboard.entry, dist: { ...clipboard.entry.dist }, holiday: prev[key]?.holiday ?? null } }));
    return true;
  };
  const cancelCopy = () => setClipboard(null);

  const reset = async () => {
    const ok = await askConfirm({
      title: `Reset ${periodLabel(period)}?`,
      body: "Clears this period's shifts, roster counts and monthly pay. Rates and History are kept.",
      confirmLabel: "Reset period", danger: true,
    });
    if (!ok) return;
    const before = { entries, counts, basePay };
    setEntries((prev) => clearPeriodEntries(prev, period));
    setCounts({ pm3: "", pm10: "", am7: "" });
    setBasePay({ monthly: "", compulsory: "" });
    showToast("Period reset", { action: { label: "Undo", onClick: () => {
      setEntries(before.entries); setCounts(before.counts); setBasePay(before.basePay);
    } } });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ mode, periodAnchor, entries, basicDistance, defaultDist, counts, basePay, rates, tax, ratesHistory, templates, theme, snapshots, onboarded, rotationAnchor }, null, 2)], { type: "application/json" });
    downloadBlob(blob, `night-shift-${periodAnchor}.json`);
  };
  const importJson = () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "application/json";
    inp.onchange = async () => {
      const f = inp.files?.[0]; if (!f) return;
      try {
        const obj = JSON.parse(await f.text());
        const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
        if (!isObj(obj)) { showToast("That file isn't a Night Shift backup"); return; }
        const ok = await askConfirm({
          title: "Restore this backup?",
          body: "It replaces what's on this device now: shifts, pay, rates and History. Save a backup first if you might want today's data back.",
          confirmLabel: "Restore", danger: true,
        });
        if (!ok) return;
        // Only accept known values, so a hand-edited or foreign file can't
        // leave the screens and the math disagreeing about the mode.
        const oneOf = (v, list) => list.includes(v);
        if (oneOf(obj.mode, ["basic", "advanced"])) setMode(obj.mode);
        if (typeof obj.periodAnchor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(obj.periodAnchor)) setPeriodAnchor(obj.periodAnchor);
        if (isObj(obj.entries)) setEntries(obj.entries);
        if (oneOf(obj.basicDistance, ["S", "L"])) setBasicDistance(obj.basicDistance);
        if (oneOf(obj.defaultDist, ["S", "L"])) setDefaultDist(obj.defaultDist);
        if (isObj(obj.counts)) setCounts(obj.counts);
        if (isObj(obj.basePay)) setBasePay(obj.basePay);
        if (isObj(obj.rates)) setRates(obj.rates);
        if (isObj(obj.tax)) setTax(obj.tax);
        if (Array.isArray(obj.ratesHistory)) setRatesHistory(obj.ratesHistory);
        if (Array.isArray(obj.templates)) setTemplates(obj.templates);
        if (oneOf(obj.theme, ["auto", "dark", "light"])) setTheme(obj.theme);
        if (Array.isArray(obj.snapshots)) setSnapshots(obj.snapshots);
        if (typeof obj.onboarded === "boolean") setOnboarded(obj.onboarded);
        if (obj.rotationAnchor === null || (typeof obj.rotationAnchor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(obj.rotationAnchor))) setRotationAnchor(obj.rotationAnchor);
        showToast("Backup restored");
      } catch (e) { showToast("Couldn't read that file. Pick a backup .json file."); }
    };
    inp.click();
  };

  const copySummary = () => {
    const net = calcTax(totals.grand, tax).net;
    copyText(summaryText(totals, periodLabel(period), net), "Summary copied");
  };

  /* Home setup: the wizard hands over generated entries; the calculator's own
     state and engine do the rest. replace clears only this period's days. */
  const applySimpleSetup = ({ fill, replace, basePay: bp, dist, counts: c, anchor }) => {
    setEntries((prev) => mergePeriodFill(prev, period, fill, replace));
    // Rotation answers save the rotation; totals don't follow one, so clear it.
    if (anchor !== undefined) setRotationAnchor(anchor);
    setBasePay(bp);
    setBasicDistance(dist);
    setDefaultDist(dist);
    if (replace) setMode("basic");
    if (c) setCounts(c);
    setOnboarded(true);
  };

  /* Screen navigation that keeps the phone's Back button inside the app:
     leaving Home pushes one history entry, moving between other screens
     replaces it, and returning Home pops it (so Back from Home exits). */
  const go = (v) => {
    if (v === view) return;
    const h = window.history;
    const onStack = h?.state && h.state[NAV_KEY] && h.state[NAV_KEY] !== "home";
    if (v === "home") {
      if (onStack) { h.back(); return; } // popstate below sets the view
      setView("home");
      return;
    }
    try {
      if (onStack) h.replaceState({ [NAV_KEY]: v }, "");
      else h.pushState({ [NAV_KEY]: v }, "");
    } catch {}
    setView(v);
  };
  useEffect(() => {
    try { window.history.replaceState({ ...(window.history.state || {}), [NAV_KEY]: "home" }, ""); } catch {}
    const onPop = (e) => setView((e.state && e.state[NAV_KEY]) || "home");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const openCalc = (m) => {
    if (m === "basic" || m === "advanced") setMode(m);
    go("calc");
    window.scrollTo?.(0, 0);
  };

  const applyAutofill = (opts) => {
    // Rotation: the tapped 7AM day anchors the cycle across the whole period
    // and is saved, just as the Home setup does.
    const fill = opts.pattern === "rotation"
      ? rotationEntries(period, opts.am7Key, opts.defaultDist)
      : autofillPattern(period, opts);
    if (opts.pattern === "rotation") setRotationAnchor(opts.am7Key);
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

  /* Taxi distance: "S"/"L" apply one distance to every shift (Quick mode);
     "mixed" sets it per shift in the day editor (Detailed mode). Switching
     to mixed seeds new shifts with the distance that was in use. */
  const setDistanceChoice = (v) => {
    if (v === "mixed") {
      if (mode !== "advanced") setDefaultDist(basicDistance);
      setMode("advanced");
    } else {
      setBasicDistance(v);
      setDefaultDist(v);
      setMode("basic");
    }
  };

  /* flash total animation hook */
  const totalChipRef = useRef(null);
  const flashTotal = () => {
    if (!totalChipRef.current) return;
    totalChipRef.current.classList.remove("flash");
    void totalChipRef.current.offsetWidth;
    totalChipRef.current.classList.add("flash");
  };

  return (
    <div data-screen-label={view === "history" ? "History" : view === "about" ? "About" : view === "home" ? "Home" : "Calculator"}
         style={{ paddingBottom: `calc(130px + var(--safe-bottom))` }}>
      <Header onSettings={() => setSettingsOpen(true)} />

      {view === "home" && (
        <HomeView
          period={period} entries={entries} mode={mode}
          basePay={basePay} basicDistance={basicDistance} counts={counts}
          totals={totals} tax={tax} rates={effectiveRates}
          ratesEffective={ratesEffectiveLabel}
          onboarded={onboarded}
          rotationAnchor={rotationAnchor}
          saveStatus={saveStatus}
          onWizardChange={setWizardOpen}
          onOpenDay={(d) => setOpenDay(ymd(d))}
          onShiftPeriod={(d) => setPeriodAnchor(ymd(shiftPeriod(period, d).start))}
          onApply={applySimpleSetup}
          onSaveSnapshot={saveSnapshot}
          onCopyShare={copySummary}
          onOpenCalc={openCalc}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {view === "calc" && (
        <CalcView
          period={period} entries={entries} mode={mode}
          counts={counts} setCounts={setCounts}
          basePay={basePay} setBasePay={setBasePay}
          basicDistance={basicDistance} onDistance={setDistanceChoice}
          totals={totals}
          tax={tax}
          clipboard={clipboard}
          highlightDays={highlightDays}
          rotationAnchor={rotationAnchor}
          saveStatus={saveStatus}
          onHeroVisible={setHeroVisible}
          onClearRotation={() => {
            const prev = rotationAnchor;
            setRotationAnchor(null);
            showToast("Rotation stopped. Your shifts are unchanged.", { action: { label: "Undo", onClick: () => setRotationAnchor(prev) } });
          }}
          onShiftPeriod={(d) => setPeriodAnchor(ymd(shiftPeriod(period, d).start))}
          onOpenDay={(d) => setOpenDay(ymd(d))}
          onAutofill={() => setAutofillOpen(true)}
          onTemplates={() => setTemplatesOpen(true)}
          onSaveSnapshot={saveSnapshot}
          onCopyShare={copySummary}
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
          onBack={() => go("calc")}
          onReconcile={(snap) => setReconcileTarget(snap)}
        />
      )}

      {view === "about" && <AboutView onBack={() => go("home")} />}

      {/* One footnote for every screen (hidden while Home setup is open, so
          the wizard's bottom bar stays the last thing on screen). */}
      {!(view === "home" && wizardOpen) && (
        <AppFooter
          ratesEffective={view === "about" ? null : ratesEffectiveLabel}
          onOpenSettings={() => setSettingsOpen(true)}
          onAbout={view === "about" ? null : () => go("about")}
        />
      )}

      {!(view === "home" && wizardOpen) && <Taskbar
        activeTab={view}
        onTab={go}
        total={totals.grand}
        totalShort={Number(totals.monthlyBasic) > 0 ? "Est. gross" : Number(totals.compulsory) > 0 ? "Est. pay" : "Allowances"}
        showTotal={view === "calc" && !heroVisible}
        hasInputs={Object.keys(entries).length > 0}
        snapshotCount={snapshots.length}
        totalChipRef={totalChipRef}
      />}

      {openDay && (
        <DayModal
          dayKey={openDay}
          entry={entries[openDay] || blankDay()}
          mode={mode}
          slot={rotationSlot(openDay, rotationAnchor)}
          defaultDist={mode === "advanced" ? defaultDist : basicDistance}
          onClose={() => setOpenDay(null)}
          onChange={(updater) => setEntry(openDay, updater)}
          onClear={() => { setEntries((p) => { const n = { ...p }; delete n[openDay]; return n; }); setOpenDay(null); }}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          rates={rates} setRates={setRates}
          tax={tax} setTax={setTax}
          ratesHistory={ratesHistory} setRatesHistory={setRatesHistory}
          theme={theme} setTheme={setTheme}
          ratesEffective={ratesEffectiveLabel}
          onExportICS={exportICS}
          onReset={reset}
          onExport={exportJson}
          onImport={importJson}
          onAbout={() => { setSettingsOpen(false); go("about"); }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {autofillOpen && <AutofillModal period={period} mode={mode} defaultDist={mode === "advanced" ? defaultDist : basicDistance} rotationAnchor={rotationAnchor} existing={entries} onApply={applyAutofill} onClose={() => setAutofillOpen(false)} />}
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
      <ToastHost />
      <ConfirmHost />
    </div>
  );
}

/* ============ Header ============ */
/* One quiet line: the app name and Settings. Each screen shows its own pay
   period, so the header doesn't repeat it. */
function Header({ onSettings }) {
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 30,
      background: "var(--bg-translucent)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      borderBottom: "1px solid var(--line-soft)",
    }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "calc(var(--safe-top) + 12px) 20px 12px", display: "flex", alignItems: "center", gap: 12 }}>
        <img src="icon-192.svg" alt="" width="28" height="28" style={{ borderRadius: 8, flexShrink: 0 }} />
        <h1 style={{ flex: 1, minWidth: 0, margin: 0, fontSize: "clamp(15px, 4.6vw, 17px)", fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Night Shift Calculator</h1>
        <button onClick={onSettings} title="Settings" aria-label="Settings" style={iconBtn()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </div>
    </header>
  );
}

/* ============ Calc view (with desktop 2-col layout) ============ */
/* Order of use: log shifts → confirm distance → read the result. Base pay
   (set once on Home) and the roster cross-check fold away until needed. */
function CalcView(props) {
  const {
    period, entries, mode, counts, setCounts, basePay, setBasePay,
    basicDistance, onDistance,
    totals, tax, clipboard, highlightDays, rotationAnchor, onClearRotation, saveStatus, onHeroVisible,
    onShiftPeriod, onOpenDay, onAutofill, onTemplates, onSaveSnapshot, onCopyShare,
    onWarningClick, copyDay, pasteDay, cancelCopy,
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
          rotationAnchor={rotationAnchor}
          onClearRotation={onClearRotation}
          onShift={onShiftPeriod}
          onOpenDay={onOpenDay}
          onAutofill={onAutofill}
          onTemplates={onTemplates}
          clipboard={clipboard}
          copyDay={copyDay}
          pasteDay={pasteDay}
          cancelCopy={cancelCopy}
        />
      </div>
      <div className="calc-right">
        <DistanceCard mode={mode} basicDistance={basicDistance} onChange={onDistance} totals={totals} />

        <LiveSummary
          totals={totals}
          mode={mode}
          basicDistance={basicDistance}
          tax={tax}
          saveStatus={saveStatus}
          onHeroVisible={onHeroVisible}
          onSaveSnapshot={onSaveSnapshot}
          onCopyShare={onCopyShare}
        />

        <Card style={{ padding: "6px 18px" }}>
          <BasePayFold basePay={basePay} setBasePay={setBasePay} />
          <div style={{ height: 1, background: "var(--line-soft)" }} />
          <CrossCheckFold counts={counts} setCounts={setCounts} totals={totals} onWarningClick={onWarningClick} />
        </Card>

      </div>
    </main>
  );
}

/* ============ Taxi distance ============ */
function DistanceCard({ mode, basicDistance, onChange, totals }) {
  const value = mode === "advanced" ? "mixed" : basicDistance;
  const c = totals.cal;
  return (
    <Card>
      <SectionHead title="Taxi distance" subtitle="Paid on 3PM and 10PM shifts" />
      <SegToggle
        full
        options={[
          { v: "S", l: "Short" },
          { v: "L", l: "Long" },
          { v: "mixed", l: "Varies" },
        ]}
        value={value} onChange={onChange}
      />
      <div style={{ fontSize: 12.5, color: "var(--ink-dim)", marginTop: 10, lineHeight: 1.5 }}>
        {value === "mixed" ? (
          <>
            Set Short or Long on each shift when you tap a day. Long shifts show a striped bar.
            <div className="mono" style={{ marginTop: 6, color: "var(--ink)" }}>
              Short {c.shortPm3 + c.shortPm10} · Long {c.longPm3 + c.longPm10}
            </div>
          </>
        ) : (
          <>Each 3PM and 10PM shift pays <span className="mono" style={{ color: "var(--ink)" }}>{fmt(value === "L" ? totals.rates.taxiLong : totals.rates.taxiShort)}</span> taxi this period.</>
        )}
      </div>
    </Card>
  );
}

/* ============ Foldable rows (base pay, cross-check) ============ */
function FoldRow({ title, detail, open, onToggle, warn, children }) {
  return (
    <div>
      <button onClick={onToggle} aria-expanded={open} style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "14px 0",
        background: "transparent", border: "none", color: "var(--ink)", cursor: "pointer",
        textAlign: "left", fontFamily: "inherit",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 500 }}>{title}</div>
          <div style={{ fontSize: 12.5, color: warn ? "var(--warn)" : "var(--ink-faint)", marginTop: 2 }}>{detail}</div>
        </div>
        <span aria-hidden style={{
          fontSize: 12, color: "var(--ink-faint)", transition: "transform 0.18s",
          transform: open ? "rotate(180deg)" : "none",
        }}>▾</span>
      </button>
      <Collapse open={open}><div style={{ paddingBottom: 14 }}>{children}</div></Collapse>
    </div>
  );
}

function BasePayFold({ basePay, setBasePay }) {
  const [open, setOpen] = useState(false);
  const setP = (k, v) => setBasePay((p) => ({ ...p, [k]: sanitizeDecimal(v) }));
  const monthly = Number(basePay.monthly) || 0;
  const detail = monthly > 0
    ? `${fmt(monthly)} basic · ${fmt(Number(basePay.compulsory) || 0)} compulsory`
    : "Not set. Needed for base pay and overtime";
  return (
    <FoldRow title="Your monthly pay" detail={detail} warn={!(monthly > 0)} open={open} onToggle={() => setOpen((o) => !o)}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <MoneyInput label="Monthly basic" value={basePay.monthly} onChange={(v) => setP("monthly", v)} />
        <MoneyInput label="Compulsory assignment" value={basePay.compulsory} onChange={(v) => setP("compulsory", v)} />
      </div>
    </FoldRow>
  );
}

/* Optional: type the counts from your roster and the calendar is checked
   against them. Counts never change the pay math. */
function CrossCheckFold({ counts, setCounts, totals, onWarningClick }) {
  const [open, setOpen] = useState(totals.hasMismatch);
  const setC = (k, v) => setCounts((p) => ({ ...p, [k]: v.replace(/[^0-9]/g, "") }));
  const entered = counts.pm3 !== "" || counts.pm10 !== "" || counts.am7 !== "";
  const detail = totals.hasMismatch
    ? "Your roster counts don't match the calendar"
    : entered ? "Matches the calendar" : "Optional: compare with your roster";
  return (
    <FoldRow title="Check against roster" detail={detail} warn={totals.hasMismatch} open={open} onToggle={() => setOpen((o) => !o)}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        <CountInput label="3PM" color="var(--sp1)" value={counts.pm3} onChange={(v) => setC("pm3", v)} expected={totals.cal.pm3} flag={totals.mismatch.pm3} />
        <CountInput label="10PM" color="var(--sp2)" value={counts.pm10} onChange={(v) => setC("pm10", v)} expected={totals.cal.pm10} flag={totals.mismatch.pm10} />
        <CountInput label="7AM" color="var(--am)" value={counts.am7} onChange={(v) => setC("am7", v)} expected={totals.cal.am7} flag={totals.mismatch.am7} />
      </div>
      {totals.hasMismatch && (
        <button onClick={onWarningClick} style={{
          marginTop: 12, padding: "10px 12px", borderRadius: 10,
          background: "color-mix(in oklab, var(--warn) 12%, transparent)",
          border: "1px solid color-mix(in oklab, var(--warn) 40%, transparent)",
          color: "var(--warn)", fontSize: 13, display: "flex", alignItems: "center", gap: 8,
          width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
        }}>
          <span style={{ flex: 1 }}>Show me the calendar</span>
          <span aria-hidden>→</span>
        </button>
      )}
    </FoldRow>
  );
}

function CountInput({ label, color, value, onChange, expected, flag }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
        <span style={{ fontSize: 12.5, color: "var(--ink-dim)" }}>{label}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: flag ? "var(--warn)" : "var(--ink-faint)" }}>cal <span className="mono">{expected}</span></span>
      </div>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        aria-label={`${label} shift count`}
        style={{
          width: "100%",
          background: "var(--bg-2)",
          border: `1px solid ${flag ? "color-mix(in oklab, var(--warn) 50%, var(--line))" : "var(--line)"}`,
          borderRadius: 10, padding: "10px 12px", color: "var(--ink)",
          fontSize: 16, outline: "none", fontFamily: "inherit",
        }}
      />
    </div>
  );
}

function MoneyInput({ label, value, onChange }) {
  return (
    <label style={{ display: "block" }}>
      <div className="label" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-faint)", fontSize: 14 }}>$</span>
        <input
          inputMode="decimal" value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          style={{
            width: "100%", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 10,
            padding: "10px 12px 10px 24px", color: "var(--ink)", fontSize: 16, outline: "none", fontFamily: "inherit"
          }}
        />
      </div>
    </label>
  );
}

/* ============ About ============ */
/* Mirrors the README's credit and disclaimers, so the app says the same
   thing as the repo, plus how to get in touch. */
function AboutView({ onBack }) {
  const strong = { color: "var(--ink)" };
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Night Shift Calculator")}`;
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "20px 20px 0" }}>
      <Card>
        <SectionHead title="About" subtitle="WCO JFB Night Shift Calculator" />
        <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--ink-dim)" }}>
          <p style={{ margin: 0 }}>Works out your night shift allowances (SP1, SP2, meal and taxi), base pay and extra-hours pay in one place, from the shifts on your calendar. Save each period to History, compare periods and check them against your pay slip.</p>
          <p style={{ marginTop: 12 }}>On the <strong style={strong}>Shifts</strong> screen, set <strong style={strong}>Taxi distance</strong> to Short or Long for the whole period, or <strong style={strong}>Varies</strong> to set it per shift when you tap a day.</p>
          <p style={{ marginTop: 12 }}>Public holidays are marked automatically from the Jamaica calendar: Ash Wednesday, Good Friday, Easter Monday, National Heroes Day and the fixed-date holidays. Change any day from the day editor.</p>
          <p style={{ marginTop: 12 }}>Created by <strong style={strong}>L/Cpl. R. Marshall</strong>, Portland Division · Workflow Coaching and Optimisation.</p>
        </div>
      </Card>

      <Card>
        <SectionHead title="Questions or issues?" subtitle="A number looks wrong, a rate changed, or something doesn't work" />
        <a href={mailto} style={{ ...accentBtn(), display: "block", textAlign: "center", textDecoration: "none", padding: "12px 16px", fontSize: 14 }}>
          Email {CONTACT_EMAIL}
        </a>
        <div style={{ fontSize: 12.5, color: "var(--ink-faint)", marginTop: 10, lineHeight: 1.5 }}>
          Say which pay period and screen you were on. A screenshot helps.
        </div>
      </Card>

      <Card>
        <SectionHead title="Disclaimers" />
        <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ink-dim)" }}>
          <p style={{ margin: 0 }}><strong style={strong}>Accuracy.</strong> Estimates only. Check every result against your official pay records. This is not official payroll advice.</p>
          <p style={{ marginTop: 10 }}><strong style={strong}>Your data.</strong> Nothing leaves this device. Backup, restore and reset are in Settings → Backup.</p>
          <p style={{ marginTop: 10 }}><strong style={strong}>Unofficial.</strong> Made independently. Not an official product of the JFB or any affiliated organisation.</p>
          <p style={{ marginTop: 10 }}><strong style={strong}>AI assistance.</strong> Built with help from Claude, an AI assistant made by Anthropic. The concept, design, calculations and content were directed and checked by L/Cpl. R. Marshall.</p>
        </div>
        <div style={{ marginTop: 14 }}>
          <button onClick={onBack} style={primaryBtn()}>← Back</button>
        </div>
      </Card>
    </main>
  );
}

/* ============ Taskbar (with live total + tabs) ============ */
function Taskbar({ activeTab, onTab, total, totalShort, showTotal, hasInputs, snapshotCount, totalChipRef }) {
  const tabs = [
    { id: "home", label: "Home", icon: HomeIcon },
    { id: "calc", label: "Shifts", icon: ShiftsIcon },
    { id: "history", label: "History", icon: HistoryIcon, badge: snapshotCount },
  ];

  return (
    <nav aria-label="Main" style={{
      position: "fixed", left: 0, right: 0, bottom: 0,
      paddingBottom: "var(--safe-bottom)",
      zIndex: 40,
      pointerEvents: "none",
    }}>
      {/* Live total — floats above the tabs while logging shifts */}
      {showTotal && (
        <div style={{ display: "flex", justifyContent: "center", padding: "0 16px 8px", pointerEvents: "none" }}>
          <div ref={totalChipRef} className="total-chip" style={{
            background: "var(--surface-translucent)",
            backdropFilter: "blur(24px) saturate(140%)",
            WebkitBackdropFilter: "blur(24px) saturate(140%)",
            border: "1px solid color-mix(in oklab, var(--accent) 35%, var(--line))",
            borderRadius: 999,
            padding: "8px 16px",
            display: "inline-flex", alignItems: "center", gap: 10,
            boxShadow: "0 12px 32px -16px rgba(0,0,0,0.6)",
            pointerEvents: "auto",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: hasInputs ? "var(--accent)" : "var(--ink-faint)" }} />
            <span style={{ fontSize: 12.5, color: "var(--ink-dim)" }}>{totalShort}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.005em" }}>
              <AnimatedNumber value={total} format={fmt} />
            </span>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 16px 12px", pointerEvents: "auto" }}>
        <div role="tablist" style={{
          background: "var(--surface-translucent)",
          backdropFilter: "blur(24px) saturate(140%)",
          WebkitBackdropFilter: "blur(24px) saturate(140%)",
          border: "1px solid var(--line)",
          borderRadius: 20,
          padding: 5,
          display: "grid",
          gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
          gap: 4,
          boxShadow: "0 16px 40px -16px rgba(0,0,0,0.6)",
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
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                  padding: "9px 6px 7px",
                  border: "none",
                  borderRadius: 15,
                  background: active ? "color-mix(in oklab, var(--accent) 16%, transparent)" : "transparent",
                  color: active ? "var(--accent)" : "var(--ink-dim)",
                  cursor: "pointer",
                  transition: "background 0.18s, color 0.18s",
                  position: "relative",
                  fontFamily: "inherit",
                }}
              >
                <Icon />
                <span style={{ fontSize: 11.5, fontWeight: active ? 600 : 500 }}>{t.label}</span>
                {t.badge > 0 && !active && (
                  <span className="mono" style={{
                    position: "absolute", top: 5, right: "calc(50% - 22px)",
                    fontSize: 9, fontWeight: 700,
                    padding: "1px 5px", borderRadius: 999,
                    background: "var(--accent)", color: "var(--accent-ink)",
                  }}>{t.badge}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function HomeIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 11l8-6.5 8 6.5"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>
  </svg>;
}
function ShiftsIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h2M14 14h2M8 17h2"/>
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
