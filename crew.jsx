/* crew.jsx — Crew: several people on the same shift. One shared crew
   calendar, each person's own days that differ (leave, swaps, extras), their
   pay and taxi distance, and one report for everyone (copy or CSV). It never
   computes pay itself: memberTotals runs the same aggregate() as every other
   screen on each person's calendar. */
const { useState: useStateW, useMemo: useMemoW, useEffect: useEffectW, useRef: useRefW } = React;

function CrewView({ period, crew, setCrew, myEntries, myRotation, rates, tax, onShiftPeriod }) {
  const [openId, setOpenId] = useStateW(null);
  const [dayEdit, setDayEdit] = useStateW(null); // { who: "crew" | member id, key }
  const [fillOpen, setFillOpen] = useStateW(false);
  const member = crew.members.find((m) => m.id === openId) || null;

  // A person's page holds a history entry while it's open, so the phone's
  // Back button returns to the crew list instead of leaving the screen.
  const layerRef = useRefW(null);
  useEffectW(() => {
    if (!openId) return;
    const layer = openBackLayer(() => setOpenId(null));
    layerRef.current = layer;
    return () => {
      if (layerRef.current !== layer) return;
      layerRef.current = null;
      closeBackLayer(layer);
    };
  }, [openId]);
  const closePerson = () => {
    const layer = layerRef.current;
    layerRef.current = null;
    if (layer) closeBackLayer(layer);
    setOpenId(null);
  };
  React.useLayoutEffect(() => { window.scrollTo?.(0, 0); }, [openId]);

  const crewTotals = useMemoW(
    () => aggregate(crew.entries, period, "basic", "S", null, {}, rates),
    [crew.entries, period, rates]
  );
  const rows = useMemoW(() => crewRows(crew, period, rates, tax), [crew, period, rates, tax]);

  /* ----- crew calendar ----- */
  const setCrewEntries = (fn) => setCrew((c) => ({ ...c, entries: fn(c.entries) }));
  const replacePeriod = (fill, anchor, message) => {
    const before = crew;
    setCrew((c) => ({
      ...c,
      entries: mergePeriodFill(c.entries, period, fill, true),
      ...(anchor !== undefined ? { rotationAnchor: anchor } : {}),
    }));
    showToast(message, { action: { label: "Undo", onClick: () => setCrew((c) => ({ ...c, entries: before.entries, rotationAnchor: before.rotationAnchor })) } });
  };
  const copyMine = () => {
    const fill = {};
    for (const d of periodDays(period)) {
      const day = crewDayFrom(myEntries[ymd(d)]);
      if (day) fill[ymd(d)] = day;
    }
    if (!Object.values(fill).some(hasShifts)) { showToast("No shifts on your own calendar this period"); return; }
    replacePeriod(fill, myRotation || null, "Crew shifts copied from yours");
  };
  const clearCrew = async () => {
    const ok = await askConfirm({
      title: `Clear the crew's shifts for ${periodLabel(period)}?`,
      body: "Everyone's days that differ from the crew are kept.",
      confirmLabel: "Clear shifts", danger: true,
    });
    if (ok) replacePeriod({}, undefined, "Crew shifts cleared");
  };

  /* ----- people ----- */
  const updateMember = (id, fn) => setCrew((c) => ({ ...c, members: c.members.map((m) => (m.id === id ? fn(m) : m)) }));
  const addMember = (name, empNo) => {
    const m = newMember(name, empNo);
    setCrew((c) => ({ ...c, members: [...c.members, m] }));
    showToast(`Added ${m.name || "person"}`);
  };
  const removeMember = async (m) => {
    const ok = await askConfirm({
      title: `Remove ${m.name || "this person"}?`,
      body: "Their pay, taxi distance and days that differ from the crew are removed too.",
      confirmLabel: "Remove", danger: true,
    });
    if (!ok) return;
    closePerson();
    setCrew((c) => ({ ...c, members: c.members.filter((x) => x.id !== m.id) }));
    showToast(`Removed ${m.name || "person"}`, { action: { label: "Undo", onClick: () => setCrew((c) => (c.members.some((x) => x.id === m.id) ? c : { ...c, members: [...c.members, m] })) } });
  };

  /* ----- day editor (crew day, or one person's day) ----- */
  const editing = dayEdit && (dayEdit.who === "crew" ? "crew" : crew.members.find((m) => m.id === dayEdit.who));
  const editEntry = !editing ? null
    : editing === "crew" ? crew.entries[dayEdit.key]
    : memberEntries(crew.entries, editing)[dayEdit.key];
  const onDayChange = (updater) => {
    const { who, key } = dayEdit;
    const clone = (e) => (e ? { ...e, dist: { ...(e.dist || blankDay().dist) } } : blankDay());
    if (who === "crew") {
      setCrewEntries((prev) => {
        const next = { ...prev };
        const updated = updater(clone(prev[key]));
        if (!hasShifts(updated) && updated.holiday == null) delete next[key]; else next[key] = updated;
        return next;
      });
    } else {
      setCrew((c) => {
        const m = c.members.find((x) => x.id === who);
        if (!m) return c;
        const updated = updater(clone(memberEntries(c.entries, m)[key]));
        return { ...c, members: c.members.map((x) => (x.id === who ? setMemberDay(c.entries, x, key, updated) : x)) };
      });
    }
  };
  const onDayClear = () => {
    const { who, key } = dayEdit;
    if (who === "crew") {
      const prev = crew.entries[key];
      setCrewEntries((p) => { const n = { ...p }; delete n[key]; return n; });
      if (hasShifts(prev)) showToast("Crew day cleared", { action: { label: "Undo", onClick: () => setCrewEntries((p) => ({ ...p, [key]: prev })) } });
    } else {
      const before = crew.members.find((x) => x.id === who);
      updateMember(who, (m) => setMemberDay(crew.entries, m, key, blankDay()));
      if (before) showToast("Day cleared", { action: { label: "Undo", onClick: () => updateMember(who, (m) => ({ ...m, days: before.days })) } });
    }
  };

  return (
    <>
      {member ? (
        <CrewPersonPage key={member.id}
          period={period} crew={crew} member={member} rates={rates} tax={tax}
          dupe={!!member.empNo && crew.members.some((x) => x.id !== member.id && x.empNo && x.empNo.toLowerCase() === member.empNo.toLowerCase())}
          onShiftPeriod={onShiftPeriod}
          onBack={closePerson}
          onChange={(fn) => updateMember(member.id, fn)}
          onOpenDay={(d) => setDayEdit({ who: member.id, key: ymd(d) })}
          onRemove={() => removeMember(member)}
        />
      ) : (
        <main key="crew" className="nsc-view" style={{ maxWidth: 720, margin: "0 auto", padding: "16px 20px 0" }}>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <PeriodNav period={period} onShift={onShiftPeriod} style={{ padding: "14px 16px 8px" }} />
            <div style={{ padding: "0 16px 10px" }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Crew shift</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-dim)", marginTop: 2, lineHeight: 1.45 }}>
                The shifts everyone on the crew works. Each person starts from this calendar; open a person to mark their leave, swaps or extra shifts.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                <button onClick={() => setFillOpen(true)} style={crewToolBtn}>Fill rotation</button>
                <button onClick={copyMine} style={crewToolBtn}>Copy my shifts</button>
                {periodDays(period).some((d) => crew.entries[ymd(d)]) && <button onClick={clearCrew} style={crewToolBtn}>Clear</button>}
              </div>
            </div>
            <div style={{ padding: "0 12px" }}>
              <Calendar compact period={period} entries={crew.entries} mode="basic" totals={crewTotals}
                rotationAnchor={crew.rotationAnchor} onOpenDay={(d) => setDayEdit({ who: "crew", key: ymd(d) })} />
            </div>
            <div style={{ padding: "6px 16px 14px", fontSize: 12, color: "var(--ink-dim)" }}>
              <span className="mono" style={{ color: "var(--ink)" }}>{crewTotals.cal.am7}</span> 7AM ·{" "}
              <span className="mono" style={{ color: "var(--ink)" }}>{crewTotals.cal.pm3}</span> 3PM ·{" "}
              <span className="mono" style={{ color: "var(--ink)" }}>{crewTotals.cal.pm10}</span> 10PM ·{" "}
              <span className="mono" style={{ color: "var(--ink)" }}>{fmtH0(crewTotals.totalHours)}</span>h
            </div>
          </Card>

          <CrewPeople crew={crew} rows={rows} period={period}
            onSort={(v) => setCrew((c) => ({ ...c, sortBy: v }))}
            onAdd={addMember} onOpen={setOpenId} />

          {rows.length > 0 && <CrewTotals rows={rows} period={period} />}
        </main>
      )}

      {editing && (
        <DayModal
          key={dayEdit.who + dayEdit.key}
          dayKey={dayEdit.key}
          entry={editEntry || blankDay()}
          mode="basic"
          slot={rotationSlot(dayEdit.key, crew.rotationAnchor)}
          defaultDist={editing === "crew" ? "S" : editing.dist}
          onClose={() => setDayEdit(null)}
          onChange={onDayChange}
          onClear={onDayClear}
        />
      )}
      {fillOpen && (
        <CrewFillModal period={period} anchor={crew.rotationAnchor || myRotation}
          onApply={(key) => replacePeriod(rotationEntries(period, key, "S"), key, "Crew rotation filled")}
          onClose={() => setFillOpen(false)} />
      )}
    </>
  );
}

