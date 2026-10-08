/* snapshots.jsx — history list with sparkline */
const { useState: useStateSn, useMemo: useMemoSn } = React;

function SnapshotsView({ snapshots, theme, onDelete, onClear, onBack, onReconcile }) {
  // Track the open snapshot by id and look it up live, so a reconciliation
  // saved while it's open shows immediately instead of a stale copy.
  const [selectedAt, setSelectedAt] = useStateSn(null);
  const list = snapshots || [];
  const selected = list.find((s) => s.at === selectedAt) || null;
  // Order by pay period (not capture time), so "vs previous" and the sparkline
  // compare consecutive periods even when an older period is saved later.
  // Legacy snapshots without periodKey fall back to their capture date.
  const sortedAsc = useMemoSn(() => [...list].sort(snapOrder), [list]);
  const sortedDesc = useMemoSn(() => [...sortedAsc].reverse(), [sortedAsc]);

  // Coerce grand so a legacy/imported snapshot missing the field can't yield NaN.
  const g = (s) => Number(s?.totals?.grand) || 0;
  const max = Math.max(1, ...sortedAsc.map(g));
  const avg = sortedAsc.length ? sortedAsc.reduce((a, s) => a + g(s), 0) / sortedAsc.length : 0;
  const latest = sortedDesc[0];
  const prev = sortedDesc[1];
  const delta = latest && prev ? g(latest) - g(prev) : 0;
  const deltaPct = g(prev) ? (delta / g(prev)) * 100 : 0;

  return (
    <main className="nsc-view" style={{ maxWidth: 720, margin: "0 auto", padding: "20px 20px 0" }}>
      {list.length > 0 && <YTDDashboard snapshots={list} />}
      <Card>
        <SectionHead title="Saved periods" subtitle={`${list.length} saved`} right={
          list.length > 0 && <button onClick={onClear} style={ghostBtn()}>Clear all</button>
        } />

        {/* Sparkline */}
        {sortedAsc.length >= 2 && (
          <div style={{ marginBottom: 16, padding: "14px", background: "var(--bg-2)", borderRadius: 12, border: "1px solid var(--line-soft)" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <div className="label">Latest</div>
                <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{fmt(g(latest))}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="label">vs previous</div>
                <div className="mono" style={{
                  fontSize: 14, fontWeight: 600, marginTop: 2,
                  color: delta >= 0 ? "var(--ok)" : "var(--holiday)",
                }}>
                  {delta >= 0 ? "▲" : "▼"} {fmt(Math.abs(delta))} ({deltaPct >= 0 ? "+" : ""}{deltaPct.toFixed(1)}%)
                </div>
              </div>
            </div>
            <Sparkline points={sortedAsc.map(g)} labels={sortedAsc.map((s) => s.period)} avg={avg} />
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 8 }}>
              avg {fmt(avg)} · max {fmt(max)}
            </div>
          </div>
        )}

        {list.length === 0 ? (
          <EmptyState onBack={onBack} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sortedDesc.map((s, i) => {
              const prevSnap = sortedDesc[i + 1];
              const d = prevSnap ? g(s) - g(prevSnap) : 0;
              return (
                <SnapRow key={s.at} snap={s} delta={d} onOpen={() => setSelectedAt(s.at)} onDelete={() => onDelete(s.at)} />
              );
            })}
          </div>
        )}
      </Card>

      {selected && <SnapshotDetail snap={selected} theme={theme} onClose={() => setSelectedAt(null)} onReconcile={onReconcile} />}
    </main>
  );
}

function snapOrder(a, b) {
  const key = (s) => s.periodKey || ymd(new Date(s.at));
  const k = key(a).localeCompare(key(b));
  return k !== 0 ? k : new Date(a.at) - new Date(b.at);
}

