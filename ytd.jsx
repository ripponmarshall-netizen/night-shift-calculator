/* ytd.jsx — Year-to-date dashboard */
const { useState: useStateY } = React;

function YTDDashboard({ snapshots }) {
  const year = new Date().getFullYear();
  // Attribute each snapshot to its pay period's year (consistent with the
  // monthly buckets below), falling back to capture date for legacy snapshots
  // saved before periodKey existed.
  const periodYear = (s) => (s.periodKey ? fromYmd(s.periodKey).getFullYear() : new Date(s.at).getFullYear());
  const thisYear = snapshots.filter((s) => periodYear(s) === year);

  const stats = (() => {
    // Legacy/imported snapshots may omit newer totals fields; coerce so a single
    // missing value can't turn an entire reduce (and the whole dashboard) into NaN.
    const f = (s, k) => Number(s.totals?.[k]) || 0;
    const total = thisYear.reduce((a, s) => a + f(s, "grand"), 0);
    const hours = thisYear.reduce((a, s) => a + f(s, "totalHours"), 0);
    const holHours = thisYear.reduce((a, s) => a + f(s, "holidayHours"), 0);
    const otHours = thisYear.reduce((a, s) => a + f(s, "otHours"), 0);
    const sumAllow = thisYear.reduce((a, s) => a + f(s, "allowanceSubtotal"), 0);
    const sumBase = thisYear.reduce((a, s) => a + f(s, "baseSubtotal"), 0);
    const sumExtra = thisYear.reduce((a, s) => a + f(s, "extraSubtotal"), 0);
    const biggest = [...thisYear].sort((a, b) => f(b, "grand") - f(a, "grand"))[0];
    // monthly bucket by snapshot's pay period start month
    const monthly = Array(12).fill(0);
    for (const s of thisYear) {
      const m = s.periodKey ? fromYmd(s.periodKey).getMonth() : new Date(s.at).getMonth();
      monthly[m] += f(s, "grand");
    }
    return { total, hours, holHours, otHours, sumAllow, sumBase, sumExtra, biggest, monthly };
  })();

  if (thisYear.length === 0) return null;

  // Totals count up from zero when History opens.
  const count = (v, format) => <AnimatedNumber value={v} format={format} from={0} durationMs={900} />;

  return (
    <Card>
      <SectionHead title={`${year} Year to date`} subtitle={`${thisYear.length} pay period${thisYear.length === 1 ? "" : "s"}`} />

      {/* Earned YTD gets its own row: a six-figure amount beside another tile
          overflows the card on a 320px phone. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 16 }}>
        <KpiTile label="Earned YTD" value={count(stats.total, fmt)} wide
          sub={thisYear.length > 1 ? `avg ${fmt(stats.total / thisYear.length)} per period` : null} />
        <KpiTile label="Hours worked" value={count(stats.hours, hrs1)} small />
        <KpiTile label="Holiday hours" value={count(stats.holHours, hrs1)} small />
        <KpiTile label="OT hours" value={count(stats.otHours, hrs1)} small />
      </div>

      <div className="label" style={{ marginBottom: 8 }}>By month</div>
      <MonthlyBars monthly={stats.monthly} />

      <div className="label" style={{ margin: "18px 0 8px" }}>Where it came from</div>
      <Composition allow={stats.sumAllow} base={stats.sumBase} extra={stats.sumExtra} total={stats.total} />

      {/* With one period, "biggest" just repeats Earned YTD. */}
      {thisYear.length > 1 && stats.biggest && (
        <div style={{
          marginTop: 16, padding: "10px 12px",
          background: "var(--bg-2)", borderRadius: 10,
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
        }}>
          <div>
            <div className="label">Biggest period</div>
            <div style={{ fontSize: 13.5, marginTop: 2 }}>{stats.biggest.period}</div>
          </div>
          <div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{fmt(Number(stats.biggest.totals?.grand) || 0)}</div>
        </div>
      )}
    </Card>
  );
}

/* Year totals to one decimal ("25.7h"), short enough for a third-width tile. */
const hrs1 = (n) => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString("en-JM", { maximumFractionDigits: 1 }) + "h";