const crewToolBtn = { ...ghostBtn(), padding: "7px 11px", fontSize: 12.5 };

/* ----- the list of people, with quick add ----- */
function CrewPeople({ crew, rows, period, onSort, onAdd, onOpen }) {
  const [name, setName] = useStateW("");
  const [empNo, setEmpNo] = useStateW("");
  const nameRef = useRefW(null);
  const taken = (no) => !!no && crew.members.some((m) => m.empNo && m.empNo.toLowerCase() === no.trim().toLowerCase());
  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) { nameRef.current?.focus(); return; }
    onAdd(name, empNo);
    setName(""); setEmpNo("");
    nameRef.current?.focus();
  };
  // An employee number used twice is almost always a typo.
  const counts = {};
  for (const m of crew.members) if (m.empNo) counts[m.empNo.toLowerCase()] = (counts[m.empNo.toLowerCase()] || 0) + 1;

  return (
    <Card>
      <SectionHead
        title={`People${rows.length ? ` · ${rows.length}` : ""}`}
        subtitle="Same shift, each with their own pay and taxi"
        right={rows.length > 1 && (
          <SegToggle small options={[{ v: "name", l: "Name" }, { v: "empNo", l: "Emp. no." }]} value={crew.sortBy} onChange={onSort} />
        )}
      />

      {rows.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--ink-dim)", lineHeight: 1.5, marginBottom: 12 }}>
          Add everyone on the shift by name and employee number. Each person's pay is worked out from the crew calendar above.
        </div>
      )}

      {rows.map(({ member: m, totals: t }, i) => {
        const diff = memberDiffKeys(m, period).length;
        const dupe = m.empNo && counts[m.empNo.toLowerCase()] > 1;
        return (
          <AnimatedRow key={m.id} index={i} gap={6}>
            <button onClick={() => onOpen(m.id)} style={{
              display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 12px",
              background: "var(--bg-2)", border: "1px solid var(--line-soft)", borderRadius: 12,
              color: "var(--ink)", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
              transition: "background 0.18s, var(--press)",
            }}>
              <CrewAvatar name={m.name} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name || "Unnamed"}</div>
                <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2, lineHeight: 1.4 }}>
                  {m.empNo ? <span className="mono" style={{ color: dupe ? "var(--warn)" : undefined }}>#{m.empNo}{dupe ? " (used twice)" : ""}</span> : "No emp. no."}
                  {" · "}{m.dist === "L" ? "Long" : "Short"} taxi
                  {diff > 0 && <> · <span style={{ color: "var(--extra)" }}>{diff} day{diff === 1 ? "" : "s"} different</span></>}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{fmt(t.grand)}</div>
                <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 2 }}>{totalLabel(t, true)}</div>
              </div>
            </button>
          </AnimatedRow>
        );
      })}

      <form onSubmit={submit} style={{ marginTop: rows.length ? 10 : 0, padding: 12, borderRadius: 12, border: "1px dashed var(--line)" }}>
        <div className="label" style={{ marginBottom: 8 }}>Add a person</div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)", gap: 8 }}>
          <CrewField inputRef={nameRef} label="Name" value={name} onChange={setName} placeholder="e.g. R. Marshall" capitalize="words" />
          <CrewField label="Employee no." value={empNo} onChange={setEmpNo} placeholder="e.g. 10234" capitalize="characters" />
        </div>
        {taken(empNo) && <div style={{ fontSize: 12, color: "var(--warn)", marginTop: 6 }}>Someone on the crew already has this employee number.</div>}
        <button type="submit" style={{ ...accentBtn(), width: "100%", marginTop: 10 }}>Add to crew</button>
      </form>
    </Card>
  );
}

