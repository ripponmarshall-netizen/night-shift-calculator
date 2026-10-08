/* reconcile.jsx — pay slip reconciliation: enter actual amounts, see variance */
const { useState: useStateR } = React;

/* The pay-slip lines, in pay-slip order. */
const RECON_LINES = [
  { k: "sp1", label: "SP1 — 3PM" },
  { k: "sp2", label: "SP2 — 10PM" },
  { k: "meal", label: "Meal" },
  { k: "taxi", label: "Taxi" },
  { k: "monthlyBasic", label: "Monthly Basic" },
  { k: "compulsory", label: "Compulsory assign." },
  { k: "holidayPay", label: "Holiday pay (×2)" },
  { k: "overtimePay", label: "Overtime (×1.5)" },
];

/* What the pay slip says in total: the typed "Pay slip total" when there is
   one (an explicit 0 counts), otherwise the sum of the lines filled in.
   hasTotal: anything was entered to compare against. */
function reconTotals(recon, estimate) {
  const r = recon || {};
  const lineSum = RECON_LINES.reduce((a, l) => a + (Number(r[l.k]) || 0), 0);
  // A lone "." while typing isn't a number yet.
  const hasGrand = r.grand != null && r.grand !== "" && Number.isFinite(Number(r.grand));
  const total = hasGrand ? Number(r.grand) || 0 : lineSum;
  return { total, hasGrand, hasTotal: hasGrand || lineSum !== 0, variance: total - (Number(estimate) || 0) };
}

function ReconcileModal({ snapshot, onSave, onClose }) {
  const dismiss = useModalDismiss(onClose);
  const { close } = dismiss;
  const t = snapshot.totals || {};
  const [actual, setActual] = useStateR(() => {
    const existing = snapshot.reconcile || {};
    const out = {};
    for (const k of [...RECON_LINES.map((l) => l.k), "grand", "notes"]) out[k] = existing[k] ?? "";
    return out;
  });
  const set = (k, v) => setActual((p) => ({ ...p, [k]: k === "notes" ? v : sanitizeDecimal(v) }));

  // Legacy snapshots can miss a field.
  const lines = RECON_LINES.map((l) => ({ ...l, expected: Number(t[l.k]) || 0 }));
  const { variance: totalVariance, hasTotal } = reconTotals(actual, t.grand);

  const save = () => {
    // Nothing typed: don't mark the period as checked against a pay slip.
    const empty = Object.values(actual).every((v) => String(v).trim() === "");
    onSave(empty ? null : { ...actual, at: new Date().toISOString() });
    showToast(empty ? "Nothing entered. Pay slip check cleared" : "Pay slip check saved");
    close();
  };

  return (
    <ModalFrame dismiss={dismiss} zIndex={85} maxWidth={560} label="Pay slip check">
        <ModalHead eyebrow="Pay slip check" title="What were you actually paid?" onClose={close}>
          <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 2 }}>{snapshot.period}</div>
        </ModalHead>

        <div style={{ fontSize: 12.5, color: "var(--ink-dim)", marginBottom: 12, lineHeight: 1.5 }}>
          Enter what you were <span style={{ color: "var(--ink)" }}>actually paid</span> per line. Empty rows are skipped. Variance is shown vs the estimated amount.
        </div>

        <div style={{ borderTop: "1px solid var(--line-soft)", marginBottom: 4 }} />

        {lines.map((l) => {
          const a = Number(actual[l.k]);
          const hasActual = actual[l.k] !== "" && Number.isFinite(a);
          const variance = hasActual ? a - l.expected : 0;
          const varianceColor = !hasActual ? "var(--ink-faint)"
            : Math.abs(variance) < 0.01 ? "var(--ok)"
            : variance > 0 ? "var(--ok)"
            : "var(--holiday)";
          return (
            <div key={l.k} className="recon-row" style={{
              padding: "10px 0", borderBottom: "1px dashed var(--line-soft)",
              gap: 8, alignItems: "center",
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
                    fontSize: 16, fontFamily: "inherit",
                  }}
                />
              </div>
              <div className="mono recon-var" style={{
                textAlign: "right", fontSize: 12, color: varianceColor, fontWeight: 600,
              }}>
                {hasActual ? (Math.abs(variance) < 0.01 ? "✓ match" : `${variance >= 0 ? "+" : ""}${fmt(variance)}`) : null}
              </div>
            </div>
          );
        })}

        <div style={{ borderTop: "1px solid var(--line)", marginTop: 8, paddingTop: 12 }}>
          <div className="recon-row" style={{
            padding: "10px 12px", marginBottom: 10,
            background: "var(--bg-2)", borderRadius: 10,
            gap: 8, alignItems: "center",
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
                  fontSize: 16, fontFamily: "inherit",
                }}
              />
            </div>
            <div className="mono recon-var" style={{
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

          <div className="label" style={{ marginBottom: 6 }}>Notes</div>
          <textarea
            value={actual.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Anything to remember about this period..."
            rows={2}
            style={{
              width: "100%", background: "var(--bg-2)", border: "1px solid var(--line)",
              borderRadius: 10, padding: "10px 12px", color: "var(--ink)",
              fontSize: 16, fontFamily: "inherit",
              resize: "vertical", minHeight: 60,
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
          <button onClick={close} style={ghostBtn()}>Cancel</button>
          <button onClick={save} style={accentBtn()}>Save pay slip check</button>
        </div>
    </ModalFrame>
  );
}

Object.assign(window, { ReconcileModal, reconTotals });