function Sparkline({ points, labels, avg }) {
  const W = 600, H = 80, P = 8;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = points.length > 1 ? (W - 2 * P) / (points.length - 1) : 0;
  const y = (v) => H - P - ((v - min) / range) * (H - 2 * P);
  const pathD = points.map((v, i) => `${i === 0 ? "M" : "L"}${(P + i * stepX).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const areaD = pathD + ` L${(P + (points.length - 1) * stepX).toFixed(2)},${H - P} L${P},${H - P} Z`;
  const avgY = y(avg);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 80, display: "block" }}>
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#sparkFill)" />
      <line x1={P} x2={W - P} y1={avgY} y2={avgY} stroke="var(--ink-faint)" strokeDasharray="3 3" strokeWidth="1" opacity="0.5" />
      <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((v, i) => (
        <circle key={i} cx={P + i * stepX} cy={y(v)} r="3" fill="var(--bg-1)" stroke="var(--accent)" strokeWidth="2">
          <title>{labels[i]}: {fmt(v)}</title>
        </circle>
      ))}
    </svg>
  );
}

/* The whole row opens the saved result; delete sits apart with an Undo toast
   (in the app), so no confirm step is needed. */
function SnapRow({ snap, delta, onOpen, onDelete }) {
  const t = snap.totals || {};
  const reconciled = !!snap.reconcile;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4,
      background: "var(--bg-2)", border: "1px solid var(--line-soft)", borderRadius: 12,
    }}>
      <button onClick={onOpen} aria-label={`Open ${snap.period}`} style={{
        flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "8px 12px", flexWrap: "wrap",
        padding: "12px 6px 12px 14px", background: "transparent", border: "none", borderRadius: 12,
        color: "var(--ink)", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
      }}>
        {/* On a narrow phone the amount wraps under the period instead of
            squeezing it to one word per line. */}
        <div style={{ flex: "1 1 150px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{snap.period}</span>
            {reconciled && <span title="Checked against your pay slip" style={{
              fontSize: 11, padding: "1px 7px", borderRadius: 999, fontWeight: 500,
              background: "color-mix(in oklab, var(--ok) 18%, transparent)",
              color: "var(--ok)", border: "1px solid color-mix(in oklab, var(--ok) 40%, transparent)",
            }}>Pay slip ✓</span>}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>
            Saved {new Date(snap.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {snap.mode === "advanced" ? "Taxi varies" : snap.basicDistance === "L" ? "Long taxi" : "Short taxi"}
          </div>
        </div>
        <div style={{ textAlign: "right", marginLeft: "auto" }}>
          <div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{fmt(t.grand)}</div>
          {delta !== 0 && (
            <div className="mono" style={{ fontSize: 11, color: delta > 0 ? "var(--ok)" : "var(--holiday)", marginTop: 2 }}>
              {delta > 0 ? "▲" : "▼"} {fmt(Math.abs(delta))}
            </div>
          )}
        </div>
        <span aria-hidden style={{ color: "var(--ink-faint)", fontSize: 18, paddingLeft: 2 }}>›</span>
      </button>
      <button onClick={onDelete} style={{ ...iconBtn(), background: "transparent", border: "none", color: "var(--ink-faint)", marginRight: 4, flexShrink: 0 }} aria-label={`Delete ${snap.period}`} title="Delete">✕</button>
    </div>
  );
}

function EmptyState({ onBack }) {
  return (
    <div style={{
      padding: "32px 16px", textAlign: "center",
      border: "1px dashed var(--line)", borderRadius: 12,
      color: "var(--ink-dim)",
    }}>
      <svg aria-hidden width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
        <path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3.5 2"/>
      </svg>
      <div style={{ fontSize: 14, marginBottom: 6, color: "var(--ink)" }}>Nothing saved yet</div>
      <div style={{ fontSize: 12.5, color: "var(--ink-faint)", maxWidth: 320, margin: "0 auto 14px", lineHeight: 1.5 }}>
        Tap <strong>Save to History</strong> on Home or Shifts to keep this period's result. Then you can compare periods and check it against your pay slip.
      </div>
      <button onClick={onBack} style={primaryBtn()}>Go to my shifts</button>
    </div>
  );
}

function SnapshotDetail({ snap, theme, onClose, onReconcile }) {
  const { ref: dialogRef, closing, close } = useModalDismiss(onClose);
  const t = snap.totals || {};
  const copy = () => {
    const net = netApplies(t, snap.tax) ? estimateNet(t, snap.tax).net : null;
    copyText(summaryText(t, snap.period, net), "Summary copied");
  };
  const downloadPng = () => { downloadSnapshotImage(snap, theme); showToast("Image downloaded"); };
  const copyPng = async () => {
    try {
      await copySnapshotImage(snap, theme);
      showToast("Image copied");
    } catch {
      showToast("Couldn't copy image — try Download");
    }
  };
  const recon = snap.reconcile;
  // Same rule as the pay slip check: the typed total when there is one,
  // otherwise the sum of the lines that were filled in.
  const RECON_LINES = ["sp1", "sp2", "meal", "taxi", "monthlyBasic", "compulsory", "holidayPay", "overtimePay"];
  const reconLineSum = recon ? RECON_LINES.reduce((a, k) => a + (Number(recon[k]) || 0), 0) : 0;
  const reconHasGrand = !!recon && recon.grand != null && recon.grand !== "";
  const reconTotal = reconHasGrand ? Number(recon.grand) || 0 : reconLineSum;
  const reconHasTotal = reconHasGrand || reconLineSum !== 0;
  const reconVar = reconTotal - (Number(t.grand) || 0);
  return (
    <div onClick={close} className={"nsc-backdrop" + (closing ? " is-closing" : "")} style={{
      position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.55)",
      backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 12px 12px",
    }}>
      <div ref={dialogRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className={"nsc-modal nsc-sheet" + (closing ? " is-closing" : "")} style={{
        width: "100%", maxWidth: 540,
        background: "var(--bg-1)", border: "1px solid var(--line)",
        borderRadius: 18, padding: 18,
        marginBottom: `calc(96px + var(--safe-bottom))`,
        outline: "none",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div className="label">Saved result</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginTop: 2 }}>{snap.period}</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 2 }}>Saved {new Date(snap.at).toLocaleString()}</div>
          </div>
          <button onClick={close} style={iconBtn()} aria-label="Close">✕</button>
        </div>

        <Row label="Allowance" muted />
        <Row label="SP1" value={fmt(t.sp1)} />
        <Row label="SP2" value={fmt(t.sp2)} />
        <Row label="Meal" value={fmt(t.meal)} />
        <Row label="Taxi" value={fmt(t.taxi)} />
        <Sub label="Allowance subtotal" value={fmt(t.allowanceSubtotal)} />

        <Row label="Base Pay" muted top />
        <Row label="Monthly Basic" value={fmt(t.monthlyBasic)} />
        <Row label="Compulsory assignment" value={fmt(t.compulsory)} />
        <Sub label="Base Pay subtotal" value={fmt(t.baseSubtotal)} />

        <Row label="Extra Hours" muted top />
        <Row label="Total hours" value={fmtH(t.totalHours)} />
        <Row label="Holiday hours" value={fmtH(t.holidayHours)} />
        <Row label="Hourly rate" value={fmt(t.hourlyRate)} />
        <Row label="Holiday pay (×2)" value={fmt(t.holidayPay)} />
        <Row label="Overtime pay (×1.5)" value={fmt(t.overtimePay)} />
        <Sub label="Extra Hours subtotal" value={fmt(t.extraSubtotal)} />

        <DutySummary totals={t} style={{ marginTop: 14 }} />

        <div style={{
          marginTop: 14, padding: "16px",
          borderRadius: 12,
          background: "var(--ink)", color: "var(--bg)",
          display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "4px 12px", flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{totalLabel(t)}</span>
          <span className="mono" style={{ fontSize: 26, fontWeight: 700 }}>{fmt(t.grand)}</span>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={accentBtn()} onClick={() => onReconcile(snap)}>
            {recon ? "Edit pay slip check" : "Check against pay slip"}
          </button>
          <button style={ghostBtn()} onClick={downloadPng}>⤓ Download PNG</button>
          <button style={ghostBtn()} onClick={copyPng}>⎘ Copy image</button>
          <button style={ghostBtn()} onClick={copy}>⎘ Copy text</button>
        </div>

        {recon && (
          <div style={{
            marginTop: 14, padding: "12px 14px",
            background: "color-mix(in oklab, var(--ok) 8%, var(--bg-2))",
            border: "1px solid color-mix(in oklab, var(--ok) 30%, var(--line))",
            borderRadius: 12,
          }}>
            <div className="label" style={{ marginBottom: 6 }}>Pay slip check</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 13.5 }}>Pay slip total{!reconHasGrand && reconHasTotal ? " (sum of lines)" : ""}</span>
              <span className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{reconHasTotal ? fmt(reconTotal) : "—"}</span>
            </div>
            {reconHasTotal && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
                <span style={{ fontSize: 12, color: "var(--ink-dim)" }}>Variance vs estimate</span>
                <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: reconVar > -0.01 ? "var(--ok)" : "var(--holiday)" }}>
                  {Math.abs(reconVar) < 0.01 ? "✓ match" : `${reconVar > 0 ? "+" : ""}${fmt(reconVar)}`}
                </span>
              </div>
            )}
            {recon.notes && (
              <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-dim)", marginTop: 8, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                {recon.notes}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { SnapshotsView });
