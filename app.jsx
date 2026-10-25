/* app.jsx — main app with bottom taskbar (Home / Watch / History + live total), two columns on iPad and desktop */

const { useState, useEffect, useMemo, useRef, useCallback } = React;

/* History-state key for in-app screens, so the phone's Back button returns to
   Home instead of leaving the app. Only one entry is ever pushed above Home;
   moves between non-Home screens replace it. */
const NAV_KEY = "nscView";
// Screens a history entry can name. Anything else (an entry left by an older
// version, say the Details screen Home has taken over) opens Home.
const VIEWS = ["home", "crew", "history", "about"];

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
  const [otUnit, setOtUnit] = useState(OT_UNITS.includes(initial.otUnit) ? initial.otUnit : "hours");
  const [onboarded, setOnboarded] = useState(initial.onboarded ?? false);
  // Any date the person works a 7AM; drives Off days and extra-shift colour.
  const [rotationAnchor, setRotationAnchor] = useState(initial.rotationAnchor || null);
  // Several people on the same shift (Crew tab): a shared calendar plus each
  // person's own days, pay and taxi distance.
  const [crew, setCrew] = useState(() => sanitizeCrew(initial.crew) || blankCrew());
  // Crew results saved to History, one per pay period.
  const [crewHistory, setCrewHistory] = useState(() => sanitizeCrewHistory(initial.crewHistory));
  const [openDay, setOpenDay] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autofillOpen, setAutofillOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [reconcileTarget, setReconcileTarget] = useState(null);
  const [clipboard, setClipboard] = useState(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  // Whether Home's own total is on screen: null until it has been measured,
  // so the floating total doesn't flash in on arrival.
  const [heroVisible, setHeroVisible] = useState(null);

  const period = useMemo(() => periodFor(fromYmd(periodAnchor)), [periodAnchor]);
  // A phone keeps an installed app suspended rather than closing it, so
  // "opens on today's period" also has to hold when it's brought back. If a
  // new pay period started while it was away and you were still on what was
  // then the current one, move on to today's; a period you'd browsed to on
  // purpose is left alone.
  const todayPeriodRef = useRef(periodKey(periodFor(new Date())));
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState !== "visible") return;
      const now = periodKey(periodFor(new Date()));
      const was = todayPeriodRef.current;
      if (now === was) return;
      todayPeriodRef.current = now;
      setPeriodAnchor((a) => (periodKey(periodFor(fromYmd(a))) === was ? ymd(new Date()) : a));
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, []);
  const effectiveRates = useMemo(() => ratesAt(period, ratesHistory, rates), [period, ratesHistory, rates]);
  // What every calculation runs on: the period's rates, plus how overtime is
  // counted (hours or minutes), which isn't a rate and so isn't in Past rates.
  const calcRates = useMemo(() => ({ ...effectiveRates, otUnit }), [effectiveRates, otUnit]);
  const ratesEffectiveLabel = useMemo(() => {
    const e = rateEntryAt(period, ratesHistory);
    return e
      ? "Rates effective " + effDate(e.effectiveFrom).toLocaleDateString("en-US", { month: "short", year: "numeric" })
      : "Current rates";
  }, [ratesHistory, period]);

  // The app is on screen: hand the loading screen over to the logo, which
  // then flies into the header (index.html).
  useEffect(() => { window.nscSplashDone?.(); }, []);

  useEffect(() => {
    saveState({ mode, periodAnchor, entries, basicDistance, defaultDist, counts, basePay, rates, tax, ratesHistory, templates, snapshots, theme, otUnit, onboarded, rotationAnchor, crew, crewHistory });
  }, [mode, periodAnchor, entries, basicDistance, defaultDist, counts, basePay, rates, tax, ratesHistory, templates, snapshots, theme, otUnit, onboarded, rotationAnchor, crew, crewHistory]);

  useEffect(() => {
    const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
    const apply = () => {
      const resolved = theme === "auto" ? (mq?.matches ? "light" : "dark") : theme;
      document.body.setAttribute("data-theme", resolved);
      // index.html sets it on <html> before the app loads (no flash of the
      // wrong theme); keep the two in step.
      document.documentElement.setAttribute("data-theme", resolved);
      const meta = document.getElementById("theme-color-meta");
      if (meta) meta.setAttribute("content", resolved === "light" ? "#f2f2f7" : "#000000");
    };
    apply();
    if (theme === "auto" && mq) {
      mq.addEventListener?.("change", apply);
      return () => mq.removeEventListener?.("change", apply);
    }
  }, [theme]);

  const totals = useMemo(
    () => aggregate(entries, period, mode, basicDistance, counts, basePay, calcRates, rotationAnchor),
    [entries, period, mode, basicDistance, counts, basePay, calcRates, rotationAnchor]
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
    // The per-day hour maps only drive the calendar; History never reads
    // them, so they'd just bloat every saved period in storage.
    const { dayHours, dayHolidayHours, ...kept } = totals;
    const snap = {
      at: new Date().toISOString(),
      period: periodLabel(period),
      periodKey: periodKey(period),
      mode,
      basicDistance,
      totals: { ...kept, rates: { ...totals.rates } },
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
    const keys = ["grand", "allowanceSubtotal", "baseSubtotal", "extraSubtotal", "totalHours", "holidayHours", "otHours", "leaveShifts", "exchangedShifts"];
    const near = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.005;
    // Duty marks that don't move the pay (orderly, exchange for) still
    // belong in the saved record, so a change to them counts too.
    const same = keys.every((k) => near(saved.totals?.[k], totals[k]))
      && DUTY_KEYS.every((k) => near(saved.totals?.duties?.[k], totals.duties[k]));
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
      title: crewHistory.length ? "Delete your saved periods?" : "Delete all of History?",
      body: `This removes all ${snapshots.length} saved result${snapshots.length === 1 ? "" : "s"}, including any pay slip checks.`
        + (crewHistory.length ? " Saved watches are kept." : ""),
      confirmLabel: "Delete all", danger: true,
    });
    if (!ok) return;
    const prev = snapshots;
    setSnapshots([]);
    showToast("History cleared", { action: { label: "Undo", onClick: () => restoreSnapshots(prev) } });
  };

  /* Crew saves: one per period, like the person's own. Saving again
     replaces that period's crew result. */
  const saveCrew = (snap) => {
    const saved = { ...snap, at: new Date().toISOString() };
    setCrewHistory((prev) => [...prev.filter((s) => s.periodKey !== saved.periodKey), saved]);
  };
  const deleteCrewSave = (at) => {
    const gone = crewHistory.find((s) => s.at === at);
    setCrewHistory((prev) => prev.filter((s) => s.at !== at));
    showToast(`Deleted watch for ${gone?.period || "that period"}`, { action: { label: "Undo", onClick: () => gone && setCrewHistory((cur) => (
      cur.some((c) => c.periodKey === gone.periodKey) ? cur : [...cur, gone]
    )) } });
  };

  /* templates */
  const saveTemplate = (tpl) => setTemplates((prev) => [...prev, tpl]);
  const deleteTemplate = (id) => setTemplates((prev) => prev.filter((t) => t.id !== id));
  const applyTemplateToPeriod = (tpl, opts) => {
    setEntries((prev) => fillDays(prev, applyTemplate(tpl, period), !!opts?.preserve));
  };

  /* reconciliation */
  const saveReconcile = (snapId, recon) => {
    setSnapshots((prev) => prev.map((s) => s.at === snapId ? { ...s, reconcile: recon } : s));
  };

  /* ICS export */
  const exportICS = () => {
    const periodEntries = {};
    // A day holding only a holiday override has no shifts to export.
    for (const d of periodDays(period)) {
      const k = ymd(d);
      if (hasShifts(entries[k])) periodEntries[k] = entries[k];
    }
    if (Object.keys(periodEntries).length === 0) {
      showToast("No shifts logged for this period yet");
      return;
    }
    const ics = toICS(periodEntries);
    // Named for the period it holds (periodAnchor can be any day in it).
    downloadBlob(new Blob([ics], { type: "text/calendar" }), `night-shift-${periodKey(period)}.ics`);
  };

  /* clipboard (long-press to copy day shifts) */
  const copyDay = (key) => {
    const e = entries[key];
    if (!hasShifts(e)) return false;
    setClipboard({ srcKey: key, entry: { ...e, dist: { ...e.dist }, ...(e.hours ? { hours: { ...e.hours } } : {}), ...(e.duty ? { duty: { ...e.duty } } : {}) } });
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
      body: "Clears this period's shifts and roster counts. Your monthly pay, rates and History are kept.",
      confirmLabel: "Reset period", danger: true,
    });
    if (!ok) return;
    // Monthly pay is kept: it applies to every period, not just this one.
    // Undo puts back only this period's days, so edits made elsewhere while
    // the toast is up survive.
    const before = {};
    for (const d of periodDays(period)) if (entries[ymd(d)]) before[ymd(d)] = entries[ymd(d)];
    const beforeCounts = counts;
    setEntries((prev) => clearPeriodEntries(prev, period));
    setCounts({ pm3: "", pm10: "", am7: "" });
    showToast("Period reset", { action: { label: "Undo", onClick: () => {
      setEntries((cur) => ({ ...clearPeriodEntries(cur, period), ...before }));
      setCounts(beforeCounts);
    } } });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ mode, periodAnchor, entries, basicDistance, defaultDist, counts, basePay, rates, tax, ratesHistory, templates, theme, otUnit, snapshots, onboarded, rotationAnchor, crew, crewHistory }, null, 2)], { type: "application/json" });
    downloadBlob(blob, `night-shift-${periodAnchor}.json`);
  };
  const importJson = () => {
    const inp = document.createElement("input");
    // Some Android pickers grey out .json files that are only matched by type.
    inp.type = "file"; inp.accept = "application/json,.json";
    // iOS Safari can drop the change event of a picker that isn't in the
    // page, so it stays attached (hidden) until a file is chosen or not.
    inp.style.display = "none";
    document.body.appendChild(inp);
    inp.addEventListener("cancel", () => inp.remove());
    inp.onchange = async () => {
      const f = inp.files?.[0];
      inp.remove();
      if (!f) return;
      try {
        const obj = JSON.parse(await f.text());
        const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
        if (!isObj(obj)) { showToast("That file isn't a Night Shift backup"); return; }
        const ok = await askConfirm({
          title: "Restore this backup?",
          body: "It replaces what's on this device now: shifts, pay, rates, watch and History. Save a backup first if you might want today's data back.",
          confirmLabel: "Restore", danger: true,
        });
        if (!ok) return;
        // Only accept known values, so a hand-edited or foreign file can't
        // leave the screens and the math disagreeing about the mode.
        const oneOf = (v, list) => list.includes(v);
        if (oneOf(obj.mode, ["basic", "advanced"])) setMode(obj.mode);
        // The period the backup was viewing isn't restored: like a fresh
        // start, a restore stays on today's pay period, so an old backup
        // doesn't open on (and stay stuck on) a past month.
        if (isObj(obj.entries)) setEntries(sanitizeEntries(obj.entries));
        if (oneOf(obj.basicDistance, ["S", "L"])) setBasicDistance(obj.basicDistance);
        if (oneOf(obj.defaultDist, ["S", "L"])) setDefaultDist(obj.defaultDist);
        // Fill in anything an older (or hand-edited) backup is missing, so a
        // missing rate can't quietly pay $0 and a missing field can't leave
        // Settings with blank, uncontrolled inputs.
        const digits = (v) => (typeof v === "string" || typeof v === "number" ? String(v).replace(/[^0-9]/g, "") : "");
        if (isObj(obj.counts)) setCounts({ pm3: digits(obj.counts.pm3), pm10: digits(obj.counts.pm10), am7: digits(obj.counts.am7) });
        const money = (v) => (typeof v === "string" || typeof v === "number" ? sanitizeDecimal(v) : "");
        if (isObj(obj.basePay)) setBasePay({ monthly: money(obj.basePay.monthly), compulsory: money(obj.basePay.compulsory) });
        const numbers = (defaults, o) => {
          const out = { ...defaults };
          for (const k of Object.keys(defaults)) {
            const v = o[k];
            if (typeof defaults[k] === "boolean") { if (typeof v === "boolean") out[k] = v; }
            else if (v !== "" && v != null && Number.isFinite(Number(v)) && Number(v) >= 0) out[k] = Number(v);
          }
          return out;
        };
        if (isObj(obj.rates)) setRates(sanitizeRates(obj.rates));
        if (isObj(obj.tax)) setTax(numbers(DEFAULT_TAX, obj.tax));
        // Lists keep only entries in the shape their screens read, so one
        // broken entry can't crash Settings, Templates or History.
        if (Array.isArray(obj.ratesHistory)) setRatesHistory(sanitizeRatesHistory(obj.ratesHistory));
        if (Array.isArray(obj.templates)) setTemplates(sanitizeTemplates(obj.templates));
        if (oneOf(obj.theme, ["auto", "dark", "light"])) setTheme(obj.theme);
        if (oneOf(obj.otUnit, OT_UNITS)) setOtUnit(obj.otUnit);
        if (Array.isArray(obj.snapshots)) setSnapshots(sanitizeSnapshots(obj.snapshots));
        if (typeof obj.onboarded === "boolean") setOnboarded(obj.onboarded);
        if (obj.rotationAnchor === null || (typeof obj.rotationAnchor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(obj.rotationAnchor))) setRotationAnchor(obj.rotationAnchor);
        const importedCrew = sanitizeCrew(obj.crew);
        if (importedCrew) setCrew(importedCrew);
        if (Array.isArray(obj.crewHistory)) setCrewHistory(sanitizeCrewHistory(obj.crewHistory));
        showToast("Backup restored");
      } catch (e) { showToast("Couldn't read that file. Pick a backup .json file."); }
    };
    inp.click();
  };

  const copySummary = () => {
    const net = netApplies(totals, tax) ? estimateNet(totals, tax).net : null;
    copyText(summaryText(totals, periodLabel(period), net), "Summary copied");
  };

  /* Home setup: the wizard hands over generated entries; the calculator's own
     state and engine do the rest. replace clears only this period's days. */
  const applySimpleSetup = ({ fill, replace, basePay: bp, dist, counts: c, anchor, keepTaxi }) => {
    setEntries((prev) => mergePeriodFill(prev, period, fill, replace));
    // Rotation answers save the rotation; totals don't follow one, so clear it.
    if (anchor !== undefined) setRotationAnchor(anchor);
    setBasePay(bp);
    // keepTaxi (Home's one-tap rotation fill): no taxi question was asked,
    // so the Short / Long / Varies choice stays as it was.
    if (!keepTaxi) {
      setBasicDistance(dist);
      setDefaultDist(dist);
      if (replace) setMode("basic");
    }
    if (c) setCounts(c);
    setOnboarded(true);
  };

  /* Screen navigation that keeps the phone's Back button inside the app:
     leaving Home pushes one history entry, moving between other screens
     replaces it, and returning Home pops it (so Back from Home exits). */
  const go = (v) => {
    // Tapping the screen you're on takes you back to its top.
    if (v === view) { window.scrollTo?.({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" }); return; }
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
    try {
      // A reload can land on an entry a modal or setup held; nothing's open now.
      const st = { ...(window.history.state || {}), [NAV_KEY]: "home" };
      delete st.nscLayer;
      window.history.replaceState(st, "");
    } catch {}
    const onPop = (e) => {
      const v = e.state && e.state[NAV_KEY];
      setView(VIEWS.includes(v) ? v : "home");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  // Each screen opens at its top, not at the scroll position the last
  // screen was left at.
  // Before paint, so the new screen never flashes at the old offset.
  React.useLayoutEffect(() => { window.scrollTo?.(0, 0); }, [view]);
  // A side column is pinned on wide screens only while all of it fits
  // between the header and the tab bar. A taller one (the calendar on an
  // iPad turned sideways) scrolls with the page, or its last rows would sit
  // under the tab bar where no amount of scrolling reaches them. Its height
  // changes as days are filled in, and the room changes as Safari's toolbar
  // shows and hides, so this re-checks on both.
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const check = () => {
      frame = 0;
      const header = document.querySelector(".nsc-header");
      const dock = document.querySelector(".nsc-dock");
      const top = header ? header.getBoundingClientRect().bottom + 16 : 0;
      // Sizes, not positions: the dock may still be sliding in.
      const bottom = window.innerHeight - 8 - (dock
        ? dock.offsetHeight + (parseFloat(getComputedStyle(dock.parentElement).paddingBottom) || 0)
        : 0);
      document.querySelectorAll(".nsc-split > .is-pinned").forEach((el) => {
        ro.observe(el);
        el.classList.toggle("is-fit", el.offsetHeight <= bottom - top);
      });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(check); };
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    // Columns come and go without a screen change (a watch member opening).
    const mo = new MutationObserver(schedule);
    mo.observe(document.getElementById("root") || document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    return () => {
      ro.disconnect(); mo.disconnect();
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);

  const applyAutofill = (opts) => {
    // Rotation: the tapped 7AM day anchors the cycle across the whole period
    // and is saved, just as the Home setup does.
    const fill = opts.pattern === "rotation"
      ? rotationEntries(period, opts.am7Key, opts.defaultDist)
      : autofillPattern(period, opts);
    if (opts.pattern === "rotation") {
      setRotationAnchor(opts.am7Key);
      // A rotation covers the whole period, so without "keep" it replaces
      // the period like the Home setup does; otherwise shifts left on the
      // new off days would linger as extras and still be paid.
      setEntries((prev) => mergePeriodFill(prev, period, fill, !opts.preserve));
    } else {
      setEntries((prev) => fillDays(prev, fill, opts.preserve));
    }
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
    <div data-screen-label={view === "history" ? "History" : view === "about" ? "About" : view === "crew" ? "Watch" : "Home"}
         style={{ paddingBottom: `calc(130px + var(--safe-bottom))` }}>
      <Header onSettings={() => setSettingsOpen(true)} />

      {view === "home" && (
        <HomeView
          period={period} entries={entries} mode={mode}
          basePay={basePay} setBasePay={setBasePay}
          basicDistance={basicDistance} defaultDist={defaultDist} onDistance={setDistanceChoice}
          counts={counts} setCounts={setCounts}
          totals={totals} tax={tax} rates={calcRates}
          ratesEffective={ratesEffectiveLabel}
          onboarded={onboarded}
          rotationAnchor={rotationAnchor}
          saveStatus={saveStatus}
          clipboard={clipboard}
          onWizardChange={setWizardOpen}
          onHeroVisible={setHeroVisible}
          onOpenDay={(d) => setOpenDay(ymd(d))}
          onShiftPeriod={(d) => setPeriodAnchor(ymd(shiftPeriod(period, d).start))}
          onApply={applySimpleSetup}
          onAutofill={() => setAutofillOpen(true)}
          onTemplates={() => setTemplatesOpen(true)}
          onClearRotation={() => {
            const prev = rotationAnchor;
            setRotationAnchor(null);
            showToast("Rotation stopped. Your shifts are unchanged.", { action: { label: "Undo", onClick: () => setRotationAnchor(prev) } });
          }}
          onSaveSnapshot={saveSnapshot}
          onCopyShare={copySummary}
          onOpenSettings={() => setSettingsOpen(true)}
          copyDay={copyDay}
          pasteDay={pasteDay}
          cancelCopy={cancelCopy}
        />
      )}

      {view === "crew" && (
        <CrewView
          period={period}
          crew={crew} setCrew={setCrew}
          myEntries={entries} myRotation={rotationAnchor}
          rates={calcRates} tax={tax}
          saved={crewHistory.find((s) => s.periodKey === periodKey(period))}
          onSave={saveCrew}
          onShiftPeriod={(d) => setPeriodAnchor(ymd(shiftPeriod(period, d).start))}
        />
      )}

      {view === "history" && (
        <SnapshotsView
          snapshots={snapshots}
          crewHistory={crewHistory}
          onDeleteCrew={deleteCrewSave}
          theme={theme}
          onDelete={deleteSnapshot}
          onClear={clearSnapshots}
          onBack={() => go("home")}
          onReconcile={(snap) => setReconcileTarget(snap)}
        />
      )}

      {view === "about" && <AboutView onBack={() => go("home")} rates={calcRates} />}

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
        totalShort={totalLabel(totals, true)}
        totalSlot={view === "home"}
        showTotal={view === "home" && heroVisible === false}
        onTotal={() => go("home")}
        hasInputs={totals.totalHours > 0}
        snapshotCount={snapshots.length + crewHistory.length}
        totalChipRef={totalChipRef}
      />}

      {openDay && (
        <DayModal
          dayKey={openDay}
          entry={entries[openDay] || blankDay()}
          mode={mode}
          otUnit={otUnit}
          slot={rotationSlot(openDay, rotationAnchor)}
          defaultDist={mode === "advanced" ? defaultDist : basicDistance}
          onClose={() => setOpenDay(null)}
          onChange={(updater) => setEntry(openDay, updater)}
          onClear={() => {
            const key = openDay, prev = entries[key];
            setEntries((p) => { const n = { ...p }; delete n[key]; return n; });
            if (hasShifts(prev)) showToast("Day cleared", { action: { label: "Undo", onClick: () => setEntries((p) => ({ ...p, [key]: prev })) } });
          }}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          rates={rates} setRates={setRates}
          tax={tax} setTax={setTax}
          ratesHistory={ratesHistory} setRatesHistory={setRatesHistory}
          theme={theme} setTheme={setTheme}
          otUnit={otUnit} setOtUnit={setOtUnit}
          ratesEffective={ratesEffectiveLabel}
          onExportICS={exportICS}
          onReset={reset}
          onExport={exportJson}
          onImport={importJson}
          onAbout={() => go("about")}
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

      <ToastHost />
      <ConfirmHost />
    </div>
  );
}

/* ============ Header ============ */
/* One quiet line: the app name and Settings. Each screen shows its own pay
   period, so the header doesn't repeat it. */
function Header({ onSettings }) {
  // The hairline under the header only shows once the page has scrolled.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className={"nsc-header" + (scrolled ? " is-scrolled" : "")}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "calc(var(--safe-top) + 12px) 20px 12px", display: "flex", alignItems: "center", gap: 12 }}>
        {/* The splash logo and title fly onto these two (index.html). */}
        <img data-splash-target="logo" src="icon-192.svg" alt="" width="28" height="28" style={{ borderRadius: 8, flexShrink: 0 }} />
        <h1 data-splash-target="title" style={{ flex: 1, minWidth: 0, margin: 0, fontSize: "clamp(15px, 4.6vw, 17px)", fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Night Shift Calculator</h1>
        <button onClick={onSettings} title="Settings" aria-label="Settings" style={iconBtn()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </div>
    </header>
  );
}

/* ============ About ============ */
/* Mirrors the README's credit and disclaimers, so the app says the same
   thing as the repo, plus a guide to using it, the shift labels and how to
   get in touch. The guide folds into one section per job, so it reads on a
   phone without a wall of text. */
function AboutView({ onBack, rates }) {
  const strong = { color: "var(--ink)" };
  const p = { margin: "12px 0 0" };
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Night Shift Calculator")}`;
  const [openGuide, setOpenGuide] = useState("start");
  const toggle = (k) => setOpenGuide((o) => (o === k ? null : k));
  const b = (t) => <strong style={strong}>{t}</strong>;
  const r = rates || DEFAULT_RATES;
  const hasJfbLogo = useJfbLogo();
  return (
    <main className="nsc-view" style={{ maxWidth: 720, margin: "0 auto", padding: "20px 20px 0" }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <img src="icon-192.svg" alt="" width="56" height="56" className="nsc-pop" style={{ borderRadius: 14, flexShrink: 0, boxShadow: "var(--shadow)" }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>Night Shift Calculator</div>
            <div style={{ fontSize: 12.5, color: "var(--ink-faint)", marginTop: 2 }}>WCO JFB · Version {APP_VERSION}</div>
          </div>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--ink-dim)" }}>
          <p style={{ margin: 0 }}>Works out your night shift allowances (SP1, SP2, meal and taxi), base pay and extra-hours pay in one place, from the shifts on your calendar. Save each period to History, compare periods and check them against your pay slip. It can do the same for everyone on your watch.</p>
          <p style={p}>Created by {b("L/Cpl. R. Marshall")}, Portland Division · Workflow Coaching and Optimisation.</p>
        </div>
        {/* Who it's for, with the JFB logo when the app has it, and in the
            same breath that it isn't theirs. */}
        {hasJfbLogo && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, padding: "10px 12px", borderRadius: 12, background: "var(--bg-2)" }}>
            <JfbLogo size={40} />
            <div style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--ink-dim)" }}>
              {b("For Jamaica Fire Brigade personnel.")} Unofficial: not made, checked or endorsed by the JFB.
            </div>
          </div>
        )}
      </Card>

      <Card>
        <SectionHead title="How to use the app" subtitle="Tap a topic to open it" />
        <GuideSection id="start" open={openGuide} onToggle={toggle} title="Quick start" detail="Your pay in about a minute">
          <GuideSteps steps={[
            <>On {b("Home")}, tap {b("Start")}.</>,
            <>{b("Your pay:")} type your Monthly Basic and Compulsory Assignment from your pay slip. Leave them blank to see allowances only.</>,
            <>{b("Your commute:")} pick {b("Short")} or {b("Long")} for your taxi allowance.</>,
            <>{b("Your shifts:")} choose {b("My rotation")} and tap any day you work a 7AM. The 7AM → 3PM → 10PM → Off cycle fills the whole period, before and after that day. Or choose {b("My totals")} and just enter how many of each shift you worked.</>,
            <>Tap {b("See my pay")}. Then tap any day on {b("Your shifts")}, the calendar on Home, to fix it: leave, a swap or an extra shift.</>,
            <>Tap {b("Save to History")} when the period is right.</>,
          ]} />
          <GuideNote>Next pay period, Home offers {b("Fill my rotation")}: one tap carries your cycle on. The app always opens on today's pay period (the 16th to the 15th).</GuideNote>
        </GuideSection>

        <GuideSection id="shifts" open={openGuide} onToggle={toggle} title="Logging shifts day by day" detail="The calendar on Home">
          <GuideSteps steps={[
            <>{b("Tap a day")} to open it, then tick 7AM, 3PM or 10PM. Ticking again takes the shift off.</>,
            <>Worked fewer hours? Type them under the shift. Blank means the standard hours (7AM 8h, 3PM 7h, 10PM 9h across midnight).</>,
            <>{b("Duty → Change")} marks a shift as orderly, exchange for, leave (VL, DL, SL, TO) or exchange leave. See {b("Shift labels")} below for what each does to your pay.</>,
            <>Public holidays fill in on their own, on the day they're kept: one that falls on a weekend moves to the weekday it's observed (Labour Day 2026 was Monday 25 May). To change one, open the day and use {b("Public holiday → Change")}.</>,
            <>{b("Taxi distance")}, in the card under the calendar: Short or Long for the whole period, or {b("Varies")} to set it on each shift.</>,
            <>Tap {b("Your shifts")} at the top of the calendar to fold it away, and again to open it. It stays the way you left it.</>,
          ]} />
          <GuideNote>Shortcuts above the calendar: {b("Auto-fill")} fills a rotation or one shift type across the period. {b("Templates")} saves a week's pattern to reuse. {b("Setup")} asks the three questions again. {b("Hold a day")} to copy it, then tap empty days to paste.</GuideNote>
        </GuideSection>

        <GuideSection id="read" open={openGuide} onToggle={toggle} title="Reading your result" detail="Totals, the maths and tax">
          <GuideSteps steps={[
            <>The big number is your {b("estimated gross")} (or {b("estimated allowances")} until a monthly basic is set). The bar under it splits it into Allowance, Base and Extra.</>,
            <>Tap {b("Allowances")}, {b("Base pay")} or {b("Extra hours")} to open its lines, and {b("ƒ")} on a line to see exactly how it was worked out.</>,
            <>Tap {b("after tax")} under the total to see NIS, NHT, Education Tax and PAYE. Meal and taxi are tax-free. Set the rates in Settings → Tax.</>,
            <>Logging shifts further down? The total floats above the tabs. Tap it to jump back up.</>,
            <>{b("Check against roster")} (under the calendar): type your roster's counts and the app tells you if the calendar disagrees. It never changes the pay.</>,
          ]} />
        </GuideSection>

        <GuideSection id="watch" open={openGuide} onToggle={toggle} title="Your watch" detail="Pay for everyone on your shift">
          <GuideSteps steps={[
            <>Open the {b("Watch")} tab. Set the watch's shifts with {b("Fill rotation")} or {b("Copy my shifts")}, or tap days.</>,
            <>{b("Add a person")} with their name, employee number and rank. A number used twice is flagged.</>,
            <>Open a person to set their monthly basic and Short or Long taxi, and tap a day to mark their leave, a swap or an extra shift. {b("Match watch")} undoes a change.</>,
            <>{b("Watch totals")} adds everyone up. Save it to History, copy a summary, download a CSV, or set the watch name and station and download the {b("Word record sheets")}: one JFB Regular and Overtime Record Sheet per person.</>,
          ]} />
        </GuideSection>

        <GuideSection id="history" open={openGuide} onToggle={toggle} title="History and pay slips" detail="Compare periods, check what you were paid">
          <GuideSteps steps={[
            <>Every period you save shows in {b("History")}, with ▲ / ▼ against the one before and a year-to-date summary.</>,
            <>Drag across the trend line or the month columns to read any period.</>,
            <>Open a saved period to download or copy it as an image, or tap {b("Check against pay slip")} and type what you were paid. The app shows the difference line by line.</>,
            <>Saving a period again replaces it. The save button says {b("Save changes")} when the period has changed since.</>,
          ]} />
        </GuideSection>

        <GuideSection id="settings" open={openGuide} onToggle={toggle} title="Settings and backup" detail="The gear at the top">
          <GuideSteps steps={[
            <>{b("Rates")}: SP1, SP2, meal, taxi and the overtime threshold. They save as you type. {b("Count overtime in")} switches between decimal hours (6.5h) and minutes (6h 30m): in minutes every shift counts to the minute and you type short shifts as hours and minutes.</>,
            <>{b("Past rates")}: when rates change, save the old ones with the date they started, so earlier periods stay right.</>,
            <>{b("Backup")}: save everything to a file before you change phones, restore it on the new one, add the period's shifts to your phone's calendar (.ics), or reset this period.</>,
            <>{b("Theme")}: dark, light, or follow your phone.</>,
          ]} />
        </GuideSection>

        <GuideSection id="rules" open={openGuide} onToggle={toggle} title="How the pay is worked out" detail="The rules the app follows">
          <div style={{ fontSize: 13, color: "var(--ink-dim)", lineHeight: 1.55 }}>
            <GuideRule label="SP1" value={`${fmt(r.sp1)} per 3PM shift`} />
            <GuideRule label="SP2" value={`${fmt(r.sp2)} per 10PM shift`} />
            <GuideRule label="Meal" value={`${fmt(r.meal)} per 3PM or 10PM shift`} />
            <GuideRule label="Taxi" value={`${fmt(r.taxiShort)} Short or ${fmt(r.taxiLong)} Long per 3PM or 10PM shift. None on a day with both a 3PM and a 10PM.`} />
            <GuideRule label="Short shift" value="Earns its allowances only if you worked more than half its hours. The hours still count." />
            <GuideRule label="Hourly rate" value={`Monthly Basic ÷ ${r.threshold}`} />
            <GuideRule label="Overtime" value={inMinutes(r)
              ? `Minutes over ${fmtHM(r.threshold)} in the period (not counting holiday time) × hourly rate ÷ 60 × 1.5`
              : `Hours over ${r.threshold} in the period (not counting holiday hours) × hourly rate × 1.5`} />
            <GuideRule label="Extra shifts" value="Shifts outside your saved rotation. Their time is shown on its own, but it's already in your total hours, so it isn't paid twice." />
            <GuideRule label="Holiday" value="On a public holiday, each shift after the day's first is paid × 2 the hourly rate." />
            <GuideRule label="Leave" value="Hours count as ordinary hours (never × 2); no SP1, SP2, meal or taxi." last />
          </div>
          <GuideNote>The numbers above are the rates for the period on screen. Check them against your pay slip in Settings.</GuideNote>
        </GuideSection>

        <GuideSection id="tips" open={openGuide} onToggle={toggle} title="Tips" detail="Small things that save time" last>
          <GuideSteps steps={[
            <>{b("Add it to your Home Screen")}: in Safari tap Share → Add to Home Screen. It then opens like an app and works offline.</>,
            <>Pull a sheet down to close it (or tap outside it). Flick it and it flies off.</>,
            <>The phone's {b("Back")} button closes an open sheet first, then takes you Home.</>,
            <>Tap the tab you're on to jump back to the top.</>,
            <>Deleted or reset something by mistake? Tap {b("Undo")} on the message at the bottom.</>,
          ]} />
        </GuideSection>
      </Card>

      <Card>
        <SectionHead title="Shift labels" subtitle="Tap a day, tick a shift, then Duty → Change" />
        <div style={{ display: "grid", gap: 2 }}>
          <LabelRow chip={<ShiftChip label="3PM" color="var(--sp1)" />} title="Regular shift" detail="Hours and all allowances." />
          <LabelRow chip={<ShiftChip label="3PM" color="var(--sp1)" duty="orderly" />} title="Orderly duty" detail="Paid as a normal shift. Recorded for your reference." />
          <LabelRow chip={<ShiftChip label="3PM" color="var(--sp1)" duty="exchangeFor" />} title="Exchange for" detail="You cover someone else's shift. Paid as a normal shift." />
          <LabelRow chip={<ShiftChip label="3PM" color="var(--sp1)" duty="vacation" />} title="Leave: VL · DL · SL · TO" detail="Vacation, departmental, sick or time off. Hours count as ordinary hours (never holiday ×2); no SP1, SP2, meal or taxi." />
          <LabelRow chip={<ShiftChip label="3PM" color="var(--sp1)" duty="exchangeLeave" />} title="Exchange leave" detail="Someone else covers your shift. No hours and no allowances." />
          <LabelRow chip={<ShiftChip label="3PM" color="var(--sp1)" extra />} title="Extra shift" detail="A worked shift outside your saved rotation, shown in pink with a +." last />
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
        <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--ink-dim)" }}>
          <p style={{ margin: 0 }}><strong style={strong}>Accuracy.</strong> Estimates only. Check every result against your official pay records. This is not official payroll advice.</p>
          <p style={p}><strong style={strong}>Your data.</strong> Nothing leaves this device. Backup, restore and reset are in Settings → Backup.</p>
          <p style={p}><strong style={strong}>Unofficial.</strong> This is not an official app of the Jamaica Fire Brigade (JFB) or any affiliated organisation. It was made independently by a member, for members, and hasn't been made, checked or endorsed by the JFB. The JFB name and logo belong to the Jamaica Fire Brigade and appear only to show who the app is for. Its results are not JFB pay records.</p>
          <p style={p}><strong style={strong}>AI assistance.</strong> Built with help from Claude, an AI assistant made by Anthropic. The concept, design, calculations and content were directed and checked by L/Cpl. R. Marshall.</p>
        </div>
        <div style={{ marginTop: 16 }}>
          <button onClick={onBack} style={primaryBtn()}>← Back</button>
        </div>
      </Card>
    </main>
  );
}

/* One topic in About's guide: a row that folds open. Only one is open at a
   time, so the page stays short. */
function GuideSection({ id, open, onToggle, title, detail, last, children }) {
  const isOpen = open === id;
  return (
    <div style={{ borderBottom: last ? "none" : "1px solid var(--line-soft)" }}>
      <button onClick={() => onToggle(id)} aria-expanded={isOpen} className="nsc-fold-btn" style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 0",
        background: "transparent", border: "none", color: "var(--ink)", cursor: "pointer",
        textAlign: "left", fontFamily: "inherit",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600 }}>{title}</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-faint)", marginTop: 2 }}>{detail}</div>
        </div>
        <FoldChevron open={isOpen} />
      </button>
      <Collapse open={isOpen}><div style={{ paddingBottom: 14 }}>{children}</div></Collapse>
    </div>
  );
}

/* Numbered steps in the guide. */
function GuideSteps({ steps }) {
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
      {steps.map((s, i) => (
        <li key={i} style={{ display: "flex", gap: 10, fontSize: 13.5, lineHeight: 1.5, color: "var(--ink-dim)" }}>
          <span aria-hidden className="mono" style={{
            flexShrink: 0, width: 22, height: 22, borderRadius: 999, marginTop: 0,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700,
            background: "color-mix(in oklab, var(--accent) 16%, transparent)", color: "var(--accent)",
          }}>{i + 1}</span>
          <span style={{ minWidth: 0 }}>{s}</span>
        </li>
      ))}
    </ol>
  );
}

