/* home.jsx — the Home page, the one place your own pay lives: the result
   (each part folds open to its lines and maths), the calendar you log shifts
   on, and the pay settings behind it, plus the plain-language setup (pay →
   commute → shifts). Setup never computes pay itself: answers become
   ordinary calendar entries (see rotationEntries / totalsEntries in helpers)
   and its preview runs the same aggregate() as everything else. */
const { useState: useStateH, useMemo: useMemoH, useEffect: useEffectH, useRef: useRefH } = React;

function periodShiftDays(entries, period) {
  return periodDays(period).filter((d) => hasShifts(entries[ymd(d)])).length;
}

/* A per-device display choice (the calendar folded shut, say). Kept apart
   from the saved data, so it never lands in a backup, and it's only a
   convenience: storage that's blocked or full just means the default. */
const UI_KEY = "nsc:ui";
function useUiPref(name, initial) {
  const [value, setValue] = useStateH(() => {
    try {
      const v = JSON.parse(localStorage.getItem(UI_KEY) || "{}")[name];
      return typeof v === typeof initial ? v : initial;
    } catch { return initial; }
  });
  const set = (v) => {
    setValue(v);
    try {
      const all = JSON.parse(localStorage.getItem(UI_KEY) || "{}");
      localStorage.setItem(UI_KEY, JSON.stringify({ ...all, [name]: v }));
    } catch {}
  };
  return [value, set];
}

/* Bring a section into view, below the sticky header (its scroll-margin-top),
   once the screen has re-rendered: it may have just unfolded, or only now be
   on screen at all, so `get` finds it then. Measured from the layout, not
   the screen: a card still rising into place (closing setup replays the
   entrance) would otherwise throw the target off by however far it has
   left to travel. block "center" centres it when it fits. */
function scrollToSection(get, block = "start") {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const el = get();
    if (!el) return;
    let top = 0;
    for (let n = el; n; n = n.offsetParent) top += n.offsetTop;
    const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    const room = window.innerHeight - margin;
    const y = block === "center" && el.offsetHeight < room
      ? top - margin - (room - el.offsetHeight) / 2
      : top - margin;
    window.scrollTo({ top: Math.max(0, y), behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }));
}

function HomeView(props) {
  const {
    period, entries, mode, basePay, setBasePay, basicDistance, defaultDist, counts, setCounts, totals, tax, onboarded,
    rotationAnchor, saveStatus, clipboard, onShiftPeriod, onApply, onWizardChange, onHeroVisible, onDistance,
    onOpenDay, onAutofill, onTemplates, onClearRotation, onSaveSnapshot, onCopyShare, copyDay, pasteDay, cancelCopy,
  } = props;
  const [wizard, setWizard] = useStateH(false);
  // The app hides the tab bar while setup is open, so the wizard's own
  // Back / See my pay bar can sit at the bottom of the screen.
  useEffectH(() => {
    onWizardChange?.(wizard);
    return () => onWizardChange?.(false);
  }, [wizard]);
  // Setup holds a history entry while it's open, so the phone's Back button
  // cancels it instead of leaving the app from Home.
  const wizardLayer = React.useRef(null);
  useEffectH(() => {
    if (!wizard) return;
    const layer = openBackLayer(() => setWizard(false));
    wizardLayer.current = layer;
    return () => {
      if (wizardLayer.current !== layer) return;
      wizardLayer.current = null;
      closeBackLayer(layer);
    };
  }, [wizard]);
  // Close setup from its own buttons. `then` (a screen change) waits until
  // setup's entry is off the history, so it's pushed onto the right one.
  const closeWizard = (then) => {
    const layer = wizardLayer.current;
    wizardLayer.current = null;
    const left = layer ? closeBackLayer(layer) : Promise.resolve();
    if (typeof then !== "function") { setWizard(false); return; }
    left.then(() => { setWizard(false); then(); });
  };
  // Opening or finishing setup swaps the whole card, so start at the top
  // (finishing from the foot of the tall rotation step otherwise lands
  // halfway down the result).
  const first = React.useRef(true);
  React.useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    window.scrollTo?.(0, 0);
  }, [wizard]);
  const shiftDays = periodShiftDays(entries, period);
  // A saved rotation runs on into every period, so an empty new period can be
  // filled in one tap with the same pay and distance answers. With taxi set
  // to Varies, new shifts start at the distance Varies seeds them with, and
  // the taxi choice itself is left alone. Like every rotation fill it keeps
  // what's already there (here, any holiday changed by hand).
  const fillRotation = () => {
    onApply({
      fill: rotationEntries(period, rotationAnchor, mode === "advanced" ? defaultDist || "S" : basicDistance),
      replace: false, basePay, dist: basicDistance, keepTaxi: true,
      counts: { pm3: "", pm10: "", am7: "" }, anchor: rotationAnchor,
    });
    showToast("Rotation filled for this period");
  };
  const canQuickFill = !wizard && shiftDays === 0 && !!rotationAnchor;
  const welcome = shiftDays === 0 && !(Number(basePay.monthly) > 0) && !rotationAnchor;

  // The calendar folds shut to one line; the choice sticks on this device.
  const [calOpen, setCalOpen] = useUiPref("calendarOpen", true);
  // One pay setting open at a time, so the card stays short. A roster that
  // disagrees with the calendar opens on its check.
  const [fold, setFold] = useStateH(() => (totals.hasMismatch ? "roster" : null));
  const settingsRef = useRefH(null);
  const openSetting = (k) => {
    setFold(k);
    scrollToSection(() => settingsRef.current, "center");
  };
  const showCalendar = () => {
    setCalOpen(true);
    scrollToSection(() => document.getElementById("calendar-section"));
  };
  // "Show me the calendar" from the roster check: open it, then outline
  // every day for a moment so the counts can be checked against it.
  const [highlightDays, setHighlightDays] = useStateH(null);
  const highlightTimer = useRefH(0);
  useEffectH(() => () => clearTimeout(highlightTimer.current), []);
  const highlightCalendar = () => {
    clearTimeout(highlightTimer.current);
    setHighlightDays(new Set(periodDays(period).map(ymd)));
    highlightTimer.current = setTimeout(() => setHighlightDays(null), 3000);
    showCalendar();
  };

  const calendar = (
    <div className="is-side is-pinned">
      <Calendar
        period={period} entries={entries} mode={mode} totals={totals}
        highlight={highlightDays} rotationAnchor={rotationAnchor}
        open={calOpen} onToggle={() => setCalOpen(!calOpen)}
        onOpenDay={onOpenDay} onClearRotation={onClearRotation}
        onAutofill={onAutofill} onTemplates={onTemplates} onSetup={() => setWizard(true)}
        clipboard={clipboard} copyDay={copyDay} pasteDay={pasteDay} cancelCopy={cancelCopy}
      />
    </div>
  );

  return (
    // Setup stays one phone-width column; otherwise the calendar goes beside
    // the result on an iPad.
    <main className={"nsc-view nsc-page " + (wizard ? "is-narrow" : "is-split")} style={{ padding: "16px 20px 0" }}>
      {canQuickFill && (
        <Card style={{ padding: 18, border: "1px solid color-mix(in oklab, var(--accent) 40%, var(--line-soft))" }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>New pay period</div>
          <div style={{ fontSize: 13.5, color: "var(--ink-dim)", lineHeight: 1.5, marginTop: 4 }}>
            Your rotation carries on into this period. Fill it in, then fix any days that were different.
          </div>
          <button onClick={fillRotation} style={{ ...accentBtn(), width: "100%", padding: "13px 16px", fontSize: 15, marginTop: 14 }}>
            Fill my rotation
          </button>
        </Card>
      )}
      {wizard ? (
        <SetupWizard {...props} shiftDays={shiftDays} onDone={closeWizard} onLogByDay={() => closeWizard(showCalendar)} />
      ) : welcome ? (
        <div className="nsc-split has-side">
          <HomeWelcome period={period} onShiftPeriod={onShiftPeriod} onStart={() => setWizard(true)} onLogByDay={showCalendar} firstRun={!onboarded} />
          {calendar}
        </div>
      ) : (
        <div className="nsc-split has-side">
          <PaySummary
            period={period} totals={totals} mode={mode} basicDistance={basicDistance} tax={tax}
            shiftDays={shiftDays} saveStatus={saveStatus} onShiftPeriod={onShiftPeriod}
            onSaveSnapshot={onSaveSnapshot} onCopyShare={onCopyShare} onHeroVisible={onHeroVisible}
            onAddPay={() => openSetting("pay")} onReviewRoster={() => openSetting("roster")}
          />
          {calendar}
          <div ref={settingsRef} style={{ scrollMarginTop: "calc(var(--safe-top) + 80px)" }}>
            <Card style={{ padding: "4px 18px" }}>
              <TaxiFold mode={mode} basicDistance={basicDistance} onChange={onDistance} totals={totals}
                open={fold === "taxi"} onToggle={() => setFold(fold === "taxi" ? null : "taxi")} />
              <BasePayFold basePay={basePay} setBasePay={setBasePay}
                open={fold === "pay"} onToggle={() => setFold(fold === "pay" ? null : "pay")} />
              <CrossCheckFold counts={counts} setCounts={setCounts} totals={totals} onShowCalendar={highlightCalendar} last
                open={fold === "roster"} onToggle={() => setFold(fold === "roster" ? null : "roster")} />
            </Card>
          </div>
        </div>
      )}
    </main>
  );
}

