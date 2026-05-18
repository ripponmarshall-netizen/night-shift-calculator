/* ytd.jsx — Year-to-date dashboard */
const { useMemo: useMemoYtd } = React;

function YTDDashboard({ snapshots }) {
  const year = new Date().getFullYear();
  const thisYear = snapshots.filter((s) => new Date(s.at).getFullYear() === year);

  const stats = useMemoYtd(() => {
    const total = thisYear.reduce((a, s) => a + s.totals.grand, 0);
    const hours = thisYear.reduce((a, s) => a + s.totals.totalHours, 0);
    const holHours = thisYear.reduce((a, s) => a + s.totals.holidayHours, 0);
    const otHours = thisYear.reduce((a, s) => a + s.totals.otHours, 0);
    const sumAllow = thisYear.reduce((a, s) => a + s.totals.allowanceSubtotal, 0);
    const sumBase = thisYear.reduce((a, s) => a + s.totals.baseSubtotal, 0);
    const sumExtra = thisYear.reduce((a, s) => a + s.totals.extraSubtotal, 0);
    const biggest = [...thisYear].sort((a, b) => b.totals.grand - a.totals.grand)[0];
    // monthly bucket by snapshot's pay period start month
    const monthly = Array(12).fill(0);
    for (const s of thisYear) {
      const m = s.periodKey ? fromYmd(s.periodKey).getMonth() : new Date(s.at).getMonth();
      monthly[m] += s.totals.grand;
    }
    return { total, hours, holHours, otHours, sumAllow, sumBase, sumExtra, biggest, monthly };
  }, [thisYear]);

  if (thisYear.length === 0) return null;

  const max = Math.max(1, ...stats.monthly);

  return (
    <Card>
      <SectionHead title={`${year} Year to date`} subtitle={`${thisYear.length} pay period${thisYear.length === 1 ? "" : "s"}`} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <KpiTile label="Earned YTD" value={fmt(stats.total)} accent="var(--accent)" />
        <KpiTile label="Hours worked" value={fmtH(stats.hours) + "h"} accent="var(--am)" />
        <KpiTile label="Holiday hours" value={fmtH(stats.holHours) + "h"} small />
        <KpiTile label="OT hours" value={fmtH(stats.otHours) + "h"} small />
      </div>

      {/* Composition bar */}
      <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Composition</div>
      <Composition allow={stats.sumAllow} base={stats.sumBase} extra={stats.sumExtra} total={stats.total} />

      {/* Monthly bars */}
      <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "16px 0 8px" }}>Monthly</div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(12, 1fr)",
        gap: 4,
        alignItems: "end",
        height: 120,
        padding: "4px 0",
      }}>
        {stats.monthly.map((v, i) => {
          const h = max > 0 ? (v / max) * 100 : 0;
          const active = v > 0;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%" }}>
              <div title={fmt(v)} style={{
                width: "100%",
                background: active ? "color-mix(in oklab, var(--accent) 65%, var(--bg-3))" : "var(--bg-2)",
                height: `${Math.max(2, h)}%`,
                borderRadius: 4,
                transition: "height 0.4s ease",
              }} />
              <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-faint)" }}>{monthName(i)[0]}</div>
            </div>
          );
        })}
      </div>

      {stats.biggest && (
        <div style={{
          marginTop: 14, padding: "10px 12px",
          background: "var(--bg-2)", borderRadius: 10,
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
        }}>
          <div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Biggest period</div>
            <div style={{ fontSize: 13.5, marginTop: 2 }}>{stats.biggest.period}</div>
          </div>
          <div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{fmt(stats.biggest.totals.grand)}</div>
        </div>
      )}
    </Card>
  );
}

function KpiTile({ label, value, accent, small }) {
  return (
    <div style={{
      padding: "12px 14px",
      background: "var(--bg-2)",
      border: "1px solid var(--line-soft)",
      borderRadius: 12,
    }}>
      <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
      <div className="mono" style={{ fontSize: small ? 16 : 22, fontWeight: 700, marginTop: 4, color: accent || "var(--ink)" }}>{value}</div>
    </div>
  );
}

function Composition({ allow, base, extra, total }) {
  if (total <= 0) total = 1;
  const a = (allow / total) * 100;
  const b = (base / total) * 100;
  const e = (extra / total) * 100;
  return (
    <div>
      <div style={{
        display: "flex", height: 14, borderRadius: 7, overflow: "hidden",
        background: "var(--bg-2)", border: "1px solid var(--line-soft)",
      }}>
        <div title={`Allowance ${fmt(allow)}`} style={{ width: `${a}%`, background: "var(--sp1)" }} />
        <div title={`Base ${fmt(base)}`} style={{ width: `${b}%`, background: "var(--am)" }} />
        <div title={`Extra ${fmt(extra)}`} style={{ width: `${e}%`, background: "var(--sp2)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, gap: 8, flexWrap: "wrap" }}>
        <CompKey color="var(--sp1)" label="Allowance" value={allow} pct={a} />
        <CompKey color="var(--am)" label="Base" value={base} pct={b} />
        <CompKey color="var(--sp2)" label="Extra" value={extra} pct={e} />
      </div>
    </div>
  );
}

function CompKey({ color, label, value, pct }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      <span className="mono" style={{ fontSize: 11, color: "var(--ink-dim)" }}>{label}</span>
      <span className="mono" style={{ fontSize: 11, color: "var(--ink)", fontWeight: 600 }}>{fmtShort(value)}</span>
      <span className="mono" style={{ fontSize: 10, color: "var(--ink-faint)" }}>({pct.toFixed(0)}%)</span>
    </div>
  );
}

Object.assign(window, { YTDDashboard });
