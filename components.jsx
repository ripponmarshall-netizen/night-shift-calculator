/* components.jsx — shared primitives, buttons, icons */
const { useState: useStateC, useEffect: useEffectC, useRef: useRefC } = React;

function Card({ children, style, id }) {
  return (
    <section id={id} style={{
      background: "var(--bg-1)",
      border: "1px solid var(--line-soft)",
      borderRadius: 16,
      padding: 18,
      marginBottom: 14,
      ...style,
    }}>{children}</section>
  );
}

function SectionHead({ title, subtitle, right }) {
  return (
    <div style={{ marginBottom: 12, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.005em" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12.5, color: "var(--ink-faint)", marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

function Row({ label, value, muted, faint, top, onClick, formula }) {
  if (muted) return <div className="label" style={{ marginTop: top ? 14 : 6, marginBottom: 4 }}>{label}</div>;
  // A row with math behind it is a real button, so it works by keyboard too.
  const interactive = !!formula;
  const Tag = interactive ? "button" : "div";
  return (
    <Tag
      type={interactive ? "button" : undefined}
      onClick={interactive ? onClick : undefined}
      title={interactive ? "Tap to see calculation" : undefined}
      style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8,
        width: "100%", padding: "6px 0", margin: 0,
        background: "transparent", border: "none", borderBottom: "1px dashed var(--line-soft)",
        color: "inherit", font: "inherit", textAlign: "left",
        cursor: interactive ? "pointer" : "default",
      }}
    >
      <span style={{ fontSize: 13.5, color: faint ? "var(--ink-faint)" : "var(--ink-dim)", display: "flex", alignItems: "center", gap: 6 }}>
        {label}
        {interactive && <span style={{ fontSize: 10, color: "var(--ink-faint)", opacity: 0.7 }}>ƒ</span>}
      </span>
      <span className="mono" style={{ fontSize: 13.5, color: faint ? "var(--ink-faint)" : "var(--ink)" }}>{value}</span>
    </Tag>
  );
}

function Sub({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 12px", marginTop: 6, borderRadius: 8, background: "var(--bg-2)" }}>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
      <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

/* wrap: lay options out as a wrapping row, so a long set never hides
   options off-screen on a narrow phone. fit: one row whose options size to
   their labels, wrapping into even rows when they don't fit (Settings tabs).
   The active pill slides between options. */
function SegToggle({ options, value, onChange, small, full, wrap, fit }) {
  const rootRef = useRefC(null);
  const [pill, setPill] = useStateC(null);
  const activeIndex = options.findIndex((o) => o.v === value);
  React.useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const el = root.querySelectorAll("[data-seg]")[activeIndex];
      setPill(el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [activeIndex, options.length]);
  return (
    <div ref={rootRef} role="radiogroup" style={{
      ...(wrap
        ? { display: "inline-flex", flexWrap: "wrap", maxWidth: "100%" }
        : fit
          ? { display: "flex", flexWrap: "wrap" }
          : { display: full ? "grid" : "inline-grid", gridAutoFlow: "column", gridAutoColumns: full ? "1fr" : undefined }),
      position: "relative", isolation: "isolate",
      background: "var(--bg-2)", border: "1px solid var(--line)",
      borderRadius: 10, padding: 3, gap: 2,
    }}>
      {pill && (
        <span aria-hidden className="nsc-seg-pill" style={{
          position: "absolute", left: 0, top: 0, zIndex: -1,
          width: pill.w, height: pill.h, borderRadius: 8, background: "var(--ink)",
          transform: `translate(${pill.x}px, ${pill.y}px)`,
        }} />
      )}
      {options.map((o) => {
        const active = o.v === value;
        return (
          <button key={String(o.v)} data-seg role="radio" aria-checked={active} onClick={() => onChange(o.v)} style={{
            padding: small ? (fit ? "6px 8px" : "5px 10px") : "8px 14px",
            // fit: options share each row; on a narrow phone they wrap into
            // even rows instead of running off the edge.
            flex: fit ? "1 1 auto" : undefined,
            borderRadius: 8, border: "none",
            // Until the pill is measured, paint the active option directly.
            background: active && !pill ? "var(--ink)" : "transparent",
            color: active ? "var(--bg)" : "var(--ink-dim)",
            fontSize: small ? 12 : 13, fontWeight: active ? 600 : 500,
            cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
            transition: "color 0.2s ease",
          }}>{o.l}</button>
        );
      })}
    </div>
  );
}

/* 44px: Apple's minimum comfortable tap target. */
function iconBtn() {
  return {
    width: 44, height: 44, borderRadius: 12,
    background: "var(--bg-2)", border: "1px solid var(--line)",
    color: "var(--ink)", cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontSize: 16, fontFamily: "inherit",
  };
}
function primaryBtn() {
  return {
    padding: "10px 16px", borderRadius: 10, border: "none",
    background: "var(--ink)", color: "var(--bg)",
    fontWeight: 600, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit",
  };
}
function ghostBtn() {
  return {
    padding: "10px 14px", borderRadius: 10,
    border: "1px solid var(--line)", background: "var(--bg-2)",
    color: "var(--ink)", fontSize: 13, cursor: "pointer", fontWeight: 500, fontFamily: "inherit",
  };
}
/* Underlined text button (inline links, Change / Hide toggles). */
function linkBtn(fontSize = "inherit") {
  return {
    background: "transparent", border: "none", padding: 0, color: "var(--ink-dim)",
    fontSize, cursor: "pointer", fontFamily: "inherit",
    textDecoration: "underline", textUnderlineOffset: 3,
  };
}
function accentBtn() {
  return {
    padding: "10px 14px", borderRadius: 10, border: "none",
    background: "var(--accent)", color: "var(--accent-ink)",
    fontWeight: 600, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit",
  };
}

/* prefersReducedMotion — respect the OS "reduce motion" accessibility setting */
function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* AnimatedNumber — smooth count to target */
/* `from` counts up on mount (e.g. from 0); without it the first render shows
   the value as is and only later changes animate. */
function AnimatedNumber({ value, format, durationMs = 350, from }) {
  const [display, setDisplay] = useStateC(from ?? value);
  const fromRef = useRefC(from ?? value);
  const startRef = useRefC(null);
  const rafRef = useRefC(null);
  useEffectC(() => {
    if (prefersReducedMotion()) { setDisplay(value); return; }
    fromRef.current = display;
    startRef.current = performance.now();
    const to = value;
    const from = fromRef.current;
    const tick = (now) => {
      const t = Math.min(1, (now - startRef.current) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);
  return <span className="mono">{format(display)}</span>;
}

/* ChartTip — the one hover/focus readout for History's charts. Value first
   (strong), label after; pinned above the mark at `xPct` and kept inside the
   chart near either edge. */
function ChartTip({ xPct, value, label, note }) {
  const shift = xPct < 18 ? "0%" : xPct > 82 ? "-100%" : "-50%";
  return (
    <div role="status" className="nsc-tip" style={{
      position: "absolute", left: `${xPct}%`, bottom: "calc(100% + 6px)", transform: `translateX(${shift})`,
      padding: "6px 9px", borderRadius: 8, whiteSpace: "nowrap", pointerEvents: "none", zIndex: 2,
      background: "var(--surface-translucent)", border: "1px solid var(--line)", boxShadow: "var(--shadow)",
    }}>
      <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 1 }}>{label}</div>
      {note && <div style={{ marginTop: 2 }}>{note}</div>}
    </div>
  );
}

/* useChartCursor — which point/column a chart is reading out. Pointer sets it
   directly; the chart is one tab stop, and arrows step through the indexes
   `valid` allows. Mouse-out or blur clears it; a touch readout stays up
   until the next tap elsewhere (which blurs the chart). */
function useChartCursor(count, valid = () => true) {
  const [cur, setCur] = useStateC(null);
  const step = (dir) => setCur((c) => {
    let k = c ?? (dir > 0 ? -1 : count);
    do { k += dir; } while (k >= 0 && k < count && !valid(k));
    return k >= 0 && k < count ? k : c;
  });
  const props = {
    tabIndex: 0,
    onKeyDown: (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); step(e.key === "ArrowRight" ? 1 : -1); }
      else if (e.key === "Escape") setCur(null);
    },
    onFocus: () => setCur((c) => {
      if (c != null) return c;
      for (let k = count - 1; k >= 0; k--) if (valid(k)) return k;
      return null;
    }),
    onBlur: () => setCur(null),
    onPointerLeave: (e) => { if (e.pointerType === "mouse") setCur(null); },
  };
  return [cur, setCur, props];
}

/* PAY_PARTS — the three parts every total splits into, in the same order
   and colours on Home, Shifts and History. */
const PAY_PARTS = [
  { key: "allow", label: "Allowance", field: "allowanceSubtotal", color: "var(--sp1)" },
  { key: "base", label: "Base", field: "baseSubtotal", color: "var(--am)" },
  { key: "extra", label: "Extra", field: "extraSubtotal", color: "var(--sp2)" },
];

/* SplitBar — a total as one stacked bar of its parts. Parts are split by a
   2px surface gap (no strokes), the bar reveals left to right on mount and
   each part slides to its new share when the numbers change. `focus` dims
   every part but that one; onFocusPart reports the part under the pointer. */
function SplitBar({ totals, focus, onFocusPart, height = 8, delay = 0.3 }) {
  const parts = PAY_PARTS.map((p) => ({ ...p, value: Math.max(0, Number(totals?.[p.field]) || 0) }));
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div className="nsc-reveal-x" aria-hidden onPointerLeave={onFocusPart && (() => onFocusPart(null))} style={{
      display: "flex", gap: shown.length > 1 ? 2 : 0, height, borderRadius: height / 2, overflow: "hidden",
      background: shown.length ? "transparent" : "var(--bg-2)", animationDelay: `${delay}s`,
    }}>
      {shown.map((p) => (
        <div key={p.key} title={`${p.label} ${fmt(p.value)}`}
          onPointerEnter={onFocusPart && ((e) => { if (e.pointerType === "mouse") onFocusPart(p.key); })}
          onPointerDown={onFocusPart && (() => onFocusPart(p.key))}
          style={{
            flex: `${p.value} 1 0`, minWidth: 3, background: p.color,
            opacity: focus && focus !== p.key ? 0.3 : 1,
            transition: "flex-grow 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.15s ease",
          }} />
      ))}
    </div>
  );
}

/* useFoldAway — remove a list row after it folds shut, so the rows below
   slide up instead of jumping. Returns [isLeaving(id), remove(id)]; a second
   tap while a row is folding is ignored. */
function useFoldAway(onRemove, ms = 220) {
  const [leaving, setLeaving] = useStateC([]);
  const busy = useRefC(new Set());
  const remove = (id) => {
    if (busy.current.has(id)) return;
    if (prefersReducedMotion()) { onRemove(id); return; }
    busy.current.add(id);
    setLeaving((l) => [...l, id]);
    setTimeout(() => {
      onRemove(id);
      busy.current.delete(id);
      setLeaving((l) => l.filter((x) => x !== id));
    }, ms);
  };
  return [(id) => leaving.includes(id), remove];
}

/* AnimatedRow — one row of a list: rises in a beat after the row above it and
   folds away when `leaving`. The gap below it lives inside the fold, so it
   closes too. */
function AnimatedRow({ index = 0, leaving, gap = 8, children }) {
  return (
    <div className={"nsc-row" + (leaving ? " is-leaving" : "")}>
      <div>
        <div className="nsc-row-in" style={{ paddingBottom: gap, animationDelay: `${Math.min(index, 8) * 40 + 80}ms` }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* Collapse — animate height open/closed via grid-template-rows (no measuring).
   Closed content is inert, so Tab and screen readers skip what can't be seen;
   once fully open, overflow is released so focus rings aren't clipped. */
function Collapse({ open, children }) {
  const [settled, setSettled] = useStateC(open);
  useEffectC(() => {
    if (!open) { setSettled(false); return; }
    if (prefersReducedMotion()) { setSettled(true); return; }
    const t = setTimeout(() => setSettled(true), 260);
    return () => clearTimeout(t);
  }, [open]);
  return (
    <div className={"nsc-collapse" + (open ? " is-open" : "")} style={{
      display: "grid",
      gridTemplateRows: open ? "1fr" : "0fr",
      transition: "grid-template-rows 0.26s cubic-bezier(0.22, 1, 0.36, 1)",
    }}>
      <div inert={open ? undefined : ""} aria-hidden={open ? undefined : "true"} style={{ overflow: open && settled ? "visible" : "hidden", minHeight: 0 }}>{children}</div>
    </div>
  );
}

/* Toast — decoupled: any module calls showToast(); ToastHost (mounted once)
   renders an animated, auto-dismissing toast above the taskbar. Pass
   { action: { label, onClick } } for an Undo-style button; those toasts stay
   up longer so there's time to reach them. */
function showToast(message, opts) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("nsc-toast", { detail: { message, action: opts?.action || null } }));
  }
}
function ToastHost() {
  const [toast, setToast] = useStateC(null);
  const timerRef = useRefC(null);
  useEffectC(() => {
    const onToast = (e) => {
      const d = e.detail || {};
      setToast({ id: Date.now(), message: String(d.message || ""), action: d.action });
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setToast(null), d.action ? 6000 : 2200);
    };
    window.addEventListener("nsc-toast", onToast);
    return () => {
      window.removeEventListener("nsc-toast", onToast);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
  if (!toast) return null;
  const act = () => {
    toast.action?.onClick?.();
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
  };
  return (
    <div aria-live="polite" className="nsc-toast-wrap" style={{
      position: "fixed", left: 0, right: 0,
      display: "flex", justifyContent: "center", zIndex: 90, pointerEvents: "none", padding: "0 16px",
    }}>
      <div key={toast.id} className="nsc-toast" style={{
        background: "var(--surface-translucent)",
        backdropFilter: "blur(24px) saturate(140%)", WebkitBackdropFilter: "blur(24px) saturate(140%)",
        border: "1px solid color-mix(in oklab, var(--accent) 35%, var(--line))",
        color: "var(--ink)", borderRadius: 999, padding: toast.action ? "6px 6px 6px 16px" : "10px 16px", fontSize: 13,
        boxShadow: "0 12px 32px -16px rgba(0,0,0,0.7)", maxWidth: 420,
        display: "flex", alignItems: "center", gap: 12,
        pointerEvents: toast.action ? "auto" : "none",
      }}>
        <span>{toast.message}</span>
        {toast.action && (
          <button onClick={act} style={{
            border: "none", borderRadius: 999, padding: "8px 14px", minHeight: 36,
            background: "var(--accent)", color: "var(--accent-ink)",
            fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
          }}>{toast.action.label}</button>
        )}
      </div>
    </div>
  );
}

/* askConfirm — in-app replacement for window.confirm(). Resolves true when the
   person confirms, false on cancel / Escape / backdrop. ConfirmHost (mounted
   once) renders the dialog above any open modal. */
function askConfirm(opts) {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent("nsc-confirm", { detail: { opts: opts || {}, resolve } }));
  });
}
function ConfirmHost() {
  const [req, setReq] = useStateC(null);
  useEffectC(() => {
    const onReq = (e) => setReq({ id: Date.now(), ...e.detail });
    window.addEventListener("nsc-confirm", onReq);
    return () => window.removeEventListener("nsc-confirm", onReq);
  }, []);
  if (!req) return null;
  return <ConfirmDialog key={req.id} {...req.opts} onDone={(ok) => { req.resolve(ok); setReq(null); }} />;
}
function ConfirmDialog({ title, body, confirmLabel, danger, onDone }) {
  const resultRef = useRefC(false);
  const { ref: dialogRef, closing, close } = useModalDismiss(() => onDone(resultRef.current));
  const answer = (ok) => { resultRef.current = ok; close(); };
  return (
    <ModalFrame dismiss={{ ref: dialogRef, closing, close: () => answer(false) }} zIndex={95} maxWidth={380} role="alertdialog" label={title}>
        <div style={{ fontSize: 17, fontWeight: 600 }}>{title}</div>
        {body && <div style={{ fontSize: 13.5, color: "var(--ink-dim)", lineHeight: 1.5, marginTop: 6 }}>{body}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
          <button onClick={() => answer(false)} style={ghostBtn()}>Cancel</button>
          <button onClick={() => answer(true)} style={danger
            ? { ...primaryBtn(), background: "var(--holiday)", color: "#fff" }
            : primaryBtn()}>{confirmLabel || "OK"}</button>
        </div>
    </ModalFrame>
  );
}

/* ModalFrame — the dimmed backdrop and the dialog card every modal shares.
   Pass the useModalDismiss() result as `dismiss`. sheet: a bottom sheet above
   the tab bar; otherwise a centred dialog. Both scroll inside when tall. */
function ModalFrame({ dismiss, sheet, zIndex = 70, maxWidth = 520, role = "dialog", label, style, children }) {
  const { ref, closing, close } = dismiss;
  const c = closing ? " is-closing" : "";
  return (
    <div onClick={close} className={"nsc-backdrop" + (sheet ? " is-bottom" : "") + c} style={{ zIndex }}>
      <div ref={ref} tabIndex={-1} onClick={(e) => e.stopPropagation()} role={role} aria-modal="true" aria-label={label}
        className={"nsc-modal " + (sheet ? "nsc-sheet" : "nsc-center") + c} style={{ maxWidth, ...style }}>
        {children}
      </div>
    </div>
  );
}

/* ModalHead — small label, title, optional lines under it, and a close
   button, as every modal opens. */
function ModalHead({ eyebrow, title, onClose, children }) {
  return (
    <div style={{ display: "flex", alignItems: eyebrow || children ? "flex-start" : "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && <div className="label">{eyebrow}</div>}
        <div style={{ fontSize: eyebrow ? 17 : 18, fontWeight: 600, marginTop: eyebrow ? 2 : 0 }}>{title}</div>
        {children}
      </div>
      <button onClick={onClose} style={{ ...iconBtn(), flexShrink: 0 }} aria-label="Close">✕</button>
    </div>
  );
}

/* PeriodNav — the pay period with previous / next buttons (Home and Shifts). */
function PeriodNav({ period, onShift, style }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, ...style }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="label">Pay period</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{periodLabel(period)}</div>
      </div>
      <button onClick={() => onShift(-1)} style={iconBtn()} aria-label="Previous period">‹</button>
      <button onClick={() => onShift(1)} style={iconBtn()} aria-label="Next period">›</button>
    </div>
  );
}

/* ChoiceCard — one of a few big tappable options (setup wizard, Auto-fill).
   color: an optional shift colour swatch beside the title. */
function ChoiceCard({ active, onClick, title, detail, color }) {
  return (
    <button onClick={onClick} aria-pressed={active} style={{
      padding: "12px 14px", borderRadius: 12, textAlign: "left", cursor: "pointer", fontFamily: "inherit",
      background: active ? "color-mix(in oklab, var(--accent) 12%, var(--bg-2))" : "var(--bg-2)",
      border: `1.5px solid ${active ? "var(--accent)" : "var(--line)"}`,
      color: "var(--ink)", display: "flex", flexDirection: "column", gap: 4,
      transition: "background 0.15s, border-color 0.15s, transform 0.12s",
    }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 600 }}>
        {color && <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />}
        {title}
      </span>
      <span style={{ fontSize: 12.5, color: "var(--ink-dim)" }}>{detail}</span>
    </button>
  );
}

/* DutySummary — leave, orderly and exchange shifts for a period's totals, as
   one row of chips plus a line on what each kind did to pay. Nothing when
   there are none (or for a legacy snapshot). */
function DutySummary({ totals, style }) {
  const d = totals?.duties || {};
  const kinds = DUTY_KEYS.filter((k) => Number(d[k]) > 0);
  if (!kinds.length) return null;
  const leaveH = Number(totals.leaveHours) || 0;
  const exchH = Number(totals.exchangedHours) || 0;
  const hoursNote = [
    leaveH > 0 && <span key="l"><span className="mono">{fmtH0(leaveH)}</span>h on leave</span>,
    exchH > 0 && <span key="x"><span className="mono">{fmtH0(exchH)}</span>h swapped out</span>,
  ].filter(Boolean);
  const notes = [
    Number(totals.leaveShifts) > 0 && "Leave hours count as ordinary hours toward your total and overtime, never holiday ×2. No SP1, SP2, meal or taxi on those shifts.",
    Number(d.exchangeLeave) > 0 && "Exchange leave shifts were covered by someone else: no hours and no allowances.",
    Number(d.exchangeFor) > 0 && "Exchange for shifts (covering someone else) are paid in full.",
  ].filter(Boolean);
  return (
    <div style={{ padding: "10px 12px", borderRadius: 12, background: "var(--bg-2)", border: "1px solid var(--line-soft)", ...style }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span className="label">Leave & duties</span>
        {hoursNote.length > 0 && (
          <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
            {hoursNote.map((n, i) => <React.Fragment key={i}>{i > 0 && " · "}{n}</React.Fragment>)}
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {kinds.map((k) => {
          const pay = DUTY_TYPES[k].pay;
          return (
            <span key={k} style={{
              fontSize: 12, padding: "3px 9px", borderRadius: 999,
              color: pay === "none" ? "var(--ink-dim)" : "var(--ink)",
              border: `1px ${pay === "hours" ? "dashed" : pay === "none" ? "dotted" : "solid"} ${pay === "none" ? "var(--ink-faint)" : "var(--line)"}`,
              background: "var(--bg-1)",
            }}>
              {DUTY_TYPES[k].label} <span className="mono" style={{ fontWeight: 700 }}>× {d[k]}</span>
            </span>
          );
        })}
      </div>
      {notes.map((n) => (
        <div key={n} style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 8, lineHeight: 1.45 }}>{n}</div>
      ))}
    </div>
  );
}

/* totalLabel — what the big number actually is. Without a monthly basic
   there's no base pay or overtime, so calling it "gross pay" would mislead.
   short: the floating total's few-word version. */
function totalLabel(t, short) {
  if (Number(t?.monthlyBasic) > 0) return short ? "Est. gross" : "Estimated gross pay";
  if (Number(t?.compulsory) > 0) return short ? "Est. pay" : "Estimated pay (basic not set)";
  return short ? "Allowances" : "Estimated allowances";
}

/* netApplies — whether an "after tax" figure means anything. Deductions
   depend on the whole month's pay, so taxing allowances alone (no monthly
   basic) would understate them and show a net that's too high. */
function netApplies(t, tx) {
  return !!tx?.enabled && Number(t?.monthlyBasic) > 0;
}

/* SaveRow — Save to History + Copy summary, with whether this period is
   already saved. status: { state: "none" | "saved" | "changed", at } */
function SaveRow({ status, onSave, onCopy }) {
  const state = status?.state || "none";
  const when = status?.at ? new Date(status.at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
  const save = () => {
    // Re-saving an unchanged result would only move its "saved on" date.
    if (state === "saved") { showToast("Already saved to History"); return; }
    onSave();
    showToast(state === "none" ? "Saved to History" : "Saved result updated");
  };
  const label = state === "saved" ? "Saved ✓" : state === "changed" ? "Save changes" : "Save to History";
  return (
    <div style={{ marginTop: 14 }}>
      {/* Side by side when both labels fit on one line; stacked on a
          narrow phone instead of wrapping each label onto two lines. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
        <button onClick={save} style={state === "saved" ? { ...ghostBtn(), color: "var(--ok)", fontWeight: 600 } : accentBtn()}>{label}</button>
        <button onClick={onCopy} style={ghostBtn()}>Copy summary</button>
      </div>
      {state !== "none" && (
        <div style={{ fontSize: 12, marginTop: 8, color: state === "changed" ? "var(--warn)" : "var(--ink-faint)" }}>
          {state === "changed" ? `Changed since you saved it on ${when}.` : `Saved to History on ${when}.`}
        </div>
      )}
    </div>
  );
}

/* AppFooter — the one footnote every screen ends with, so the disclaimer,
   credit and contact read the same everywhere. The rates line shows when
   Settings can be opened from it; About is left out on the About screen. */
function AppFooter({ ratesEffective, onOpenSettings, onAbout }) {
  const link = linkBtn();
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Night Shift Calculator")}`;
  return (
    <footer className="nsc-footer" style={{ maxWidth: 560, margin: "0 auto", padding: "6px 20px 0", textAlign: "center", fontSize: 12, color: "var(--ink-faint)", lineHeight: 1.7 }}>
      {ratesEffective && onOpenSettings && (
        <div>{ratesEffective} · <button onClick={onOpenSettings} style={link}>Edit rates</button></div>
      )}
      <div>Estimate only. Check against your pay slip.</div>
      <div>Questions or issues? <a href={mailto} style={link}>{CONTACT_EMAIL}</a></div>
      <div>{APP_CREDIT}</div>
      <div>
        v{APP_VERSION}
        {onAbout && <> · <button onClick={onAbout} style={link}>About</button></>}
      </div>
    </footer>
  );
}

/* copyText — copy to the clipboard and toast the real outcome. The async
   Clipboard API can be missing (non-HTTPS, older WebViews) or reject (denied
   permission), so fall back to a hidden textarea + execCommand before
   reporting failure. */
function copyText(text, okMessage) {
  const ok = () => showToast(okMessage || "Copied");
  const fail = () => showToast("Couldn't copy. Your browser blocked the clipboard.");
  const fallback = () => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const done = document.execCommand("copy");
      document.body.removeChild(ta);
      done ? ok() : fail();
    } catch { fail(); }
  };
  try {
    const p = navigator.clipboard?.writeText(text);
    if (p && typeof p.then === "function") p.then(ok, fallback);
    else fallback();
  } catch { fallback(); }
}

/* downloadBlob — save a Blob as a file. Revoking the object URL in the same
   tick as click() can cancel the download in some browsers (notably Safari),
   so release it after a short delay, as share.jsx does for images. */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* sanitizeDecimal — keep digits and a single decimal point */
function sanitizeDecimal(v) {
  let s = String(v).replace(/[^0-9.]/g, "");
  const i = s.indexOf(".");
  if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, "");
  return s;
}

/* useModalDismiss — close on Escape, lock background scroll, manage focus, and
   drive an exit animation. Returns { ref, closing, close }:
   - attach `ref` to the dialog container for initial focus + Tab focus-trap
   - call `close()` from the backdrop/close buttons; it plays the exit animation
     (toggling `closing`) and then unmounts via onClose after MODAL_EXIT_MS
     (immediately when reduced-motion is on)
   Focus is always restored to the opener on unmount.
   Modals can stack (Reconcile opens over a snapshot's detail), so only the
   topmost one handles keys. Otherwise one Escape closes both, and the two
   Tab focus-traps pull focus back and forth. */
const MODAL_EXIT_MS = 180;
const modalStack = [];
function useModalDismiss(onClose) {
  const cbRef = useRefC(onClose);
  cbRef.current = onClose;
  const dialogRef = useRefC(null);
  const [closing, setClosing] = useStateC(false);
  const closingRef = useRefC(false);

  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (prefersReducedMotion()) { cbRef.current?.(); return; }
    setClosing(true);
    setTimeout(() => cbRef.current?.(), MODAL_EXIT_MS);
  };
  const closeRef = useRefC(close);
  closeRef.current = close;

  useEffectC(() => {
    const prevFocus = document.activeElement;
    const token = {};
    modalStack.push(token);
    const focusables = () => {
      const root = dialogRef.current;
      if (!root) return [];
      return Array.from(root.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((el) => el.offsetParent !== null || el === document.activeElement);
    };
    if (dialogRef.current) {
      const f = focusables();
      (f[0] || dialogRef.current).focus?.();
    }
    const onKey = (e) => {
      if (modalStack[modalStack.length - 1] !== token) return;
      if (e.key === "Escape") { closeRef.current?.(); return; }
      if (e.key === "Tab" && dialogRef.current) {
        const f = focusables();
        if (f.length === 0) { e.preventDefault(); return; }
        const first = f[0], last = f[f.length - 1], active = document.activeElement;
        if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
          e.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      modalStack.splice(modalStack.indexOf(token), 1);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      prevFocus?.focus?.();
    };
  }, []);
  return { ref: dialogRef, closing, close };
}

Object.assign(window, {
  Card, SectionHead, Row, Sub, SegToggle,
  iconBtn, primaryBtn, ghostBtn, accentBtn, linkBtn,
  ModalFrame, ModalHead, PeriodNav, ChoiceCard,
  AnimatedNumber, ChartTip, useChartCursor, PAY_PARTS, SplitBar, useFoldAway, AnimatedRow, sanitizeDecimal, useModalDismiss,
  prefersReducedMotion, Collapse, showToast, ToastHost,
  askConfirm, ConfirmHost, DutySummary, totalLabel, netApplies, SaveRow, AppFooter,
  copyText, downloadBlob,
});
