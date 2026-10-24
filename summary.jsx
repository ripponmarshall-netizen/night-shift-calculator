/* summary.jsx — Home's pay card: the total, what it comes to after tax, and
   its three parts. Each part folds open to its lines, and a line marked ƒ
   shows how it was worked out. */
const { useState: useStateS, useRef: useRefS, useEffect: useEffectS } = React;

function PaySummary({ period, totals, mode, basicDistance, tax, shiftDays, saveStatus, onShiftPeriod, onSaveSnapshot, onCopyShare, onHeroVisible, onAddPay, onReviewRoster }) {
  const [openSec, setOpenSec] = useStateS({ allow: false, base: false, extra: false, duty: false });
  const [math, setMath] = useStateS(null);
  const [showNet, setShowNet] = useStateS(false);
  const [part, setPart] = useStateS(null);
  const est = totals.grand;
  const taxBreak = estimateNet(totals, tax);
  const net = taxBreak.net;
  const hasNet = netApplies(totals, tax);
  const noBasic = !(Number(totals.monthlyBasic) > 0);

  // unit "h" shows the result as hours (in the unit overtime is counted
  // in); money otherwise.
  const showMath = (label, formula, value, unit) => setMath({ label, formula, value, unit, rates: totals.rates });
  const byMin = inMinutes(totals.rates);
  const hrs = (v) => (byMin ? fmtHM(v) : fmtH(v));
  const thrLabel = byMin ? fmtHM(totals.rates.threshold) : String(totals.rates.threshold);
  // Extra shifts per shift type. Always hours and minutes: it's a count of
  // time worked, read against the roster, not a figure in the pay math.
  const extraKinds = SHIFTS.filter((s) => totals.extraBy?.[s.k]?.n > 0);
  const n = (k, word) => `${k} ${word}${k === 1 ? "" : "s"}`;
  const toggle = (k) => setOpenSec((p) => ({ ...p, [k]: !p[k] }));
  const anyOpen = openSec.allow || openSec.base || openSec.extra;
  // Leave, orderly and exchange shifts: a fourth row, only when there are any.
  const dutyCount = DUTY_KEYS.reduce((a, k) => a + (Number(totals.duties?.[k]) || 0), 0);

  // Tell the app when this total is on screen, so the floating total pill
  // above the tabs only shows once it has scrolled away.
  const heroRef = useRefS(null);
  useEffectS(() => {
    const el = heroRef.current;
    if (!el || !onHeroVisible) return;
    if (typeof IntersectionObserver === "undefined") { onHeroVisible(false); return; }
    const io = new IntersectionObserver(([e]) => onHeroVisible(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); onHeroVisible(null); };
  }, []);

  const extra = totals.extraShifts || 0;
  const counts = [
    [totals.cal.pm3, "3PM"],
    [totals.cal.pm10, "10PM"],
    [totals.cal.am7, "7AM"],
  ].filter(([c]) => c > 0).map(([c, l]) => `${c} × ${l}`);

  return (
    <Card style={{ padding: 20 }}>
      <PeriodNav period={period} onShift={onShiftPeriod} style={{ marginBottom: 12 }} />

      <div ref={heroRef} className="nsc-hero">
        {/* A light sweeps across whenever the total changes. */}
        <span key={Math.round(est * 100)} className="nsc-sheen" aria-hidden />
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--accent)" }}>{totalLabel(totals)}</div>
        {/* Scales down on narrow phones, so a six-figure total stays inside the card. */}
        <div style={{ fontSize: "clamp(26px, 8.6vw, 34px)", fontWeight: 700, letterSpacing: "-0.02em", marginTop: 4 }}>
          <AnimatedNumber value={est} format={fmt} from={0} durationMs={900} />
        </div>
        {hasNet && (
          <button onClick={() => setShowNet((v) => !v)} aria-expanded={showNet} className="nsc-fold-btn" style={{
            display: "inline-flex", alignItems: "center", gap: 6, marginTop: 2, padding: "2px 0",
            background: "transparent", border: "none", color: "var(--ink-dim)", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
          }}>
            <span>About <span className="mono" style={{ color: "var(--ink)", fontWeight: 600 }}>{fmt(net)}</span> after tax</span>
            <FoldChevron open={showNet} size={10} />
          </button>
        )}
        {noBasic && (
          <div style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 6, lineHeight: 1.45 }}>
            Base pay, overtime and tax aren't included.{" "}
            <button onClick={onAddPay} style={{ ...linkBtn(), color: "var(--ink)", fontWeight: 600 }}>Add your monthly pay</button>
          </div>
        )}
        {est > 0 && (
          <div style={{ marginTop: 14 }}>
            <SplitBar totals={totals} focus={part} onFocusPart={setPart} />
          </div>
        )}
        <Collapse open={showNet && hasNet}>
          <div style={{
            marginTop: 12, padding: "10px 12px",
            background: "color-mix(in oklab, var(--bg-2) 60%, transparent)",
            borderRadius: 10,
            border: "1px solid color-mix(in oklab, var(--accent) 18%, var(--line-soft))",
          }}>
            <div className="label" style={{ marginBottom: 6 }}>Estimated deductions</div>
            {taxBreak.lines.map((l, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12 }}>
                <span style={{ color: "var(--ink-dim)" }}>{l.label} {l.note && <span style={{ color: "var(--ink-faint)" }}>· {l.note}</span>}</span>
                <span className="mono" style={{ color: "var(--ink)" }}>− {fmt(l.value)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", borderTop: "1px dashed var(--line)", marginTop: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Estimated net</span>
              <span className="mono" style={{ fontSize: 14, fontWeight: 700 }}>{fmt(net)}</span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 8, lineHeight: 1.5 }}>
              Meal and taxi ({fmt(taxBreak.exempt)}) are tax-free, so deductions are on {fmt(taxBreak.taxable)}. JM brackets: NIS, NHT, Education Tax, PAYE. Verify in Settings.
            </div>
          </div>
        </Collapse>
      </div>

      <div style={{ marginTop: 10 }} onPointerLeave={() => setPart(null)}>
        <PartRow k="allow" label="Allowances" hint="SP1, SP2, meal, taxi" value={totals.allowanceSubtotal}
          open={openSec.allow} onToggle={() => toggle("allow")} dim={part && part !== "allow"} onEnter={() => setPart("allow")}>
          <Row label="SP1 — 3PM" value={fmt(totals.sp1)} formula onClick={() => showMath("SP1 — 3PM allowance", `${n(totals.cal.pm3, "shift")} × ${fmt(totals.rates.sp1)} per shift`, totals.sp1)} />
          <Row label="SP2 — 10PM" value={fmt(totals.sp2)} formula onClick={() => showMath("SP2 — 10PM allowance", `${n(totals.cal.pm10, "shift")} × ${fmt(totals.rates.sp2)} per shift`, totals.sp2)} />
          <Row label="Meal" value={fmt(totals.meal)} formula onClick={() => showMath("Meal allowance", `(${totals.cal.pm3} × 3PM + ${totals.cal.pm10} × 10PM) × ${fmt(totals.rates.meal)} = ${totals.cal.pm3 + totals.cal.pm10} × ${fmt(totals.rates.meal)}`, totals.meal)} />
          <Row label="Taxi" value={fmt(totals.taxi)} formula onClick={() => showMath("Taxi allowance",
            mode === "basic"
              ? `${n(totals.cal.pm3 + totals.cal.pm10, "shift")} (3PM + 10PM) × ${fmt(basicDistance === "L" ? totals.rates.taxiLong : totals.rates.taxiShort)} (${basicDistance === "L" ? "Long" : "Short"})${totals.taxiDeduct > 0 ? `\nminus ${n(totals.cal.sameDayPair, "same-day pair")} × 2 × rate = − ${fmt(totals.taxiDeduct)}` : ""}`
              : `Short (${totals.cal.shortPm3 + totals.cal.shortPm10}) × ${fmt(totals.rates.taxiShort)}\n+ Long (${totals.cal.longPm3 + totals.cal.longPm10}) × ${fmt(totals.rates.taxiLong)}${totals.taxiDeduct > 0 ? `\n− pair deduction ${fmt(totals.taxiDeduct)}` : ""}`,
            totals.taxi)} />
          {totals.taxiDeduct > 0 && <Row label={`Same-day pair deduction (×${totals.cal.sameDayPair})`} value={"− " + fmt(totals.taxiDeduct)} faint />}
          {totals.leaveShifts > 0 && <Row label={`Shifts on leave (×${totals.leaveShifts})`} value="no allowance" faint />}
          {totals.exchangedShifts > 0 && <Row label={`Exchange leave (×${totals.exchangedShifts})`} value="no allowance" faint />}
        </PartRow>

        <PartRow k="base" label="Base pay" hint="basic + compulsory" value={totals.baseSubtotal}
          open={openSec.base} onToggle={() => toggle("base")} dim={part && part !== "base"} onEnter={() => setPart("base")}>
          <Row label="Monthly Basic" value={fmt(totals.monthlyBasic)} />
          <Row label="Compulsory assignment" value={fmt(totals.compulsory)} />
          <Row label="Hourly rate" value={fmt(totals.hourlyRate)} formula onClick={() => showMath("Hourly rate", `Monthly Basic ÷ ${totals.rates.threshold}\n${fmt(totals.monthlyBasic)} ÷ ${totals.rates.threshold}`, totals.hourlyRate)} />
        </PartRow>

        <PartRow k="extra" label="Extra hours" hint="overtime + holiday" value={totals.extraSubtotal}
          open={openSec.extra} onToggle={() => toggle("extra")} dim={part && part !== "extra"} onEnter={() => setPart("extra")}>
          <Row label="Total hours" value={hrs(totals.totalHours)} />
          {totals.exchangedShifts > 0 && <Row label="Exchange leave (not counted)" value={hrs(totals.exchangedHours)} faint />}
          <Row label="Holiday hours" value={hrs(totals.holidayHours)} />
          <Row label="Non-holiday hours" value={hrs(totals.nonHolidayHours)} />
          <Row label={`${byMin ? "Time" : "Hours"} over ${thrLabel}`} value={hrs(totals.otHours)} formula onClick={() => showMath(byMin ? "Overtime time" : "Overtime hours",
            byMin
              ? `Non-holiday time − threshold, in whole minutes\n${hrs(totals.nonHolidayHours)} − ${thrLabel} (clamped ≥ 0)\n= ${Math.round(totals.otHours * 60).toLocaleString("en-JM")} minutes`
              : `Non-holiday hours − threshold\n${fmtH(totals.nonHolidayHours)} − ${totals.rates.threshold} (clamped ≥ 0)`,
            totals.otHours, "h")} />
          <Row label="Holiday pay (×2)" value={fmt(totals.holidayPay)} formula onClick={() => showMath("Holiday pay", byMin
            ? `${hrs(totals.holidayHours)} (${Math.round(totals.holidayHours * 60).toLocaleString("en-JM")} min) × ${fmt(totals.hourlyRate / 60)}/min × 2`
            : `${fmtH(totals.holidayHours)} hours × ${fmt(totals.hourlyRate)}/h × 2`, totals.holidayPay)} />
          <Row label="Overtime pay (×1.5)" value={fmt(totals.overtimePay)} formula onClick={() => showMath("Overtime pay", byMin
            ? `${hrs(totals.otHours)} (${Math.round(totals.otHours * 60).toLocaleString("en-JM")} min) × ${fmt(totals.hourlyRate / 60)}/min × 1.5\n(${fmt(totals.hourlyRate)}/h ÷ 60 = ${fmt(totals.hourlyRate / 60)}/min)`
            : `${fmtH(totals.otHours)} hours × ${fmt(totals.hourlyRate)}/h × 1.5`, totals.overtimePay)} />
          {/* Extra shifts are time, not a pay line: their hours are already
              in the total above, and overtime is only the time over the
              threshold, so the two are shown apart. */}
          {extra > 0 && (
            <>
              <Row muted top label="Extra shifts · outside your rotation" />
              {extraKinds.map((s) => (
                <Row key={s.k} label={`${s.label} × ${totals.extraBy[s.k].n}`} value={fmtHM(totals.extraBy[s.k].h)} />
              ))}
              <Row label={`All extra shifts × ${extra}`} value={fmtHM(totals.extraHours)} formula onClick={() => showMath("Extra shift time",
                `${extraKinds.map((s) => `${s.label} × ${totals.extraBy[s.k].n} = ${fmtHM(totals.extraBy[s.k].h)}`).join("\n")}\n\nAlready part of total hours. Overtime pay is only the time over ${thrLabel}, so extra shifts aren't paid again on top.`,
                totals.extraHours, "hm")} />
            </>
          )}
        </PartRow>

        {dutyCount > 0 && (
          <PartRow label="Leave & duties" hint="what each did to your pay" value={`${dutyCount} shift${dutyCount === 1 ? "" : "s"}`}
            open={openSec.duty} onToggle={() => toggle("duty")} dim={!!part} onEnter={() => setPart(null)}>
            <DutySummary totals={totals} bare />
          </PartRow>
        )}
      </div>

      <Collapse open={anyOpen}>
        <div style={{ fontSize: 12, color: "var(--ink-faint)", padding: "8px 2px 0" }}>Tap a line marked ƒ to see how it's worked out.</div>
      </Collapse>

      <div style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 12, lineHeight: 1.5 }}>
        {shiftDays > 0 ? `${counts.length ? counts.join(" · ") + " · " : ""}${fmtDur(totals.totalHours, totals.rates)}` : "No shifts logged yet"}
        {extra > 0 && <> · <span style={{ color: "var(--extra)", fontWeight: 600 }}>{extra} extra ({fmtHM(totals.extraHours)})</span></>}
        {totals.holidayHours > 0 && ` · ${fmtDur(totals.holidayHours, totals.rates)} holiday`}
        {totals.otHours > 0 && ` · ${fmtDur(totals.otHours, totals.rates)} overtime`}
        {totals.leaveShifts > 0 && ` · ${totals.leaveShifts} on leave`}
        {totals.duties?.orderly > 0 && ` · ${totals.duties.orderly} orderly`}
        {totals.duties?.exchangeFor > 0 && ` · ${totals.duties.exchangeFor} exchange for`}
        {totals.exchangedShifts > 0 && ` · ${totals.exchangedShifts} exchange leave`}
      </div>

      {totals.hasMismatch && (
        <button onClick={onReviewRoster} style={{
          marginTop: 10, width: "100%", padding: "10px 12px", borderRadius: 10, textAlign: "left", cursor: "pointer", fontFamily: "inherit",
          background: "color-mix(in oklab, var(--warn) 12%, transparent)",
          border: "1px solid color-mix(in oklab, var(--warn) 40%, transparent)",
          color: "var(--warn)", fontSize: 12.5,
        }}>⚠ Your roster counts don't match the calendar. Review →</button>
      )}

      {/* Nothing to save or share until a shift is logged. */}
      {(shiftDays > 0 || saveStatus?.state !== "none") && <SaveRow status={saveStatus} onSave={onSaveSnapshot} onCopy={onCopyShare} />}

      {math && <MathPopover {...math} onClose={() => setMath(null)} />}
    </Card>
  );
}

