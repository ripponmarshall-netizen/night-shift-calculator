/* reconcile.jsx — pay slip reconciliation: enter actual amounts, see variance */
const { useState: useStateR, useMemo: useMemoR } = React;

function ReconcileModal({ snapshot, onSave, onClose }) {
  const { ref: dialogRef, closing, close } = useModalDismiss(onClose);
  const t = snapshot.totals;
  const existing = snapshot.reconcile || {};
  const [actual, setActual] = useStateR({
    sp1: existing.sp1 ?? "",
    sp2: existing.sp2 ?? "",
    meal: existing.meal ?? "",
    taxi: existing.taxi ?? "",
    monthlyBasic: existing.monthlyBasic ?? "",
    compulsory: existing.compulsory ?? "",
    holidayPay: existing.holidayPay ?? "",
    overtimePay: existing.overtimePay ?? "",
    grand: existing.grand ?? "",
    notes: existing.notes ?? "",
  });
  const set = (k, v) => setActual((p) => ({ ...p, [k]: k === "notes" ? v : sanitizeDecimal(v) }));

  const lines = [
    { k: "sp1", label: "SP1 — 3PM", expected: t.sp1 },
    { k: "sp2", label: "SP2 — 10PM", expected: t.sp2 },
    { k: "meal", label: "Meal", expected: t.meal },
    { k: "taxi", label: "Taxi", expected: t.taxi },
    { k: "monthlyBasic", label: "Monthly Basic", expected: t.monthlyBasic },
    { k: "compulsory", label: "Compulsory Allow.", expected: t.compulsory },
    { k: "holidayPay", label: "Holiday pay (×2)", expected: t.holidayPay },
    { k: "overtimePay", label: "Overtime (×1.5)", expected: t.overtimePay },
  ];

  const totalActualPerLine = lines.reduce((sum, l) => sum + (Number(actual[l.k]) || 0), 0);
  // Use the explicit "Pay slip total" when entered (honoring an explicit 0),
  // otherwise fall back to the sum of the per-line actuals.
  const actualGrand = actual.grand !== "" ? Number(actual.grand) || 0 : totalActualPerLine;
  const totalVariance = actualGrand - t.grand;
  // There's a total to compare whenever the user entered the grand or any line.
  const hasTotal = actual.grand !== "" || totalActualPerLine !== 0;

  const save = () => {
    onSave({
      ...actual,
      at: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div onClick={close} className={"nsc-backdrop" + (closing ? " is-closing" : "")} style={{
      position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.55)",
      backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div ref={dialogRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className={"nsc-modal nsc-center" + (closing ? " is-closing" : "")} style={{
        width: "100%", maxWidth: 560, maxHeight: "88vh", overflow: "auto",
        background: "var(--bg-1)", border: "1px solid var(--line)",
        borderRadius: 18, padding: 18, outline: "none",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Reconcile</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginTop: 2 }}>vs pay slip</div>
            <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 2 }}>{snapshot.period}</div>
          </div>
          <button onClick={close} style={iconBtn()}>✕</button>
        </div>

        <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-dim)", marginBottom: 12, lineHeight: 1.5 }}>
          Enter what you were <span style={{ color: "var(--ink)" }}>actually paid</span> per line. Empty rows are skipped. Variance is shown vs the estimated amount.
        </div>

        <div style={{ borderTop: "1px solid var(--line-soft)", marginBottom: 4 }} />

        {lines.map((l) => {
          const a = Number(actual[l.k]);
          const hasActual = actual[l.k] !== "";
          const variance = hasActual ? a - l.expected : 0;
          const varianceColor = !hasActual ? "var(--ink-faint)"
            : Math.abs(variance) < 0.01 ? "var(--ok)"
            : variance > 0 ? "var(--ok)"
            : "var(--holiday)";
          return (
            <div key={l.k} style={{
              padding: "10px 0", borderBottom: "1px dashed var(--line-soft)",
              display: "grid", gridTemplateColumns: "1fr 110px 110px", gap: 8, alignItems: "center",
            }}>
              <div>
                <div style={{ fontSize: 13.5, color: "var(--ink)" }}>{l.label}</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 2 }}>est. {fmt(l.expected)}</div>
              </div>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--ink-faint)", fontSize: 12 }}>$</span>
                <input
                  inputMode="decimal"
                  value={actual[l.k]}
                  onChange={(e) => set(l.k, e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: "100%", background: "var(--bg-2)", border: "1px solid var(--line)",
                    borderRadius: 8, padding: "8px 8px 8px 18px", color: "var(--ink)",
                    fontSize: 13, outline: "none", fontFamily: "inherit",
                  }}
                />
              </div>
              <div className="mono" style={{
                textAlign: "right", fontSize: 12, color: varianceColor, fontWeight: 600,
              }}>
                {hasActual ? (Math.abs(variance) < 0.01 ? "✓ match" : `${variance >= 0 ? "+" : ""}${fmt(variance)}`) : "—"}
              </div>
            </div>
          );
        })}

        <div style={{ borderTop: "1px solid var(--line)", marginTop: 8, paddingTop: 12 }}>
          <div style={{
            padding: "10px 12px", marginBottom: 10,
            background: "var(--bg-2)", borderRadius: 10,
            display: "grid", gridTemplateColumns: "1fr 110px 110px", gap: 8, alignItems: "center",
          }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Pay slip total</div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--ink-faint)", fontSize: 12 }}>$</span>
              <input
                inputMode="decimal"
                value={actual.grand}
                onChange={(e) => set("grand", e.target.value)}
                placeholder="0.00"
                style={{
                  width: "100%", background: "var(--bg-1)", border: "1px solid var(--line)",
                  borderRadius: 8, padding: "8px 8px 8px 18px", color: "var(--ink)",
                  fontSize: 13, outline: "none", fontFamily: "inherit",
                }}
              />
            </div>
            <div className="mono" style={{
              textAlign: "right", fontSize: 13, fontWeight: 700,
              color: !hasTotal ? "var(--ink-faint)" :
                     Math.abs(totalVariance) < 0.01 ? "var(--ok)" :
                     totalVariance > 0 ? "var(--ok)" : "var(--holiday)",
            }}>
              {!hasTotal ? "—" :
                Math.abs(totalVariance) < 0.01 ? "✓ match" :
                `${totalVariance >= 0 ? "+" : ""}${fmt(totalVariance)}`}
            </div>
          </div>

          <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Notes</div>
          <textarea
            value={actual.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Anything to remember about this period..."
            rows={2}
            style={{
              width: "100%", background: "var(--bg-2)", border: "1px solid var(--line)",
              borderRadius: 10, padding: "10px 12px", color: "var(--ink)",
              fontSize: 13, outline: "none", fontFamily: "inherit",
              resize: "vertical", minHeight: 60,
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
          <button onClick={close} style={ghostBtn()}>Cancel</button>
          <button onClick={save} style={accentBtn()}>Save reconciliation</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ReconcileModal });
