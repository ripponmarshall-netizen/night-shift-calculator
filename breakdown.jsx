/* breakdown.jsx — the shift breakdown: each shift type (how many, how many
   of them extra, the time and the allowances they earned), a bar of where
   the time went, and every shift on its own line with its times, hours,
   holiday time and allowances. It reads the shift log aggregate() keeps
   (totals.shifts), so it always adds up to the pay above it. Home, a watch
   member's page and a saved result show it; where the days can be edited,
   tapping a shift opens its day. */
const { useState: useStateB, useMemo: useMemoB } = React;

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const shiftMeta = (k) => SHIFTS.find((s) => s.k === k) || { k, label: k, color: "var(--ink-faint)" };

/* bare: no card of its own, for inside a sheet that already has one (a
   saved result). onOpenDay(date): tap a shift to edit its day. */
function ShiftBreakdown({ totals, onOpenDay, bare }) {
  const list = Array.isArray(totals?.shifts) ? totals.shifts : null;
  const b = useMemoB(() => shiftBreakdown(list || []), [list]);
  const [open, setOpen] = useStateB(false);
  const [filter, setFilter] = useStateB("all");
  if (!list || !list.length) return null;
  const rates = totals.rates;
  const dur = (n) => fmtDur(n, rates);
  const t = b.total;
  const regularN = t.n - t.extra;
  const regularH = Math.max(0, t.hours - t.extraHours - b.after.hours);

  // Filters for the shift list, only for what this period has.
  const filters = [
    { v: "all", l: `All ${list.length}`, keep: () => true },
    { v: "extra", l: `Extra ${t.extra}`, keep: (s) => s.extra, n: t.extra },
    { v: "holiday", l: "Holiday", keep: (s) => s.hol > 0 || s.afterHol > 0, n: list.filter((s) => s.hol > 0 || s.afterHol > 0).length },
    { v: "leave", l: "Leave & swaps", keep: (s) => s.given || isLeave(s.duty), n: t.leave + t.given },
  ].filter((f) => f.v === "all" || f.n > 0);
  const active = filters.find((f) => f.v === filter) || filters[0];
  const shown = list.filter(active.keep);

  const body = (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        <BdTile label="Regular" count={regularN} value={dur(regularH)} format={dur} hours={regularH} />
        <BdTile label="Extra" mark="var(--extra)" count={t.extra} value={dur(t.extraHours)} format={dur} hours={t.extraHours} />
        <BdTile label="Holiday" mark="var(--holiday)" dot value={t.hol > 0 ? dur(t.hol) : "None"} format={dur} hours={t.hol} note={t.hol > 0 ? "paid ×2" : null} />
      </div>

      <HoursBar rows={b.rows} after={b.after} dur={dur} />

      <div role="table" aria-label="Shifts by type" style={{ marginTop: 12 }}>
        <div role="row" className="nsc-bd-row nsc-bd-head">
          <span role="columnheader">Shift</span>
          <span role="columnheader" className="nsc-bd-num">Shifts</span>
          <span role="columnheader" className="nsc-bd-num">Time</span>
          <span role="columnheader" className="nsc-bd-num nsc-bd-money">Allowances</span>
        </div>
        {b.rows.map((r) => {
          const m = shiftMeta(r.k);
          const notes = [
            r.extra > 0 && <span key="x" style={{ color: "var(--extra)", fontWeight: 600 }}>{r.extra} extra · {dur(r.extraHours)}</span>,
            r.hol > 0 && `${dur(r.hol)} holiday`,
            r.leave > 0 && `${r.leave} on leave`,
            r.short > 0 && `${r.short} short`,
            r.given > 0 && `${r.given} swapped out`,
          ].filter(Boolean);
          return (
            <div key={r.k} role="row" className="nsc-bd-row">
              <span role="cell" className="nsc-bd-name">
                <span aria-hidden className="nsc-bd-swatch" style={{ background: m.color }} />
                {SHIFT_LABEL[r.k]}
              </span>
              <span role="cell" className="nsc-bd-num mono">
                {r.n}{r.extra > 0 && <span className="nsc-bd-plus" aria-label={`, ${r.extra} extra`}>+{r.extra}</span>}
              </span>
              <span role="cell" className="nsc-bd-num mono">{dur(r.hours)}</span>
              <span role="cell" className={"nsc-bd-num nsc-bd-money mono" + (r.allow > 0 ? "" : " is-none")}>{r.allow > 0 ? fmt(r.allow) : "—"}</span>
              {notes.length > 0 && (
                <span role="cell" className="nsc-bd-notes">
                  {notes.map((n, i) => <React.Fragment key={i}>{i > 0 && " · "}{n}</React.Fragment>)}
                </span>
              )}
            </div>
          );
        })}
        {b.after.days > 0 && (
          <div role="row" className="nsc-bd-row">
            <span role="cell" className="nsc-bd-name">
              <span aria-hidden className="nsc-bd-swatch is-hatched" style={{ "--c": "var(--sd)" }} />
              OT after SD
            </span>
            <span role="cell" className="nsc-bd-num mono">—</span>
            <span role="cell" className="nsc-bd-num mono">{dur(b.after.hours)}</span>
            <span role="cell" className="nsc-bd-num nsc-bd-money mono is-none">—</span>
            <span role="cell" className="nsc-bd-notes">
              After 4:30PM on {b.after.days} day{b.after.days === 1 ? "" : "s"}{b.after.hol > 0 ? ` · ${dur(b.after.hol)} holiday` : ""}
            </span>
          </div>
        )}
        <div role="row" className="nsc-bd-row nsc-bd-total">
          <span role="cell" className="nsc-bd-name">Total</span>
          <span role="cell" className="nsc-bd-num mono">
            {t.n}{t.extra > 0 && <span className="nsc-bd-plus" aria-label={`, ${t.extra} extra`}>+{t.extra}</span>}
          </span>
          <span role="cell" className="nsc-bd-num mono">{dur(t.hours)}</span>
          <span role="cell" className="nsc-bd-num nsc-bd-money mono">{fmt(t.allow)}</span>
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 8, lineHeight: 1.5 }}>
        <span style={{ color: "var(--extra)", fontWeight: 700 }}>+</span> extra (overtime) shifts, already in the time.
        {t.short > 0 && " Short: half its hours or less, so no allowance (the hours still count)."}
        {t.given > 0 && ` Swapped out on exchange leave: ${dur(t.givenHours)} not counted.`}
      </div>

      {/* Every shift, folded away so the card stays short. */}
      <div style={{ marginTop: 12, borderTop: "1px solid var(--line-soft)" }}>
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="nsc-fold-btn" style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 0 10px",
          background: "transparent", border: "none", color: "var(--ink)", cursor: "pointer",
          textAlign: "left", fontFamily: "inherit",
        }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>Every shift</span>
            <span style={{ display: "block", fontSize: 12, color: "var(--ink-faint)", marginTop: 1 }}>
              Times, hours and allowances{onOpenDay ? " · tap to change" : ""}
            </span>
          </span>
          <span className="mono" style={{ fontSize: 13, color: "var(--ink-dim)" }}>{list.length}</span>
          <FoldChevron open={open} />
        </button>
        <Collapse open={open}>
          {filters.length > 1 && (
            <div style={{ marginBottom: 10, overflowX: "auto" }}>
              <SegToggle small fit options={filters.map((f) => ({ v: f.v, l: f.l }))} value={active.v} onChange={setFilter} />
            </div>
          )}
          <ShiftList list={shown} totals={totals} dur={dur} onOpenDay={onOpenDay} />
        </Collapse>
      </div>
    </>
  );

  const head = (
    // Counted as the calendar and the pay card count them: shifts worked,
    // then leave on its own. The table's rows hold both (a leave shift's
    // hours count), and say how many were leave.
    <SectionHead title="Shift breakdown" subtitle={
      <>
        <span className="mono">{t.n - t.leave}</span> worked · <span className="mono">{dur(t.hours)}</span>
        {t.extra > 0 && <> · <span className="mono" style={{ color: "var(--extra)" }}>{t.extra} extra</span></>}
        {t.leave > 0 && <> · <span className="mono">{t.leave}</span> on leave</>}
      </>
    } />
  );
  if (bare) {
    return (
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line-soft)" }}>
        {head}
        {body}
      </div>
    );
  }
  return <Card>{head}{body}</Card>;
}

