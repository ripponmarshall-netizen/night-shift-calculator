/* summary.jsx — collapsible Live Summary with math popovers */
const { useState: useStateS } = React;

function LiveSummary({ totals, mode, basicDistance, tax, onSaveSnapshot, onCopyShare }) {
  const [openSec, setOpenSec] = useStateS({ allow: false, base: false, extra: false });
  const [math, setMath] = useStateS(null);
  const [showNet, setShowNet] = useStateS(false);
  const est = totals.grand;
  const taxBreak = calcTax(est, tax);
  const net = taxBreak.net;

  const showMath = (label, formula, value) => setMath({ label, formula, value });
  const toggle = (k) => setOpenSec((p) => ({ ...p, [k]: !p[k] }));

  const distLabel = mode === "basic" ? (basicDistance === "L" ? "Long" : "Short") : "Per-shift";

  return (
    <Card>
      {/* Hero total */}
      <div style={{
        marginBottom: 14, padding: "18px 16px",
        borderRadius: 14,
        background: "linear-gradient(180deg, color-mix(in oklab, var(--accent) 16%, transparent), color-mix(in oklab, var(--accent) 6%, transparent))",
        border: "1px solid color-mix(in oklab, var(--accent) 30%, transparent)",
      }}>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--accent)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Estimated Gross</div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 4, gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)" }}>
            <AnimatedNumber value={est} format={fmt} />
          </div>
          {tax?.enabled && (
            <button onClick={() => setShowNet((v) => !v)} style={{
              background: "transparent", border: "none", color: "var(--ink-dim)", fontSize: 12, padding: 0, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit",
            }}>
              {showNet ? "Hide net" : `Show est. net (${fmt(net)})`}
            </button>
          )}
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span>Allow {fmtShort(totals.allowanceSubtotal)}</span>
          <span>Base {fmtShort(totals.baseSubtotal)}</span>
          <span>Extra {fmtShort(totals.extraSubtotal)}</span>
        </div>
        {showNet && tax?.enabled && (
          <div style={{
            marginTop: 12, padding: "10px 12px",
            background: "color-mix(in oklab, var(--bg-2) 60%, transparent)",
            borderRadius: 10,
            border: "1px solid color-mix(in oklab, var(--accent) 18%, var(--line-soft))",
          }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
              Estimated deductions
            </div>
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
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 8, lineHeight: 1.5 }}>
              JM brackets: NIS, NHT, Education Tax, PAYE. Verify in Settings.
            </div>
          </div>
        )}
      </div>

      <SecHeader title="Allowance" subtotal={totals.allowanceSubtotal} open={openSec.allow} onToggle={() => toggle("allow")} accent="var(--sp1)" />
      <Collapse open={openSec.allow}>
        <div style={{ paddingLeft: 8, marginBottom: 10 }}>
          <Row label="SP1 — 3PM" value={fmt(totals.sp1)} formula onClick={() => showMath("SP1 — 3PM allowance", `${totals.cal.pm3} shifts × ${fmt(totals.rates.sp1)} per shift`, totals.sp1)} />
          <Row label="SP2 — 10PM" value={fmt(totals.sp2)} formula onClick={() => showMath("SP2 — 10PM allowance", `${totals.cal.pm10} shifts × ${fmt(totals.rates.sp2)} per shift`, totals.sp2)} />
          <Row label="Meal" value={fmt(totals.meal)} formula onClick={() => showMath("Meal allowance", `(${totals.cal.pm3} × 3PM + ${totals.cal.pm10} × 10PM) × ${fmt(totals.rates.meal)} = ${totals.cal.pm3 + totals.cal.pm10} × ${fmt(totals.rates.meal)}`, totals.meal)} />
          <Row label="Taxi" value={fmt(totals.taxi)} formula onClick={() => showMath("Taxi allowance",
            mode === "basic"
              ? `${totals.cal.pm3 + totals.cal.pm10} shifts (3PM + 10PM) × ${fmt(basicDistance === "L" ? totals.rates.taxiLong : totals.rates.taxiShort)} (${basicDistance === "L" ? "Long" : "Short"})${totals.taxiDeduct > 0 ? `\nminus ${totals.cal.sameDayPair} same-day pair × 2 × rate = − ${fmt(totals.taxiDeduct)}` : ""}`
              : `Short (${totals.cal.shortPm3 + totals.cal.shortPm10}) × ${fmt(totals.rates.taxiShort)}\n+ Long (${totals.cal.longPm3 + totals.cal.longPm10}) × ${fmt(totals.rates.taxiLong)}${totals.taxiDeduct > 0 ? `\n− pair deduction ${fmt(totals.taxiDeduct)}` : ""}`,
            totals.taxi)} />
          {totals.taxiDeduct > 0 && <Row label={`Same-day pair deduction (×${totals.cal.sameDayPair})`} value={"− " + fmt(totals.taxiDeduct)} faint />}
          <Row label="Distance" value={distLabel} />
        </div>
      </Collapse>

      <SecHeader title="Base Pay" subtotal={totals.baseSubtotal} open={openSec.base} onToggle={() => toggle("base")} accent="var(--am)" />
      <Collapse open={openSec.base}>
        <div style={{ paddingLeft: 8, marginBottom: 10 }}>
          <Row label="Monthly Basic" value={fmt(totals.monthlyBasic)} />
          <Row label="Compulsory Allowance" value={fmt(totals.compulsory)} />
          <Row label="Hourly rate" value={fmt(totals.hourlyRate)} formula onClick={() => showMath("Hourly rate", `Monthly Basic ÷ ${totals.rates.threshold}\n${fmt(totals.monthlyBasic)} ÷ ${totals.rates.threshold}`, totals.hourlyRate)} />
        </div>
      </Collapse>

      <SecHeader title="Extra Hours" subtotal={totals.extraSubtotal} open={openSec.extra} onToggle={() => toggle("extra")} accent="var(--sp2)" />
      <Collapse open={openSec.extra}>
        <div style={{ paddingLeft: 8, marginBottom: 10 }}>
          <Row label="Total hours" value={fmtH(totals.totalHours)} />
          <Row label="Holiday hours" value={fmtH(totals.holidayHours)} />
          <Row label="Non-holiday hours" value={fmtH(totals.nonHolidayHours)} />
          <Row label={`Hours over ${totals.rates.threshold}`} value={fmtH(totals.otHours)} formula onClick={() => showMath("Overtime hours", `Non-holiday hours − threshold\n${fmtH(totals.nonHolidayHours)} − ${totals.rates.threshold} (clamped ≥ 0)`, totals.otHours)} />
          <Row label="Holiday pay (×2)" value={fmt(totals.holidayPay)} formula onClick={() => showMath("Holiday pay", `${fmtH(totals.holidayHours)} hours × ${fmt(totals.hourlyRate)}/h × 2`, totals.holidayPay)} />
          <Row label="Overtime pay (×1.5)" value={fmt(totals.overtimePay)} formula onClick={() => showMath("Overtime pay", `${fmtH(totals.otHours)} hours × ${fmt(totals.hourlyRate)}/h × 1.5`, totals.overtimePay)} />
        </div>
      </Collapse>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        <button onClick={onSaveSnapshot} style={accentBtn()}>Save Snapshot</button>
        <button onClick={onCopyShare} style={ghostBtn()}>⎘ Copy summary</button>
      </div>

      {math && <MathPopover {...math} onClose={() => setMath(null)} />}
    </Card>
  );
}

