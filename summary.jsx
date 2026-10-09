/* summary.jsx — collapsible Live Summary with math popovers */
const { useState: useStateS, useRef: useRefS, useEffect: useEffectS } = React;

function LiveSummary({ totals, mode, basicDistance, tax, saveStatus, onSaveSnapshot, onCopyShare, onHeroVisible }) {
  const [openSec, setOpenSec] = useStateS({ allow: false, base: false, extra: false });
  const [math, setMath] = useStateS(null);
  const [showNet, setShowNet] = useStateS(false);
  const [part, setPart] = useStateS(null);
  const est = totals.grand;
  const taxBreak = estimateNet(totals, tax);
  const net = taxBreak.net;

  // unit "h" shows the result as hours; money otherwise.
  const showMath = (label, formula, value, unit) => setMath({ label, formula, value, unit });
  const n = (k, word) => `${k} ${word}${k === 1 ? "" : "s"}`;
  const toggle = (k) => setOpenSec((p) => ({ ...p, [k]: !p[k] }));

  // Tell the app when this total is on screen, so the floating total pill
  // above the tabs doesn't show the same number twice.
  const heroRef = useRefS(null);
  useEffectS(() => {
    const el = heroRef.current;
    if (!el || !onHeroVisible) return;
    if (typeof IntersectionObserver === "undefined") { onHeroVisible(false); return; }
    const io = new IntersectionObserver(([e]) => onHeroVisible(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); onHeroVisible(null); };
  }, []);
  const noBasic = !(Number(totals.monthlyBasic) > 0);

  return (
    <Card>
      {/* Hero total */}
      <div ref={heroRef} className="nsc-hero" style={{ marginBottom: 14 }}>
        {/* A light sweeps across whenever the total changes. */}
        <span key={Math.round(est * 100)} className="nsc-sheen" aria-hidden />
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--accent)" }}>{totalLabel(totals)}</div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 4, gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: "clamp(24px, 7.6vw, 30px)", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)" }}>
            <AnimatedNumber value={est} format={fmt} from={0} durationMs={900} />
          </div>
          {netApplies(totals, tax) && (
            <button onClick={() => setShowNet((v) => !v)} aria-expanded={showNet} style={linkBtn(12.5)}>
              {showNet ? "Hide net" : `Show est. net (${fmt(net)})`}
            </button>
          )}
        </div>
        {noBasic && (
          <div style={{ fontSize: 12.5, color: "var(--ink-dim)", marginTop: 6, lineHeight: 1.45 }}>
            Base pay, overtime and tax aren't included until you add your monthly basic below.
          </div>
        )}
        {est > 0 && (
          <div style={{ marginTop: 14 }}>
            <SplitBar totals={totals} focus={part} onFocusPart={setPart} />
          </div>
        )}
        <Collapse open={showNet && netApplies(totals, tax)}>
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

      <SecHeader dim={part && part !== "allow"} onEnter={() => setPart("allow")} onLeave={() => setPart(null)} title="Allowance" subtotal={totals.allowanceSubtotal} open={openSec.allow} onToggle={() => toggle("allow")} accent="var(--sp1)" />
      <Collapse open={openSec.allow}>
        <div style={{ paddingLeft: 8, marginBottom: 10 }}>
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
        </div>
      </Collapse>

      <SecHeader dim={part && part !== "base"} onEnter={() => setPart("base")} onLeave={() => setPart(null)} title="Base Pay" subtotal={totals.baseSubtotal} open={openSec.base} onToggle={() => toggle("base")} accent="var(--am)" />
      <Collapse open={openSec.base}>
        <div style={{ paddingLeft: 8, marginBottom: 10 }}>
          <Row label="Monthly Basic" value={fmt(totals.monthlyBasic)} />
          <Row label="Compulsory assignment" value={fmt(totals.compulsory)} />
          <Row label="Hourly rate" value={fmt(totals.hourlyRate)} formula onClick={() => showMath("Hourly rate", `Monthly Basic ÷ ${totals.rates.threshold}\n${fmt(totals.monthlyBasic)} ÷ ${totals.rates.threshold}`, totals.hourlyRate)} />
        </div>
      </Collapse>

      <SecHeader dim={part && part !== "extra"} onEnter={() => setPart("extra")} onLeave={() => setPart(null)} title="Extra Hours" subtotal={totals.extraSubtotal} open={openSec.extra} onToggle={() => toggle("extra")} accent="var(--sp2)" />
      <Collapse open={openSec.extra}>
        <div style={{ paddingLeft: 8, marginBottom: 10 }}>
          <Row label="Total hours" value={fmtH(totals.totalHours)} />
          {totals.exchangedShifts > 0 && <Row label="Exchange leave (not counted)" value={fmtH(totals.exchangedHours)} faint />}
          <Row label="Holiday hours" value={fmtH(totals.holidayHours)} />
          <Row label="Non-holiday hours" value={fmtH(totals.nonHolidayHours)} />
          <Row label={`Hours over ${totals.rates.threshold}`} value={fmtH(totals.otHours)} formula onClick={() => showMath("Overtime hours", `Non-holiday hours − threshold\n${fmtH(totals.nonHolidayHours)} − ${totals.rates.threshold} (clamped ≥ 0)`, totals.otHours, "h")} />
          <Row label="Holiday pay (×2)" value={fmt(totals.holidayPay)} formula onClick={() => showMath("Holiday pay", `${fmtH(totals.holidayHours)} hours × ${fmt(totals.hourlyRate)}/h × 2`, totals.holidayPay)} />
          <Row label="Overtime pay (×1.5)" value={fmt(totals.overtimePay)} formula onClick={() => showMath("Overtime pay", `${fmtH(totals.otHours)} hours × ${fmt(totals.hourlyRate)}/h × 1.5`, totals.overtimePay)} />
        </div>
      </Collapse>

      <DutySummary totals={totals} style={{ marginTop: 8 }} />

      <div style={{ fontSize: 12, color: "var(--ink-faint)", margin: "8px 2px 0" }}>Tap a row to see the lines. Tap ƒ to see the math.</div>

      <SaveRow status={saveStatus} onSave={onSaveSnapshot} onCopy={onCopyShare} />

      {math && <MathPopover {...math} onClose={() => setMath(null)} />}
    </Card>
  );
}

