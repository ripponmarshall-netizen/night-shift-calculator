/* components.jsx — shared primitives, buttons, icons */
const { useState: useStateC, useEffect: useEffectC, useRef: useRefC } = React;

function Card({ children, style, id }) {
  return (
    <section id={id} style={{
      background: "var(--bg-1)",
      border: "1px solid var(--line-soft)",
      borderRadius: 14,
      padding: 16,
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
        {subtitle && <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

function Row({ label, value, muted, faint, top, onClick, formula }) {
  if (muted) return <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: top ? 14 : 6, marginBottom: 4 }}>{label}</div>;
  const interactive = !!formula;
  return (
    <div
      onClick={interactive ? onClick : undefined}
      title={interactive ? "Tap to see calculation" : undefined}
      style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        padding: "6px 0",
        borderBottom: "1px dashed var(--line-soft)",
        cursor: interactive ? "pointer" : "default",
        position: "relative",
      }}
    >
      <span style={{ fontSize: 13.5, color: faint ? "var(--ink-faint)" : "var(--ink-dim)", display: "flex", alignItems: "center", gap: 6 }}>
        {label}
        {interactive && <span style={{ fontSize: 10, color: "var(--ink-faint)", opacity: 0.7 }}>ƒ</span>}
      </span>
      <span className="mono" style={{ fontSize: 13.5, color: faint ? "var(--ink-faint)" : "var(--ink)" }}>{value}</span>
    </div>
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

function SegToggle({ options, value, onChange, small }) {
  return (
    <div style={{
      display: "inline-grid",
      gridAutoFlow: "column",
      background: "var(--bg-2)", border: "1px solid var(--line)",
      borderRadius: 10, padding: 3, gap: 2,
    }}>
      {options.map((o) => {
        const active = o.v === value;
        return (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            padding: small ? "5px 10px" : "8px 14px",
            borderRadius: 8, border: "none",
            background: active ? "var(--ink)" : "transparent",
            color: active ? "var(--bg)" : "var(--ink-dim)",
            fontSize: small ? 12 : 13, fontWeight: active ? 600 : 500,
            cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
          }}>{o.l}</button>
        );
      })}
    </div>
  );
}

function iconBtn() {
  return {
    width: 36, height: 36, borderRadius: 10,
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
function accentBtn() {
  return {
    padding: "10px 14px", borderRadius: 10, border: "none",
    background: "var(--accent)", color: "var(--accent-ink)",
    fontWeight: 600, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit",
  };
}

/* AnimatedNumber — smooth count to target */
function AnimatedNumber({ value, format, durationMs = 350 }) {
  const [display, setDisplay] = useStateC(value);
  const fromRef = useRefC(value);
  const startRef = useRefC(null);
  const rafRef = useRefC(null);
  useEffectC(() => {
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

/* sanitizeDecimal — keep digits and a single decimal point */
function sanitizeDecimal(v) {
  let s = String(v).replace(/[^0-9.]/g, "");
  const i = s.indexOf(".");
  if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, "");
  return s;
}

/* useModalDismiss — close on Escape, lock background scroll, and manage focus.
   Returns a ref: attach it to the dialog container to enable initial focus and
   a Tab focus-trap. Focus is always restored to the opener on unmount. */
function useModalDismiss(onClose) {
  const cbRef = useRefC(onClose);
  cbRef.current = onClose;
  const dialogRef = useRefC(null);
  useEffectC(() => {
    const prevFocus = document.activeElement;
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
      if (e.key === "Escape") { cbRef.current?.(); return; }
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
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      prevFocus?.focus?.();
    };
  }, []);
  return dialogRef;
}

Object.assign(window, {
  Card, SectionHead, Row, Sub, SegToggle,
  iconBtn, primaryBtn, ghostBtn, accentBtn,
  AnimatedNumber, sanitizeDecimal, useModalDismiss,
});
