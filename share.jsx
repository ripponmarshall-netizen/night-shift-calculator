/* share.jsx — render snapshot as PNG image for sharing */

// The app's own type: San Francisco on Apple devices, Geist elsewhere.
const SANS = '-apple-system, "SF Pro Display", "Geist", system-ui, sans-serif';
const FIG = '-apple-system, "SF Pro Text", "Geist", system-ui, sans-serif';

function renderSnapshotCanvas(snap, theme = "dark") {
  // Legacy/imported snapshots may lack totals; draw zeros rather than throw.
  snap = { ...snap, totals: snap.totals || {} };
  if (theme === "auto") {
    const prefersLight = typeof window !== "undefined" && window.matchMedia
      && window.matchMedia("(prefers-color-scheme: light)").matches;
    theme = prefersLight ? "light" : "dark";
  }
  const isDark = theme !== "light";
  const colors = isDark ? {
    bg: "#000000",
    card: "#1c1c1e",
    section: "#2c2c2e",
    line: "#38383a",
    ink: "#f5f5f7",
    dim: "#aeaeb2",
    faint: "#98989d",
    accent: "#ff9f0a",
    accentInk: "#000000",
    sp1: "#0a84ff",
    sp2: "#bf5af2",
    am: "#30d158",
  } : {
    bg: "#f2f2f7",
    card: "#ffffff",
    section: "#f2f2f7",
    line: "#d1d1d6",
    ink: "#1d1d1f",
    dim: "#6e6e73",
    faint: "#76767b",
    accent: "#b84f00",
    accentInk: "#ffffff",
    sp1: "#0071e3",
    sp2: "#8944ab",
    am: "#248a3d",
  };
  // The shift colours, as on the calendar.
  colors.shift = isDark
    ? { am7: colors.am, pm3: colors.sp1, pm10: colors.sp2, sd: "#40c8e0", extra: "#ff375f" }
    : { am7: colors.am, pm3: colors.sp1, pm10: colors.sp2, sd: "#00809a", extra: "#d30f45" };

  // Laid out twice: once on a scratch canvas to see how tall it runs (a
  // period with extra shifts and leave has more lines), then for real at
  // that height. Never shorter than the 4:5 card it has always been.
  const W = 1080;
  const scratch = document.createElement("canvas");
  scratch.width = 1;
  scratch.height = 1;
  const H = Math.max(1350, paintSnapshot(scratch.getContext("2d"), snap, colors, isDark, W, 1350));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  paintSnapshot(canvas.getContext("2d"), snap, colors, isDark, W, H);
  return canvas;
}

