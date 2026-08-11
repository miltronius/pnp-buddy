import { useState, useEffect } from "react";
import type { DnDCharacter, DnDFeature, OriginType } from "../../types/dnd";
import { SOURCE_COLOR } from "../../lib/dndGame";
import { useT, useGameLabels } from "../../i18n";

const ALL_SOURCES: OriginType[] = ['SPECIES', 'CLASS', 'SUBCLASS', 'FEAT', 'BACKGROUND', 'UNIVERSAL'];
const EMPTY: Omit<DnDFeature, 'id'> = { name: '', description: '', origin: 'CLASS' };

interface Props {
  char: DnDCharacter;
  addFeature: (m: Omit<DnDFeature, 'id'>) => void;
  updateFeature: (m: DnDFeature) => void;
  removeFeature: (id: string) => void;
}

export function DnDFeatures({ char, addFeature, updateFeature, removeFeature }: Props) {
  const t = useT();
  const { SOURCE_LABEL } = useGameLabels();
  const [filter, setFilter] = useState<OriginType | 'ALL'>('ALL');
  const [formData, setFormData] = useState<Omit<DnDFeature, 'id'>>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(char.features.map(m => m.id)));

  useEffect(() => {
    setExpanded(prev => {
      const newIds = char.features.map(m => m.id).filter(id => !prev.has(id));
      if (newIds.length === 0) return prev;
      return new Set([...prev, ...newIds]);
    });
  }, [char.features]);

  function openNew() { setEditId(null); setFormData(EMPTY); setFormOpen(true); }

  function openEdit(m: DnDFeature) {
    setEditId(m.id);
    setFormData({ name: m.name, description: m.description, origin: m.origin });
    setFormOpen(true);
  }

  function save() {
    if (!formData.name.trim()) return;
    if (editId) { updateFeature({ ...formData, id: editId }); }
    else { addFeature(formData); }
    setFormOpen(false); setFormData(EMPTY); setEditId(null);
  }

  function cancel() { setFormOpen(false); setFormData(EMPTY); setEditId(null); }

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const visible = char.features.filter(m => filter === 'ALL' || m.origin === filter);

  return (
    <div className="sheet" style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="dnd-section-header">
        <h2 className="sheet-title" style={{ margin: 0 }}>{t.features_title}</h2>
        <button className="gla-btn" onClick={openNew}>{t.features_add}</button>
      </div>

      <div className="dnd-filter-leiste">
        <button className={`dnd-filter-btn ${filter === 'ALL' ? 'active' : ''}`}
          onClick={() => setFilter('ALL')}>{t.all}</button>
        {ALL_SOURCES.map(h => (
          <button key={h}
            className={`dnd-filter-btn ${filter === h ? 'active' : ''}`}
            style={filter === h ? { background: SOURCE_COLOR[h], borderColor: SOURCE_COLOR[h], color: '#fff' } : {}}
            onClick={() => setFilter(filter === h ? 'ALL' : h)}>
            {SOURCE_LABEL[h]}
          </button>
        ))}
      </div>

      <div className="rule" />

      {formOpen && (
        <div className="dnd-form-box">
          <div className="grid-2">
            <div>
              <div className="field-label">{t.name}</div>
              <input className="gla-input" value={formData.name} autoFocus
                onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && save()} />
            </div>
            <div>
              <div className="field-label">{t.origin}</div>
              <select className="gla-input" value={formData.origin}
                onChange={e => setFormData(f => ({ ...f, origin: e.target.value as OriginType }))}>
                {ALL_SOURCES.map(h => (
                  <option key={h} value={h}>{SOURCE_LABEL[h]}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div className="field-label">{t.description}</div>
            <textarea className="gla-textarea" value={formData.description} rows={3}
              onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="dnd-form-actions">
            <button className="gla-btn primary" onClick={save}>{t.save}</button>
            <button className="gla-btn" onClick={cancel}>{t.cancel}</button>
          </div>
        </div>
      )}

      {visible.length === 0 && (
        <p className="dnd-leer-hinweis">{t.features_none}</p>
      )}
      <div className="dnd-merkmal-liste">
        {visible.map(m => {
          const open = expanded.has(m.id);
          return (
            <div key={m.id} className="dnd-merkmal-item">
              <div className="dnd-merkmal-header">
                <span className="dnd-herkunft-badge" style={{ background: SOURCE_COLOR[m.origin] }}>
                  {SOURCE_LABEL[m.origin]}
                </span>
                <button className="dnd-merkmal-name-btn" onClick={() => toggleExpanded(m.id)}>
                  <strong>{m.name}</strong>
                  {m.description && <span className="dnd-merkmal-pfeil">{open ? '▲' : '▼'}</span>}
                </button>
                <div className="dnd-merkmal-aktionen">
                  <button className="dnd-icon-btn" onClick={() => openEdit(m)}>✎</button>
                  <button className="dnd-icon-btn danger" onClick={() => removeFeature(m.id)}>✕</button>
                </div>
              </div>
              {open && m.description && (
                <div className="dnd-merkmal-text">{m.description}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
