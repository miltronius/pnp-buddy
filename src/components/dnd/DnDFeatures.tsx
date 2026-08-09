import { useState } from "react";
import type { DnDCharakter, DnDMerkmal, HerkunftArt } from "../../types/dnd";
import { SOURCE_COLOR, SOURCE_LABEL } from "../../lib/dndGame";

const ALL_SOURCES: HerkunftArt[] = ['SPECIES', 'CLASS', 'SUBCLASS', 'FEAT', 'BACKGROUND', 'UNIVERSAL'];

const EMPTY: Omit<DnDMerkmal, 'id'> = { name: '', beschreibung: '', herkunft: 'CLASS' };

interface Props {
  char: DnDCharakter;
  merkmalHinzu: (m: Omit<DnDMerkmal, 'id'>) => void;
  merkmalAktuell: (m: DnDMerkmal) => void;
  merkmalLoeschen: (id: string) => void;
}

export function DnDFeatures({ char, merkmalHinzu, merkmalAktuell, merkmalLoeschen }: Props) {
  const [filter, setFilter] = useState<HerkunftArt | 'ALL'>('ALL');
  const [formData, setFormData] = useState<Omit<DnDMerkmal, 'id'>>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function openNew() {
    setEditId(null);
    setFormData(EMPTY);
    setFormOpen(true);
  }

  function openEdit(m: DnDMerkmal) {
    setEditId(m.id);
    setFormData({ name: m.name, beschreibung: m.beschreibung, herkunft: m.herkunft });
    setFormOpen(true);
  }

  function save() {
    if (!formData.name.trim()) return;
    if (editId) {
      merkmalAktuell({ ...formData, id: editId });
    } else {
      merkmalHinzu(formData);
    }
    setFormOpen(false);
    setFormData(EMPTY);
    setEditId(null);
  }

  function cancel() {
    setFormOpen(false);
    setFormData(EMPTY);
    setEditId(null);
  }

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const visible = char.merkmale.filter(m => filter === 'ALL' || m.herkunft === filter);

  return (
    <div className="sheet" style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="dnd-section-header">
        <h2 className="sheet-title" style={{ margin: 0 }}>Merkmale &amp; Features</h2>
        <button className="gla-btn" onClick={openNew}>+ Hinzufügen</button>
      </div>

      {/* Herkunfts-Filter */}
      <div className="dnd-filter-leiste">
        <button className={`dnd-filter-btn ${filter === 'ALL' ? 'active' : ''}`}
          onClick={() => setFilter('ALL')}>Alle</button>
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

      {/* Formular */}
      {formOpen && (
        <div className="dnd-form-box">
          <div className="grid-2">
            <div>
              <div className="field-label">Name</div>
              <input className="gla-input" value={formData.name} autoFocus
                onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && save()} />
            </div>
            <div>
              <div className="field-label">Herkunft</div>
              <select className="gla-input" value={formData.herkunft}
                onChange={e => setFormData(f => ({ ...f, herkunft: e.target.value as HerkunftArt }))}>
                {ALL_SOURCES.map(h => (
                  <option key={h} value={h}>{SOURCE_LABEL[h]}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div className="field-label">Beschreibung</div>
            <textarea className="gla-textarea" value={formData.beschreibung} rows={3}
              onChange={e => setFormData(f => ({ ...f, beschreibung: e.target.value }))} />
          </div>
          <div className="dnd-form-actions">
            <button className="gla-btn primary" onClick={save}>Speichern</button>
            <button className="gla-btn" onClick={cancel}>Abbrechen</button>
          </div>
        </div>
      )}

      {/* Liste */}
      {visible.length === 0 && (
        <p className="dnd-leer-hinweis">
          Noch keine Merkmale — füge Klassen-, Spezies- und Talentmerkmale hinzu.
        </p>
      )}
      <div className="dnd-merkmal-liste">
        {visible.map(m => {
          const open = expanded.has(m.id);
          return (
            <div key={m.id} className="dnd-merkmal-item">
              <div className="dnd-merkmal-header">
                <span className="dnd-herkunft-badge"
                  style={{ background: SOURCE_COLOR[m.herkunft] }}>
                  {SOURCE_LABEL[m.herkunft]}
                </span>
                <button className="dnd-merkmal-name-btn" onClick={() => toggleExpanded(m.id)}>
                  <strong>{m.name}</strong>
                  {m.beschreibung && <span className="dnd-merkmal-pfeil">{open ? '▲' : '▼'}</span>}
                </button>
                <div className="dnd-merkmal-aktionen">
                  <button className="dnd-icon-btn" onClick={() => openEdit(m)}>✎</button>
                  <button className="dnd-icon-btn danger" onClick={() => merkmalLoeschen(m.id)}>✕</button>
                </div>
              </div>
              {open && m.beschreibung && (
                <div className="dnd-merkmal-text">{m.beschreibung}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