function KpiTile({ label, value, sub, small, wide }) {
  return (
    <div style={{
      padding: small ? "10px 10px" : "12px 14px",
      background: "var(--bg-2)",
      border: "1px solid var(--line-soft)",
      borderRadius: 12,
      minWidth: 0,
      gridColumn: wide ? "1 / -1" : undefined,
    }}>
      <div className="label">{label}</div>
      <div className="mono" style={{ fontSize: small ? 15 : 26, fontWeight: 700, marginTop: 4, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      {sub && <div className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

/* One column per month on a shared baseline. The latest month with a saved
   period is full accent and the rest a step back, only the peak carries a
   printed value, and hover, tap or arrow keys read out any month. */
function MonthlyBars({ monthly }) {
  const max = Math.max(0, ...monthly);
  const peak = max > 0 ? monthly.indexOf(max) : -1;
  const latest = monthly.reduce((a, v, i) => (v > 0 ? i : a), -1);
  const thisMonth = new Date().getMonth();
  const [cur, setCur, cursorProps] = useChartCursor(12, (i) => monthly[i] > 0);
  return (
    <div {...cursorProps} className="nsc-col" role="group"
      aria-label="Totals by month. Use the arrow keys to read each month."
      style={{ position: "relative", paddingTop: 18, touchAction: "pan-y" }}>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 2,
        height: 96, alignItems: "end", borderBottom: "1px solid var(--line)",
      }}>
        {monthly.map((v, i) => {
          const h = max > 0 ? (v / max) * 100 : 0;
          const on = cur === i;
          return (
            // The whole column is the hit target, not just the painted bar.
            <div key={i} onPointerEnter={() => setCur(i)} onPointerDown={() => setCur(i)}
              style={{ position: "relative", height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
              {i === peak && cur == null && (
                <span className="mono" style={{
                  position: "absolute", bottom: `calc(${h}% + 3px)`, left: "50%", transform: "translateX(-50%)",
                  fontSize: 10, color: "var(--ink-dim)", whiteSpace: "nowrap",
                }}>{fmtShort(v)}</span>
              )}
              {v > 0 && (
                <div className="nsc-grow-y" style={{
                  width: "70%", maxWidth: 24, height: `${h}%`, minHeight: 2,
                  borderRadius: "4px 4px 0 0",
                  background: i === latest ? "var(--accent)" : "color-mix(in oklab, var(--accent) 45%, var(--bg-3))",
                  filter: on ? "brightness(1.18)" : "none",
                  animationDelay: `${120 + i * 35}ms`,
                  transition: "height 0.4s cubic-bezier(0.22, 1, 0.36, 1), filter 0.15s ease",
                }} />
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 2, marginTop: 5 }}>
        {monthly.map((_, i) => (
          <div key={i} className="mono" style={{
            textAlign: "center", fontSize: 9.5,
            color: i === thisMonth ? "var(--ink)" : "var(--ink-faint)", fontWeight: i === thisMonth ? 700 : 400,
          }}>{monthName(i)[0]}</div>
        ))}
      </div>
      {cur != null && monthly[cur] > 0 && (
        <ChartTip xPct={((cur + 0.5) / 12) * 100} value={fmt(monthly[cur])}
          label={`${monthNameLong(cur)}${cur === peak ? " · best month" : ""}`} />
      )}
    </div>
  );
}

/* The year's pay split into its parts (the same bar Home and Shifts show
   under their totals). Pointing at a part or its key spotlights it. */
function Composition({ allow, base, extra, total }) {
  const [focus, setFocus] = useStateY(null);
  if (total <= 0) total = 1;
  const sums = { allowanceSubtotal: allow, baseSubtotal: base, extraSubtotal: extra };
  const dim = (k) => (focus && focus !== k ? 0.3 : 1);
  return (
    <div onPointerLeave={() => setFocus(null)}>
      <SplitBar totals={sums} focus={focus} onFocusPart={setFocus} height={12} delay={0.45} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, gap: 8, flexWrap: "wrap" }}>
        {PAY_PARTS.map((p) => (
          <CompKey key={p.key} color={p.color} label={p.label} value={sums[p.field]} pct={(sums[p.field] / total) * 100}
            opacity={dim(p.key)} onEnter={() => setFocus(p.key)} />
        ))}
      </div>
    </div>
  );
}

function CompKey({ color, label, value, pct, opacity, onEnter }) {
  return (
    <div onPointerEnter={onEnter} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, opacity, transition: "opacity 0.15s ease" }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      <span className="mono" style={{ fontSize: 11, color: "var(--ink-dim)" }}>{label}</span>
      <span className="mono" style={{ fontSize: 11, color: "var(--ink)", fontWeight: 600 }}>{fmtShort(value)}</span>
      <span className="mono" style={{ fontSize: 10, color: "var(--ink-faint)" }}>({pct.toFixed(0)}%)</span>
    </div>
  );
}

Object.assign(window, { YTDDashboard });