/* ----- empty period: invite to start ----- */
function HomeWelcome({ period, onShiftPeriod, onStart, onLogByDay, firstRun }) {
  return (
    <Card style={{ padding: 20 }}>
      <PeriodNav period={period} onShift={onShiftPeriod} style={{ marginBottom: 12 }} />
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.015em", marginTop: 8 }}>
        {firstRun ? "Work out your pay" : "Nothing logged for this period yet"}
      </div>
      <div style={{ fontSize: 14, color: "var(--ink-dim)", lineHeight: 1.5, marginTop: 6 }}>
        Answer three quick questions: your pay, your commute and your shifts. You'll get your allowances, base pay and overtime in one number.
      </div>
      <button onClick={onStart} style={{ ...accentBtn(), width: "100%", padding: "14px 16px", fontSize: 15, marginTop: 18 }}>
        Start
      </button>
      <button onClick={onLogByDay} style={homeLinkBtn}>
        Prefer to log day by day? Tap a day on the calendar
      </button>
    </Card>
  );
}

/* ============ Pay settings (taxi, monthly pay, roster check) ============ */
/* A row that folds open: a title, one line saying what it's set to, and the
   controls underneath. */
function FoldRow({ title, detail, open, onToggle, warn, last, children }) {
  return (
    <div style={{ borderBottom: last ? "none" : "1px solid var(--line-soft)" }}>
      <button onClick={onToggle} aria-expanded={open} className="nsc-fold-btn" style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "14px 0",
        background: "transparent", border: "none", color: "var(--ink)", cursor: "pointer",
        textAlign: "left", fontFamily: "inherit",
      }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14.5, fontWeight: 500 }}>{title}</span>
          <span style={{ display: "block", fontSize: 12.5, color: warn ? "var(--warn)" : "var(--ink-faint)", marginTop: 2 }}>{detail}</span>
        </span>
        <FoldChevron open={open} />
      </button>
      <Collapse open={open}><div style={{ paddingBottom: 14 }}>{children}</div></Collapse>
    </div>
  );
}

