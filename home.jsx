/* home.jsx — simple Home page: plain-language setup (pay → commute → shifts)
   and a one-glance result. It never computes pay itself: answers become
   ordinary calendar entries (see rotationEntries / totalsEntries in helpers)
   and the preview runs the same aggregate() the calculator uses. */
const { useState: useStateH, useMemo: useMemoH } = React;

const HOME_SHIFTS = {
  am7: { label: "7AM", color: "var(--am)" },
  pm3: { label: "3PM", color: "var(--sp1)" },
  pm10: { label: "10PM", color: "var(--sp2)" },
};

function periodShiftDays(entries, period) {
  let n = 0;
  for (const d of periodDays(period)) {
    const e = entries[ymd(d)];
    if (e && (e.am7 || e.pm3 || e.pm10)) n++;
  }
  return n;
}

function HomeView(props) {
  const { period, entries, basePay, basicDistance, totals, tax, onboarded, onShiftPeriod, onOpenCalc } = props;
  const [wizard, setWizard] = useStateH(false);
  const shiftDays = periodShiftDays(entries, period);

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "16px 20px 0" }}>
      {wizard ? (
        <SetupWizard {...props} shiftDays={shiftDays} onDone={() => setWizard(false)} />
      ) : shiftDays === 0 && !(Number(basePay.monthly) > 0) ? (
        <HomeWelcome period={period} onShiftPeriod={onShiftPeriod} onStart={() => setWizard(true)} onOpenCalc={onOpenCalc} firstRun={!onboarded} />
      ) : (
        <HomeSummary {...props} basicDistance={basicDistance} totals={totals} tax={tax} shiftDays={shiftDays} onUpdate={() => setWizard(true)} />
      )}
    </main>
  );
}

/* ----- period switcher shared by Home states ----- */
function HomePeriod({ period, onShiftPeriod }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Pay period</div>
        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{periodLabel(period)}</div>
      </div>
      <button onClick={() => onShiftPeriod(-1)} style={iconBtn()} aria-label="Previous period">‹</button>
      <button onClick={() => onShiftPeriod(1)} style={iconBtn()} aria-label="Next period">›</button>
    </div>
  );
}

/* ----- empty period: invite to start ----- */
function HomeWelcome({ period, onShiftPeriod, onStart, onOpenCalc, firstRun }) {
  return (
    <Card style={{ padding: 20 }}>
      <HomePeriod period={period} onShiftPeriod={onShiftPeriod} />
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.015em", marginTop: 8 }}>
        {firstRun ? "Work out your pay" : "Nothing logged for this period yet"}
      </div>
      <div style={{ fontSize: 14, color: "var(--ink-dim)", lineHeight: 1.5, marginTop: 6 }}>
        Answer three quick questions: your pay, your commute and your shifts. You'll get your allowances, base pay and overtime in one number.
      </div>
      <button onClick={onStart} style={{ ...accentBtn(), width: "100%", padding: "14px 16px", fontSize: 15, marginTop: 18 }}>
        Start
      </button>
      <button onClick={() => onOpenCalc()} style={homeLinkBtn}>
        Prefer to log day by day? Open the calendar →
      </button>
    </Card>
  );
}

