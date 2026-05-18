/* share.jsx — render snapshot as PNG image for sharing */

function renderSnapshotCanvas(snap, theme = "dark") {
  const W = 1080, H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const isDark = theme !== "light";
  const colors = isDark ? {
    bg: "#0b0b0c",
    card: "#131316",
    line: "#2a2b33",
    ink: "#f4f4f5",
    dim: "#a1a1aa",
    faint: "#6b6b73",
    accent: "#e8a661",
    accentInk: "#0b0b0c",
    sp1: "#7eb3e0",
    sp2: "#a48cd8",
    am: "#86c69d",
  } : {
    bg: "#faf9f7",
    card: "#ffffff",
    line: "#d8d4cb",
    ink: "#1a1815",
    dim: "#6a665f",
    faint: "#93908a",
    accent: "#a06226",
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
  ctx.fillText("NIGHT SHIFT · " + (snap.mode === "basic" ? "QUICK" : "DETAILED").toUpperCase(), pad + 50, pad + 50);

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
  ctx.fillText("ESTIMATED GROSS", pad + 80, chipY + 26);

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
  drawLine(ctx, "Compulsory Allowance", fmt(snap.totals.compulsory), pad + 70, y, W - 2 * pad - 140, colors); y += 50;

  y = drawSection(ctx, "Extra Hours", snap.totals.extraSubtotal, pad + 50, y, W - 2 * pad - 100, colors.sp2, colors);
  drawLine(ctx, `Holiday hours · ${fmtH(snap.totals.holidayHours)}h`, fmt(snap.totals.holidayPay), pad + 70, y, W - 2 * pad - 140, colors); y += 38;
  drawLine(ctx, `OT hours · ${fmtH(snap.totals.otHours)}h`, fmt(snap.totals.overtimePay), pad + 70, y, W - 2 * pad - 140, colors); y += 50;

  // footer
  ctx.fillStyle = colors.faint;
  ctx.font = '500 20px "Geist Mono", monospace';
  ctx.textAlign = "center";
  ctx.fillText("Night Shift Calculator · " + new Date(snap.at).toLocaleDateString(), W / 2, H - pad - 60);
  ctx.textAlign = "left";

  return canvas;
}

function drawSection(ctx, label, subtotal, x, y, w, accent, colors) {
  drawRoundedRect(ctx, x, y, w, 56, 12);
  ctx.fillStyle = colors.card === "#131316" ? "#1a1a1f" : "#f3f1ec";
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
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `night-shift-${snap.periodKey || "snapshot"}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

async function copySnapshotImage(snap, theme) {
  const canvas = renderSnapshotCanvas(snap, theme);
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject();
      try {
        if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          resolve(true);
        } else {
          reject(new Error("Clipboard image not supported"));
        }
      } catch (e) { reject(e); }
    }, "image/png");
  });
}

Object.assign(window, { renderSnapshotCanvas, downloadSnapshotImage, copySnapshotImage });