function CrewAvatar({ name }) {
  const initials = String(name || "?").split(/[\s.]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
  return (
    <span aria-hidden className="mono" style={{
      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: "color-mix(in oklab, var(--accent) 16%, var(--bg-1))", color: "var(--accent)",
      fontSize: 13, fontWeight: 700,
    }}>{initials}</span>
  );
}

function CrewField({ label, value, onChange, placeholder, capitalize, inputRef }) {
  return (
    <label style={{ display: "block", minWidth: 0 }}>
      <div className="label" style={{ marginBottom: 6 }}>{label}</div>
      <input ref={inputRef} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        autoComplete="off" autoCapitalize={capitalize} spellCheck={false} maxLength={60}
        style={{ width: "100%", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", color: "var(--ink)", fontSize: 16, fontFamily: "inherit" }} />
    </label>
  );
}

/* ----- the whole crew: totals and the report ----- */
function CrewTotals({ rows, period }) {
  const sum = (f) => rows.reduce((a, r) => a + (Number(r.totals[f]) || 0), 0);
  const allow = sum("allowanceSubtotal"), gross = sum("grand");
  const anyBase = rows.some((r) => Number(r.totals.baseSubtotal) > 0);
  const label = periodLabel(period);
  const downloadCsv = () => {
    // The BOM tells Excel the file is UTF-8, so accented names survive.
    downloadBlob(new Blob(["﻿" + crewCsv(rows, label)], { type: "text/csv" }), `crew-${periodKey(period)}.csv`);
  };
  return (
    <Card>
      <SectionHead title="Crew totals" subtitle={`${rows.length} ${rows.length === 1 ? "person" : "people"} · ${label}`} />
      <Row label="Allowances (SP1, SP2, meal, taxi)" value={fmt(allow)} />
      {anyBase && <Row label="Base pay + extra hours" value={fmt(gross - allow)} />}
      <Sub label={anyBase ? "Crew gross" : "Crew allowances"} value={fmt(gross)} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginTop: 14 }}>
        <button onClick={() => copyText(crewText(rows, label), "Crew summary copied")} style={ghostBtn()}>Copy crew summary</button>
        <button onClick={downloadCsv} style={ghostBtn()}>Download CSV</button>
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 8, lineHeight: 1.45 }}>
        The CSV has one row per person (name, employee number, shifts, hours and every pay line) and opens in Excel, Numbers or Google Sheets.
      </div>
    </Card>
  );
}