/* Draw the saved result at W × H. Returns the height it needs. */
function paintSnapshot(ctx, snap, colors, isDark, W, H) {
  // bg
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, W, H);

  // outer card
  const pad = 60;
  drawRoundedRect(ctx, pad, pad, W - 2 * pad, H - 2 * pad, 40);
  ctx.fillStyle = colors.card;
  ctx.fill();
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 2;
  ctx.stroke();

  // header
  ctx.fillStyle = colors.faint;
  ctx.font = `600 22px ${FIG}`;
  ctx.textBaseline = "top";
  // Same taxi wording as the app (Short / Long / Varies).
  const taxi = snap.mode === "advanced" ? "TAXI VARIES" : snap.basicDistance === "L" ? "LONG TAXI" : "SHORT TAXI";
  ctx.fillText("NIGHT SHIFT · " + taxi, pad + 50, pad + 50);

  ctx.fillStyle = colors.ink;
  ctx.font = `700 56px ${SANS}`;
  ctx.fillText("Pay Summary", pad + 50, pad + 88);

  ctx.fillStyle = colors.dim;
  ctx.font = `500 28px ${SANS}`;
  ctx.fillText(snap.period, pad + 50, pad + 168);

  // big total chip
  const chipY = pad + 240;
  drawRoundedRect(ctx, pad + 50, chipY, W - 2 * pad - 100, 150, 24);
  const grad = ctx.createLinearGradient(0, chipY, 0, chipY + 150);
  grad.addColorStop(0, hexA(colors.accent, isDark ? 0.18 : 0.14));
  grad.addColorStop(1, hexA(colors.accent, isDark ? 0.06 : 0.04));
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = hexA(colors.accent, 0.35);
  ctx.stroke();

  ctx.fillStyle = colors.accent;
  ctx.font = `700 22px ${FIG}`;
  // What the number actually is: gross only when a monthly basic was set.
  ctx.fillText(totalLabel(snap.totals).toUpperCase(), pad + 80, chipY + 26);

  ctx.fillStyle = colors.ink;
  ctx.font = `700 68px ${FIG}`;
  ctx.fillText(fmt(snap.totals.grand), pad + 80, chipY + 62);

  // breakdown sections
  let y = chipY + 200;
  y = drawSection(ctx, "Allowance", snap.totals.allowanceSubtotal, pad + 50, y, W - 2 * pad - 100, colors.sp1, colors);
  drawLine(ctx, "SP1 — 3PM", fmt(snap.totals.sp1), pad + 70, y, W - 2 * pad - 140, colors); y += 38;
  drawLine(ctx, "SP2 — 10PM", fmt(snap.totals.sp2), pad + 70, y, W - 2 * pad - 140, colors); y += 38;
  drawLine(ctx, "Meal", fmt(snap.totals.meal), pad + 70, y, W - 2 * pad - 140, colors); y += 38;
  drawLine(ctx, "Taxi", fmt(snap.totals.taxi), pad + 70, y, W - 2 * pad - 140, colors); y += 50;

  y = drawSection(ctx, "Base Pay", snap.totals.baseSubtotal, pad + 50, y, W - 2 * pad - 100, colors.am, colors);
  drawLine(ctx, "Monthly Basic", fmt(snap.totals.monthlyBasic), pad + 70, y, W - 2 * pad - 140, colors); y += 38;
  drawLine(ctx, "Compulsory assignment", fmt(snap.totals.compulsory), pad + 70, y, W - 2 * pad - 140, colors); y += 50;

  y = drawSection(ctx, "Extra Hours", snap.totals.extraSubtotal, pad + 50, y, W - 2 * pad - 100, colors.sp2, colors);
  const hrs = (n) => (inMinutes(snap.totals.rates) ? fmtHM(n) : `${fmtH(n)}h`);
  drawLine(ctx, `Holiday hours · ${hrs(snap.totals.holidayHours)}`, fmt(snap.totals.holidayPay), pad + 70, y, W - 2 * pad - 140, colors); y += 38;
  drawLine(ctx, `OT hours · ${hrs(snap.totals.otHours)}`, fmt(snap.totals.overtimePay), pad + 70, y, W - 2 * pad - 140, colors); y += 50;

  // Leave and exchanges: a record only (their effect is already in the
  // totals above). One line each; the image grows to fit them.
  const plural = (n) => `${n} shift${n === 1 ? "" : "s"}`;
  const extraN = Number(snap.totals.extraShifts) || 0;
  const sdOt = Number(snap.totals.sdOtHours) || 0;
  const leaveN = Number(snap.totals.leaveShifts) || 0;
  const exchN = Number(snap.totals.exchangedShifts) || 0;
  const coverN = Number(snap.totals.duties?.exchangeFor) || 0;
  const notes = [
    extraN > 0 && [`Extra shifts · ${plural(extraN)} · ${fmtHM(snap.totals.extraHours)}`, "in total hours"],
    sdOt > 0 && [`OT after Straight Day · ${fmtHM(sdOt)}`, "in total hours"],
    leaveN > 0 && [`On leave · ${plural(leaveN)} · ${hrs(snap.totals.leaveHours)}`, "no allowance"],
    exchN > 0 && [`Exchange leave · ${plural(exchN)}`, "not paid"],
    coverN > 0 && [`Exchange for · ${plural(coverN)}`, "paid as normal"],
  ].filter(Boolean);
  for (const [label, value] of notes) {
    drawLine(ctx, label, value, pad + 70, y, W - 2 * pad - 140, colors);
    y += 38;
  }

  // Shifts per type, and each extra shift by date (a saved result from
  // before the shift log was kept has none to show).
  const log = Array.isArray(snap.totals.shifts) ? snap.totals.shifts : [];
  if (log.length) {
    if (notes.length) y += 12;
    const b = shiftBreakdown(log);
    const dur = (n) => fmtDur(n, snap.totals.rates);
    y = drawSection(ctx, "Shifts", `${b.total.n} · ${dur(b.total.hours)}`, pad + 50, y, W - 2 * pad - 100, colors.faint, colors);
    for (const r of b.rows) {
      if (!r.n) continue;
      drawSwatch(ctx, pad + 70, y, colors.shift[r.k]);
      const bits = [`${SHIFT_LABEL[r.k]} × ${r.n}`, r.extra && `${r.extra} extra`, r.hol > 0 && `${dur(r.hol)} holiday`].filter(Boolean);
      drawLine(ctx, bits.join(" · "), dur(r.hours), pad + 92, y, W - 2 * pad - 162, colors);
      y += 38;
    }
    if (b.after.days) {
      drawLine(ctx, `OT after Straight Day · ${b.after.days} day${b.after.days === 1 ? "" : "s"}`, dur(b.after.hours), pad + 92, y, W - 2 * pad - 162, colors);
      y += 38;
    }
    const extras = log.filter((s) => s.extra);
    if (extras.length) {
      y += 8;
      ctx.fillStyle = colors.faint;
      ctx.font = `600 20px ${FIG}`;
      ctx.fillText("EXTRA SHIFTS", pad + 70, y);
      y += 34;
      const MAX = 10;
      for (const s of extras.slice(0, extras.length > MAX ? MAX - 1 : MAX)) {
        const d = fromYmd(s.date);
        drawSwatch(ctx, pad + 70, y, colors.shift.extra);
        const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        drawLine(ctx, `${day} · ${SHIFT_LABEL[s.k]} · ${shiftSpan(s)}`, dur(s.hours), pad + 92, y, W - 2 * pad - 162, colors);
        y += 38;
      }
      if (extras.length > MAX) {
        drawLine(ctx, `and ${extras.length - (MAX - 1)} more`, "", pad + 92, y, W - 2 * pad - 162, colors);
        y += 38;
      }
    }
  }
  const needed = y + 40 + pad + 60;

  // footer
  ctx.fillStyle = colors.faint;
  ctx.font = `500 20px ${FIG}`;
  ctx.textAlign = "center";
  ctx.fillText("Night Shift Calculator · Estimate only · Saved " + new Date(snap.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), W / 2, H - pad - 60);
  ctx.textAlign = "left";

  return needed;
}

