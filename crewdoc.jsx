/* crewdoc.jsx — the crew as Word record sheets (.docx): one JFB "Regular and
   Overtime Record Sheet" per person, on legal paper, laid out like the paper
   form. Built by hand (WordprocessingML + a stored ZIP), so it needs no
   library and works offline. Pure JS, no JSX — Node-loadable for tests.
   Input is a crew save (crewSnapshot) or the same shape built live. */
(function () {
  const H = typeof module !== "undefined" && module.exports ? require("./helpers.jsx") : window;

  /* ----- XML pieces ----- */
  // XML 1.0 can't hold most control characters; drop them, then escape.
  const esc = (v) => String(v ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const RED = "C00000";

  /* A run of text. o: { b, sz (points), color } */
  function run(text, o = {}) {
    const pr = (o.b ? "<w:b/>" : "") + (o.color ? `<w:color w:val="${o.color}"/>` : "") + (o.sz ? `<w:sz w:val="${o.sz * 2}"/><w:szCs w:val="${o.sz * 2}"/>` : "");
    return `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ""}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
  }
  /* A paragraph. o: { jc, before, after, breakBefore } */
  function para(runs, o = {}) {
    const pr = (o.breakBefore ? "<w:pageBreakBefore/>" : "")
      + `<w:spacing w:before="${o.before || 0}" w:after="${o.after || 0}"/>`
      + (o.jc ? `<w:jc w:val="${o.jc}"/>` : "");
    return `<w:p><w:pPr>${pr}</w:pPr>${Array.isArray(runs) ? runs.join("") : runs || ""}</w:p>`;
  }
  const side = (name, on) => `<w:${name} w:val="${on ? "single" : "nil"}" w:sz="6" w:space="0" w:color="000000"/>`;
  /* A table cell. o: { box (all borders), bottom (bottom border only), span, v (vertical align) } */
  function cell(w, content, o = {}) {
    const b = o.box ? [1, 1, 1, 1] : [0, 0, o.bottom ? 1 : 0, 0];
    const pr = `<w:tcW w:w="${w}" w:type="dxa"/>`
      + (o.span ? `<w:gridSpan w:val="${o.span}"/>` : "")
      + `<w:tcBorders>${side("top", b[0])}${side("left", b[1])}${side("bottom", b[2])}${side("right", b[3])}</w:tcBorders>`
      + `<w:vAlign w:val="${o.v || "top"}"/>`;
    return `<w:tc><w:tcPr>${pr}</w:tcPr>${content || para("")}</w:tc>`;
  }
  /* A table of rows; each row: { h, cells }. Widths in DXA must sum to 10800. */
  function table(widths, rows) {
    const total = widths.reduce((a, b) => a + b, 0);
    const grid = widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("");
    const body = rows.map((r) => `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="${r.h}" w:hRule="atLeast"/></w:trPr>${r.cells.join("")}</w:tr>`).join("");
    return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/><w:tblLayout w:type="fixed"/>`
      + '<w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>'
      + `<w:tblGrid>${grid}</w:tblGrid>${body}</w:tbl>`;
  }

  /* ----- one record sheet ----- */
  const num = (v) => {
    const n = Number(v) || 0;
    return n.toLocaleString("en-JM", { maximumFractionDigits: 2 });
  };
  // Hours in the unit the result was counted in (16.67 or 16h 40m).
  const hrs = (v, r) => (Number(v) > 0 ? (H.inMinutes(r) ? H.fmtHM(v) : H.fmtH0(v)) : "");
  const SHIFT_ROWS = [["am7", "7am-3pm"], ["pm3", "3pm-10pm"], ["pm10", "10pm-7am"]];

  /* 14 date boxes per shift (two blocks of 7). A rotation's col keeps each
     4-day cycle in its own column; otherwise dates fill in order. Any spill
     past the last box shares it. */
  function boxes(items) {
    const out = Array.from({ length: 14 }, () => []);
    (items || []).forEach((it, i) => out[Math.min(13, it.col != null ? it.col : i)].push(it));
    return out;
  }
  const dateCell = (w, list) => cell(w, para(list.flatMap((it, i) => [
    i > 0 ? run(", ", { sz: 8 }) : "",
    run(it.d, { sz: 8 }),
    it.code ? run(" " + it.code, { sz: 8, color: RED }) : "",
  ])), { box: true });

  // Label · 7 date boxes · gap · right label · right value
  const GRID = [1400, 950, 950, 950, 950, 950, 950, 950, 350, 1100, 1300];
  const LEFT = GRID.slice(0, 8).reduce((a, b) => a + b, 0);
  /* One REGULAR TIME or OVERTIME block: two sets of 7AM / 3PM / 10PM rows
     with a spacer between, and the side boxes down the right. side: one
     entry per row (7, the spacer 4th): [label, value] | { span } | null. */
  function shiftGrid(part, sideBoxes) {
    const cells = Object.fromEntries(SHIFT_ROWS.map(([k]) => [k, boxes(part?.[k])]));
    const rows = [];
    for (let r = 0; r < 7; r++) {
      const s = sideBoxes[r];
      const right = !s ? [cell(GRID[9]), cell(GRID[10])]
        : s.span ? [cell(GRID[9] + GRID[10], para(run(s.span, { sz: 9 })), { box: true, span: 2 })]
        : [cell(GRID[9], para(run(s[0], { sz: 9 })), { box: true }), cell(GRID[10], para(run(s[1], { sz: 9 })), { box: true })];
      if (r === 3) {
        rows.push({ h: 420, cells: [cell(LEFT, null, { span: 8 }), cell(GRID[8]), ...right] });
        continue;
      }
      const [k, label] = SHIFT_ROWS[r < 3 ? r : r - 4];
      const block = r < 3 ? 0 : 7;
      rows.push({
        h: 540,
        cells: [
          cell(GRID[0], para(run(label, { sz: 9 })), { box: true }),
          ...cells[k].slice(block, block + 7).map((list, i) => dateCell(GRID[1 + i], list)),
          cell(GRID[8]),
          ...right,
        ],
      });
    }
    return table(GRID, rows);
  }

  function sheet(snap, row, first) {
    const m = row.member || {}, t = row.totals || {}, d = t.duties || {};
    const sh = row.sheet || {};
    const leave = (k) => (Number(d[k]) > 0 ? String(d[k]) : "nil");
    const notes = [
      Number(d.timeoff) > 0 && `T/O taken: ${d.timeoff}`,
      Number(d.orderly) > 0 && `Orderly duty: ${d.orderly}`,
    ].filter(Boolean).join(" · ");
    const label = (text, after = 0) => para(run(text, { sz: 9 }), { after });
    const out = [];
    // Each sheet after the first starts a new page.
    if (!first) out.push(para("", { breakBefore: true }));
    out.push(snap.watch
      ? table([1800, 9000], [{ h: 420, cells: [cell(1800, para(run(snap.watch, { sz: 11 })), { box: true, v: "center" }), cell(9000)] }])
      : para(""));
    const title = (text, b = true) => para(run(text, { b, sz: 10 }), { jc: "center", before: 200 });
    out.push(title("JAMAICA FIRE BRIGADE"), title("REGULAR AND OVERTIME RECORD SHEET"), title("(Allowances)"));
    const per = H.periodFor(H.fromYmd(snap.periodKey));
    out.push(title(`Period: ${H.periodLong(per)}`, false));
    out.push(para("", { after: 300 }));
    const lab = (w, text, v = "bottom") => cell(w, para(run(text, { sz: 9 }), { jc: "right" }), { v });
    const val = (w, text) => cell(w, para(run(text, { b: true, sz: 9 }), { jc: "center" }), { bottom: true, v: "bottom" });
    out.push(table([1300, 1100, 900, 1300, 900, 2700, 1100, 1500], [{
      h: 520,
      cells: [lab(1300, "EMP #:"), val(1100, m.empNo), lab(900, "RANK:"), val(1300, m.rank), lab(900, "NAME:"), val(2700, m.name), lab(1100, "STATION:"), val(1500, snap.station)],
    }]));
    out.push(para("", { after: 300 }), label("REGULAR TIME", 160));
    out.push(shiftGrid(sh.regular, [
      ["S/P 1", num(t.sp1)], ["S/P 2", num(t.sp2)], null, ["M/A", num(t.meal)], ["T/A", num(t.taxi)], null, ["S:", ""],
    ]));
    out.push(para("", { after: 300 }), label("OVERTIME", 160));
    out.push(shiftGrid(sh.overtime, [
      { span: "Hours of Overtime" }, ["Worked:", hrs((Number(t.otHours) || 0) + (Number(t.holidayHours) || 0), t.rates)], null, null,
      ["T&H:", hrs(t.otHours, t.rates)], null, ["D:", hrs(t.holidayHours, t.rates)],
    ]));
    out.push(para("", { after: 240 }));
    const box = (w, text) => cell(w, para(run(text, { sz: 9 }), { jc: "center" }), { box: true, v: "center" });
    out.push(table([1300, 900, 1500, 900, 1500, 900, 3800], [{
      h: 440,
      cells: [lab(1300, "S/L Taken", "center"), box(900, leave("sick")), lab(1500, "D/L Taken:", "center"), box(900, leave("departmental")), lab(1500, "V/L Taken", "center"), box(900, leave("vacation")), cell(3800)],
    }]));
    out.push(para("", { after: 200 }), label("REMARKS:"));
    // Ruled lines as table rows: back-to-back bordered paragraphs would
    // merge into one box with a single line under it.
    out.push(table([10800], [
      { h: 520, cells: [cell(10800, para(run(notes, { sz: 9 })), { bottom: true, v: "bottom" })] },
      { h: 620, cells: [cell(10800, null, { bottom: true })] },
    ]));
    out.push(para("", { after: 400 }));
    const sig = (labels) => ({
      h: 600,
      cells: labels.flatMap((l, i) => [
        cell([1600, 1900, 1900][i], para(run(l, { sz: 9 })), { v: "bottom" }),
        cell([1700, 1500, 1600][i], null, { bottom: true, v: "bottom" }),
        ...(i < 2 ? [cell(300)] : []),
      ]),
    });
    out.push(table([1600, 1700, 300, 1900, 1500, 300, 1900, 1600], [
      sig(["Claimant's Name:", "District Officer's Name:", "Certifying Officer's Name:"]),
      sig(["Claimant's Signature:", "District Officer's Signature:", "Certifying Officer's Signature:"]),
      sig(["Date:", "Date:", "Date:"]),
    ]));
    return out.join("");
  }

  function documentXml(snap) {
    const rows = snap.rows || [];
    const body = rows.length ? rows.map((r, i) => sheet(snap, r, i === 0)).join("") : para(run("No people saved for this period."));
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + `<w:body>${body}${para("")}`
      // Legal paper (8.5 × 14 in), as the JFB sheet uses.
      + '<w:sectPr><w:pgSz w:w="12240" w:h="20160" w:code="5"/><w:pgMar w:top="709" w:right="720" w:bottom="567" w:left="720" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>'
      + "</w:body></w:document>";
  }

  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    + '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>'
    + '<w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-JM"/></w:rPr></w:rPrDefault>'
    + '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
    + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
    + '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/>'
    + '<w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>'
    + "</w:styles>";
  const CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
    + "</Types>";
  const ROOT_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    + "</Relationships>";
  const DOC_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    + "</Relationships>";

  /* ----- ZIP (stored, no compression) ----- */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function zipStore(files) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    // 1 Jan 2026, 00:00 (DOS date/time), so the same crew gives the same file.
    const DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
    for (const f of files) {
      const name = enc.encode(f.name);
      const data = typeof f.data === "string" ? enc.encode(f.data) : f.data;
      const crc = crc32(data);
      const head = (size, sig) => {
        const b = new Uint8Array(size + name.length);
        const v = new DataView(b.buffer);
        v.setUint32(0, sig, true);
        return { b, v };
      };
      const l = head(30, 0x04034b50);
      l.v.setUint16(4, 20, true); l.v.setUint16(6, 0x0800, true); l.v.setUint16(8, 0, true);
      l.v.setUint16(10, 0, true); l.v.setUint16(12, DATE, true);
      l.v.setUint32(14, crc, true); l.v.setUint32(18, data.length, true); l.v.setUint32(22, data.length, true);
      l.v.setUint16(26, name.length, true); l.v.setUint16(28, 0, true);
      l.b.set(name, 30);
      const c = head(46, 0x02014b50);
      c.v.setUint16(4, 20, true); c.v.setUint16(6, 20, true); c.v.setUint16(8, 0x0800, true); c.v.setUint16(10, 0, true);
      c.v.setUint16(12, 0, true); c.v.setUint16(14, DATE, true);
      c.v.setUint32(16, crc, true); c.v.setUint32(20, data.length, true); c.v.setUint32(24, data.length, true);
      c.v.setUint16(28, name.length, true);
      c.v.setUint32(42, offset, true);
      c.b.set(name, 46);
      parts.push(l.b, data);
      central.push(c.b);
      offset += l.b.length + data.length;
    }
    const cdSize = central.reduce((a, b) => a + b.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
    const all = [...parts, ...central, end];
    const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
    let p = 0;
    for (const b of all) { out.set(b, p); p += b.length; }
    return out;
  }

  /* The .docx bytes for a crew save. */
  function crewDocx(snap) {
    return zipStore([
      { name: "[Content_Types].xml", data: CONTENT_TYPES },
      { name: "_rels/.rels", data: ROOT_RELS },
      { name: "word/document.xml", data: documentXml(snap) },
      { name: "word/_rels/document.xml.rels", data: DOC_RELS },
      { name: "word/styles.xml", data: STYLES },
    ]);
  }
  /* A file name like "D-WATCH-record-sheets-2026-06-16.docx". */
  function crewDocxName(snap) {
    const w = String(snap.watch || "watch").trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "watch";
    return `${w}-record-sheets-${snap.periodKey}.docx`;
  }
  const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  const api = { crewDocx, crewDocxName, documentXml, zipStore, crc32, DOCX_TYPE };
  if (typeof window !== "undefined") Object.assign(window, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