function GuideNote({ children }) {
  return (
    <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "var(--bg-2)", fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-dim)" }}>
      {children}
    </div>
  );
}

/* One pay rule: what it is, then how it's paid. */
function GuideRule({ label, value, last }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "7px 0", borderBottom: last ? "none" : "1px dashed var(--line-soft)" }}>
      <span style={{ width: 84, flexShrink: 0, color: "var(--ink)", fontWeight: 500 }}>{label}</span>
      <span style={{ minWidth: 0 }}>{value}</span>
    </div>
  );
}

/* One entry in About's shift-label guide: the calendar chip, then what it
   does to pay. */
function LabelRow({ chip, title, detail, last }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: last ? "none" : "1px dashed var(--line-soft)" }}>
      <div style={{ width: 46, flexShrink: 0, paddingTop: 1 }}>{chip}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>{title}</div>
        <div style={{ fontSize: 12.5, color: "var(--ink-faint)", marginTop: 2, lineHeight: 1.45 }}>{detail}</div>
      </div>
    </div>
  );
}

/* ============ Taskbar (with live total + tabs) ============ */
function Taskbar({ activeTab, onTab, total, totalShort, totalSlot, showTotal, onTotal, hasInputs, snapshotCount, totalChipRef }) {
  const tabs = [
    { id: "home", label: "Home", icon: HomeIcon },
    { id: "crew", label: "Watch", icon: CrewIcon },
    { id: "history", label: "History", icon: HistoryIcon, badge: snapshotCount },
  ];
  const activeIndex = tabs.findIndex((t) => t.id === activeTab);

  // iOS keeps fixed bars on the layout viewport, so with the on-screen
  // keyboard up the tab bar floats loose over the page (on an iPad, often
  // mid-screen) and moves as it scrolls. Step it aside while typing; the
  // keyboard shrinks the visual viewport, which is how it's spotted.
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setKeyboard(vv.scale < 1.05 && window.innerHeight - vv.height > 120);
    onResize();
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  return (
    <nav aria-label="Main" className={"nsc-tabbar" + (keyboard ? " is-away" : "")} aria-hidden={keyboard || undefined}>
      {/* Live total: floats above the tabs once Home's own total has
          scrolled away (logging shifts on the calendar). Tap it to go back
          up to the full result. */}
      {totalSlot && (
        <div className={"total-chip-slot" + (showTotal ? "" : " is-hidden")} aria-hidden={showTotal ? undefined : "true"}
          style={{ display: "flex", justifyContent: "center", padding: "0 16px 8px", pointerEvents: "none" }}>
          <button ref={totalChipRef} type="button" className="total-chip" onClick={onTotal} tabIndex={showTotal ? undefined : -1}
            aria-label={`${totalShort} ${fmt(total)}. Back to your pay`} style={{
            color: "var(--ink)", cursor: "pointer", fontFamily: "inherit",
            background: "var(--surface-translucent)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid var(--glass-edge)",
            borderRadius: 999,
            padding: "8px 16px",
            display: "inline-flex", alignItems: "center", gap: 10,
            boxShadow: "0 12px 32px -16px rgba(0,0,0,0.6)",
            pointerEvents: showTotal ? "auto" : "none",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: hasInputs ? "var(--accent)" : "var(--ink-faint)" }} />
            <span style={{ fontSize: 12.5, color: "var(--ink-dim)" }}>{totalShort}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.005em" }}>
              <AnimatedNumber value={total} format={fmt} />
            </span>
            <span aria-hidden style={{ display: "inline-flex", color: "var(--ink-faint)", marginLeft: -2, transform: "rotate(180deg)" }}><ChevronIcon dir="down" size={11} /></span>
          </button>
        </div>
      )}

      {/* Three tabs: narrower than four, so each stays a comfortable target
          without the capsule stretching across a big phone. */}
      <div className="nsc-dock" style={{ maxWidth: 360, margin: "0 auto", padding: "0 16px 12px", pointerEvents: "auto" }}>
        <div role="tablist" style={{
          // A floating capsule of frosted glass, like the iOS tab bar.
          background: "var(--surface-translucent)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid var(--glass-edge)",
          borderRadius: 30,
          padding: 5,
          display: "grid",
          gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
          gap: 4,
          boxShadow: "0 16px 40px -16px rgba(0,0,0,0.6)",
          position: "relative", isolation: "isolate",
        }}>
          {/* One highlight that glides to the active tab. Each column is
              (100% − padding − gaps) / n wide, so moving by its own width
              plus one gap lands it on the next tab. */}
          {activeIndex >= 0 && (
            <span aria-hidden className="nsc-tab-pill" style={{
              position: "absolute", top: 5, bottom: 5, left: 5, zIndex: -1,
              width: `calc((100% - 10px - ${(tabs.length - 1) * 4}px) / ${tabs.length})`,
              transform: `translateX(calc(${activeIndex} * (100% + 4px)))`,
              borderRadius: 25, background: "var(--fill)",
            }} />
          )}
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
                  borderRadius: 25,
                  background: "transparent",
                  color: active ? "var(--accent)" : "var(--ink-dim)",
                  cursor: "pointer",
                  transition: "background 0.18s, color 0.18s, var(--press)",
                  position: "relative",
                  fontFamily: "inherit",
                }}
              >
                {/* Keyed by state, so the icon squashes and springs back
                    each time its tab is picked. */}
                <span key={active ? "on" : "off"} className={active ? "nsc-tab-pop" : undefined} style={{ display: "inline-flex" }}><Icon /></span>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.005em" }}>{t.label}</span>
                {t.badge > 0 && !active && (
                  // Keyed by the count, so it pops when a period is saved.
                  <span key={t.badge} className="mono nsc-pop" style={{
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
function CrewIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M15.5 4.9a3.2 3.2 0 0 1 0 6.2"/><path d="M17.5 14.3c2.1.6 3.5 2.6 3.5 5.2"/>
  </svg>;
}
function HistoryIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3.5 2"/>
  </svg>;
}

/* mount */
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
