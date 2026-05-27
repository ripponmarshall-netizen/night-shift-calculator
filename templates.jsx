/* templates.jsx — save/apply/manage day-of-week templates */
const { useState: useStateT, useMemo: useMemoT } = React;

const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function TemplatesModal({ templates, onSave, onDelete, onApply, currentEntries, period, onClose }) {
  const { ref: dialogRef, closing, close } = useModalDismiss(onClose);
  const [mode, setMode] = useStateT("apply"); // apply | save
  const [selected, setSelected] = useStateT(templates[0]?.id || null);
  const [newName, setNewName] = useStateT("");
  const [preserve, setPreserve] = useStateT(true);

  const selectedTpl = templates.find((t) => t.id === selected);

  const saveCurrent = () => {
    const dows = extractTemplateFromWeek(currentEntries, period);
    if (Object.keys(dows).length === 0) {
      alert("Add some shifts to the calendar first, then save them as a template.");
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
    <div onClick={close} className={"nsc-backdrop" + (closing ? " is-closing" : "")} style={modalBackdrop}>
      <div ref={dialogRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className={"nsc-modal nsc-center" + (closing ? " is-closing" : "")} style={{
        ...modalCard, maxWidth: 520, maxHeight: "88vh", overflow: "auto", outline: "none",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Templates</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginTop: 2 }}>Weekly patterns</div>
          </div>
          <button onClick={close} style={iconBtn()}>✕</button>
        </div>

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
                padding: "24px 16px", textAlign: "center",
                border: "1px dashed var(--line)", borderRadius: 12,
                color: "var(--ink-dim)",
              }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
                <div style={{ fontSize: 13, color: "var(--ink)", marginBottom: 4 }}>No templates saved yet</div>
                <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>Fill in a typical week, then come back here to save it as a reusable template.</div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {templates.map((t) => (
                    <TemplateRow key={t.id} t={t} active={t.id === selected} onSelect={() => setSelected(t.id)} onDelete={() => onDelete(t.id)} />
                  ))}
                </div>

                {selectedTpl && (
                  <>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "4px 0", marginTop: 6 }}>
                      <input type="checkbox" checked={preserve} onChange={(e) => setPreserve(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
                      <span style={{ fontSize: 13.5 }}>Preserve days that already have shifts</span>
                    </label>
                    <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
                      <button onClick={close} style={ghostBtn()}>Cancel</button>
                      <button onClick={() => { onApply(selectedTpl, { preserve }); onClose(); }} style={accentBtn()}>
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
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Preview (Sun → Sat from this period)</div>
            <TemplatePreview dows={extractTemplateFromWeek(currentEntries, period)} />
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "14px 0 6px" }}>Name</div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Standard rotation"
              style={{
                width: "100%", background: "var(--bg-2)", border: "1px solid var(--line)",
                borderRadius: 10, padding: "10px 12px", color: "var(--ink)", fontSize: 14,
                outline: "none", fontFamily: "inherit",
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
              <button onClick={close} style={ghostBtn()}>Cancel</button>
              <button onClick={saveCurrent} style={accentBtn()}>Save template</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TemplateRow({ t, active, onSelect, onDelete }) {
  return (
    <div onClick={onSelect} style={{
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
        <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete template "${t.name}"?`)) onDelete(); }}
          style={{ ...iconBtn(), width: 28, height: 28, fontSize: 13 }}
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

const modalBackdrop = {
  position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.55)",
  backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
};
const modalCard = {
  width: "100%",
  background: "var(--bg-1)", border: "1px solid var(--line)",
  borderRadius: 18, padding: 18,
};

Object.assign(window, { TemplatesModal, DAY_NAMES });