/* ----- one person ----- */
function CrewPersonPage({ period, crew, member: m, dupe, rates, tax, onShiftPeriod, onBack, onChange, onOpenDay, onRemove }) {
  const entries = useMemoW(() => memberEntries(crew.entries, m), [crew.entries, m]);
  const t = useMemoW(() => memberTotals(crew.entries, m, period, rates), [crew.entries, m, period, rates]);
  const diffs = memberDiffKeys(m, period);
  const showNet = netApplies(t, tax);
  const net = showNet ? estimateNet(t, tax).net : null;
  const setPay = (k, v) => onChange((x) => ({ ...x, basePay: { ...x.basePay, [k]: sanitizeDecimal(v) } }));
  const matchCrew = (key) => onChange((x) => { const days = { ...x.days }; delete days[key]; return { ...x, days }; });
  const matchAll = () => {
    const before = m.days;
    onChange((x) => { const days = { ...x.days }; for (const k of diffs) delete days[k]; return { ...x, days }; });
    showToast("Matched to the crew", { action: { label: "Undo", onClick: () => onChange((x) => ({ ...x, days: before })) } });
  };
  const copySummary = () => {
    const who = (m.name || "Unnamed") + (m.empNo ? ` · #${m.empNo}` : "");
    copyText(who + "\n" + summaryText(t, periodLabel(period), net), "Summary copied");
  };

  return (
    <main className="nsc-view" style={{ maxWidth: 720, margin: "0 auto", padding: "16px 20px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={{ ...ghostBtn(), padding: "8px 12px" }}>‹ Crew</button>
        <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {m.name || "Unnamed"}
        </div>
      </div>

      <Card>
        <SectionHead title="Details" subtitle="Saved as you type" />
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)", gap: 10 }}>
          <CrewField label="Name" value={m.name} onChange={(v) => onChange((x) => ({ ...x, name: v.slice(0, 60) }))} capitalize="words" />
          <CrewField label="Employee no." value={m.empNo} onChange={(v) => onChange((x) => ({ ...x, empNo: v.slice(0, 30) }))} capitalize="characters" />
        </div>
        {dupe && <div style={{ fontSize: 12, color: "var(--warn)", marginTop: 6 }}>Someone else on the crew has this employee number.</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12, alignItems: "end" }}>
          <RateInput label="Monthly basic" unit="$" value={m.basePay.monthly} onChange={(v) => setPay("monthly", v)} />
          <RateInput label="Compulsory" unit="$" value={m.basePay.compulsory} onChange={(v) => setPay("compulsory", v)} />
        </div>
        <div className="label" style={{ margin: "12px 0 6px" }}>Taxi distance</div>
        <SegToggle full options={[{ v: "S", l: "Short" }, { v: "L", l: "Long" }]} value={m.dist} onChange={(v) => onChange((x) => ({ ...x, dist: v }))} />
        <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 8, lineHeight: 1.45 }}>
          Leave the monthly basic blank to work out allowances only.
        </div>
      </Card>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <PeriodNav period={period} onShift={onShiftPeriod} style={{ padding: "14px 16px 8px" }} />
        <div style={{ padding: "0 16px 10px", fontSize: 12.5, color: "var(--ink-dim)", lineHeight: 1.45 }}>
          The crew's shifts, plus {m.name ? `${m.name}'s` : "this person's"} own changes. Tap a day to mark leave, a swap or an extra shift.
        </div>
        <div style={{ padding: "0 12px" }}>
          <Calendar compact period={period} entries={entries} mode="basic" totals={t} rotationAnchor={crew.rotationAnchor} onOpenDay={onOpenDay} />
        </div>
        {diffs.length > 0 && (
          <div style={{ padding: "8px 16px 14px", borderTop: "1px solid var(--line-soft)" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
              <span className="label">Different from the crew</span>
              {diffs.length > 1 && <button onClick={matchAll} style={linkBtn(12.5)}>Match all</button>}
            </div>
            {diffs.map((k) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px dashed var(--line-soft)", fontSize: 13 }}>
                <span style={{ width: 92, flexShrink: 0, color: "var(--ink-dim)" }}>{fromYmd(k).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  {crewDayText(crew.entries[k])} <span style={{ color: "var(--ink-faint)" }}>→</span> <strong style={{ fontWeight: 600 }}>{crewDayText(m.days[k])}</strong>
                </span>
                <button onClick={() => matchCrew(k)} style={{ ...linkBtn(12.5), whiteSpace: "nowrap" }}>Match crew</button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--accent)" }}>{totalLabel(t)}</div>
        <div style={{ fontSize: "clamp(24px, 7.6vw, 30px)", fontWeight: 700, letterSpacing: "-0.02em", marginTop: 4 }}>
          <AnimatedNumber value={t.grand} format={fmt} from={0} durationMs={700} />
        </div>
        {t.grand > 0 && <div style={{ marginTop: 12 }}><SplitBar totals={t} /></div>}
        <div style={{ marginTop: 12 }}>
          <Row label={`SP1 · ${t.cal.pm3} × 3PM`} value={fmt(t.sp1)} />
          <Row label={`SP2 · ${t.cal.pm10} × 10PM`} value={fmt(t.sp2)} />
          <Row label="Meal" value={fmt(t.meal)} />
          <Row label={`Taxi · ${m.dist === "L" ? "Long" : "Short"}`} value={fmt(t.taxi)} />
          <Sub label="Allowances" value={fmt(t.allowanceSubtotal)} />
          {t.baseSubtotal > 0 && (
            <>
              <Row label="Monthly basic + compulsory" value={fmt(t.baseSubtotal)} />
              <Row label={`Holiday ×2 · ${fmtH0(t.holidayHours)}h`} value={fmt(t.holidayPay)} />
              <Row label={`Overtime ×1.5 · ${fmtH0(t.otHours)}h`} value={fmt(t.overtimePay)} />
            </>
          )}
          <Row label="Total hours" value={`${fmtH0(t.totalHours)}h`} faint />
          {net != null && <Sub label="Estimated net" value={fmt(net)} />}
        </div>
        <DutySummary totals={t} style={{ marginTop: 10 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginTop: 14 }}>
          <button onClick={copySummary} style={ghostBtn()}>Copy summary</button>
          <button onClick={onRemove} style={{ ...ghostBtn(), color: "var(--holiday)" }}>Remove from crew</button>
        </div>
      </Card>
    </main>
  );
}

/* A day's shifts in a few characters: "3PM", "7AM VL", or "Off". */
function crewDayText(e) {
  if (!hasShifts(e)) return "Off";
  return SHIFTS.filter((s) => e[s.k]).map((s) => {
    const d = shiftDuty(e, s.k);
    return s.label + (d ? ` ${DUTY_TYPES[d].code}` : "");
  }).join(" + ");
}

/* Fill the crew's period with the rotation: the same picker as Home. */
function CrewFillModal({ period, anchor, onApply, onClose }) {
  const dismiss = useModalDismiss(onClose);
  const [key, setKey] = useStateW(() => am7InPeriod(period, anchor) || ymd(period.start));
  return (
    <ModalFrame dismiss={dismiss} label="Fill the crew rotation">
      <ModalHead title="Fill the crew rotation" onClose={dismiss.close} />
      <RotationPicker period={period} value={key} onChange={setKey} />
      <div style={{ fontSize: 12.5, color: "var(--ink-dim)", marginTop: 10, lineHeight: 1.45 }}>
        Replaces the crew's shifts for this period. Each person's own changes are kept.
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
        <button onClick={dismiss.close} style={ghostBtn()}>Cancel</button>
        <button onClick={() => { onApply(key); dismiss.close(); }} style={accentBtn()}>Fill rotation</button>
      </div>
    </ModalFrame>
  );
}

Object.assign(window, { CrewView });