function SecHeader({ title, subtotal, open, onToggle, accent, dim, onEnter, onLeave }) {
  return (
    <button onClick={onToggle} aria-expanded={open} onPointerEnter={(e) => { if (e.pointerType === "mouse") onEnter?.(); }} onPointerLeave={onLeave} style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
      width: "100%", padding: "10px 12px",
      background: open ? "var(--bg-2)" : "transparent",
      border: "1px solid var(--line-soft)",
      borderRadius: 12,
      color: "var(--ink)",
      cursor: "pointer",
      marginBottom: 4,
      textAlign: "left",
      fontFamily: "inherit",
      opacity: dim ? 0.45 : 1,
      transition: "background 0.18s, opacity 0.15s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 6, height: 16, borderRadius: 2, background: accent }} />
        <span style={{ fontSize: 13.5, fontWeight: 500 }}>{title}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}><AnimatedNumber value={subtotal} format={fmt} from={0} durationMs={900} /></span>
        <span style={{
          fontSize: 12, color: "var(--ink-faint)",
          transition: "transform 0.18s",
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          display: "inline-block", width: 12, textAlign: "center",
        }}>▾</span>
      </div>
    </button>
  );
}

function MathPopover({ label, formula, value, unit, onClose }) {
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
          <span className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{unit === "h" ? `${fmtH(value)}h` : fmt(value)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button onClick={close} style={primaryBtn()}>Got it</button>
        </div>
    </ModalFrame>
  );
}

Object.assign(window, { LiveSummary, MathPopover });
