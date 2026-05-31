/* calendar.jsx — calendar with hour stripes + warning highlights + autofill button */
const { useState: useStateCal } = React;

function Calendar({ period, entries, mode, onShift, onOpenDay, totals, highlight, setHighlight, onAutofill, onTemplates, defaultDist, setDefaultDist, clipboard, copyDay, pasteDay, cancelCopy }) {
  const days = periodDays(period);
  const leadBlanks = period.start.getDay();
  const headWeek = ["S","M","T","W","T","F","S"];
  const periodHolidays = holidaysInPeriod(period);

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 8px", flexWrap: "wrap", gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.12em", color: "var(--ink-faint)", textTransform: "uppercase" }}>Calendar</div>
          <div style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>
            {monthNameLong(period.start.getMonth())} {period.start.getDate()} → {monthNameLong(period.end.getMonth())} {period.end.getDate()}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onShift(-1)} style={iconBtn()} aria-label="Previous period">‹</button>
          <button onClick={() => onShift(1)} style={iconBtn()} aria-label="Next period">›</button>
        </div>
      </div>

      <div style={{ padding: "0 16px 10px", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <button onClick={onAutofill} style={{
          ...ghostBtn(),
          padding: "7px 11px", fontSize: 12,
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>
          </svg>
          Auto-fill
        </button>
        <button onClick={onTemplates} style={{
          ...ghostBtn(),
          padding: "7px 11px", fontSize: 12,
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/>
          </svg>
          Templates
        </button>
        {mode === "advanced" && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Default</span>
            <SegToggle small options={[{ v: "S", l: "Short" }, { v: "L", l: "Long" }]} value={defaultDist} onChange={setDefaultDist} />
          </div>
        )}
      </div>

      {clipboard && (
        <div style={{
          margin: "0 16px 10px", padding: "8px 12px",
          background: "color-mix(in oklab, var(--accent) 14%, transparent)",
          border: "1px solid color-mix(in oklab, var(--accent) 40%, transparent)",
          borderRadius: 10,
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <span className="mono" style={{ fontSize: 11.5, color: "var(--ink)", flex: 1 }}>
            Copy mode: tap empty days to paste
            <span style={{ color: "var(--ink-faint)" }}> ({[clipboard.entry.am7 && "7AM", clipboard.entry.pm3 && "3PM", clipboard.entry.pm10 && "10PM"].filter(Boolean).join(" + ")})</span>
          </span>
          <button onClick={cancelCopy} style={{ ...ghostBtn(), padding: "4px 10px", fontSize: 11 }}>Done</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, padding: "0 12px 4px" }}>
        {headWeek.map((d, i) => (
          <div key={i} className="mono" style={{ fontSize: 10, color: "var(--ink-faint)", textAlign: "center", padding: "6px 0" }}>{d}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, padding: "0 12px 14px" }}>
        {Array.from({ length: leadBlanks }).map((_, i) => <div key={"b" + i} />)}
        {days.map((d) => {
          const key = ymd(d);
          const e = entries[key];
          const isHol = e?.holiday === null || e?.holiday === undefined ? isJamaicaHoliday(d) : e.holiday;
          const has = !!e && (e.am7 || e.pm3 || e.pm10);
          const hours = totals.dayHours[key] || 0;
          const holidayHrs = totals.dayHolidayHours[key] || 0;
          const isHighlighted = highlight && highlight.has(key);
          const isClipboardSource = clipboard && clipboard.srcKey === key;
          const isPasteTarget = !!clipboard && !has;
          const dateStr = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
          const shiftList = [e?.am7 && "7AM", e?.pm3 && "3PM", e?.pm10 && "10PM"].filter(Boolean);
          const ariaLabel = has
            ? `${dateStr} — ${shiftList.join(", ")} shift${shiftList.length > 1 ? "s" : ""}, ${hours} hours${isHol ? ", holiday" : ""}`
            : `${dateStr}, no shifts${isHol ? ", holiday" : ""}`;
          return (
            <DayButton
              key={key}
              d={d}
              ariaLabel={ariaLabel}
              hasShifts={has}
              isClipboardActive={!!clipboard}
              onTap={() => {
                if (clipboard && !has) {
                  pasteDay(key);
                } else {
                  onOpenDay(d);
                }
              }}
              onLongPress={() => {
                if (has && !clipboard) copyDay(key);
              }}
              className={isHighlighted ? "pulse-day" : ""}
              style={{
                position: "relative",
                aspectRatio: "1 / 1.15",
                borderRadius: 10,
                border: `1px solid ${
                  isClipboardSource ? "var(--accent)"
                  : isPasteTarget ? "color-mix(in oklab, var(--accent) 50%, var(--line-soft))"
                  : isHighlighted ? "var(--warn)"
                  : has ? "var(--line)" : "var(--line-soft)"
                }`,
                background: isClipboardSource ? "color-mix(in oklab, var(--accent) 18%, transparent)"
                  : has ? "var(--bg-2)" : "transparent",
                color: "var(--ink)",
                padding: "5px 5px 4px",
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                justifyContent: "space-between",
                cursor: "pointer",
                transition: "background 0.12s, border-color 0.12s",
                overflow: "hidden",
                fontFamily: "inherit",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="mono" style={{ fontSize: 11, fontWeight: 500, opacity: 0.85 }}>{d.getDate()}</span>
                {isHol && <span title={holidayName(d) || "Holiday"} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--holiday)" }} />}
              </div>

              <div style={{ display: "flex", gap: 2, alignItems: "flex-end", flex: 1, marginTop: 4 }}>
                {e?.am7 && <ShiftBand color="var(--am)" hours={effHours(e, "am7")} dist={e.dist?.am7} mode={mode} />}
                {e?.pm3 && <ShiftBand color="var(--sp1)" hours={effHours(e, "pm3")} dist={e.dist?.pm3} mode={mode} />}
                {e?.pm10 && <ShiftBand color="var(--sp2)" hours={effHours(e, "pm10")} dist={e.dist?.pm10} mode={mode} />}
              </div>

              {has && (
                <div className="mono" style={{ fontSize: 9, color: "var(--ink-faint)", textAlign: "right", marginTop: 2 }}>
                  {hours}h{holidayHrs > 0 ? "*" : ""}
                </div>
              )}
            </DayButton>
          );
        })}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, padding: "10px 16px 14px", borderTop: "1px solid var(--line-soft)", alignItems: "center" }}>
        <Legend color="var(--am)" label="7AM (8h)" />
        <Legend color="var(--sp1)" label="3PM (7h)" />
        <Legend color="var(--sp2)" label="10PM (9h)" />
        <Legend color="var(--holiday)" label="Holiday" dot />
        <div style={{ flex: 1 }} />
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-dim)" }}>
          7AM {totals.cal.am7} · 3PM {totals.cal.pm3} · 10PM {totals.cal.pm10}
        </div>
      </div>

      {totals.holidayHours > 0 && (
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-faint)", padding: "0 16px 12px" }}>
          * day total includes holiday hours (paid ×2)
        </div>
      )}

      {periodHolidays.length > 0 && (
        <div style={{ padding: "10px 16px 14px", borderTop: "1px solid var(--line-soft)" }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
            Public holidays this period
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {periodHolidays.map((h) => (
              <span key={h.date.toISOString()} className="mono" style={{
                fontSize: 11,
                padding: "3px 8px",
                background: "color-mix(in oklab, var(--holiday) 14%, transparent)",
                border: "1px solid color-mix(in oklab, var(--holiday) 40%, transparent)",
                color: "var(--holiday)",
                borderRadius: 999,
              }}>
                {monthName(h.date.getMonth())} {h.date.getDate()} · {h.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .pulse-day { animation: pulseDay 1.4s ease-out 2; }
        @keyframes pulseDay {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--warn) 0%, transparent); }
          50% { box-shadow: 0 0 0 6px color-mix(in oklab, var(--warn) 30%, transparent); }
        }
        @media (prefers-reduced-motion: reduce) {
          .pulse-day { animation: none; }
        }
      `}</style>
    </Card>
  );
}

function DayButton({ d, ariaLabel, onTap, onLongPress, hasShifts, isClipboardActive, children, style, className }) {
  const timerRef = React.useRef(null);
  const movedRef = React.useRef(false);
  const longPressedRef = React.useRef(false);
  const startPosRef = React.useRef(null);

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };
  const start = (e) => {
    movedRef.current = false;
    longPressedRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    if (hasShifts && !isClipboardActive) {
      timerRef.current = setTimeout(() => {
        if (!movedRef.current) {
          longPressedRef.current = true;
          if (navigator.vibrate) navigator.vibrate(20);
          onLongPress?.();
        }
      }, 450);
    }
  };
  const move = (e) => {
    if (!startPosRef.current) return;
    const dx = Math.abs(e.clientX - startPosRef.current.x);
    const dy = Math.abs(e.clientY - startPosRef.current.y);
    if (dx > 8 || dy > 8) {
      movedRef.current = true;
      clearTimer();
    }
  };
  // Tap is handled on `click` so the cell is operable by mouse, touch, keyboard
  // (Enter/Space on the native button) and assistive tech alike. Pointer
  // handlers only detect a long-press (copy) and drag/scroll, then swallow the
  // trailing pointer-driven click so those gestures don't also open the editor.
  const onClick = () => {
    clearTimer();
    if (longPressedRef.current) { longPressedRef.current = false; return; }
    if (movedRef.current) { movedRef.current = false; return; }
    onTap?.();
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={className}
      style={style}
      onPointerDown={start}
      onPointerMove={move}
      onPointerCancel={clearTimer}
      onPointerLeave={clearTimer}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ShiftBand({ color, hours, dist, mode }) {
  const pct = Math.min(100, (hours / 9) * 100);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", minWidth: 0 }}>
      <div style={{
        height: `${pct}%`,
        background: color,
        borderRadius: 2,
        minHeight: 6,
        opacity: 0.85,
        position: "relative",
      }}>
        {mode === "advanced" && dist === "L" && (
          <span style={{
            position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
            background: `repeating-linear-gradient(45deg, transparent 0 3px, rgba(0,0,0,0.25) 3px 4px)`,
            borderRadius: 2,
          }} />
        )}
      </div>
    </div>
  );
}

function Legend({ color, label, dot }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={dot
        ? { width: 8, height: 8, borderRadius: "50%", background: color }
        : { width: 14, height: 4, borderRadius: 2, background: color }} />
      <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-dim)" }}>{label}</span>
    </div>
  );
}

Object.assign(window, { Calendar });
