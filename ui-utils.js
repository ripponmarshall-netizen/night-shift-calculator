/** @param {HTMLInputElement|null} el */
function val(el) {
  return el ? parseFloat(el.value) || 0 : 0;
}

/** @param {string} id @param {Record<string, HTMLInputElement|null>} map */
function valById(id, map) {
  return val(map[id]);
}

/** @param {number} n */
function round2(n) {
  return Math.round(n * 100) / 100;
}

/** @param {number} n */
function fmt(n) {
  return (
    "$" +
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/** @param {number} n */
function fmtHrs(n) {
  return n.toFixed(2);
}

window.NSUIUtils = { val, valById, round2, fmt, fmtHrs };