/* Taxi distance: "S"/"L" pay one distance on every shift; "mixed" (Varies)
   sets it per shift in the day editor. */
function TaxiFold({ mode, basicDistance, onChange, totals, open, onToggle }) {
  const value = mode === "advanced" ? "mixed" : basicDistance;
  const c = totals.cal;
  const rate = value === "L" ? totals.rates.taxiLong : totals.rates.taxiShort;
  const detail = value === "mixed"
    ? `Varies · Short ${c.shortPm3 + c.shortPm10} · Long ${c.longPm3 + c.longPm10}`
    : `${value === "L" ? "Long" : "Short"} · ${fmt(rate)} per 3PM or 10PM shift`;
  return (
    <FoldRow title="Taxi distance" detail={detail} open={open} onToggle={onToggle}>
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
        {value === "mixed"
          ? "Set Short or Long on each shift when you tap a day. Long shifts show a striped bar."
          : <>Each 3PM and 10PM shift pays <span className="mono" style={{ color: "var(--ink)" }}>{fmt(rate)}</span> taxi this period.</>}
        {c.sameDayPair > 0 && " A day with both a 3PM and a 10PM pays none."}
      </div>
    </FoldRow>
  );
}

function BasePayFold({ basePay, setBasePay, open, onToggle }) {
  const setP = (k, v) => setBasePay((p) => ({ ...p, [k]: sanitizeDecimal(v) }));
  const monthly = Number(basePay.monthly) || 0;
  const detail = monthly > 0
    ? `${fmt(monthly)} basic · ${fmt(Number(basePay.compulsory) || 0)} compulsory`
    : "Not set · needed for base pay, overtime and tax";
  return (
    <FoldRow title="Your monthly pay" detail={detail} warn={!(monthly > 0)} open={open} onToggle={onToggle}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "end" }}>
        <RateInput label="Monthly basic" unit="$" value={basePay.monthly} onChange={(v) => setP("monthly", v)} />
        <RateInput label="Compulsory assignment" unit="$" value={basePay.compulsory} onChange={(v) => setP("compulsory", v)} />
      </div>
    </FoldRow>
  );
}

/* Optional: type the counts from your roster and the calendar is checked
   against them. Counts never change the pay math. */
