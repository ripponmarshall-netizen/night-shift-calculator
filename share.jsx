/* share.jsx — render snapshot as PNG image for sharing */

function renderSnapshotCanvas(snap, theme = "dark") {
  // Legacy/imported snapshots may lack totals; draw zeros rather than throw.
  snap = { ...snap, totals: snap.totals || {} };
  if (theme === "auto") {
    const prefersLight = typeof window !== "undefined" && window.matchMedia
      && window.matchMedia("(prefers-color-scheme: light)").matches;
    theme = prefersLight ? "light" : "dark";
  }
  const W = 1080, H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const isDark = theme !== "light";
  const colors = isDark ? {
    bg: "#161513",
    card: "#1d1c19",
    section: "#252420",
    line: "#36342e",
    ink: "#f5f3ee",
    dim: "#aba79c",
    faint: "#7f7b71",
    accent: "#e4875f",
    accentInk: "#141414",
    sp1: "#7eb3e0",
    sp2: "#a48cd8",
    am: "#86c69d",
  } : {
    bg: "#faf9f7",
    card: "#ffffff",
    section: "#f3f1ec",
    line: "#d8d4cb",
    ink: "#1a1815",
    dim: "#6a665f",
    faint: "#767368",
    accent: "#a8502c",
    accentInk: "#ffffff",
    sp1: "#3d72b3",
    sp2: "#7757c0",
    am: "#3f8b5d",
  };

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
  ctx.font = '600 22px "Geist Mono", monospace';
  ctx.textBaseline = "top";
  // Same taxi wording as the app (Short / Long / Varies).
  const taxi = snap.mode === "advanced" ? "TAXI VARIES" : snap.basicDistance === "L" ? "LONG TAXI" : "SHORT TAXI";
  ctx.fillText("NIGHT SHIFT · " + taxi, pad + 50, pad + 50);

  ctx.fillStyle = colors.ink;
  ctx.font = '700 56px "Geist", system-ui';
  ctx.fillText("Pay Summary", pad + 50, pad + 88);

  ctx.fillStyle = colors.dim;
  ctx.font = '500 28px "Geist", system-ui';
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
  ctx.font = '700 22px "Geist Mono", monospace';
  // What the number actually is: gross only when a monthly basic was set.
  ctx.fillText(totalLabel(snap.totals).toUpperCase(), pad + 80, chipY + 26);

  ctx.fillStyle = colors.ink;
  ctx.font = '700 68px "Geist Mono", monospace';
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
  drawLine(ctx, `Holiday hours · ${fmtH(snap.totals.holidayHours)}h`, fmt(snap.totals.holidayPay), pad + 70, y, W - 2 * pad - 140, colors); y += 38;
  drawLine(ctx, `OT hours · ${fmtH(snap.totals.otHours)}h`, fmt(snap.totals.overtimePay), pad + 70, y, W - 2 * pad - 140, colors); y += 50;

  // Leave and exchanges: a record only (their effect is already in the
  // totals above). One line each, while there's room above the footer.
  const plural = (n) => `${n} shift${n === 1 ? "" : "s"}`;
  const leaveN = Number(snap.totals.leaveShifts) || 0;
  const exchN = Number(snap.totals.exchangedShifts) || 0;
  const coverN = Number(snap.totals.duties?.exchangeFor) || 0;
  const notes = [
    leaveN > 0 && [`On leave · ${plural(leaveN)} · ${fmtH(snap.totals.leaveHours)}h`, "no allowance"],
    exchN > 0 && [`Exchange leave · ${plural(exchN)}`, "not paid"],
    coverN > 0 && [`Exchange for · ${plural(coverN)}`, "paid as normal"],
  ].filter(Boolean);
  for (const [label, value] of notes) {
    if (y >= H - pad - 110) break;
    drawLine(ctx, label, value, pad + 70, y, W - 2 * pad - 140, colors);
    y += 38;
  }

  // footer
  ctx.fillStyle = colors.faint;
  ctx.font = '500 20px "Geist Mono", monospace';
  ctx.textAlign = "center";
  ctx.fillText("Night Shift Calculator · Estimate only · Saved " + new Date(snap.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), W / 2, H - pad - 60);
  ctx.textAlign = "left";

  return canvas;
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
  ctx.font = '600 26px "Geist", system-ui';
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + 32, y + 28);
  ctx.font = '700 28px "Geist Mono", monospace';
  ctx.textAlign = "right";
  ctx.fillText(fmt(subtotal), x + w - 16, y + 28);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  return y + 76;
}

function drawLine(ctx, label, value, x, y, w, colors) {
  ctx.fillStyle = colors.dim;
  ctx.font = '500 22px "Geist", system-ui';
  ctx.fillText(label, x, y);
  ctx.fillStyle = colors.ink;
  ctx.font = '500 22px "Geist Mono", monospace';
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
