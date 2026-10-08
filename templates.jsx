/* templates.jsx — save/apply/manage day-of-week templates */
const { useState: useStateT } = React;

const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function TemplatesModal({ templates, onSave, onDelete, onApply, currentEntries, period, onClose }) {
  const dismiss = useModalDismiss(onClose);
  const { close } = dismiss;
  const [mode, setMode] = useStateT("apply"); // apply | save
  const [selected, setSelected] = useStateT(templates[0]?.id || null);
  const [newName, setNewName] = useStateT("");
  const [preserve, setPreserve] = useStateT(true);

  // Deleting the chosen template falls back to the first one left.
  const selectedTpl = templates.find((t) => t.id === selected) || templates[0] || null;
  const [isLeaving, removeTpl] = useFoldAway(onDelete);

  const saveCurrent = () => {
    const dows = extractTemplateFromWeek(currentEntries, period);
    if (Object.keys(dows).length === 0) {
      showToast("Add some shifts to the calendar first, then save them as a template");
      return;
    }
    const tpl = {
      id: "tpl-" + Date.now().toString(36),
      name: newName.trim() || `Template · ${new Date().toLocaleDateString()}`,
      days: dows,
      createdAt: new Date().toISOString(),
    };
    onSave(tpl);
    setSelected(tpl.id);
    setNewName("");
    setMode("apply");
  };

  return (
    <ModalFrame dismiss={dismiss} label="Templates">
        <ModalHead eyebrow="Templates" title="Weekly patterns" onClose={close} />

        <div style={{ marginBottom: 14 }}>
          <SegToggle
            options={[{ v: "apply", l: "Apply" }, { v: "save", l: "Save current week" }]}
            value={mode}
            onChange={setMode}
          />
        </div>

        {mode === "apply" ? (
          <>
            {templates.length === 0 ? (
              <div style={{
                padding: "28px 16px", textAlign: "center",
                border: "1px dashed var(--line)", borderRadius: 12,
                color: "var(--ink-dim)",
              }}>
                <svg aria-hidden width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
                  <rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/>
                </svg>
                <div style={{ fontSize: 14, color: "var(--ink)", marginBottom: 6 }}>No templates saved yet</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-faint)", lineHeight: 1.5, maxWidth: 320, margin: "0 auto 14px" }}>
                  Fill in a typical week on the calendar, then save it here to reuse in any period.
                </div>
                <button onClick={() => setMode("save")} style={primaryBtn()}>Save current week</button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", marginBottom: 4 }}>
                  {templates.map((t, i) => (
                    <AnimatedRow key={t.id} index={i} leaving={isLeaving(t.id)}>
                      <TemplateRow t={t} active={t.id === selectedTpl?.id} onSelect={() => setSelected(t.id)} onDelete={() => removeTpl(t.id)} />
                    </AnimatedRow>
                  ))}
                </div>

                {selectedTpl && (
                  <>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "4px 0", marginTop: 6 }}>
                      <input type="checkbox" checked={preserve} onChange={(e) => setPreserve(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
                      <span style={{ fontSize: 13.5 }}>Keep days that already have shifts</span>
                    </label>
                    <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
                      <button onClick={close} style={ghostBtn()}>Cancel</button>
                      <button onClick={() => { onApply(selectedTpl, { preserve }); showToast(`Applied ${selectedTpl.name}`); close(); }} style={accentBtn()}>
                        Apply to this period
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <div className="label" style={{ marginBottom: 6 }}>Preview (Sun → Sat from this period)</div>
            <TemplatePreview dows={extractTemplateFromWeek(currentEntries, period)} />
            <div className="label" style={{ margin: "14px 0 6px" }}>Name</div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Standard rotation"
              style={{
                width: "100%", background: "var(--bg-2)", border: "1px solid var(--line)",
                borderRadius: 10, padding: "10px 12px", color: "var(--ink)", fontSize: 16,
                fontFamily: "inherit",
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
              <button onClick={close} style={ghostBtn()}>Cancel</button>
              <button onClick={saveCurrent} style={accentBtn()}>Save template</button>
            </div>
          </>
        )}
    </ModalFrame>
  );
}

function TemplateRow({ t, active, onSelect, onDelete }) {
  return (
    <div onClick={onSelect} role="radio" aria-checked={active} tabIndex={0}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelect(); } }}
      style={{
      padding: "12px 12px",
      border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
      borderRadius: 12,
      background: active ? "var(--bg-2)" : "transparent",
      cursor: "pointer",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{
          width: 16, height: 16, borderRadius: "50%",
          border: `2px solid ${active ? "var(--ink)" : "var(--line)"}`,
          background: active ? "var(--ink)" : "transparent",
          position: "relative",
        }}>
          {active && <span style={{ position: "absolute", inset: 3, borderRadius: "50%", background: "var(--bg-1)" }} />}
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{t.name}</span>
        <button onClick={async (e) => {
          e.stopPropagation();
          if (await askConfirm({ title: `Delete "${t.name}"?`, body: "Shifts already on your calendar aren't affected.", confirmLabel: "Delete", danger: true })) onDelete();
        }}
          style={{ ...iconBtn(), width: 36, height: 36, fontSize: 13 }}
          aria-label="Delete template">✕</button>
      </div>
      <TemplatePreview dows={t.days} small />
    </div>
  );
}

function TemplatePreview({ dows, small }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
      {[0,1,2,3,4,5,6].map((dow) => {
        const t = dows[dow];
        const has = t && (t.am7 || t.pm3 || t.pm10);
        return (
          <div key={dow} style={{
            padding: small ? 4 : 6,
            background: has ? "var(--bg-2)" : "transparent",
            border: `1px solid ${has ? "var(--line)" : "var(--line-soft)"}`,
            borderRadius: 6,
            display: "flex", flexDirection: "column", gap: 2,
            minHeight: small ? 40 : 50,
          }}>
            <div className="mono" style={{ fontSize: small ? 9 : 10, color: "var(--ink-faint)", textAlign: "center" }}>{DAY_NAMES[dow]}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, justifyContent: "flex-end" }}>
              {t?.am7 && <div style={{ height: 4, background: "var(--am)", borderRadius: 2 }} />}
              {t?.pm3 && <div style={{ height: 4, background: "var(--sp1)", borderRadius: 2 }} />}
              {t?.pm10 && <div style={{ height: 4, background: "var(--sp2)", borderRadius: 2 }} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, { TemplatesModal });