/* ----- result at a glance ----- */
function HomeSummary({ period, totals, tax, shiftDays, onShiftPeriod, onUpdate, onSaveSnapshot, onCopyShare, onOpenCalc, onOpenSettings, ratesEffective }) {
  const net = calcTax(totals.grand, tax).net;
  const counts = [
    [totals.cal.pm3, "3PM"],
    [totals.cal.pm10, "10PM"],
    [totals.cal.am7, "7AM"],
  ].filter(([n]) => n > 0).map(([n, l]) => `${n} × ${l}`);

  return (
    <>
      <Card style={{ padding: 20 }}>
        <HomePeriod period={period} onShiftPeriod={onShiftPeriod} />

        <div style={{
          padding: "18px 16px", borderRadius: 14,
          background: "linear-gradient(180deg, color-mix(in oklab, var(--accent) 16%, transparent), color-mix(in oklab, var(--accent) 6%, transparent))",
          border: "1px solid color-mix(in oklab, var(--accent) 30%, transparent)",
        }}>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--accent)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Estimated gross pay</div>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 4 }}>
            <AnimatedNumber value={totals.grand} format={fmt} />
          </div>
          {tax?.enabled && Math.round(net) !== Math.round(totals.grand) && (
            <div style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 2 }}>
              About <span className="mono" style={{ color: "var(--ink)", fontWeight: 600 }}>{fmt(net)}</span> after tax
            </div>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <HomeLine color="var(--sp1)" label="Allowances" hint="SP1, SP2, meal, taxi" value={totals.allowanceSubtotal} />
          <HomeLine color="var(--am)" label="Base pay" hint="basic + compulsory" value={totals.baseSubtotal} />
          <HomeLine color="var(--sp2)" label="Extra hours" hint="overtime + holiday" value={totals.extraSubtotal} />
        </div>

        <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-dim)", marginTop: 12, lineHeight: 1.5 }}>
          {shiftDays > 0 ? `${counts.join(" · ")} · ${fmtH(totals.totalHours)}h` : "No shifts logged yet"}
          {totals.holidayHours > 0 && ` · ${fmtH(totals.holidayHours)}h holiday`}
        </div>

        {totals.hasMismatch && (
          <button onClick={() => onOpenCalc()} style={{
            marginTop: 10, width: "100%", padding: "10px 12px", borderRadius: 10, textAlign: "left", cursor: "pointer", fontFamily: "inherit",
            background: "color-mix(in oklab, var(--warn) 12%, transparent)",
            border: "1px solid color-mix(in oklab, var(--warn) 40%, transparent)",
            color: "var(--warn)", fontSize: 12.5,
          }}>⚠ Your shift counts don't match the calendar. Review →</button>
        )}

        <button onClick={onUpdate} style={{ ...accentBtn(), width: "100%", padding: "13px 16px", fontSize: 14.5, marginTop: 16 }}>
          Update my shifts
        </button>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
          <button onClick={() => { onSaveSnapshot(); showToast("Snapshot saved to History"); }} style={ghostBtn()}>Save snapshot</button>
          <button onClick={onCopyShare} style={ghostBtn()}>Copy summary</button>
        </div>
        <button onClick={() => onOpenCalc()} style={homeLinkBtn}>See the full breakdown and calendar →</button>
      </Card>

      <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textAlign: "center", lineHeight: 1.6 }}>
        {ratesEffective} ·{" "}
        <button onClick={onOpenSettings} style={{ ...homeInlineBtn }}>Edit rates</button>
        <br />Estimate only. Check against your pay slip.
      </div>
    </>
  );
}

