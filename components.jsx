/* components.jsx — shared primitives, buttons, icons */
const { useState: useStateC, useEffect: useEffectC, useRef: useRefC } = React;

function Card({ children, style, id }) {
  return (
    <section id={id} style={{
      background: "var(--bg-1)",
      border: "1px solid var(--card-edge)",
      borderRadius: 20,
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
        <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>{title}</div>
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
      // An iOS segmented control: a gray track and a raised pill.
      background: "var(--fill)", border: "1px solid transparent",
      borderRadius: 10, padding: 2, gap: 2,
    }}>
      {pill && (
        <span aria-hidden className="nsc-seg-pill" style={{
          position: "absolute", left: 0, top: 0, zIndex: -1,
          width: pill.w, height: pill.h, borderRadius: 8, background: "var(--seg-pill)",
          boxShadow: "0 3px 8px rgba(0,0,0,0.12), 0 3px 1px rgba(0,0,0,0.04)",
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
            background: active && !pill ? "var(--seg-pill)" : "transparent",
            color: active ? "var(--ink)" : "var(--ink-dim)",
            fontSize: small ? 12 : 13, fontWeight: active ? 600 : 500,
            cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
            transition: "color 0.2s ease, var(--press)",
          }}>{o.l}</button>
        );
      })}
    </div>
  );
}

/* 44px: Apple's minimum comfortable tap target. A round gray button, as
   iOS draws toolbar and close buttons. */
