/* calendar.jsx — period calendar with labelled shift chips, rotation off days / extras, warning highlights */

/* compact: the Watch screens' version — just the grid and legend; tap a day
   to edit it. The full version is Home's "Your shifts" card: it folds shut
   to one line (open / onToggle) and adds Auto-fill, Templates, Setup,
   long-press copy and the period's rotation and holidays. */
function Calendar({ period, entries, mode, onOpenDay, totals, highlight, onAutofill, onTemplates, onSetup, clipboard, copyDay, pasteDay, cancelCopy, rotationAnchor, onClearRotation, compact, open = true, onToggle }) {
  // Counts each time the calendar opens (not when it shuts), so the days
  // cascade in again as it opens but stay in place while it folds away.
  const [opens, setOpens] = React.useState(0);
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOpens(opens + 1);
  }
  const days = periodDays(period);
  const leadBlanks = period.start.getDay();
  const headWeek = ["S","M","T","W","T","F","S"];
  const periodHolidays = holidaysInPeriod(period);
  const stats = rotationStats(entries, period, rotationAnchor);
  const shiftCount = totals.cal.am7 + totals.cal.pm3 + totals.cal.pm10 + (totals.cal.sd || 0);
  const todayKey = ymd(new Date());
  // Legend entries only for what this period actually shows.
  const anyHoliday = days.some((d) => { const e = entries[ymd(d)]; return e?.holiday == null ? isJamaicaHoliday(d) : e.holiday; });
  const leaveCount = totals.leaveShifts || 0;
  const orderlyCount = totals.duties?.orderly || 0;
  const exchForCount = totals.duties?.exchangeFor || 0;
  const exchLeaveCount = totals.exchangedShifts || 0;
  const anyStraightDay = days.some((d) => entries[ymd(d)]?.sd);

  const grid = (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, padding: compact ? "0 0 4px" : "0 12px 4px" }}>
        {headWeek.map((d, i) => (
          <div key={i} style={{ fontSize: 11, fontWeight: 500, color: "var(--ink-faint)", textAlign: "center", padding: "6px 0" }}>{d}</div>
        ))}
      </div>

      <div className="nsc-cascade" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, padding: compact ? "0 0 12px" : "0 12px 14px" }}>
        {Array.from({ length: leadBlanks }).map((_, i) => <div key={"b" + i} />)}
        {days.map((d, di) => {
          const key = ymd(d);
          const e = entries[key];
          const isHol = e?.holiday == null ? isJamaicaHoliday(d) : e.holiday;
          const has = hasShifts(e);
          const slot = rotationSlot(key, rotationAnchor);
          const extras = extraShiftKeys(e, slot);
          const isOff = slot === "off" && !has;
          const hours = totals.dayHours[key] || 0;
          const holidayHrs = totals.dayHolidayHours[key] || 0;
          // Hours differ from the standard ones (a short shift, a shift
          // given away, or overtime after a Straight Day): show the day's
          // real total under the chips.
          const sdOt = sdOtHours(e);
          const partial = has && (sdOt > 0 || SHIFTS.some((s) => e[s.k] && (!worksShift(e, s.k) || effHours(e, s.k) !== stdHours(s.k))));
          const isHighlighted = highlight && highlight.has(key);
          const canCopy = !compact && !!copyDay;
          const isClipboardSource = canCopy && clipboard && clipboard.srcKey === key;
          const isPasteTarget = canCopy && !!clipboard && !has;
          const isToday = key === todayKey;
          const dateStr = (isToday ? "Today, " : "") + d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
          const shiftList = SHIFTS.filter((s) => e?.[s.k]).map((s) => {
            const duty = shiftDuty(e, s.k);
            return (extras.includes(s.k) ? "overtime " : "") + SHIFT_LABEL[s.k] + (duty ? ` (${DUTY_TYPES[duty].label})` : "")
              + (s.k === "sd" && sdOt > 0 ? ` with ${fmtHM(sdOt)} overtime after` : "");
          });
          const ariaLabel = has
            ? `${dateStr}: ${shiftList.join(", ")}, ${inMinutes(totals.rates) ? fmtHM(hours) : `${fmtH0(hours)} hours`}${isHol ? ", holiday" : ""}`
            : `${dateStr}: ${isOff ? "off day" : "no shifts"}${isHol ? ", holiday" : ""}`;
          return (
            <DayButton
              key={key}
              ariaLabel={ariaLabel}
              hasShifts={has}
              isClipboardActive={canCopy && !!clipboard}
              onTap={() => {
                if (isPasteTarget) pasteDay(key);
                else onOpenDay(d);
              }}
              onLongPress={() => { if (canCopy && has && !clipboard) copyDay(key); }}
              className={"nsc-day" + (isHighlighted ? " pulse-day" : "")}
              style={{
                "--i": leadBlanks + di,
                position: "relative",
                minHeight: 54,
                borderRadius: 11,
                border: `1px solid ${
                  isClipboardSource ? "var(--accent)"
                  : isPasteTarget ? "color-mix(in oklab, var(--accent) 50%, var(--line-soft))"
                  : isHighlighted ? "var(--warn)"
                  : has ? "var(--line)" : "var(--line-soft)"
                }`,
                background: isClipboardSource ? "color-mix(in oklab, var(--accent) 18%, transparent)"
                  : has ? "var(--bg-2)" : "transparent",
                color: "var(--ink)",
                padding: "4px 3px 4px",
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                gap: 3,
                cursor: "pointer",
                transition: "background 0.2s, border-color 0.2s, var(--press)",
                overflow: "hidden",
                fontFamily: "inherit",
                WebkitTouchCallout: "none",
                WebkitUserSelect: "none",
                userSelect: "none",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 2px" }}>
                <TodayDate date={d} today={isToday} />
                {isHol && <span title={holidayName(d) || "Holiday"} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--holiday)" }} />}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, justifyContent: "center" }}>
                {SHIFTS.filter((s) => e?.[s.k]).map((s) => (
                  <ShiftChip key={s.k} label={s.label} color={s.color} extra={extras.includes(s.k)} duty={shiftDuty(e, s.k)} long={mode === "advanced" && e.dist?.[s.k] === "L"} />
                ))}
                {isOff && <span style={{ fontSize: 10.5, color: "var(--ink-faint)", textAlign: "center" }}>Off</span>}
              </div>
              {(partial || holidayHrs > 0) && (
                <div className="mono" style={{ fontSize: 9, color: "var(--ink-faint)", textAlign: "right", paddingRight: 2, whiteSpace: "nowrap" }}>
                  {/* Compact (13h40) so a cell never wraps it on a narrow phone. */}
                  {inMinutes(totals.rates) ? fmtHMc(hours) : `${fmtH0(hours)}h`}{holidayHrs > 0 ? "*" : ""}
                </div>
              )}
            </DayButton>
          );
        })}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 14px", padding: compact ? "10px 0 0" : "10px 16px 14px", borderTop: "1px solid var(--line-soft)", alignItems: "center" }}>
        <Legend color="var(--am)" label="7AM" />
        <Legend color="var(--sp1)" label="3PM" />
        <Legend color="var(--sp2)" label="10PM" />
        {anyStraightDay && <Legend color="var(--sd)" label="Straight Day (SD)" />}
        {stats.extra > 0 && <Legend color="var(--extra)" label="Extra" />}
        {anyHoliday && <Legend color="var(--holiday)" label="Holiday" dot />}
        {leaveCount > 0 && <Legend outline label="Leave" />}
        {orderlyCount > 0 && <Legend code="ORD" label="Orderly" />}
        {exchForCount > 0 && <Legend code="EXF" label="Exchange for" />}
        {exchLeaveCount > 0 && <Legend dotted label="Exchange leave" />}
        {/* The counts are in the card's header (and Home's pay card). */}
        {!compact && shiftCount > 0 && <div style={{ fontSize: 12, color: "var(--ink-faint)", marginLeft: "auto" }}>Hold a day to copy it</div>}
      </div>

      {(totals.holidayHours > 0 || anyStraightDay || leaveCount > 0 || exchForCount > 0 || exchLeaveCount > 0) && (
        <div style={{ fontSize: 11.5, color: "var(--ink-faint)", padding: compact ? "6px 0 0" : "0 16px 12px", lineHeight: 1.5 }}>
          {totals.holidayHours > 0 && <div>* includes holiday hours (paid ×2)</div>}
          {anyStraightDay && <div>SD Straight Day: 8:30AM to 4:30PM, hours only (no SP1, SP2, meal or taxi). Overtime after it counts in the day's hours.</div>}
          {leaveCount > 0 && <div>Leave (VL vacation · DL departmental · SL sick · TO time off): hours count, no allowances.</div>}
          {exchForCount > 0 && <div>EXF exchange for: covering someone's shift, paid as normal.</div>}
          {exchLeaveCount > 0 && <div>EXL exchange leave: someone covers your shift, no hours or allowances.</div>}
        </div>
      )}
    </>
  );

  if (compact) return grid;

  const tool = { ...ghostBtn(), padding: "8px 6px", fontSize: 12.5, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, whiteSpace: "nowrap", minWidth: 0 };
  const extra = stats.extra;
  return (
    // Scrolled to from "Show me the calendar": lands below the sticky header.
    <Card id="calendar-section" style={{ padding: 0, overflow: "hidden", scrollMarginTop: "calc(var(--safe-top) + 80px)" }}>
      <button onClick={onToggle} aria-expanded={open} className="nsc-fold-btn" style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "16px 16px 12px",
        background: "transparent", border: "none", color: "var(--ink)", cursor: "pointer",
        textAlign: "left", fontFamily: "inherit",
      }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>Your shifts</span>
          {/* What the grid holds, so a folded calendar still says it. */}
          <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-faint)", marginTop: 2 }}>
            {shiftCount > 0 ? <>
              <span className="mono">{shiftCount}</span> shift{shiftCount === 1 ? "" : "s"} · <span className="mono">{fmtDur(totals.totalHours, totals.rates)}</span>
              {extra > 0 && <> · <span className="mono" style={{ color: "var(--extra)" }}>{extra} extra</span></>}
              {leaveCount > 0 && <> · <span className="mono">{leaveCount}</span> leave</>}
            </> : open ? "Tap a day to add a shift" : "No shifts logged yet"}
          </span>
        </span>
        <FoldChevron open={open} size={13} />
      </button>

      <Collapse open={open}>
      <div style={{ padding: "0 16px 12px", display: "grid", gridTemplateColumns: onSetup ? "repeat(3, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        <button onClick={onAutofill} style={tool}>
          <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>
          </svg>
          Auto-fill
        </button>
        <button onClick={onTemplates} style={tool}>
          <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/>
          </svg>
          Templates
        </button>
        {onSetup && (
          <button onClick={onSetup} style={tool}>
            <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>
            </svg>
            Setup
          </button>
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
          <span style={{ fontSize: 13, color: "var(--ink)", flex: 1 }}>
            Copied. Tap empty days to paste
            <span style={{ color: "var(--ink-faint)" }}> ({SHIFTS.filter((s) => clipboard.entry[s.k]).map((s) => s.label).join(" + ")})</span>
          </span>
          <button onClick={cancelCopy} style={{ ...ghostBtn(), padding: "4px 10px", fontSize: 12 }}>Done</button>
        </div>
      )}

      {/* Keyed by the openings, so the days cascade in again each time the
          calendar opens instead of appearing all at once. */}
      <div key={opens}>{grid}</div>

      {rotationAnchor && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px 12px", borderTop: "1px solid var(--line-soft)", fontSize: 12.5, color: "var(--ink-dim)" }}>
          <span style={{ flex: 1 }}>Rotation saved: 7AM → 3PM → 10PM → Off. Shifts outside it show as <span style={{ color: "var(--extra)", fontWeight: 600 }}>extra</span> (overtime) unless you switch that off in the day.</span>
          <button onClick={onClearRotation} style={{ ...linkBtn(), whiteSpace: "nowrap" }}>Stop</button>
        </div>
      )}

      {periodHolidays.length > 0 && (
        <div style={{ padding: "10px 16px 14px", borderTop: "1px solid var(--line-soft)" }}>
          <div className="label" style={{ marginBottom: 8 }}>Public holidays this period</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {periodHolidays.map((h) => (
              <span key={h.date.toISOString()} style={{
                fontSize: 12,
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
      </Collapse>
    </Card>
  );
}

/* One shift on a calendar day: a labelled chip, so colour is never the only
   cue. Extra (overtime) shifts use the extra colour and a "+".
   Leave shows as a dashed outline with its code (VL, DL, SL, TO), since it
   earns no allowance; exchange leave (EXL) as a faint dotted outline, since
   it isn't worked at all. Orderly (ORD) and exchange for (EXF) are worked
   shifts: solid chips with their code. */
function ShiftChip({ label, color, extra, long, duty }) {
  const bg = extra ? "var(--extra)" : color;
  const pay = duty ? DUTY_TYPES[duty].pay : "full";
  const outline = pay !== "full";
  const text = duty ? DUTY_TYPES[duty].code : (extra ? "+" : "") + label;
  // "+10PM" is a character wider than any other chip, so it gets a touch
  // smaller and tighter, or it clips to "+10P" on phones under ~360px.
  const wide = text.length > 4;
  return (
    <span className="mono nsc-chip-in" style={{
      position: "relative", display: "block", textAlign: "center",
      // Shrinks a little on 320px phones so "10PM" fits a seventh of the width.
      fontSize: wide ? "clamp(8px, 2.5vw, 10.5px)" : "clamp(9px, 2.9vw, 10.5px)",
      fontWeight: 700, lineHeight: outline ? "14px" : "16px", letterSpacing: wide ? "-0.06em" : "-0.03em",
      borderRadius: 4,
      background: pay === "hours" ? `color-mix(in oklab, ${bg} 16%, transparent)` : pay === "none" ? "transparent" : bg,
      border: pay === "hours" ? `1px dashed ${bg}` : pay === "none" ? "1px dotted var(--ink-faint)" : "none",
      color: pay === "hours" ? "var(--ink)" : pay === "none" ? "var(--ink-faint)" : "var(--chip-ink)",
      overflow: "hidden", whiteSpace: "nowrap",
    }}>
      {long && !outline && <span aria-hidden style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(45deg, transparent 0 3px, rgba(0,0,0,0.22) 3px 4.5px)" }} />}
      <span style={{ position: "relative" }}>{text}</span>
    </span>
  );
}

/* The day number; today's gets an accent pill so "where am I in the period"
   is answered at a glance. */
function TodayDate({ date, today, size = 11 }) {
  return (
    <span className="mono" style={today ? {
      fontSize: size, fontWeight: 700, lineHeight: 1.3, padding: "0 5px", borderRadius: 999,
      background: "var(--accent)", color: "var(--accent-ink)", alignSelf: "flex-start",
    } : { fontSize: size, fontWeight: 500, opacity: 0.85 }}>{date.getDate()}</span>
  );
}

function DayButton({ ariaLabel, onTap, onLongPress, hasShifts, isClipboardActive, children, style, className }) {
  const timerRef = React.useRef(null);
  const movedRef = React.useRef(false);
  const longPressedRef = React.useRef(false);
  const startPosRef = React.useRef(null);

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };
  const start = (e) => {
    if (e.button !== 0) return; // right-click / pen barrel: not a press
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
  // A mouse hovering after the press isn't a drag; only track while pressed,
  // or a later keyboard Enter on this day would be swallowed as a scroll.
  const end = () => { startPosRef.current = null; };
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
      onPointerUp={end}
      onPointerCancel={() => { clearTimer(); end(); }}
      onPointerLeave={() => { clearTimer(); end(); }}
      // A held finger also opens the phone's context menu / text callout,
      // which covers the calendar just as the day is copied.
      onContextMenu={(e) => { if (timerRef.current || longPressedRef.current) e.preventDefault(); }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Legend({ color, label, dot, outline, dotted, code }) {
  const mark = dot
    ? { width: 8, height: 8, borderRadius: "50%", background: color }
    : outline || dotted
      ? { width: 14, height: 8, borderRadius: 2, border: `1px ${dotted ? "dotted" : "dashed"} var(--ink-dim)` }
      : { width: 14, height: 4, borderRadius: 2, background: color };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {code
        ? <span className="mono" style={{ fontSize: 9.5, fontWeight: 700, padding: "0 4px", borderRadius: 3, background: "var(--ink-dim)", color: "var(--bg)" }}>{code}</span>
        : <span style={mark} />}
      <span style={{ fontSize: 12, color: "var(--ink-dim)" }}>{label}</span>
    </div>
  );
}

Object.assign(window, { Calendar, ShiftChip, TodayDate });