function HomeLine({ color, label, hint, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 2px", borderBottom: "1px dashed var(--line-soft)" }}>
      <span style={{ width: 6, height: 18, borderRadius: 2, background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>{hint}</div>
      </div>
      <span className="mono" style={{ fontSize: 14.5, fontWeight: 600 }}>{fmt(value)}</span>
    </div>
  );
}

/* ============ Setup wizard ============ */
const blankTotals = { pm3: "", pm10: "", am7: "", pairs: "" };

function SetupWizard({ period, entries, mode, basePay, basicDistance, counts, totals, rates, shiftDays, onApply, onOpenCalc, onOpenSettings, onDone }) {
  const [step, setStep] = useStateH(0);
  const [draft, setDraft] = useStateH(() => ({
    monthly: basePay.monthly || "",
    compulsory: basePay.compulsory || "",
    dist: basicDistance || "S",
    method: "rotation",
    // Any day the person works a 7AM. Start from a 7AM already on this
    // period's calendar if there is one, else the period's first day.
    am7Key: firstAm7Key(entries, period) || ymd(period.start),
    // Prefill totals with what's already on the calendar for this period.
    totals: shiftDays > 0
      ? { pm3: String(totals.cal.pm3), pm10: String(totals.cal.pm10), am7: String(totals.cal.am7), pairs: String(totals.cal.sameDayPair) }
      : blankTotals,
    keep: false,
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
    const preview = aggregate(mergePeriodFill(entries, period, fill, replace), period, nextMode, draft.dist, nextCounts, bp, rates);
    return { fill, nextCounts, bp, preview };
  }, [draft, period, entries, mode, counts, rates, replace]);

  const steps = ["Your pay", "Your commute", "Your shifts"];
  const last = step === steps.length - 1;
  const finish = () => {
    if (totalsErr) return;
    onApply({ fill: plan.fill, replace, basePay: plan.bp, dist: draft.dist, counts: plan.nextCounts });
    onDone();
  };

  return (
    <Card style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
          Step {step + 1} of {steps.length} · {steps[step]}
        </div>
        <button onClick={onDone} style={homeInlineBtn}>Cancel</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${steps.length}, 1fr)`, gap: 4, margin: "10px 0 18px" }} aria-hidden>
        {steps.map((_, i) => (
          <span key={i} style={{ height: 4, borderRadius: 2, background: i <= step ? "var(--accent)" : "var(--line)", transition: "background 0.2s" }} />
        ))}
      </div>

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
            <ChoiceCard active={draft.dist === "S"} onClick={() => set({ dist: "S" })} title="Short" detail={`${fmt(rates.taxiShort)} per shift`} />
            <ChoiceCard active={draft.dist === "L"} onClick={() => set({ dist: "L" })} title="Long" detail={`${fmt(rates.taxiLong)} per shift`} />
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
                <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                  <input type="checkbox" checked={draft.keep} onChange={(e) => set({ keep: e.target.checked })} style={{ accentColor: "var(--accent)", marginTop: 2 }} />
                  <span>Keep the {shiftDays} day{shiftDays === 1 ? "" : "s"} already logged and only fill empty days. {draft.keep ? "" : "Unticked: this period's calendar will be replaced."}</span>
                </label>
              ) : (
                <>This replaces the {shiftDays} day{shiftDays === 1 ? "" : "s"} already logged for this period.</>
              )}
            </div>
          )}

          <button onClick={() => { onDone(); onOpenCalc(); }} style={homeLinkBtn}>
            Different schedule? Log day by day on the calendar →
          </button>
        </>
      )}

      {last && (
        <div style={{
          marginTop: 16, padding: "12px 14px", borderRadius: 12,
          background: "color-mix(in oklab, var(--accent) 10%, transparent)",
          border: "1px solid color-mix(in oklab, var(--accent) 28%, transparent)",
          display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10,
        }}>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Estimated gross</span>
          <span style={{ fontSize: 20, fontWeight: 700 }}>
            {totalsErr ? <span className="mono">—</span> : <AnimatedNumber value={plan.preview.grand} format={fmt} />}
          </span>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
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

      {last && (
        <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 14, lineHeight: 1.5 }}>
          Rates: SP1 {fmt(rates.sp1)} · SP2 {fmt(rates.sp2)} · Meal {fmt(rates.meal)} ·{" "}
          <button onClick={onOpenSettings} style={homeInlineBtn}>Edit</button>
        </div>
      )}
    </Card>
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

function ChoiceCard({ active, onClick, title, detail }) {
  return (
    <button onClick={onClick} aria-pressed={active} style={{
      padding: "14px 14px", borderRadius: 12, textAlign: "left", cursor: "pointer", fontFamily: "inherit",
      background: active ? "color-mix(in oklab, var(--accent) 12%, var(--bg-2))" : "var(--bg-2)",
      border: `1.5px solid ${active ? "var(--accent)" : "var(--line)"}`,
      color: "var(--ink)", display: "flex", flexDirection: "column", gap: 4,
      transition: "background 0.12s, border-color 0.12s",
    }}>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
      <span className="mono" style={{ fontSize: 11, color: "var(--ink-dim)" }}>{detail}</span>
    </button>
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
          style={{ width: "100%", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 12, padding: "13px 14px 13px 28px", color: "var(--ink)", fontSize: 17, outline: "none", fontFamily: "inherit" }}
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
  return (
    <>
      <div style={{ fontSize: 14, fontWeight: 500 }}>Tap any day you work a 7AM</div>
      <div style={{ fontSize: 12.5, color: "var(--ink-dim)", marginTop: 3, marginBottom: 10, lineHeight: 1.45 }}>
        Your rotation fills the whole period from that day, before and after it. Check the days below match your roster.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }} role="group" aria-label="Rotation calendar">
        {["S", "M", "T", "W", "T", "F", "S"].map((w, i) => (
          <div key={"h" + i} className="mono" style={{ fontSize: 9.5, color: "var(--ink-faint)", textAlign: "center", padding: "2px 0" }}>{w}</div>
        ))}
        {Array.from({ length: lead }).map((_, i) => <div key={"b" + i} />)}
        {days.map((d) => {
          const key = ymd(d);
          const e = preview[key];
          const k = e ? (e.am7 ? "am7" : e.pm3 ? "pm3" : "pm10") : null;
          const sh = k ? HOME_SHIFTS[k] : null;
          const anchor = key === value;
          const hol = holidayName(d);
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              aria-pressed={anchor}
              aria-label={`${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}: ${sh ? sh.label : "off"}${hol ? `, ${hol}` : ""}${anchor ? ", chosen 7AM" : ""}`}
              style={{
                position: "relative", padding: "5px 0 4px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit",
                textAlign: "center", minWidth: 0,
                background: sh ? `color-mix(in oklab, ${sh.color} 20%, transparent)` : "var(--bg-2)",
                border: anchor ? "2px solid var(--accent)" : `1px solid ${sh ? `color-mix(in oklab, ${sh.color} 50%, transparent)` : "var(--line-soft)"}`,
                color: "var(--ink)",
              }}
            >
              <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-faint)" }}>{d.getDate()}</div>
              <div className="mono" style={{ fontSize: 10, fontWeight: 600, color: sh ? "var(--ink)" : "var(--ink-faint)" }}>{sh ? sh.label : "Off"}</div>
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
        Took leave or swapped a shift? Adjust those days on the calendar afterwards.
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
          <Stepper label="Days with a 3PM and a 10PM" hint="back-to-back · taxi paid once" value={values.pairs} onChange={(v) => setK("pairs", v)} />
        ) : (
          <button onClick={() => setShowPairs(true)} style={{ ...homeInlineBtn, justifySelf: "start", fontSize: 12 }}>
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
        {hint && <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>{hint}</div>}
      </div>
      <button onClick={() => bump(-1)} style={btn} aria-label={`Fewer ${label}`}>−</button>
      <input
        inputMode="numeric" value={value} placeholder="0"
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        aria-label={label}
        style={{ width: 52, textAlign: "center", background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 4px", color: "var(--ink)", fontSize: 17, outline: "none", fontFamily: "inherit" }}
      />
      <button onClick={() => bump(1)} style={btn} aria-label={`More ${label}`}>+</button>
    </div>
  );
}

const numStr = (v) => String(Math.max(0, Math.trunc(Number(v) || 0)));

const homeLinkBtn = {
  display: "block", width: "100%", marginTop: 12, padding: "8px 4px",
  background: "transparent", border: "none", color: "var(--ink-dim)",
  fontSize: 13, cursor: "pointer", fontFamily: "inherit", textAlign: "center",
  textDecoration: "underline", textUnderlineOffset: 3,
};
const homeInlineBtn = {
  background: "transparent", border: "none", padding: 0, color: "var(--ink-dim)",
  fontSize: "inherit", cursor: "pointer", fontFamily: "inherit",
  textDecoration: "underline", textUnderlineOffset: 3,
};

Object.assign(window, { HomeView });