function iconBtn() {
  return {
    width: 44, height: 44, borderRadius: 999,
    background: "var(--fill)", border: "1px solid transparent",
    color: "var(--ink)", cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontSize: 16, fontFamily: "inherit",
  };
}
function primaryBtn() {
  return {
    padding: "10px 16px", borderRadius: 12, border: "none",
    background: "var(--ink)", color: "var(--bg-1)",
    fontWeight: 600, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit",
  };
}
function ghostBtn() {
  return {
    padding: "10px 14px", borderRadius: 12,
    // A gray (not outlined) button, as iOS draws secondary actions.
    border: "1px solid transparent", background: "var(--fill)",
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
    padding: "10px 14px", borderRadius: 12, border: "none",
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

/* AnimatedNumber — count to the target like a critically damped spring:
   it moves fastest at the start and eases onto the value without passing
   it (an overshoot would flash a wrong amount of money).
   `from` counts up on mount (e.g. from 0); without it the first render shows
   the value as is and only later changes animate. */
function AnimatedNumber({ value, format, durationMs = 350, from }) {
  const [display, setDisplay] = useStateC(from ?? value);
  const fromRef = useRefC(from ?? value);
  const startRef = useRefC(null);
  const rafRef = useRefC(null);
  useEffectC(() => {
    // Nothing to count (e.g. mounting without `from`): skip the frames.
    if (prefersReducedMotion() || display === value) { setDisplay(value); return; }
    fromRef.current = display;
    startRef.current = performance.now();
    const to = value;
    const from = fromRef.current;
    const tick = (now) => {
      // On launch the screen mounts under the loading screen (index.html):
      // hold the count until the page comes in, so it plays where it's seen.
      if (document.documentElement.classList.contains("nsc-booting")) {
        startRef.current = now;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(1, (now - startRef.current) / durationMs);
      // x(t) = 1 − (1 + ωt)·e^(−ωt), scaled so it's settled by t = 1.
      const eased = t >= 1 ? 1 : 1 - (1 + 7 * t) * Math.exp(-7 * t);
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
   and colours on Home, Details and History. */
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
            transition: "flex-grow 0.7s var(--ease-snappy), opacity 0.15s ease",
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
    const t = setTimeout(() => setSettled(true), 420);
    return () => clearTimeout(t);
  }, [open]);
  return (
    <div className={"nsc-collapse" + (open ? " is-open" : "")} style={{
      display: "grid",
      gridTemplateRows: open ? "1fr" : "0fr",
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
const TOAST_EXIT_MS = 200;
function ToastHost() {
  const [toast, setToast] = useStateC(null);
  const timerRef = useRefC(null);
  // Fade the toast out, then unmount it. A newer toast replaces it at once.
  const dismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (prefersReducedMotion()) { setToast(null); return; }
    setToast((t) => (t ? { ...t, leaving: true } : t));
    timerRef.current = setTimeout(() => setToast(null), TOAST_EXIT_MS);
  };
  const dismissRef = useRefC(dismiss);
  dismissRef.current = dismiss;
  useEffectC(() => {
    const onToast = (e) => {
      const d = e.detail || {};
      setToast({ id: Date.now(), message: String(d.message || ""), action: d.action });
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => dismissRef.current(), d.action ? 6000 : 2200);
    };
    window.addEventListener("nsc-toast", onToast);
    return () => {
      window.removeEventListener("nsc-toast", onToast);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
  if (!toast) return null;
  const act = () => {
    if (toast.leaving) return;
    toast.action?.onClick?.();
    dismiss();
  };
  return (
    <div aria-live="polite" className="nsc-toast-wrap" style={{
      position: "fixed", left: 0, right: 0,
      display: "flex", justifyContent: "center", zIndex: 90, pointerEvents: "none", padding: "0 16px",
    }}>
      <div key={toast.id} className={"nsc-toast" + (toast.leaving ? " is-leaving" : "")} style={{
        background: "var(--surface-translucent)",
        backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid var(--glass-edge)",
        color: "var(--ink)", borderRadius: 999, padding: toast.action ? "6px 6px 6px 16px" : "10px 16px", fontSize: 13,
        boxShadow: "0 12px 32px -16px rgba(0,0,0,0.7)", maxWidth: 420,
        display: "flex", alignItems: "center", gap: 12,
        pointerEvents: toast.action && !toast.leaving ? "auto" : "none",
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
    // A second request while one is open replaces it; the first is answered
    // "no", so whatever was awaiting it doesn't hang forever.
    const onReq = (e) => setReq((cur) => {
      cur?.resolve(false);
      return { id: Date.now(), ...e.detail };
    });
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
   the tab bar; otherwise a centred dialog, or one hung from the top (top)
   when its height changes as it's used. All scroll inside when tall. */
function ModalFrame({ dismiss, sheet, top, zIndex = 70, maxWidth = 520, role = "dialog", label, style, children }) {
  const { ref, closing, close } = dismiss;
  const backdropRef = useRefC(null);
  const flung = useSheetDrag(sheet ? ref : null, backdropRef, close);
  const c = (closing ? " is-closing" : "") + (flung ? " is-flung" : "");
  // Only a press that starts on the backdrop closes the modal. A text
  // selection dragged out of a field ends with a click on the backdrop too.
  const downOnBackdrop = useRefC(false);
  return (
    <div ref={backdropRef}
      onPointerDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (e.target === e.currentTarget && downOnBackdrop.current) close(); }}
      className={"nsc-backdrop" + (sheet ? " is-bottom" : top ? " is-top" : "") + c} style={{ zIndex }}>
      <div ref={ref} tabIndex={-1} onClick={(e) => e.stopPropagation()} role={role} aria-modal="true" aria-label={label}
        className={"nsc-modal " + (sheet ? "nsc-sheet" : "nsc-center") + c} style={{ maxWidth, ...style }}>
        {sheet && <span className="nsc-grabber" aria-hidden />}
        {children}
      </div>
    </div>
  );
}

/* springTo — move a value to `to` as a mass on a damped spring, starting at
   `from` with `velocity` (units per second), calling onUpdate each frame
   until it comes to rest. Returns a function that stops it. The defaults
   (stiffness 520, damping 34: a damping ratio of about 0.75) settle in about
   a third of a second with one small overshoot. */
function springTo({ from, to, velocity = 0, stiffness = 520, damping = 34, onUpdate, onDone }) {
  let x = from, v = velocity, last = null, raf = 0;
  const step = (now) => {
    // Fixed small steps (semi-implicit Euler) keep it stable on a slow frame.
    let dt = last == null ? 1 / 60 : Math.min(0.064, (now - last) / 1000);
    last = now;
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240);
      v += (-stiffness * (x - to) - damping * v) * h;
      x += v * h;
      dt -= h;
    }
    if (Math.abs(x - to) < 0.3 && Math.abs(v) < 8) { onUpdate(to); onDone?.(); return; }
    onUpdate(x);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

/* useSheetDrag — pull a bottom sheet down to close it, as on iOS. Only
   when the sheet is scrolled to its top and the finger moves mostly down;
   otherwise the sheet scrolls as normal. The sheet follows the finger (with
   rubber-band resistance if pulled up), the backdrop lightens with it, and
   on release it reads the finger's speed: a quick flick or a pull past a
   third of its height flings it away at that speed; anything less springs
   it back into place, carrying the release velocity into the spring.
   Touch events, not pointer events: only a non-passive touchmove can stop
   the page scrolling once the sheet has taken the gesture. Returns whether
   the sheet has been flung (the modal then skips its exit keyframes). */
function useSheetDrag(sheetRef, backdropRef, close) {
  const [flung, setFlung] = useStateC(false);
  const closeRef = useRefC(close);
  closeRef.current = close;
  useEffectC(() => {
    const el = sheetRef?.current;
    if (!el) return;
    let start = null, dragging = false, offset = 0, samples = [], stopSpring = null, done = false;
    const setY = (y) => {
      offset = y;
      el.style.transform = y ? `translateY(${y}px)` : "";
      const bd = backdropRef.current;
      if (bd) bd.style.opacity = y > 0 ? String(Math.max(0.25, 1 - y / (el.offsetHeight * 1.4))) : "";
    };
    const onStart = (e) => {
      if (done || e.touches.length !== 1) { start = null; return; }
      stopSpring?.(); stopSpring = null;
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY, base: offset };
      dragging = false;
      samples = [{ y: t.clientY, t: e.timeStamp }];
    };
    const onMove = (e) => {
      if (!start || done) return;
      const t = e.touches[0];
      const dx = t.clientX - start.x, dy = t.clientY - start.y;
      if (!dragging) {
        // At the top, a downward move would only rubber-band the sheet's
        // own scroll. Claim it from the first move: iOS won't let a scroll
        // that has already started be cancelled.
        if (el.scrollTop <= 0 && dy > 0 && e.cancelable) e.preventDefault();
        // Take the gesture only from the top of the content, moving down;
        // a sideways drag (a slider, a long label) is left alone.
        if (el.scrollTop > 0 || dy < 8 || Math.abs(dy) < Math.abs(dx) * 1.2) {
          if (Math.abs(dx) > 10 || dy < -8 || el.scrollTop > 0) start = null;
          return;
        }
        dragging = true;
        start.y = t.clientY; // no jump by the slop distance
        // An unfinished entrance would fight the finger: skip to its end
        // (leaving the exit keyframes free to play later).
        el.getAnimations?.().forEach((an) => { try { an.finish(); } catch {} });
      }
      e.preventDefault();
      const raw = start.base + (t.clientY - start.y);
      // Pulled up past its resting place, the sheet resists more the further it goes.
      setY(raw >= 0 ? raw : -(1 - 1 / (1 + (-raw * 0.55) / 120)) * 120);
      samples.push({ y: t.clientY, t: e.timeStamp });
      while (samples.length > 2 && e.timeStamp - samples[0].t > 90) samples.shift();
    };
    const onEnd = (e) => {
      if (!start) return;
      start = null;
      if (!dragging) return;
      dragging = false;
      const a = samples[0], b = samples[samples.length - 1];
      const ms = Math.max(1, (b?.t ?? 0) - (a?.t ?? 0));
      // Lifted after holding still: no fling left in it.
      const stale = e.timeStamp - (b?.t ?? 0) > 80;
      const v = stale ? 0 : ((b?.y ?? 0) - (a?.y ?? 0)) / ms; // px per ms
      const h = el.offsetHeight;
      if (offset > 0 && (v > 0.5 || offset > h / 3)) {
        done = true;
        setFlung(true);
        // Leave at (at least) the finger's speed: the sheet keeps the
        // momentum it was given instead of starting from rest.
        const dist = h + 140 - offset;
        const dur = Math.round(Math.max(110, Math.min(180, dist / Math.max(v, 1.6))));
        el.style.transition = `transform ${dur}ms cubic-bezier(0.3, 0.7, 0.6, 1)`;
        const bd = backdropRef.current;
        if (bd) { bd.style.transition = `opacity ${dur + 40}ms ease-out`; bd.style.opacity = "0"; }
        requestAnimationFrame(() => { el.style.transform = `translateY(${h + 140}px)`; });
        closeRef.current();
        return;
      }
      if (prefersReducedMotion()) { setY(0); return; }
      stopSpring = springTo({ from: offset, to: 0, velocity: v * 1000, onUpdate: setY, onDone: () => { stopSpring = null; } });
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      stopSpring?.();
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);
  return flung;
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
      <button onClick={onClose} style={{ ...iconBtn(), flexShrink: 0, color: "var(--ink-dim)" }} aria-label="Close"><XIcon /></button>
    </div>
  );
}

/* The close mark (SF Symbols' xmark), drawn so it's crisp at any size. */
function XIcon({ size = 13 }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M2 2l10 10M12 2L2 12" />
    </svg>
  );
}
function ChevronIcon({ dir = "right", size = 14 }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === "left" ? "M9 2L4 7l5 5" : "M5 2l5 5-5 5"} />
    </svg>
  );
}

/* PeriodNav — the pay period with previous / next buttons (Home and Details). */
function PeriodNav({ period, onShift, style }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, ...style }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="label">Pay period</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{periodLabel(period)}</div>
      </div>
      <button onClick={() => onShift(-1)} style={iconBtn()} aria-label="Previous period"><ChevronIcon dir="left" /></button>
      <button onClick={() => onShift(1)} style={iconBtn()} aria-label="Next period"><ChevronIcon /></button>
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
      border: `1.5px solid ${active ? "var(--accent)" : "transparent"}`,
      color: "var(--ink)", display: "flex", flexDirection: "column", gap: 4,
      transition: "background 0.15s, border-color 0.15s, var(--press)",
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
  // In the unit the result was counted in (16.5h, or 16h 30m by the minute).
  const hoursNote = [
    leaveH > 0 && <span key="l"><span className="mono">{fmtDur(leaveH, totals.rates)}</span> on leave</span>,
    exchH > 0 && <span key="x"><span className="mono">{fmtDur(exchH, totals.rates)}</span> swapped out</span>,
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

/* Back-button layers. A modal, or Home's setup, holds one history entry while
   it's open, so the phone's Back button closes it instead of changing the
   screen underneath (or, from Home, leaving the app). Closing one from its
   own buttons takes the entry off again; that history.back() is swallowed
   here, ahead of App's popstate handler, so App doesn't read it as a move.
   Layers close newest first, so the top layer always owns the top entry. */
const backLayers = [];
let pendingPops = 0;
let popWaiters = [];
const settlePops = () => { const w = popWaiters; popWaiters = []; w.forEach((fn) => fn()); };
// Registered before App mounts, so it runs ahead of App's own listener.
window.addEventListener("popstate", (e) => {
  if (pendingPops > 0) {
    pendingPops--;
    e.stopImmediatePropagation();
    if (pendingPops === 0) settlePops();
    return;
  }
  const top = backLayers[backLayers.length - 1];
  if (!top || !top.pushed) return;
  backLayers.pop();
  top.pushed = false;
  e.stopImmediatePropagation();
  top.onBack();
});
function openBackLayer(onBack) {
  const layer = { onBack, pushed: false };
  try {
    window.history.pushState({ ...(window.history.state || {}), nscLayer: backLayers.length + 1 }, "");
    layer.pushed = true;
  } catch {}
  backLayers.push(layer);
  return layer;
}
/* Close a layer from the UI. Resolves once its entry is off the history
   (at once when Back already took it), so a screen change made after it
   lands on the right entry. */
function closeBackLayer(layer) {
  const i = backLayers.indexOf(layer);
  if (i !== -1) backLayers.splice(i, 1);
  if (layer.pushed) {
    layer.pushed = false;
    pendingPops++;
    try { window.history.back(); } catch { pendingPops--; }
  }
  if (pendingPops === 0) return Promise.resolve();
  return new Promise((resolve) => {
    popWaiters.push(resolve);
    // Backstop: if the browser never reports the pop, don't let the count
    // swallow the person's next real Back.
    setTimeout(() => { if (pendingPops > 0) { pendingPops = 0; settlePops(); } }, 600);
  });
}

function useModalDismiss(onClose) {
  const cbRef = useRefC(onClose);
  cbRef.current = onClose;
  const dialogRef = useRefC(null);
  const [closing, setClosing] = useStateC(false);
  const closingRef = useRefC(false);
  const layerRef = useRefC(null);

  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    // onClose waits until this modal's Back entry is gone, so a screen it
    // opens (Settings → About) is pushed onto the right entry.
    const left = layerRef.current ? closeBackLayer(layerRef.current) : Promise.resolve();
    layerRef.current = null;
    const finish = () => left.then(() => cbRef.current?.());
    if (prefersReducedMotion()) { finish(); return; }
    setClosing(true);
    setTimeout(finish, MODAL_EXIT_MS);
  };
  const closeRef = useRefC(close);
  closeRef.current = close;

  useEffectC(() => {
    const prevFocus = document.activeElement;
    const token = {};
    modalStack.push(token);
    layerRef.current = openBackLayer(() => closeRef.current?.());
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
      // Unmounted without close() (its screen went away): drop its entry.
      if (layerRef.current) { closeBackLayer(layerRef.current); layerRef.current = null; }
      prevFocus?.focus?.();
    };
  }, []);
  // closingRef flips in the same tap as close(), so a modal can freeze its
  // content for the exit before the state update lands.
  return { ref: dialogRef, closing: closing || closingRef.current, close };
}

Object.assign(window, {
  Card, SectionHead, Row, Sub, SegToggle,
  iconBtn, primaryBtn, ghostBtn, accentBtn, linkBtn,
  ModalFrame, ModalHead, PeriodNav, ChoiceCard, XIcon, ChevronIcon,
  AnimatedNumber, springTo, ChartTip, useChartCursor, PAY_PARTS, SplitBar, useFoldAway, AnimatedRow, sanitizeDecimal, useModalDismiss,
  openBackLayer, closeBackLayer,
  prefersReducedMotion, Collapse, showToast, ToastHost,
  askConfirm, ConfirmHost, DutySummary, totalLabel, netApplies, SaveRow, AppFooter,
  copyText, downloadBlob,
});