/* A shift's colour mark beside its line. */
function drawSwatch(ctx, x, y, color) {
  drawRoundedRect(ctx, x, y + 3, 6, 20, 3);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawSection(ctx, label, subtotal, x, y, w, accent, colors) {
  drawRoundedRect(ctx, x, y, w, 56, 12);
  // Its own palette entry: the old check compared against a stale dark card
  // colour, so dark images got a light bar under white text (unreadable).
  ctx.fillStyle = colors.section;
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillRect(x + 12, y + 16, 8, 24);
  ctx.fillStyle = colors.ink;
  ctx.font = `600 26px ${SANS}`;
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + 32, y + 28);
  ctx.font = `700 28px ${FIG}`;
  ctx.textAlign = "right";
  // A money subtotal, or a figure already in words ("24 · 191h").
  ctx.fillText(typeof subtotal === "string" ? subtotal : fmt(subtotal), x + w - 16, y + 28);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  return y + 76;
}

function drawLine(ctx, label, value, x, y, w, colors) {
  ctx.fillStyle = colors.dim;
  ctx.font = `500 22px ${SANS}`;
  ctx.fillText(label, x, y);
  ctx.fillStyle = colors.ink;
  ctx.font = `500 22px ${FIG}`;
  ctx.textAlign = "right";
  ctx.fillText(value, x + w, y);
  ctx.textAlign = "left";
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexA(hex, a) {
  // hex like "#rrggbb"
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function downloadSnapshotImage(snap, theme) {
  const canvas = renderSnapshotCanvas(snap, theme);
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `night-shift-${snap.periodKey || "snapshot"}.png`);
  }, "image/png");
}

/* Safari only allows clipboard.write() during the tap itself, so it's
   called straight away with a promise of the PNG rather than after the
   canvas has been encoded (which Safari rejects as not user-initiated). */
async function copySnapshotImage(snap, theme) {
  if (!navigator.clipboard?.write || !window.ClipboardItem) throw new Error("Clipboard image not supported");
  const png = new Promise((resolve, reject) => {
    renderSnapshotCanvas(snap, theme).toBlob((b) => (b ? resolve(b) : reject(new Error("No image"))), "image/png");
  });
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}

Object.assign(window, { renderSnapshotCanvas, downloadSnapshotImage, copySnapshotImage });