function SecHeader({ title, subtotal, open, onToggle, accent }) {
  return (
    <button onClick={onToggle} style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
      width: "100%", padding: "10px 12px",
      background: open ? "var(--bg-2)" : "transparent",
      border: "1px solid var(--line-soft)",
      borderRadius: 10,
      color: "var(--ink)",
      cursor: "pointer",
      marginBottom: 4,
      textAlign: "left",
      fontFamily: "inherit",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 6, height: 16, borderRadius: 2, background: accent }} />
        <span style={{ fontSize: 13.5, fontWeight: 500 }}>{title}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="mono" style={{ fontSize: 13.5, fontWeight: 600 }}>{fmt(subtotal)}</span>
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

function MathPopover({ label, formula, value, onClose }) {
  const { ref: dialogRef, closing, close } = useModalDismiss(onClose);
  return (
    <div onClick={close} className={"nsc-backdrop" + (closing ? " is-closing" : "")} style={{
      position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.5)",
      backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div ref={dialogRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className={"nsc-modal nsc-center" + (closing ? " is-closing" : "")} style={{
        width: "100%", maxWidth: 380,
        background: "var(--bg-1)", border: "1px solid var(--line)",
        borderRadius: 14, padding: 18, outline: "none",
      }}>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.1em" }}>How this is calculated</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{label}</div>
        <pre className="mono" style={{
          marginTop: 12, padding: 12,
          background: "var(--bg-2)", border: "1px solid var(--line-soft)",
          borderRadius: 8, color: "var(--ink-dim)",
          fontSize: 12, lineHeight: 1.5,
          whiteSpace: "pre-wrap", wordBreak: "break-word",
          fontFamily: "inherit",
        }}>{formula}</pre>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 12 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Result</span>
          <span className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{fmt(value)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button onClick={close} style={primaryBtn()}>Got it</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LiveSummary, MathPopover });
