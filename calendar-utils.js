/** @param {number} n */
function pad2(n) {
  return n < 10 ? "0" + n : "" + n;
}

/** @param {Date} d */
function toYMD(d) {
  return (
    d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate())
  );
}

/** @param {string} s */
function fromYMD(s) {
  if (typeof s !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = +m[1],
    mo = +m[2] - 1,
    da = +m[3];
  const d = new Date(y, mo, da);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== da)
    return null;
  return d;
}

/** @param {Date} d @param {number} n */
function addDays(d, n) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

/** @param {Date} a @param {Date} b */
function sameYMD(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** @param {string} code @param {string[]} shiftOrder */
function nextShiftCode(code, shiftOrder) {
  const idx = shiftOrder.indexOf(code);
  return shiftOrder[(idx + 1) % shiftOrder.length];
}

window.NSCalendarUtils = {
  pad2,
  toYMD,
  fromYMD,
  addDays,
  sameYMD,
  nextShiftCode,
};
