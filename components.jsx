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

/* wrap: lay options out as a wrapping row, so a long set (Settings tabs)
   never hides options off-screen on a narrow phone. */
function SegToggle({ options, value, onChange, small, full, wrap }) {
  return (
    <div role="radiogroup" style={{
      ...(wrap
        ? { display: "inline-flex", flexWrap: "wrap", maxWidth: "100%" }
        : { display: full ? "grid" : "inline-grid", gridAutoFlow: "column", gridAutoColumns: full ? "1fr" : undefined }),
      background: "var(--bg-2)", border: "1px solid var(--line)",
      borderRadius: 10, padding: 3, gap: 2,
    }}>
      {options.map((o) => {
        const active = o.v === value;
        return (
          <button key={o.v} role="radio" aria-checked={active} onClick={() => onChange(o.v)} style={{
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
function AnimatedNumber({ value, format, durationMs = 350 }) {
  const [display, setDisplay] = useStateC(value);
  const fromRef = useRefC(value);
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

/* Collapse — animate height open/closed via grid-template-rows (no measuring) */
function Collapse({ open, children }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateRows: open ? "1fr" : "0fr",
      transition: "grid-template-rows 0.22s ease",
    }}>
      <div style={{ overflow: "hidden", minHeight: 0 }}>{children}</div>
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
    <div aria-live="polite" style={{
      position: "fixed", left: 0, right: 0, bottom: "calc(120px + var(--safe-bottom))",
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
    <div onClick={() => answer(false)} className={"nsc-backdrop" + (closing ? " is-closing" : "")} style={{
      position: "fixed", inset: 0, zIndex: 95, background: "rgba(0,0,0,0.55)",
      backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div ref={dialogRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-label={title}
        className={"nsc-modal nsc-center" + (closing ? " is-closing" : "")} style={{
          width: "100%", maxWidth: 380, background: "var(--bg-1)", border: "1px solid var(--line)",
          borderRadius: 16, padding: 18, outline: "none",
        }}>
        <div style={{ fontSize: 17, fontWeight: 600 }}>{title}</div>
        {body && <div style={{ fontSize: 13.5, color: "var(--ink-dim)", lineHeight: 1.5, marginTop: 6 }}>{body}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
          <button onClick={() => answer(false)} style={ghostBtn()}>Cancel</button>
          <button onClick={() => answer(true)} style={danger
            ? { ...primaryBtn(), background: "var(--holiday)", color: "#fff" }
            : primaryBtn()}>{confirmLabel || "OK"}</button>
        </div>
      </div>
    </div>
  );
}

/* totalLabel — what the big number actually is. Without a monthly basic
   there's no base pay or overtime, so calling it "gross pay" would mislead. */
function totalLabel(t) {
  if (Number(t?.monthlyBasic) > 0) return "Estimated gross pay";
  if (Number(t?.compulsory) > 0) return "Estimated pay (basic not set)";
  return "Estimated allowances";
}

/* SaveRow — Save to History + Copy summary, with whether this period is
   already saved. status: { state: "none" | "saved" | "changed", at } */
function SaveRow({ status, onSave, onCopy }) {
  const state = status?.state || "none";
  const when = status?.at ? new Date(status.at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
  const save = () => {
    onSave();
    showToast(state === "none" ? "Saved to History" : "Saved result updated");
  };
  const label = state === "saved" ? "Saved ✓" : state === "changed" ? "Save changes" : "Save to History";
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
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
  iconBtn, primaryBtn, ghostBtn, accentBtn,
  AnimatedNumber, sanitizeDecimal, useModalDismiss,
  prefersReducedMotion, Collapse, showToast, ToastHost,
  askConfirm, ConfirmHost, totalLabel, SaveRow,
  copyText, downloadBlob,
});