/* One figure above the table: a count and the time it came to. */
function BdTile({ label, mark, dot, count, value, note, hours, format }) {
  return (
    <div style={{ padding: "9px 10px", borderRadius: 12, background: "var(--bg-2)", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--ink-dim)" }}>
        {mark && <span aria-hidden style={{ width: dot ? 6 : 8, height: dot ? 6 : 8, borderRadius: dot ? "50%" : 2, background: mark, flexShrink: 0 }} />}
        {label}
      </div>
      <div className="mono" style={{ fontSize: 15, fontWeight: 700, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {hours > 0 ? <AnimatedNumber value={hours} format={format} from={0} durationMs={800} /> : value}
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {count != null ? `${count} shift${count === 1 ? "" : "s"}` : note || " "}
      </div>
    </div>
  );
}

/* Where the time went: one bar, a part per shift type in the table's
   colours and order (the table is its key). Parts are split by a 2px gap,
   reveal left to right and slide to a new share when the hours change. */
function HoursBar({ rows, after, dur }) {
  const parts = rows.filter((r) => r.hours > 0).map((r) => ({ k: r.k, h: r.hours, color: shiftMeta(r.k).color, label: SHIFT_LABEL[r.k] }));
  if (after.hours > 0) parts.push({ k: "after", h: after.hours, color: "var(--sd)", label: "OT after SD", hatched: true });
  if (!parts.length) return null;
  return (
    <div className="nsc-reveal-x" aria-hidden style={{ display: "flex", gap: parts.length > 1 ? 2 : 0, height: 8, borderRadius: 4, overflow: "hidden", marginTop: 12, animationDelay: "0.25s" }}>
      {parts.map((p) => (
        <div key={p.k} title={`${p.label} ${dur(p.h)}`} className={p.hatched ? "nsc-bd-hatch" : undefined} style={{
          "--c": p.color, flex: `${p.h} 1 0`, minWidth: 3, background: p.hatched ? undefined : p.color,
          transition: "flex-grow 0.7s var(--ease-snappy)",
        }} />
      ))}
    </div>
  );
}

/* Every shift on its own line, under a heading for each month (a pay
   period runs over two). */
function ShiftList({ list, totals, dur, onOpenDay }) {
  if (!list.length) return <div style={{ fontSize: 12.5, color: "var(--ink-faint)", padding: "6px 0 10px" }}>None this period.</div>;
  const out = [];
  let month = -1;
  list.forEach((s, i) => {
    const d = fromYmd(s.date);
    if (d.getMonth() !== month) {
      month = d.getMonth();
      out.push(<div key={"m" + s.date} className="label" style={{ margin: i ? "12px 0 6px" : "2px 0 6px" }}>{monthNameLong(month)}</div>);
    }
    out.push(
      <AnimatedRow key={s.date + s.k} index={i} gap={6}>
        <ShiftLine s={s} d={d} totals={totals} dur={dur} onOpen={onOpenDay && (() => onOpenDay(d))} />
      </AnimatedRow>
    );
  });
  return <div style={{ paddingBottom: 8 }}>{out}</div>;
}

/* One shift: its date, its chip as on the calendar, when it ran, what it
   counted for, its hours and what it earned. */
function ShiftLine({ s, d, totals, dur, onOpen }) {
  const m = shiftMeta(s.k);
  const duty = s.duty && DUTY_TYPES[s.duty];
  const allow = (s.sp1 || 0) + (s.sp2 || 0) + (s.meal || 0) + (s.taxi || 0);
  const hol = (s.hol || 0) + (s.afterHol || 0);
  const tags = [
    s.extra && { t: "Extra", c: "var(--extra)", strong: true },
    hol > 0 && { t: `Holiday ${dur(hol)} ×2`, c: "var(--holiday)" },
    duty && { t: s.given ? "Swapped out · not counted" : duty.pay === "hours" ? `${duty.label} · no allowance` : duty.label },
    s.short && { t: s.k === "pm3" || s.k === "pm10" ? "Half or less · no allowance" : "Short shift" },
    s.pair && { t: "No taxi · 3PM + 10PM" },
    s.dist === "L" && totals.mode === "advanced" && { t: "Long taxi" },
    Number(s.after) > 0 && { t: `+${dur(s.after)} after (${afterSpan(s)})` },
  ].filter(Boolean);
  const hours = s.given ? 0 : (s.hours || 0) + (Number(s.after) || 0);
  const label = `${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}, ${SHIFT_LABEL[s.k]} ${shiftSpan(s)}, `
    + `${s.given ? "not counted" : dur(hours)}${allow > 0 ? `, ${fmt(allow)} allowances` : ""}${tags.length ? ", " + tags.map((x) => x.t).join(", ") : ""}`;
  // A button reads as its label; a plain line reads as its own text.
  const Tag = onOpen ? "button" : "div";
  const hide = onOpen ? true : undefined;
  return (
    <Tag type={onOpen ? "button" : undefined} onClick={onOpen} aria-label={onOpen ? label : undefined} className={"nsc-bd-shift" + (onOpen ? " is-tappable" : "") + (s.given ? " is-given" : "")}>
      <span className="nsc-bd-date" aria-hidden={hide}>
        <span style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>{WEEKDAY[d.getDay()]}</span>
        <span className="mono" style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.1 }}>{d.getDate()}</span>
      </span>
      <span aria-hidden={hide} style={{ width: 44, flexShrink: 0 }}>
        <ShiftChip label={m.label} color={m.color} extra={!!s.extra} duty={s.duty || null} />
      </span>
      <span aria-hidden={hide} style={{ flex: 1, minWidth: 0 }}>
        <span className="mono" style={{ display: "block", fontSize: 12.5, color: "var(--ink)" }}>{shiftSpan(s)}</span>
        {tags.length > 0 && (
          <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-faint)", marginTop: 1, lineHeight: 1.4 }}>
            {tags.map((x, i) => (
              <React.Fragment key={i}>{i > 0 && " · "}<span style={x.c ? { color: x.c, fontWeight: x.strong ? 600 : 500 } : undefined}>{x.t}</span></React.Fragment>
            ))}
          </span>
        )}
      </span>
      <span aria-hidden={hide} style={{ textAlign: "right", flexShrink: 0 }}>
        <span className="mono" style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: s.given ? "var(--ink-faint)" : "var(--ink)" }}>{s.given ? "—" : dur(hours)}</span>
        {allow > 0 && <span className="mono" style={{ display: "block", fontSize: 11, color: "var(--ink-faint)", marginTop: 1 }}>{fmt(allow)}</span>}
      </span>
      {onOpen && <span aria-hidden={hide} style={{ color: "var(--ink-faint)", display: "inline-flex", flexShrink: 0 }}><ChevronIcon size={11} /></span>}
    </Tag>
  );
}

Object.assign(window, { ShiftBreakdown });