function CrossCheckFold({ counts, setCounts, totals, onShowCalendar, open, onToggle, last }) {
  const setC = (k, v) => setCounts((p) => ({ ...p, [k]: v.replace(/[^0-9]/g, "") }));
  const entered = counts.pm3 !== "" || counts.pm10 !== "" || counts.am7 !== "";
  const detail = totals.hasMismatch
    ? "Your roster counts don't match the calendar"
    : entered ? "Matches the calendar" : "Optional: compare with your roster";
  return (
    <FoldRow title="Check against roster" detail={detail} warn={totals.hasMismatch} open={open} onToggle={onToggle} last={last}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        <CountInput label="3PM" color="var(--sp1)" value={counts.pm3} onChange={(v) => setC("pm3", v)} expected={totals.cal.pm3} flag={totals.mismatch.pm3} />
        <CountInput label="10PM" color="var(--sp2)" value={counts.pm10} onChange={(v) => setC("pm10", v)} expected={totals.cal.pm10} flag={totals.mismatch.pm10} />
        <CountInput label="7AM" color="var(--am)" value={counts.am7} onChange={(v) => setC("am7", v)} expected={totals.cal.am7} flag={totals.mismatch.am7} />
      </div>
      {totals.hasMismatch && (
        <button onClick={onShowCalendar} style={{
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
          fontSize: 16, fontFamily: "inherit",
        }}
      />
    </div>
  );
}

/* ============ Setup wizard ============ */
const blankTotals = { pm3: "", pm10: "", am7: "", pairs: "" };

function SetupWizard({ period, entries, mode, basePay, basicDistance, counts, totals, rates, ratesEffective, shiftDays, rotationAnchor, onApply, onLogByDay, onOpenSettings, onDone }) {
  const [step, setStep] = useStateH(0);
  // Each step starts at its question, not part-way down the last step (or
  // tucked under the sticky header, which is taller under a notch).
  const cardRef = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = cardRef.current;
    const header = document.querySelector(".nsc-header");
    const below = header ? header.getBoundingClientRect().bottom : 0;
    if (el && el.getBoundingClientRect().top < below) el.scrollIntoView({ block: "start" });
  }, [step]);
  const [draft, setDraft] = useStateH(() => ({
    monthly: basePay.monthly || "",
    compulsory: basePay.compulsory || "",
    dist: basicDistance || "S",
    method: "rotation",
    // Any day the person works a 7AM. Start from a 7AM already on this
    // period's calendar if there is one, else the period's first day.
    am7Key: am7InPeriod(period, rotationAnchor) || firstAm7Key(entries, period) || ymd(period.start),
    // Prefill totals with what's already on the calendar for this period.
    totals: shiftDays > 0
      ? { pm3: String(totals.cal.pm3), pm10: String(totals.cal.pm10), am7: String(totals.cal.am7), pairs: String(totals.cal.sameDayPair) }
      : blankTotals,
    // Days already logged stay as they are, as in Auto-fill: a leave day or
    // swap is worth more than a clean slate. Switching it off replaces them.
    keep: true,
  }));
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const totalsErr = draft.method === "totals" ? totalsError(period, draft.totals) : null;
  const replace = draft.method === "totals" || !draft.keep;
  const plan = useMemoH(() => {
    const fill = draft.method === "rotation"
      ? rotationEntries(period, draft.am7Key, draft.dist)
      : totalsEntries(period, draft.totals, draft.dist);
    const nextCounts = draft.method === "totals"
      ? { pm3: numStr(draft.totals.pm3), pm10: numStr(draft.totals.pm10), am7: numStr(draft.totals.am7) }
      : replace ? { pm3: "", pm10: "", am7: "" } : counts;
    const nextMode = replace ? "basic" : mode;
    const bp = { monthly: draft.monthly, compulsory: draft.compulsory };
    // The rotation as anchor, so kept shifts that fall outside it count as extra.
    const anchor = draft.method === "rotation" ? draft.am7Key : null;
    const preview = aggregate(mergePeriodFill(entries, period, fill, replace), period, nextMode, draft.dist, nextCounts, bp, rates, anchor);
    return { fill, nextCounts, bp, preview };
  }, [draft, period, entries, mode, counts, rates, replace]);

  const steps = ["Your pay", "Your commute", "Your shifts"];
  const last = step === steps.length - 1;
  const finish = () => {
    if (totalsErr) return;
    onApply({
      fill: plan.fill, replace, basePay: plan.bp, dist: draft.dist, counts: plan.nextCounts,
      anchor: draft.method === "rotation" ? draft.am7Key : null,
    });
    onDone();
  };

  return (
    <div ref={cardRef} style={{ scrollMarginTop: "calc(var(--safe-top) + 84px)" }}>
    <Card style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div className="label">
          Step {step + 1} of {steps.length} · {steps[step]}
        </div>
        <button onClick={() => onDone()} style={linkBtn()}>Cancel</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${steps.length}, 1fr)`, gap: 4, margin: "10px 0 18px" }} aria-hidden>
        {steps.map((_, i) => (
          <span key={i} style={{ height: 4, borderRadius: 2, background: "var(--line)", overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", background: "var(--accent)", transformOrigin: "left", transform: `scaleX(${i <= step ? 1 : 0})`, transition: "transform 0.7s var(--ease-snappy)" }} />
          </span>
        ))}
      </div>

      <div key={step} className="nsc-step">
      {step === 0 && (
        <>
          <WizardTitle title="What's your monthly pay?" sub="From your pay slip. Used for base pay and the hourly rate for overtime. Leave blank to see allowances only." />
          <div style={{ display: "grid", gap: 12 }}>
            <HomeMoney label="Monthly basic" value={draft.monthly} onChange={(v) => set({ monthly: sanitizeDecimal(v) })} />
            <HomeMoney label="Compulsory assignment allowance" value={draft.compulsory} onChange={(v) => set({ compulsory: sanitizeDecimal(v) })} />
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <WizardTitle title="How far is your commute?" sub="Sets the taxi allowance for your 3PM and 10PM shifts." />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <ChoiceCard active={draft.dist === "S"} onClick={() => set({ dist: "S" })} title="Short" detail={`${fmt(rates.taxiShort)} per 3PM or 10PM shift`} />
            <ChoiceCard active={draft.dist === "L"} onClick={() => set({ dist: "L" })} title="Long" detail={`${fmt(rates.taxiLong)} per 3PM or 10PM shift`} />
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <WizardTitle title="Which shifts did you work?" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <ChoiceCard active={draft.method === "rotation"} onClick={() => set({ method: "rotation" })} title="My rotation" detail="7AM → 3PM → 10PM → off" />
            <ChoiceCard active={draft.method === "totals"} onClick={() => set({ method: "totals" })} title="My totals" detail="Just the shift counts" />
          </div>

          {draft.method === "rotation"
            ? <RotationPicker period={period} value={draft.am7Key} onChange={(k) => set({ am7Key: k })} />
            : <TotalsPicker values={draft.totals} onChange={(t) => set({ totals: t })} error={totalsErr} />}

          {shiftDays > 0 && (
            <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "var(--bg-2)", fontSize: 12.5, color: "var(--ink-dim)", lineHeight: 1.45 }}>
              {draft.method === "rotation" ? (
                <label style={{ display: "flex", gap: 12, alignItems: "center", cursor: "pointer" }}>
                  <span style={{ flex: 1 }}>
                    Keep the {shiftDays} day{shiftDays === 1 ? "" : "s"} already logged and only fill empty days.{" "}
                    {!draft.keep ? "Switched off: this period's calendar will be replaced."
                      : plan.preview.extraShifts > 0 && <span style={{ color: "var(--extra)", fontWeight: 600 }}>{plan.preview.extraShifts} kept shift{plan.preview.extraShifts === 1 ? " falls" : "s fall"} outside this rotation and will show as extra.</span>}
                  </span>
                  <input type="checkbox" className="nsc-switch" checked={draft.keep} onChange={(e) => set({ keep: e.target.checked })} />
                </label>
              ) : (
                <>This replaces the {shiftDays} day{shiftDays === 1 ? "" : "s"} already logged for this period.</>
              )}
            </div>
          )}

          <button onClick={onLogByDay} style={homeLinkBtn}>
            Different schedule? Log day by day on the calendar →
          </button>
        </>
      )}
      </div>

      {last && (
        <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 14, lineHeight: 1.5 }}>
          {/* "Rates effective Oct 2026" → "Using rates effective Oct 2026" (only the first letter drops). */}
          {ratesEffective === "Current rates" ? "Using the current JFB rates" : `Using ${ratesEffective.charAt(0).toLowerCase()}${ratesEffective.slice(1)}`}: SP1 {fmt(rates.sp1)} · SP2 {fmt(rates.sp2)} · Meal {fmt(rates.meal)}.{" "}
          <button onClick={onOpenSettings} style={linkBtn()}>Check rates</button>
        </div>
      )}

      {/* Sticks to the bottom of the screen, so the next step and the live
          estimate are always in reach, even under the tall rotation calendar. */}
      <div style={{
        position: "sticky", bottom: 0, zIndex: 2,
        margin: "16px -20px -20px", padding: "12px 20px calc(12px + var(--safe-bottom))",
        background: "var(--bg-1)", borderTop: "1px solid var(--line-soft)",
        borderRadius: "0 0 16px 16px",
      }}>
        {last && (
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--accent)" }}>{totalLabel(plan.preview)}</span>
            <span style={{ fontSize: 20, fontWeight: 700 }}>
              {totalsErr ? <span className="mono">—</span> : <AnimatedNumber value={plan.preview.grand} format={fmt} />}
            </span>
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          {step > 0 && <button onClick={() => setStep(step - 1)} style={ghostBtn()}>Back</button>}
          <div style={{ flex: 1 }} />
          {last ? (
            <button onClick={finish} disabled={!!totalsErr} style={{ ...accentBtn(), padding: "12px 18px", opacity: totalsErr ? 0.5 : 1, cursor: totalsErr ? "not-allowed" : "pointer" }}>
              See my pay
            </button>
          ) : (
            <button onClick={() => setStep(step + 1)} style={{ ...primaryBtn(), padding: "12px 18px" }}>Next</button>
          )}
        </div>
      </div>
    </Card>
    </div>
  );
}

function WizardTitle({ title, sub }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: "-0.015em" }}>{title}</h2>
      {sub && <div style={{ fontSize: 13.5, color: "var(--ink-dim)", lineHeight: 1.5, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function HomeMoney({ label, value, onChange }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 13, color: "var(--ink-dim)", marginBottom: 6 }}>{label}</div>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--ink-faint)", fontSize: 16 }}>$</span>
        <input
          inputMode="decimal" value={value} placeholder="0.00"
          onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 12, padding: "13px 14px 13px 28px", color: "var(--ink)", fontSize: 17, fontFamily: "inherit" }}
        />
      </div>
    </label>
  );
}

function firstAm7Key(entries, period) {
  for (const d of periodDays(period)) {
    const e = entries[ymd(d)];
    if (e && e.am7) return ymd(d);
  }
  return null;
}

/* The whole period as a calendar: tap any day you work a 7AM and the rotation
   fills in both directions, so days before the chosen date are covered too.
   Each cell shows the shift that day will get, so the grid is its own preview. */
function RotationPicker({ period, value, onChange }) {
  const days = periodDays(period);
  const preview = rotationEntries(period, value, "S");
  const lead = period.start.getDay();
  const todayKey = ymd(new Date());
  return (
    <>
      <div style={{ fontSize: 14, fontWeight: 500 }}>Tap any day you work a 7AM</div>
      <div style={{ fontSize: 12.5, color: "var(--ink-dim)", marginTop: 3, marginBottom: 10, lineHeight: 1.45 }}>
        Your rotation (7AM → 3PM → 10PM → Off) fills the whole period from that day, before and after it. Check the days below match your roster. It's saved for next period too.
      </div>
      <div className="nsc-cascade" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }} role="group" aria-label="Rotation calendar">
        {["S", "M", "T", "W", "T", "F", "S"].map((w, i) => (
          <div key={"h" + i} className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", textAlign: "center", padding: "2px 0" }}>{w}</div>
        ))}
        {Array.from({ length: lead }).map((_, i) => <div key={"b" + i} />)}
        {days.map((d, di) => {
          const key = ymd(d);
          const e = preview[key];
          const sh = e ? SHIFTS.find((s) => e[s.k]) : null;
          const anchor = key === value;
          const hol = holidayName(d);
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              aria-pressed={anchor}
              className="nsc-pick"
              aria-label={`${key === todayKey ? "Today, " : ""}${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}: ${sh ? sh.label : "off"}${hol ? `, ${hol}` : ""}${anchor ? ", chosen 7AM" : ""}`}
              style={{
                "--i": lead + di,
                position: "relative", padding: "5px 0 4px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit",
                textAlign: "center", minWidth: 0,
                transition: "background 0.25s, border-color 0.25s, var(--press)",
                background: sh ? `color-mix(in oklab, ${sh.color} 20%, transparent)` : "var(--bg-2)",
                border: anchor ? "2px solid var(--accent)" : `1px solid ${sh ? `color-mix(in oklab, ${sh.color} 50%, transparent)` : "var(--line-soft)"}`,
                color: "var(--ink)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "center" }}>
                {key === todayKey
                  ? <TodayDate date={d} today size={11} />
                  : <span className="mono" style={{ fontSize: 11, color: "var(--ink-faint)" }}>{d.getDate()}</span>}
              </div>
              <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: sh ? "var(--ink)" : "var(--ink-faint)" }}>{sh ? sh.label : "Off"}</div>
              {hol && <span style={{ position: "absolute", top: 3, right: 3, width: 5, height: 5, borderRadius: "50%", background: "var(--holiday)" }} />}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 8, lineHeight: 1.45 }}>
        {holidaysInPeriod(period).length > 0 && (
          <>
            <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "var(--holiday)", marginRight: 5, verticalAlign: "middle" }} />
            Public holiday, applied automatically.{" "}
          </>
        )}
        Took leave, swapped a shift or worked an extra one? Tap that day on the calendar afterwards. Extra shifts show in <span style={{ color: "var(--extra)", fontWeight: 600 }}>pink</span> with a +.
      </div>
    </>
  );
}

function TotalsPicker({ values, onChange, error }) {
  const [showPairs, setShowPairs] = useStateH(Number(values.pairs) > 0);
  const setK = (k, v) => onChange({ ...values, [k]: v });
  return (
    <>
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>How many of each shift this period?</div>
      <div style={{ display: "grid", gap: 8 }}>
        <Stepper label="3PM shifts" color="var(--sp1)" value={values.pm3} onChange={(v) => setK("pm3", v)} />
        <Stepper label="10PM shifts" color="var(--sp2)" value={values.pm10} onChange={(v) => setK("pm10", v)} />
        <Stepper label="7AM shifts" color="var(--am)" value={values.am7} onChange={(v) => setK("am7", v)} />
        {showPairs ? (
          <Stepper label="Days with a 3PM and a 10PM" hint="back-to-back · no taxi on these days" value={values.pairs} onChange={(v) => setK("pairs", v)} />
        ) : (
          <button onClick={() => setShowPairs(true)} style={{ ...linkBtn(), justifySelf: "start", fontSize: 12 }}>
            + Worked a 3PM and 10PM on the same day?
          </button>
        )}
      </div>
      {error && <div role="alert" style={{ fontSize: 12.5, color: "var(--warn)", marginTop: 10 }}>{error}</div>}
      <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 10, lineHeight: 1.45 }}>
        Your shifts are spread across the period's regular days for the math. Holiday pay isn't included from totals. To count it, log your holiday shifts on the calendar.
      </div>
    </>
  );
}

function Stepper({ label, hint, color, value, onChange }) {
  const n = Math.max(0, Math.trunc(Number(value) || 0));
  const bump = (d) => onChange(String(Math.max(0, n + d)));
  const btn = { ...iconBtn(), width: 40, height: 40, fontSize: 20, borderRadius: 10 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 12, background: "var(--bg-2)", border: "1px solid var(--line-soft)" }}>
      {color && <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>{hint}</div>}
      </div>
      <button onClick={() => bump(-1)} style={btn} aria-label={`Fewer ${label}`}>−</button>
      <input
        inputMode="numeric" value={value} placeholder="0"
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        aria-label={label}
        style={{ width: 52, textAlign: "center", background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 4px", color: "var(--ink)", fontSize: 17, fontFamily: "inherit" }}
      />
      <button onClick={() => bump(1)} style={btn} aria-label={`More ${label}`}>+</button>
    </div>
  );
}

const numStr = (v) => String(Math.max(0, Math.trunc(Number(v) || 0)));

const homeLinkBtn = { ...linkBtn(13), display: "block", width: "100%", marginTop: 12, padding: "8px 4px", textAlign: "center" };

Object.assign(window, { HomeView, RotationPicker });