/* One part of the total (allowances, base pay, extra hours): tap it to fold
   its lines open under it. Without a part (k), it's a row about the period
   rather than a share of the money: a dashed mark, and a value in words. */
function PartRow({ k, label, hint, value, open, onToggle, dim, onEnter, children }) {
  const color = k ? PAY_PARTS.find((p) => p.key === k).color : "var(--ink-faint)";
  return (
    <div style={{ borderBottom: "1px dashed var(--line-soft)" }}>
      <button onClick={onToggle} aria-expanded={open} className="nsc-fold-btn"
        onPointerEnter={(e) => { if (e.pointerType === "mouse") onEnter(); }}
        style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 2px",
          background: "transparent", border: "none", color: "var(--ink)", cursor: "pointer",
          textAlign: "left", fontFamily: "inherit",
          opacity: dim ? 0.45 : 1, transition: "opacity 0.15s ease, var(--press)",
        }}>
        <span style={k
          ? { width: 6, height: 18, borderRadius: 2, background: color, flexShrink: 0 }
          : { width: 6, height: 18, borderRadius: 2, border: "1px dashed var(--ink-dim)", boxSizing: "border-box", flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 500 }}>{label}</span>
          <span style={{ display: "block", fontSize: 12, color: "var(--ink-faint)" }}>{hint}</span>
        </span>
        <span style={{ fontSize: 14.5, fontWeight: 600 }}>
          {typeof value === "number" ? <AnimatedNumber value={value} format={fmt} from={0} durationMs={900} /> : <span className="mono">{value}</span>}
        </span>
        <FoldChevron open={open} />
      </button>
      <Collapse open={open}>
        {/* The lines hang off a rule in the part's colour, so it's clear
            which total they add up to. */}
        <div style={{ margin: "0 0 12px 2px", paddingLeft: 14, borderLeft: `2px solid color-mix(in oklab, ${color} 45%, transparent)` }}>
          {children}
        </div>
      </Collapse>
    </div>
  );
}

function MathPopover({ label, formula, value, unit, rates, onClose }) {
  const dismiss = useModalDismiss(onClose);
  const { close } = dismiss;
  return (
    <ModalFrame dismiss={dismiss} zIndex={80} maxWidth={380} label={label}>
        <div className="label">How this is calculated</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{label}</div>
        <pre className="mono" style={{
          marginTop: 12, padding: 12,
          background: "var(--bg-2)", border: "1px solid var(--line-soft)",
          borderRadius: 8, color: "var(--ink-dim)",
          fontSize: 12, lineHeight: 1.5,
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>{formula}</pre>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 12 }}>
          <span className="label">Result</span>
          <span className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{unit === "hm" || (unit === "h" && inMinutes(rates)) ? fmtHM(value) : unit === "h" ? `${fmtH(value)}h` : fmt(value)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button onClick={close} style={primaryBtn()}>Got it</button>
        </div>
    </ModalFrame>
  );
}

Object.assign(window, { PaySummary, MathPopover });
